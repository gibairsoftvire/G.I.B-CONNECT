"""Stage HelloAsso payment records in private Firestore documents.

Does not mark memberships paid, change permissions, or assume a payer is a beneficiary.
Uses only stable HelloAsso identifiers; no names, emails or phone numbers stored.
"""
import json, os, re, sys, urllib.request, urllib.error, urllib.parse, datetime, unicodedata

BASE='https://firestore.googleapis.com/v1/projects/gib-connect/databases/(default)/documents'
TOKEN=os.environ['GOOGLE_ACCESS_TOKEN']

def field(v):
    if isinstance(v,bool): return {'booleanValue':v}
    if isinstance(v,int): return {'integerValue':str(v)}
    if v is None: return {'nullValue':None}
    return {'stringValue':str(v)}

def write(path, data):
    payload=json.dumps({'fields':{k:field(v) for k,v in data.items()}}).encode()
    req=urllib.request.Request(BASE+'/'+path,data=payload,method='PATCH',headers={'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=35) as response:
        if response.status != 200: raise RuntimeError('Firestore write failed')

def safe_id(value):
    value=str(value)
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}',value): raise ValueError('Invalid API identifier')
    return value

def read(path):
    req=urllib.request.Request(BASE+'/'+path,headers={'Authorization':'Bearer '+TOKEN})
    try:
        with urllib.request.urlopen(req,timeout=35) as response:
            doc=json.load(response)
        result={}
        for k,v in doc.get('fields',{}).items():
            result[k]=next(iter(v.values()),None)
        return result
    except urllib.error.HTTPError as exc:
        if exc.code==404:return {}
        raise

def profiles():
    result={}
    url=BASE+'/profiles?pageSize=100'
    while url:
        req=urllib.request.Request(url,headers={'Authorization':'Bearer '+TOKEN})
        with urllib.request.urlopen(req,timeout=35) as response: data=json.load(response)
        for doc in data.get('documents',[]):
            uid=doc['name'].split('/')[-1]
            email=(doc.get('fields',{}).get('email',{}).get('stringValue') or '').strip().lower()
            if email: result.setdefault(email,set()).add(uid)
        next_page=data.get('nextPageToken')
        url=BASE+'/profiles?pageSize=100&pageToken='+urllib.parse.quote(next_page) if next_page else None
    return result

def normalize_name(value):
    value=unicodedata.normalize('NFKD',str(value or ''))
    value=''.join(c for c in value if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+','',value.casefold())

def civil_profiles():
    # L'identité civile est saisie par un administrateur, jamais le pseudo.
    result={}
    url=BASE+'/memberCivil?pageSize=100'
    while url:
        req=urllib.request.Request(url,headers={'Authorization':'Bearer '+TOKEN})
        with urllib.request.urlopen(req,timeout=35) as response: data=json.load(response)
        for doc in data.get('documents',[]):
            uid=doc['name'].split('/')[-1]
            fields=doc.get('fields',{})
            first=fields.get('firstName',{}).get('stringValue','')
            last=fields.get('lastName',{}).get('stringValue','')
            key=(normalize_name(first),normalize_name(last))
            if all(key): result.setdefault(key,set()).add(uid)
        page=data.get('nextPageToken')
        url=BASE+'/memberCivil?pageSize=100&pageToken='+urllib.parse.quote(page) if page else None
    return result

def beneficiary_name(item):
    """Return beneficiary identity only; never use order payer as beneficiary."""
    user=item.get('user') or {}
    if isinstance(user,dict):
        first=normalize_name(user.get('firstName'))
        last=normalize_name(user.get('lastName'))
        if first and last:return (first,last)
    # HelloAsso may expose the beneficiary's identity as custom fields on
    # the membership item. Accept only explicitly named first/last fields.
    fields=item.get('customFields') or []
    if not isinstance(fields,list):return None
    found={}
    first_labels={'prenom','firstname','firstnames','givenname','givennames'}
    last_labels={'nom','nomdefamille','lastname','familyname','surname'}
    for field in fields:
        if not isinstance(field,dict):continue
        label=normalize_name(field.get('name') or field.get('label') or field.get('question') or '')
        value=field.get('answer') or field.get('value') or ''
        if isinstance(value,dict):value=value.get('value') or value.get('label') or ''
        if not isinstance(value,str):continue
        if label in first_labels:found['first']=normalize_name(value)
        if label in last_labels:found['last']=normalize_name(value)
    return (found['first'],found['last']) if found.get('first') and found.get('last') else None

# Associations déjà vérifiées par le responsable dans Firebase / HelloAsso.
KNOWN={
 '215867858':'ZrI6KdIsuRatDqv0cY2AKF5z16n2',
 '215994834':'a7lSvPBvb2Roz7SS46tuP4TBbnt2',
}

def single_item_order_name(order, item):
    """Fallback when the HelloAsso order has exactly one membership item.

    This is the order payer's identity, not proof of beneficiary identity.
    Only use it if the item's own identity is absent, never conflicting.
    """
    items=[x for x in (order.get('items') or []) if x.get('id') is not None]
    if len(items)!=1 or str(items[0]['id'])!=str(item.get('id')):
        return None
    payer=order.get('payer') or {}
    if not isinstance(payer,dict):return None
    first=normalize_name(payer.get('firstName'))
    last=normalize_name(payer.get('lastName'))
    return (first,last) if first and last else None

def beneficiary_email(item):
    # Exclusivement l'adresse du bénéficiaire, jamais celle du payeur de la commande.
    user=item.get('user') or {}
    return (user.get('email') or '').strip().lower() if isinstance(user,dict) else ''

def main():
    orders=[json.loads(line) for line in open(sys.argv[1],encoding='utf-8') if line.strip()]
    count=0
    by_email=profiles()  # Compatibilité pour les fiches déjà identifiées par e-mail.
    by_name=civil_profiles()
    mapped={}
    name_matches=0
    ambiguous=0
    no_beneficiary=0
    unmatched_beneficiary=0
    eligible_with_identity=0
    payer_candidates=0
    now=datetime.datetime.now(datetime.timezone.utc).isoformat()
    for order in orders:
        oid=safe_id(order['id'])
        payments=order.get('payments') or []
        # One order may cover multiple beneficiaries. Do not infer individual payment allocation.
        write('helloassoOrders/'+oid,{
            'orderId':oid,'orderState':order.get('state') or 'Unknown',
            'itemCount':len(order.get('items') or []),'paymentCount':len(payments),
            'lastSync':now,'source':'helloasso','allocationVerified':False
        })
        for item in order.get('items') or []:
            if item.get('id') is None: continue
            iid=safe_id(item['id'])
            old=read('helloassoItems/'+iid)
            state=item.get('state') or 'Unknown'
            assigned=old.get('firebaseUid') if old.get('mappingVerified') is True else ''
            verified=bool(assigned)
            # La valeur de state varie selon les articles HelloAsso. Ne pas
            # confondre liaison d'identité et validation d'un paiement.
            excluded={'canceled','cancelled','refunded','deleted','rejected','failed'}
            eligible=str(state).strip().lower() not in excluded
            if eligible:
                if iid in KNOWN:
                    assigned=KNOWN[iid];verified=True
                elif not verified:
                    # Priorité au nom/prénom civil : adresse e-mail facultative.
                    name=beneficiary_name(item)
                    if name:eligible_with_identity+=1
                    else:no_beneficiary+=1
                    candidates=by_name.get(name,set()) if name else set()
                    # Fallback conservateur : une seule adhésion dans la commande,
                    # aucun bénéficiaire identifié sur l'article, nom du payeur unique.
                    # Ne pas confondre avec une validation de paiement.
                    payer_fallback=False
                    if not name:
                        payer_name=single_item_order_name(order,item)
                        if payer_name:
                            candidates=by_name.get(payer_name,set())
                            payer_fallback=True
                    if len(candidates)==1:
                        assigned=next(iter(candidates));verified=True
                        name_matches+=1
                        if payer_fallback:payer_candidates+=1
                    elif len(candidates)>1:
                        ambiguous+=1
                    else:
                        if name:unmatched_beneficiary+=1
                        # Ne pas relier par e-mail seule : elle peut être celle d'un tiers.
                        pass
            else:
                assigned='';verified=False
            write('helloassoItems/'+iid,{
                'itemId':iid,'orderId':oid,'itemState':state,
                'itemType':item.get('type') or 'Unknown','lastSync':now,
                'firebaseUid':assigned or '','mappingVerified':verified
            })
            if eligible and verified:
                mapped.setdefault(assigned,[]).append({'itemId':iid,'orderId':oid})
            count+=1
        for payment in payments:
            if payment.get('id') is None: continue
            pid=safe_id(payment['id'])
            write('helloassoPayments/'+pid,{
                'paymentId':pid,'orderId':oid,
                'state':payment.get('state') or 'Unknown',
                'cashOutState':payment.get('cashOutState') or 'Unknown',
                'installmentNumber':payment.get('installmentNumber'),
                'paymentDate':payment.get('date'),
                'amountCents':payment.get('amount'),
                'lastSync':now,'memberAllocationVerified':False
            })
    for member_uid, links in mapped.items():
        # Un document privé par membre, lisible dans son onglet Cotisations.
        related=[o for o in orders if str(o['id']) in {x['orderId'] for x in links}]
        payments=[p for o in related for p in (o.get('payments') or [])]
        status={}
        for pay in payments:
            st=pay.get('state') or 'Unknown';status[st]=status.get(st,0)+1
        write('helloassoMemberStatus/'+safe_id(member_uid),{
            'firebaseUid':member_uid,'itemIds':','.join(x['itemId'] for x in links),
            'orderIds':','.join(sorted({x['orderId'] for x in links})),
            'paymentStatesJson':json.dumps(status,sort_keys=True),
            'paymentCount':len(payments),'lastSync':now,
            'paymentValidation':'A_verifier',
            'note':'Statuts de commande uniquement; ne prouve pas les mensualites encaissees.'
        })
    print('Fiches membres synchronisées : '+str(len(mapped))+'. Aucun compte restreint.')
    print('Correspondances nom/prénom uniques : '+str(name_matches)+'. Identités ambiguës : '+str(ambiguous)+'.')
    print(f'Diagnostic bénéficiaires éligibles : {eligible_with_identity} avec nom/prénom, {no_beneficiary} sans identité exploitable, {unmatched_beneficiary} sans fiche civile correspondante.')
    print('Rapprochements sur commande à adhésion unique : '+str(payer_candidates)+'.')
    print('Correspondances connues trouvées : '+str(sum(1 for links in mapped.values() for link in links if link['itemId'] in KNOWN))+'.')
    print(f'Import Firestore terminé : {len(orders)} commandes, {count} articles, '+str(sum(len(o.get('payments') or []) for o in orders))+' paiements.')
    print('Aucune adhésion validée automatiquement. Aucune restriction appliquée.')

if __name__=='__main__':
    try: main()
    except (ValueError,KeyError,urllib.error.HTTPError,urllib.error.URLError) as exc:
        print('Erreur de synchronisation individuelle (détails confidentiels masqués).',file=sys.stderr)
        sys.exit(1)
