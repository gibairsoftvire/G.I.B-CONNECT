/* Serveur G.I.B. CONNECT. Aucun secret dans ce fichier ou sur GitHub.
   Ajouter le JSON du compte de service dans la propriété de script
   FIREBASE_SERVICE_ACCOUNT, uniquement dans Google Apps Script. */
const GIB = Object.freeze({
 project:'gib-connect', apiKey:'AIzaSyCD6_fcCb4rs6Yy83n-NTVvEcSHbC8PQsI',
 appUrl:'https://gibairsoftvire.github.io/G.I.B-CONNECT/index.html', maxAge:600000
});
function output_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function doGet(){return output_({service:'G.I.B. CONNECT notifications',version:'0.9.7',ready:!!PropertiesService.getScriptProperties().getProperty('FIREBASE_SERVICE_ACCOUNT')});}
function doPost(e){try{const raw=e&&e.postData&&e.postData.contents;if(!raw||raw.length>12000)throw Error('request');return output_(dispatch_(JSON.parse(raw)));}catch(error){return output_({ok:false,error:publicError_(error.message)});}}
function publicError_(code){return ['auth','request','denied','expired','busy','configuration','send'].includes(code)?code:'service';}
function http_(url,options){const r=UrlFetchApp.fetch(url,Object.assign({muteHttpExceptions:true},options||{}));let data;try{data=JSON.parse(r.getContentText());}catch(_){throw Error('service');}return {status:r.getResponseCode(),data:data};}
function base_(){return 'https://firestore.googleapis.com/v1/projects/'+GIB.project+'/databases/(default)/documents';}
function b64_(value){return Utilities.base64EncodeWebSafe(value).replace(/=+$/,'');}
function digest_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8).map(b=>(b&255).toString(16).padStart(2,'0')).join('');}
function oauth_(){const cache=CacheService.getScriptCache(),cached=cache.get('fcm-oauth');if(cached)return cached;let key;try{key=JSON.parse(PropertiesService.getScriptProperties().getProperty('FIREBASE_SERVICE_ACCOUNT')||'{}');}catch(_){throw Error('configuration');}if(key.project_id!==GIB.project||!key.private_key||!key.client_email)throw Error('configuration');const now=Math.floor(Date.now()/1000);const header=b64_(JSON.stringify({alg:'RS256',typ:'JWT'}));const payload=b64_(JSON.stringify({iss:key.client_email,scope:'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));const input=header+'.'+payload;const jwt=input+'.'+b64_(Utilities.computeRsaSha256Signature(input,key.private_key));const r=http_('https://oauth2.googleapis.com/token',{method:'post',payload:{grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}});if(r.status!==200||!r.data.access_token)throw Error('configuration');cache.put('fcm-oauth',r.data.access_token,3300);return r.data.access_token;}
function value_(v){if('stringValue'in v)return v.stringValue;if('booleanValue'in v)return v.booleanValue;if('integerValue'in v)return Number(v.integerValue);if('timestampValue'in v)return v.timestampValue;if('arrayValue'in v)return(v.arrayValue.values||[]).map(value_);if('mapValue'in v)return fields_(v.mapValue.fields||{});return null;}
function fields_(fields){const data={};Object.keys(fields||{}).forEach(k=>data[k]=value_(fields[k]));return data;}
function document_(d){return d?Object.assign(fields_(d.fields),{_id:d.name.split('/').pop()}):null;}
function get_(path,token,missing){const r=http_(base_()+'/'+path,{headers:{Authorization:'Bearer '+token}});if(r.status===404&&missing)return null;if(r.status!==200)throw Error('denied');return document_(r.data);}
function list_(collection,token){const result=[];let page='';do{const r=http_(base_()+'/'+collection+'?pageSize=300'+(page?'&pageToken='+encodeURIComponent(page):''),{headers:{Authorization:'Bearer '+token}});if(r.status!==200)throw Error('configuration');(r.data.documents||[]).forEach(d=>result.push(document_(d)));page=r.data.nextPageToken||'';if(result.length>1000)throw Error('configuration');}while(page);return result;}
function many_(paths,token){if(!paths.length)return {};const r=http_(base_()+':batchGet',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+token},payload:JSON.stringify({documents:paths.map(p=>'projects/'+GIB.project+'/databases/(default)/documents/'+p)})});if(r.status!==200||!Array.isArray(r.data))throw Error('configuration');const out={};r.data.forEach(item=>{if(item.found){const d=item.found;out[d.name.split('/documents/')[1]]=document_(d);}else if(item.missing)out[item.missing.split('/documents/')[1]]=null;});return out;}
function set_(path,fields,token){const r=http_(base_()+'/'+path,{method:'patch',contentType:'application/json',headers:{Authorization:'Bearer '+token},payload:JSON.stringify({fields:fields})});if(r.status!==200)throw Error('service');}
function enabledRole_(a,slots){if(!a||a.enabled!==true)return false;if(a.role==='member'||a.role==='owner')return true;return ['moderator','admin'].includes(a.role)&&['1','2','3','4','5','6'].includes(a.slot)&&slots.some(s=>s._id===a.slot&&s.uid===a._id);}
function eligible_(a,context){if(!enabledRole_(a,context.slots)||a._id===context.sender)return false;if(context.type!=='general'&&!context.participants.includes(a._id))return false;const p=context.data['preferences/'+a._id];if(p&&p.messages===false)return false;const restriction=context.data['restrictions/'+a._id],dues=context.data['memberships/'+a._id];return context.type==='general'||a.role!=='member'||!restriction||restriction.suspended!==true||!!(dues&&dues.validated===true);}
function dispatch_(body){
 const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,300}$/.test(id);
 if(!body||typeof body.idToken!=='string'||body.idToken.length>7000||!validId(body.conversationId)||!validId(body.messageId))throw Error('request');
 const auth=http_('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(GIB.apiKey),{method:'post',contentType:'application/json',payload:JSON.stringify({idToken:body.idToken})});
 if(auth.status!==200||!auth.data.users||auth.data.users.length!==1||auth.data.users[0].disabled)throw Error('auth');
 const sender=auth.data.users[0].localId;
 const config=get_('settings/push',body.idToken,true);if(!config||config.enabled!==true)return {ok:true,accepted:0,disabled:true};
 // Read with the CALLER's token: Firestore checks current access, participation and dues.
 const path='conversations/'+body.conversationId,conversation=get_(path,body.idToken),message=get_(path+'/messages/'+body.messageId,body.idToken);
 if(message.authorId!==sender)throw Error('denied');
 const age=Date.now()-Date.parse(message.createdAt);if(!Number.isFinite(age)||age< -30000||age>GIB.maxAge)throw Error('expired');
 if(!['general','group','private'].includes(conversation.type)||conversation.type==='general'&&body.conversationId!=='general'||conversation.type!=='general'&&!(conversation.participants||[]).includes(sender))throw Error('denied');
 return sendVerified_(body,sender,conversation,message);
}
function sendVerified_(body,sender,conversation,message){
 const token=oauth_(),access=list_('access',token),slots=list_('moderators',token);
 const senderAccess=access.find(a=>a._id===sender);if(!enabledRole_(senderAccess,slots))throw Error('denied');
 const candidates=access.filter(a=>a._id!==sender&&(conversation.type==='general'||(conversation.participants||[]).includes(a._id)));
 const paths=['restrictions/'+sender,'memberships/'+sender];candidates.forEach(a=>['preferences','restrictions','memberships'].forEach(c=>paths.push(c+'/'+a._id)));const data=many_(paths,token);
 if(conversation.type!=='general'&&senderAccess.role==='member'&&data['restrictions/'+sender]?.suspended===true&&data['memberships/'+sender]?.validated!==true)throw Error('denied');
 const context={sender:sender,type:conversation.type,participants:conversation.participants||[],slots:slots,data:data};
 const allowed=new Set(candidates.filter(a=>eligible_(a,context)).map(a=>a._id));
 const seen=new Set();const devices=list_('pushDevices',token).filter(d=>{if(!allowed.has(d.uid)||typeof d.token!=='string'||d._id!==digest_(d.token)||seen.has(d._id))return false;seen.add(d._id);return true;});
 const deliveryId=digest_(body.conversationId+'/'+body.messageId),deliveryPath='pushDeliveries/'+deliveryId;
 const lock=LockService.getScriptLock();if(!lock.tryLock(8000))throw Error('busy');
 try{
  const previous=get_(deliveryPath,token,true),sent=new Set(previous&&previous.sent||[]),pending=devices.filter(d=>!sent.has(d._id));
  if(!pending.length)return {ok:true,accepted:0};
  // Generic notification: no message text, author or private room name on lock screens.
  const requests=pending.map(d=>({url:'https://fcm.googleapis.com/v1/projects/'+GIB.project+'/messages:send',method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+token},muteHttpExceptions:true,payload:JSON.stringify({message:{token:d.token,notification:{title:'G.I.B. CONNECT',body:'Tu as reçu un nouveau message.'},data:{conversationId:body.conversationId,messageId:body.messageId},webpush:{headers:{TTL:'300',Urgency:'high'},notification:{icon:URL_(GIB.appUrl,'app-icon-192.png'),tag:'gib-'+deliveryId},fcm_options:{link:GIB.appUrl+'?salon='+encodeURIComponent(body.conversationId)}}}})}));
  let accepted=0,failed=0;const results=UrlFetchApp.fetchAll(requests);results.forEach((response,i)=>{const code=response.getResponseCode();let detail={};try{detail=JSON.parse(response.getContentText());}catch(_){}const unregistered=(detail.error&&detail.error.details||[]).some(x=>x.errorCode==='UNREGISTERED');if(code>=200&&code<300){sent.add(pending[i]._id);accepted++;}else if(unregistered){sent.add(pending[i]._id);}else failed++;});
  set_(deliveryPath,{sent:{arrayValue:{values:[...sent].map(s=>({stringValue:s}))}},updatedAt:{timestampValue:new Date().toISOString()}},token);
  return {ok:failed===0,accepted:accepted,error:failed?'send':undefined};
 }finally{lock.releaseLock();}
}
// Apps Script V8 has no standard URL constructor in every deployment.
function URL_(base,file){return base.slice(0,base.lastIndexOf('/')+1)+file;}
function verifierConfiguration(){const token=oauth_();const r=http_(base_()+'/access?pageSize=1',{headers:{Authorization:'Bearer '+token}});if(r.status!==200)throw Error('Accès Firestore refusé au compte de service.');console.log('Configuration OAuth et Firestore valide. Il reste à tester une notification sur téléphone.');}

/* Recovery trigger: messages remain deliverable if the sender closes the app
   immediately after saving. The browser relay is fast; this is a minute-based backup. */
function surveillerMessages(){
 const properties=PropertiesService.getScriptProperties(),token=oauth_();
 const config=get_('settings/push',token,true);if(!config||config.enabled!==true)return;
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 let cursor;try{cursor=JSON.parse(properties.getProperty('PUSH_CURSOR')||'null');}finally{lock.releaseLock();}
 const query={from:[{collectionId:'messages',allDescendants:true}],orderBy:[{field:{fieldPath:'createdAt'},direction:'ASCENDING'},{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:30};
 if(cursor)query.startAt={values:[{timestampValue:cursor.time},{referenceValue:cursor.name}],before:false};
 else query.where={fieldFilter:{field:{fieldPath:'createdAt'},op:'GREATER_THAN_OR_EQUAL',value:{timestampValue:new Date(Date.now()-300000).toISOString()}}};
 const response=http_(base_()+':runQuery',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+token},payload:JSON.stringify({structuredQuery:query})});
 if(response.status!==200||!Array.isArray(response.data))throw Error('Lecture des messages impossible : '+(response.data.error?.message||'vérifier l’index collectionGroup messages/createdAt dans Firestore.'));
 for(const row of response.data){if(!row.document)continue;const document=row.document,path=document.name.split('/documents/')[1],parts=path.split('/');const message=document_(document);let processed=true;
  if(parts.length===4&&parts[0]==='conversations'&&parts[2]==='messages'&&typeof message.authorId==='string'&&Date.now()-Date.parse(message.createdAt)<GIB.maxAge){
   try{const conversation=get_('conversations/'+parts[1],token,true);if(conversation&&['general','group','private'].includes(conversation.type)&&(conversation.type!=='general'||parts[1]==='general')&&(conversation.type==='general'||(conversation.participants||[]).includes(message.authorId))){const result=sendVerified_({conversationId:parts[1],messageId:parts[3]},message.authorId,conversation,message);processed=result.ok;}}
   catch(e){if(!['denied','expired'].includes(e.message))throw e;}
  }
  if(!processed)break;
  properties.setProperty('PUSH_CURSOR',JSON.stringify({time:message.createdAt,name:document.name}));
 }
}
function installerSurveillance(){ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='surveillerMessages').forEach(t=>ScriptApp.deleteTrigger(t));ScriptApp.newTrigger('surveillerMessages').timeBased().everyMinutes(1).create();console.log('Surveillance créée. Activer le service dans le Profil puis tester sur deux téléphones.');}
