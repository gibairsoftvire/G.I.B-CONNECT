import { firebaseConfig } from './firebase-config.js';
const $=id=>document.getElementById(id);
let auth, db, api, unsubscribe, currentUid=null, loadedUid=null, opening=false, epoch=0;
const status=message=>{$('authStatus').textContent=message;};
const controls=disabled=>{for(const id of ['loginSubmit','googleLogin','resetPassword'])$(id).disabled=disabled;};
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
 'permission-denied':'Lecture des droits refusée. Vérifie les règles Firestore publiées.'
};return messages[error?.code]||'Le service ne répond pas ou sa configuration est incorrecte. Réessaie et indique le code : '+(error?.code||'connexion');}
async function logout(){lock('Déconnexion…');try{await api.signOut(auth);location.reload();}catch(error){status(errorMessage(error));}}
async function openApp(user,rights,token){
 if(token!==epoch)return;
 const canAdmin=['owner','admin'].includes(rights.role);
 const session=Object.freeze({uid:user.uid,email:user.email||'membre',canAdmin,role:rights.role});
 if(loadedUid&&loadedUid!==user.uid){location.reload();return;}
 if(!loadedUid){
  if(opening)return;opening=true;
  Object.defineProperty(window,'gibSession',{value:session,configurable:true});
  try{await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='./app.js';script.onload=resolve;script.onerror=reject;document.body.append(script);});loadedUid=user.uid;}catch{opening=false;lock('Chargement de l’application impossible. Actualise la page.');return;}
 }
 if(token!==epoch)return;
 $('connectedAccount').textContent='Compte connecté : '+session.email;
 $('accountRights').textContent='Droits : '+({owner:'Administrateur principal',admin:'Administrateur',member:'Membre'})[rights.role];
 $('logoutButton').onclick=logout;
 $('loginPassword').value='';$('authGate').hidden=true;$('appShell').hidden=false;
}
function monitorUser(user){
 const token=++epoch;if(unsubscribe){unsubscribe();unsubscribe=null;}
 currentUid=user?.uid||null;$('gateLogout').classList.toggle('hidden',!user);
 if(!user){lock('Connecte-toi avec le compte créé dans Firebase.');if(loadedUid)location.reload();return;}
 lock('Vérification de tes droits…');
 unsubscribe=api.onSnapshot(api.doc(db,'access',user.uid),{includeMetadataChanges:true},snapshot=>{
  if(token!==epoch)return;
  // On ne déverrouille jamais l’application sur des droits issus du cache hors ligne.
  if(snapshot.metadata.fromCache){lock('Vérification des droits en ligne… Une connexion Internet est nécessaire.');return;}
  const rights=snapshot.exists()?snapshot.data():null;
  if(!rights||rights.enabled!==true||!['owner','admin','member'].includes(rights.role)){lock('Compte connecté, mais accès non autorisé. Un responsable doit activer ton document access/'+user.uid+'.');return;}
  if(loadedUid&&window.gibSession.role!==rights.role){location.reload();return;}
  openApp(user,rights,token);
 },error=>{if(token===epoch)lock(errorMessage(error));});
}
$('loginForm').onsubmit=async e=>{e.preventDefault();controls(true);status('Connexion…');try{await api.signInWithEmailAndPassword(auth,$('loginEmail').value.trim(),$('loginPassword').value);}catch(error){status(errorMessage(error));}finally{$('loginPassword').value='';controls(false);}};
$('googleLogin').onclick=async()=>{controls(true);status('Ouverture de Google…');try{await api.signInWithPopup(auth,new api.GoogleAuthProvider());}catch(error){status(errorMessage(error));}finally{controls(false);}};
$('resetPassword').onclick=async()=>{const email=$('loginEmail').value.trim();if(!email){status('Renseigne ton adresse e-mail au-dessus, puis clique à nouveau sur Mot de passe oublié.');return;}controls(true);try{await api.sendPasswordResetEmail(auth,email);status('Si ce compte existe, un lien de réinitialisation sera envoyé. Vérifie aussi les courriers indésirables.');}catch(error){status(errorMessage(error));}finally{controls(false);}};
$('gateLogout').onclick=logout;
window.addEventListener('offline',()=>lock('Connexion Internet interrompue. Reconnecte-toi au réseau puis actualise la page.'));
try{
 const version='12.19.0';
 const [appModule,authModule,firestoreModule]=await Promise.all([
 import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
 import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
 import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
 ]);
 api={...authModule,...firestoreModule};const app=appModule.initializeApp(firebaseConfig);auth=api.getAuth(app);auth.languageCode='fr';db=api.getFirestore(app);
 await api.setPersistence(auth,api.browserSessionPersistence);
 api.onAuthStateChanged(auth,monitorUser,error=>lock(errorMessage(error)));controls(false);
}catch(error){lock('Impossible de charger Firebase. Vérifie Internet puis actualise la page. '+(error?.code||''));}
