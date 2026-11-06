"""Stage HelloAsso payment records in private Firestore documents.

Does not mark memberships paid, change permissions, or assume a payer is a beneficiary.
Uses only stable HelloAsso identifiers; no names, emails or phone numbers stored.
"""
import json, os, re, sys, urllib.request, urllib.error, datetime

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

def main():
    orders=[json.loads(line) for line in open(sys.argv[1],encoding='utf-8') if line.strip()]
    count=0
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
            write('helloassoItems/'+iid,{
                'itemId':iid,'orderId':oid,'itemState':item.get('state') or 'Unknown',
                'itemType':item.get('type') or 'Unknown','lastSync':now,
                'firebaseUid':'','mappingVerified':False
            })
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
    print(f'Import Firestore terminé : {len(orders)} commandes, {count} articles, '+str(sum(len(o.get('payments') or []) for o in orders))+' paiements.')
    print('Aucune adhésion validée automatiquement. Aucune restriction appliquée.')

if __name__=='__main__':
    try: main()
    except (ValueError,KeyError,urllib.error.HTTPError,urllib.error.URLError) as exc:
        print('Erreur de synchronisation individuelle (détails confidentiels masqués).',file=sys.stderr)
        sys.exit(1)
