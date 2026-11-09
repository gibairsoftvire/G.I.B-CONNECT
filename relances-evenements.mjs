import admin from 'firebase-admin';
const secret=process.env.FIREBASE_SERVICE_ACCOUNT;
if(!secret){throw Error('Secret FIREBASE_SERVICE_ACCOUNT absent : aucune relance envoyée.');}
const credentials=JSON.parse(secret);
if(credentials.project_id!=='gib-connect')throw Error('Compte de service du mauvais projet Firebase.');
admin.initializeApp({credential:admin.credential.cert(credentials)});
const db=admin.firestore(), messaging=admin.messaging();
const now=Date.now(), DAY=86400000;
const users=await db.collection('access').where('enabled','==',true).get();
const eligible=new Set(users.docs.filter(d=>d.data().role!=='owner').map(d=>d.id));
const [events,devices]=await Promise.all([db.collection('events').get(),db.collection('pushDevices').get()]);
const tokens=new Map();for(const d of devices.docs){const v=d.data();if(eligible.has(v.uid)&&typeof v.token==='string'){if(!tokens.has(v.uid))tokens.set(v.uid,[]);tokens.get(v.uid).push(v.token);}}
function due(created){if(!created?.toMillis)return null;const age=now-created.toMillis();if(age<7*DAY)return null;const n=age<14*DAY?7:age<15*DAY?14:15+Math.floor((age-15*DAY)/DAY);return n;}
let sent=0,failed=0;
async function notify(type,doc,answered,created,deadline){
 const v=doc.data(),day=due(created);if(day===null || (deadline?.toMillis && now>=deadline.toMillis()))return;
 for(const uid of eligible){if(answered.has(uid)||!tokens.has(uid))continue;
  const pref=await db.doc(`preferences/${uid}`).get();if(pref.exists&&pref.data()?.events===false)continue;
  const key=`${type}_${doc.id}_${uid}_${day}`;
  // Claim once, atomically, before sending; prevents duplicate pushes if jobs overlap.
  const claimed=await db.runTransaction(async tx=>{const r=db.doc(`reminderDispatches/${key}`),s=await tx.get(r);if(s.exists)return false;tx.create(r,{type,sourceId:doc.id,uid,day,createdAt:admin.firestore.FieldValue.serverTimestamp()});return true;});
  if(!claimed)continue;
  try{
   const body=type==='event'?`Tu n'as pas encore répondu à l'événement « ${String(v.name||'Événement').slice(0,70)} ».`:`Tu n'as pas encore répondu au sondage « ${String(v.question||'Sondage').slice(0,70)} ».`;
   const result=await messaging.sendEachForMulticast({tokens:tokens.get(uid),notification:{title:'G.I.B. CONNECT · Relance',body},data:{kind:type,sourceId:doc.id,url:type==='event'?'/?page=agenda':'/?page=home'},webpush:{fcmOptions:{link:'https://gibairsoftvire.github.io/G.I.B-CONNECT/'}}});
   sent+=result.successCount;failed+=result.failureCount;
  }catch(err){failed++;console.error('Erreur relance',type,doc.id,uid,err.message);}
 }
}
for(const doc of events.docs){const v=doc.data();const r=await doc.ref.collection('rsvps').get();const answered=new Set(r.docs.map(d=>d.id));await notify('event',doc,answered,v.createdAt,v.startsAt);}

console.log(`Relances événements uniquement : ${sent} notifications push envoyées, ${failed} échecs.`);
