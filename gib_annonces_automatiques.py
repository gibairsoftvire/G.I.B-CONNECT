"""Annonces G.I.B. automatiques, idempotentes, heure civile de Paris."""
from datetime import datetime
from zoneinfo import ZoneInfo
import os
from google.cloud import firestore

PROJECT = os.getenv('GOOGLE_CLOUD_PROJECT', 'gib-connect')
db = firestore.Client(project=PROJECT)
today = datetime.now(ZoneInfo('Europe/Paris')).date()


def publish(doc_id, title, body):
    ref = db.collection('announcements').document(doc_id)
    @firestore.transactional
    def create_once(transaction):
        snapshot = ref.get(transaction=transaction)
        if snapshot.exists:
            return False
        transaction.set(ref, {'title': title, 'body': body, 'createdAt': firestore.SERVER_TIMESTAMP})
        return True
    if create_once(db.transaction()):
        print('Annonce créée :', doc_id)
    else:
        print('Annonce déjà publiée :', doc_id)


if (today.month, today.day) == (12, 25):
    publish(f'auto-noel-{today.year}', 'Joyeux Noël ! 🎄',
            'Toute l’association G.I.B. vous souhaite un joyeux Noël !')
if (today.month, today.day) == (1, 1):
    publish(f'auto-nouvel-an-{today.year}', 'Bonne année ! 🎉',
            'Toute l’association G.I.B. vous souhaite une excellente année !')

# Lire les dates de naissance en privé, sans les copier dans les annonces.
profiles = {doc.id: doc.to_dict() or {} for doc in db.collection('profiles').stream()}
archived = {doc.id for doc in db.collection('archivedMembers').stream()
            if (doc.to_dict() or {}).get('archived', True)}
access = {doc.id: doc.to_dict() or {} for doc in db.collection('access').stream()}
for record in db.collection('memberBirthDates').stream():
    uid = record.id
    if uid in archived or uid not in profiles:
        continue
    if access.get(uid, {}).get('enabled') is False:
        continue
    birth = (record.to_dict() or {}).get('birthDate', '')
    try:
        birthday = datetime.strptime(birth, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        continue
    # Un anniversaire le 29 février est publié uniquement les années bissextiles.
    if (birthday.month, birthday.day) != (today.month, today.day):
        continue
    nickname = str(profiles[uid].get('nickname') or '').strip()
    if not nickname:
        continue
    # Pseudo uniquement : pas de divulgation des identités civiles ni de la date complète.
    publish(f'auto-anniversaire-{today.year}-{uid}', 'Joyeux anniversaire ! 🎂',
            f'Toute l’association G.I.B. souhaite un joyeux anniversaire à {nickname} !')
