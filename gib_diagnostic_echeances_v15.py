#!/usr/bin/env python3
"""Audit en lecture seule des données HelloAsso nécessaires aux relances automatiques."""
from collections import Counter
from google.cloud import firestore

db=firestore.Client(project='gib-connect')
collections=('memberships','helloassoMemberStatus','helloassoPayments','helloassoItems')
for name in collections:
    docs=list(db.collection(name).stream())
    print(f'{name}: {len(docs)} documents')
    if name=='memberships':
        print('  périodes:',dict(Counter(str((d.to_dict() or {}).get('period','absent')) for d in docs)))
        print('  dates de fin absentes:',sum(not (d.to_dict() or {}).get('end') for d in docs))
        print('  exemptions:',sum(str((d.to_dict() or {}).get('method','')).lower()=='exempt' for d in docs))
    if name=='helloassoPayments':
        print('  états:',dict(Counter(str((d.to_dict() or {}).get('state','absent')) for d in docs)))
        print('  numéros échéance absents:',sum((d.to_dict() or {}).get('installmentNumber') is None for d in docs))
        print('  dates paiement absentes:',sum(not (d.to_dict() or {}).get('paymentDate') for d in docs))
        print('  rapprochements non vérifiés:',sum((d.to_dict() or {}).get('memberAllocationVerified') is not True for d in docs))
    if name=='helloassoMemberStatus':
        print('  rapprochements de période à vérifier:',sum((d.to_dict() or {}).get('paymentValidation')!='Valide' for d in docs))
print('DIAGNOSTIC UNIQUEMENT : aucun e-mail, aucune modification Firebase, aucune restriction.')
