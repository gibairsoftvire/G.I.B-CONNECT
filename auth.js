import { firebaseConfig } from './firebase-config.js';
import {initPush} from './push.js';
const $=id=>document.getElementById(id);
let auth, db, api, unsubscribe, currentUid=null, loadedUid=null, opening=false, epoch=0;
const status=message=>{$('authStatus').textContent=message;};
const controls=disabled=>{for(const id of ['loginSubmit','googleLogin','resetPassword','createAccount'])$(id).disabled=disabled;};
function lock(message){$('appShell').hidden=true;$('authGate').hidden=false;status(message);}
function errorMessage(error){const messages={
 'auth/invalid-credential':'Adresse e-mail ou mot de passe incorrect.',
 'auth/invalid-login-credentials':'Adresse e-mail ou mot de passe incorrect.',
 'auth/invalid-email':'Vérifie ton adresse e-mail.',
 'auth/user-disabled':'Ce compte est désactivé.',
 'auth/too-many-requests':'Trop de tentatives. Patiente avant de réessayer.',
 'auth/network-request-failed':'Connexion impossible. Vérifie ton accès Internet.',
 'auth/unauthorized-domain':'Autorise gibairsoftvire.github.io dans Authentication → Paramètres → Domaines autorisés.',
 'auth/popup-blocked':'Le navigateur a bloqué la fenêtre Google. Autorise les fenêtres de connexion ou utilise ton e-mail.',
 'auth/popup-closed-by-user':'Fenêtre Google fermée. Tu peux réessayer.',
 'auth/account-exists-with-different-credential':'Utilise la connexion e-mail et mot de passe de ton compte existant.',
 'auth/operation-not-allowed':'Cette méthode doit être activée dans Firebase Authentication.',
 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':'Configuration Firebase à vérifier : copie le bloc firebaseConfig en texte.',
 'auth/invalid-api-key':'Configuration Firebase à vérifier : copie le bloc firebaseConfig en texte.',
 'permission-denied':'Accès refusé. Vérifie les règles Firestore publiées.',
 'auth/email-already-in-use':'Un compte existe déjà avec cette adresse. Utilise Se connecter ou Mot de passe oublié.',
 'auth/weak-password':'Choisis un mot de passe d’au moins 12 caractères.'
};return messages[error?.code]||'Le service ne répond pas ou sa configuration est incorrecte. Réessaie et indique le code : '+(error?.code||'connexion');}
async function logout(){lock('Déconnexion…');try{await window.gibPush?.cleanup().catch(()=>{});await api.signOut(auth);location.reload();}catch(error){status(errorMessage(error));}}
async function openApp(user,rights,token){
 if(token!==epoch)return;
 const canAdmin=['owner','moderator','admin'].includes(rights.role);
 const session=Object.freeze({uid:user.uid,email:user.email||'membre',canAdmin,role:rights.role});
 if(loadedUid&&loadedUid!==user.uid){location.reload();return;}
 if(!loadedUid){
  if(opening)return;opening=true;
  Object.defineProperty(window,'gibSession',{value:session,configurable:true});
  window.gibBackend=Object.freeze({api,db,uid:user.uid,email:user.email||'membre',role:rights.role});
  try{window.gibPush=initPush({api,db,uid:user.uid,role:rights.role,getIdToken:()=>auth.currentUser?.getIdToken()});}catch(_){$('notificationStatus').textContent='Notifications indisponibles ; la connexion reste utilisable.';}
  try{await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='./app.js?v=20261106-fr-final-1';script.onload=resolve;script.onerror=reject;document.body.append(script);});await window.gibReady;loadedUid=user.uid;}catch(error){
   console.error('[GIB CONNECT] Module secondaire indisponible :',error);
   // Le droit d'accès a déjà été confirmé par le document /access/{uid}.
   // Ne pas enfermer l'utilisateur dans l'écran de connexion lorsqu'un module
   // secondaire Firestore est refusé. Ne jamais élargir les règles de sécurité.
   if(token!==epoch)return;
   if(!document.getElementById('appShell') || !window.gibBackend){opening=false;lock('Initialisation impossible : '+(error?.code||error?.message||String(error)));return;}
   loadedUid=user.uid;
   window.gibPartialStartupError=error?.code||error?.message||String(error);
   console.warn('[GIB CONNECT] Ouverture en mode dégradé :',window.gibPartialStartupError);
  }
 }
 if(token!==epoch)return;
 $('connectedAccount').textContent='Compte connecté : '+session.email;
 $('accountRights').textContent='Droits : '+({owner:'Administrateur principal',admin:'Modérateur',moderator:'Modérateur',member:'Membre'})[rights.role];
 $('logoutButton').onclick=logout;
 $('loginPassword').value='';$('authGate').hidden=true;$('appShell').hidden=false;if(window.gibPartialStartupError){const t=$('toast');if(t){t.textContent='Connexion rétablie. Certaines rubriques sont indisponibles ('+window.gibPartialStartupError+').';t.classList.remove('hidden');}}window.gibPush?.offerOnboarding?.();
}
function monitorUser(user){
 const token=++epoch;if(unsubscribe){unsubscribe();unsubscribe=null;}
 currentUid=user?.uid||null;$('gateLogout').classList.toggle('hidden',!user);
 if(!user){lock('Connecte-toi avec le compte créé dans Firebase.');if(loadedUid)location.reload();return;}
 lock('Vérification de tes droits…');
 let provisioning=false;
 unsubscribe=api.onSnapshot(api.doc(db,'access',user.uid),{includeMetadataChanges:true},async snapshot=>{
  if(token!==epoch)return;
  // On ne déverrouille jamais l’application sur des droits issus du cache hors ligne.
  if(snapshot.metadata.fromCache){lock('Vérification des droits en ligne… Une connexion Internet est nécessaire.');return;}
  const rights=snapshot.exists()?snapshot.data():null;
  if(rights?.role==='member'&&rights.enabled===true&&user.emailVerified&&!provisioning){provisioning=true;try{const i=await api.getDocFromServer(api.doc(db,'invitations',user.email.toLowerCase()));if(i.exists()&&i.data().enabled&&i.data().role==='moderator'){await api.runTransaction(db,async tx=>{const invitation=await tx.get(api.doc(db,'invitations',user.email.toLowerCase()));const v=invitation.data();const r=api.doc(db,'moderators',v.slot),slot=await tx.get(r);if(!v.enabled||!slot.exists()||slot.data().email!==user.email.toLowerCase()||slot.data().uid&&slot.data().uid!==user.uid)throw Error('Place indisponible');tx.update(r,{uid:user.uid});tx.set(api.doc(db,'access',user.uid),{role:'moderator',slot:v.slot,enabled:true});});return;}}catch(error){status(errorMessage(error));}}
  if(!rights||rights.enabled!==true||!['owner','moderator','admin','member'].includes(rights.role)){
   window.gibStop?.();
   if(!rights&&user.emailVerified&&!provisioning){provisioning=true;try{const invitation=await api.getDocFromServer(api.doc(db,'invitations',user.email.toLowerCase()));if(invitation.exists()&&invitation.data().enabled===true){await api.runTransaction(db,async tx=>{const i=await tx.get(api.doc(db,'invitations',user.email.toLowerCase()));if(!i.exists()||!i.data().enabled)throw Error('Invitation indisponible');const v=i.data();if(v.role==='moderator'){const r=api.doc(db,'moderators',v.slot),slot=await tx.get(r);if(!slot.exists()||slot.data().email!==user.email.toLowerCase()||slot.data().uid&&slot.data().uid!==user.uid)throw Error('Place indisponible');tx.update(r,{uid:user.uid});tx.set(api.doc(db,'access',user.uid),{role:'moderator',slot:v.slot,enabled:true});}else if(v.role==='member')tx.set(api.doc(db,'access',user.uid),{role:'member',enabled:true});else throw Error('Invitation à renouveler par le compte principal');});return;}}catch(error){status(errorMessage(error));}}
   lock(!user.emailVerified?'Vérifie ton adresse e-mail avant de rejoindre l’association, puis déconnecte-toi et reconnecte-toi.':'Compte connecté, mais accès non autorisé. Contacte un administrateur.');
   $('verifyEmail').classList.toggle('hidden',user.emailVerified);return;
  }
  $('verifyEmail').classList.add('hidden');
  if(loadedUid&&window.gibSession.role!==rights.role){location.reload();return;}
  openApp(user,rights,token);
 },error=>{if(token===epoch){console.error('[GIB] Lecture des droits /access/'+user.uid,error);lock('Accès Firebase refusé pour ton document de droits : '+(error?.code||error?.message||'erreur')+'. Les modules secondaires ne sont pas en cause.');}});
}
$('loginForm').onsubmit=async e=>{e.preventDefault();controls(true);status('Connexion…');try{await api.signInWithEmailAndPassword(auth,$('loginEmail').value.trim(),$('loginPassword').value);}catch(error){status(errorMessage(error));}finally{$('loginPassword').value='';controls(false);}};
$('googleLogin').onclick=async()=>{controls(true);status('Ouverture de Google…');try{await api.signInWithPopup(auth,new api.GoogleAuthProvider());}catch(error){status(errorMessage(error));}finally{controls(false);}};
$('resetPassword').onclick=async()=>{const email=$('loginEmail').value.trim();if(!email){status('Renseigne ton adresse e-mail au-dessus, puis clique à nouveau sur Mot de passe oublié.');return;}controls(true);try{await api.sendPasswordResetEmail(auth,email);status('Si ce compte existe, un lien de réinitialisation sera envoyé. Vérifie aussi les courriers indésirables.');}catch(error){status(errorMessage(error));}finally{controls(false);}};
$('gateLogout').onclick=logout;
$('createAccount').onclick=async()=>{const email=$('loginEmail').value.trim(),password=$('loginPassword').value;if(!email||password.length<12){status('Indique ton adresse invitée et un mot de passe d’au moins 12 caractères.');return;}controls(true);try{await api.createUserWithEmailAndPassword(auth,email,password);status('Compte créé. Clique sur Vérifier mon e-mail, puis utilise le lien reçu avant de te reconnecter.');$('verifyEmail').classList.remove('hidden');}catch(error){status(errorMessage(error));}finally{$('loginPassword').value='';controls(false);}};
$('verifyEmail').onclick=async()=>{if(!auth.currentUser)return;try{await api.sendEmailVerification(auth.currentUser);status('Lien de vérification envoyé. Ouvre-le, puis déconnecte-toi et reconnecte-toi ici.');}catch(error){status(errorMessage(error));}};
window.addEventListener('offline',()=>lock('Connexion Internet interrompue. Reconnecte-toi au réseau puis actualise la page.'));
try{
 const version='12.19.0';
 const [appModule,authModule,firestoreModule]=await Promise.all([
 import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
 import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
 import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
 ]);
 api={...authModule,...firestoreModule};const app=appModule.initializeApp(firebaseConfig);auth=api.getAuth(app);auth.languageCode='fr';db=api.getFirestore(app);
 await api.setPersistence(auth,(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)?api.browserLocalPersistence:api.browserSessionPersistence);
 api.onAuthStateChanged(auth,monitorUser,error=>lock(errorMessage(error)));controls(false);
}catch(error){lock('Impossible de charger Firebase. Vérifie Internet puis actualise la page. '+(error?.code||''));}
