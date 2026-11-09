#!/usr/bin/env python3
"""G.I.B. CONNECT — relances sondages J+4, J+7 puis quotidiennes.
Configuration requise: GOOGLE_APPLICATION_CREDENTIALS (via GitHub auth), GIB_SENDER_UID,
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM.
"""
import os, smtplib, ssl
from datetime import datetime, timezone, timedelta
from email.message import EmailMessage
from zoneinfo import ZoneInfo
from google.cloud import firestore

DB=firestore.Client()
TZ=ZoneInfo('Europe/Paris')
NOW=datetime.now(TZ)
DAY=NOW.date()
SENDER=os.environ.get('GIB_SENDER_UID','').strip()
SMTP_KEYS=('SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASSWORD','SMTP_FROM')

def day_of(value):
    if hasattr(value,'date'):return value.astimezone(TZ).date() if value.tzinfo else value.date()
    if isinstance(value,str):
        try:return datetime.fromisoformat(value.replace('Z','+00:00')).astimezone(TZ).date()
        except ValueError:return None
    return None

def eligible(days):return days==4 or days>=7

def active(p):
    if p.get('archived') or p.get('excluded') or p.get('disabled'):return False
    if p.get('enabled') is False:return False
    return True

def email_send(to,subject,body):
    missing=[x for x in SMTP_KEYS if not os.environ.get(x)]
    if missing:raise RuntimeError('Configuration SMTP manquante: '+', '.join(missing))
    msg=EmailMessage();msg['From']=os.environ['SMTP_FROM'];msg['To']=to;msg['Subject']=subject;msg.set_content(body)
    with smtplib.SMTP(os.environ['SMTP_HOST'],int(os.environ['SMTP_PORT']),timeout=20) as server:
        server.starttls(context=ssl.create_default_context());server.login(os.environ['SMTP_USER'],os.environ['SMTP_PASSWORD']);server.send_message(msg)

def main():
    if not SENDER:raise RuntimeError('Secret GIB_SENDER_UID manquant: UID d’un compte administrateur existant.')
    profiles={s.id:s.to_dict() or {} for s in DB.collection('profiles').stream()}
    archived={s.id for s in DB.collection('archivedMembers').stream() if (s.to_dict() or {}).get('archived')}
    polls=list(DB.collection('polls').stream())
    total=0
    for snap in polls:
        poll=snap.to_dict() or {}
        published=day_of(poll.get('createdAt'))
        if not published:continue
        days=(DAY-published).days
        if not eligible(days):continue
        if poll.get('closed') is True or poll.get('isClosed') is True or poll.get('status') in ('closed','archived','cancelled','canceled'):continue
        end=day_of(poll.get('endsAt') or poll.get('deadline') or poll.get('closesAt'))
        if end and DAY>end:continue
        voted={v.id for v in snap.reference.collection('votes').stream() if (v.to_dict() or {}).get('choices')}
        for uid,profile in profiles.items():
            if uid==SENDER or uid in archived or not active(profile) or uid in voted:continue
            # Comptes ayant accès aux sondages seulement.
            access=DB.collection('access').document(uid).get()
            if access.exists and not active(access.to_dict() or {}):continue
            label=(profile.get('nickname') or 'membre').strip()
            subject='G.I.B. CONNECT — Rappel de réponse à un sondage'
            ordinal='premier rappel' if days==4 else 'deuxième rappel' if days==7 else 'rappel quotidien'
            body=f'Bonjour {label},\n\nCeci est votre {ordinal} : vous n’avez pas encore répondu au sondage « {poll.get("question","Sondage")} ».\nMerci de répondre dans G.I.B. CONNECT.\n\nAssociation G.I.B.'
            marker=DB.collection('pollReminderDispatch').document(f'{snap.id}_{uid}_{DAY.isoformat()}')
            prior=marker.get().to_dict() or {}
            if prior.get('complete'):continue
            if not prior.get('mpSent'):
                ids=sorted([SENDER,uid]);conversation_id='private-'+'_'.join(ids)
                conv=DB.collection('conversations').document(conversation_id)
                if not conv.get().exists:conv.set({'type':'private','participants':ids,'name':'G.I.B. — Rappels','createdAt':firestore.SERVER_TIMESTAMP})
                msgid=f'poll-reminder-{snap.id}-{DAY.isoformat()}'
                conv.collection('messages').document(msgid).set({'authorId':SENDER,'text':body,'createdAt':firestore.SERVER_TIMESTAMP})
                marker.set({'mpSent':True,'pollId':snap.id,'uid':uid,'date':DAY.isoformat()},merge=True)
            if not prior.get('emailSent'):
                address=(profile.get('email') or '').strip()
                if not address:
                    print('E-mail absent pour',uid,'— MP envoyé, e-mail en attente')
                    continue
                email_send(address,subject,body)
                marker.set({'emailSent':True},merge=True)
            marker.set({'complete':True},merge=True)
            total+=1
    print('Relances terminées:',total)
if __name__=='__main__':main()
