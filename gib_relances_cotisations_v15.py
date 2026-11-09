#!/usr/bin/env python3
"""V15: vérification J+15. Mode simulation par défaut. Aucun blocage automatique."""
import os, ssl, smtplib
from datetime import datetime
from email.message import EmailMessage
from zoneinfo import ZoneInfo
from google.cloud import firestore

DB=firestore.Client(project='gib-connect')
TODAY=datetime.now(ZoneInfo('Europe/Paris')).date()
ADMIN_EMAIL='g.i.b.airsoft.vire@gmail.com'
CONFIRMED=('Authorized','Captured','Paid','Succeeded')

def email(to,subject,body):
    keys=['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASSWORD','SMTP_FROM']
    missing=[k for k in keys if not os.environ.get(k)]
    if missing: raise RuntimeError('SMTP manquant : '+', '.join(missing))
    msg=EmailMessage();msg['From']=os.environ['SMTP_FROM'];msg['To']=to
    msg['Subject']=subject;msg.set_content(body)
    with smtplib.SMTP(os.environ['SMTP_HOST'],int(os.environ['SMTP_PORT']),timeout=20) as s:
        s.starttls(context=ssl.create_default_context());s.login(os.environ['SMTP_USER'],os.environ['SMTP_PASSWORD']);s.send_message(msg)

def main():
    dry=os.environ.get('GIB_COTISATIONS_SEND','false').lower()!='true'
    count=0;skipped=0
    for snap in DB.collection('memberships').stream():
        m=snap.to_dict() or {};uid=snap.id
        if m.get('method')=='exempt' or not m.get('end'):continue
        try: days=(TODAY-datetime.strptime(m['end'],'%Y-%m-%d').date()).days
        except (ValueError,TypeError):continue
        if days<15:continue
        access=DB.collection('access').document(uid).get().to_dict() or {}
        if access.get('role') in ('owner','admin','moderator') or access.get('enabled') is False:continue
        if (DB.collection('archivedMembers').document(uid).get().to_dict() or {}).get('archived'):continue
        import json
        hello=DB.collection('helloassoMemberStatus').document(uid).get().to_dict() or {}
        try: states=json.loads(hello.get('paymentStatesJson') or '{}')
        except (ValueError,TypeError):states={}
        if any(int(states.get(s) or 0)>0 for s in CONFIRMED):skipped+=1;continue
        # Confirmation administrative explicite obligatoire : une date expirée n'est pas une preuve d'impayé.
        if m.get('unpaidConfirmed') is not True:skipped+=1;continue
        profile=DB.collection('profiles').document(uid).get().to_dict() or {}
        addr=str(profile.get('email') or '').strip()
        label=profile.get('nickname') or uid
        key=uid+'_'+m['end']
        marker=DB.collection('membershipReminderDispatch').document(key)
        state=marker.get().to_dict() or {}
        if dry:
            print('SIMULATION J+15 :',uid,'retard=',days,'destinataire=',bool(addr),'admin=',ADMIN_EMAIL)
            count+=1;continue
        if addr and not state.get('memberSent'):
            email(addr,'G.I.B. CONNECT — Cotisation à régulariser',f'Bonjour {label},\n\nTa cotisation a expiré le {m["end"]}. Merci de contacter les responsables de G.I.B. pour régulariser ta situation.\n\nAssociation G.I.B.')
            marker.set({'memberSent':True,'end':m['end']},merge=True)
        if not state.get('adminSent'):
            email(ADMIN_EMAIL,'G.I.B. CONNECT — Alerte cotisation J+15',f'Membre : {label}\nFin de cotisation : {m["end"]}\nRetard : {days} jours\nMontant déclaré : {m.get("amount","non renseigné")} €\nImpayé confirmé manuellement.')
            marker.set({'adminSent':True,'end':m['end']},merge=True)
        count+=1
    print('Mode :', 'SIMULATION' if dry else 'ENVOI','; dossiers candidats :',count,'; non confirmés / protégés :',skipped)
    print('Aucune restriction automatique appliquée.')
if __name__=='__main__':main()
