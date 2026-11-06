"""Stage HelloAsso payment records in private Firestore documents.

Does not mark memberships paid, change permissions, or assume a payer is a beneficiary.
Uses only stable HelloAsso identifiers; no names, emails or phone numbers stored.
"""
import json, os, re, sys, urllib.request, urllib.error, urllib.parse, datetime

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

# Associations déjà vérifiées par le responsable dans Firebase / HelloAsso.
KNOWN={
 '215867858':'ZrI6KdIsuRatDqv0cY2AKF5z16n2',
 '215994834':'a7lSvPBvb2Roz7SS46tuP4TBbnt2',
}

def beneficiary_email(item):
    # Exclusivement l'adresse du bénéficiaire, jamais celle du payeur de la commande.
    user=item.get('user') or {}
    return (user.get('email') or '').strip().lower() if isinstance(user,dict) else ''

def main():
    orders=[json.loads(line) for line in open(sys.argv[1],encoding='utf-8') if line.strip()]
    count=0
    by_email=profiles()
    mapped={}
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
                    e=beneficiary_email(item)
                    candidates=by_email.get(e,set()) if e else set()
                    if len(candidates)==1:
                        assigned=next(iter(candidates));verified=True
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
    print('Correspondances connues trouvées : '+str(sum(1 for links in mapped.values() for link in links if link['itemId'] in KNOWN))+'.')
    print(f'Import Firestore terminé : {len(orders)} commandes, {count} articles, '+str(sum(len(o.get('payments') or []) for o in orders))+' paiements.')
    print('Aucune adhésion validée automatiquement. Aucune restriction appliquée.')

if __name__=='__main__':
    try: main()
    except (ValueError,KeyError,urllib.error.HTTPError,urllib.error.URLError) as exc:
        print('Erreur de synchronisation individuelle (détails confidentiels masqués).',file=sys.stderr)
        sys.exit(1)
