const CACHE='gib-connect-v0921-6-presences-par-jour-1';const ASSETS=['./index.html','./style.css','./theme.css','./appearance.js','./app.js','./gps.js','./photos.js','./jpeg-worker.js','./vendor/jpeg-decoder.js','./vendor/jpeg-encoder.js','./auth.js','./firebase-config.js','./manifest.webmanifest','./install.js','./push.js','./app-icon-180.png','./app-icon-192.png','./app-icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('gib-connect-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;e.respondWith(fetch(e.request).then(response=>{if(response.ok&&ASSETS.some(a=>new URL(a,self.registration.scope).pathname===u.pathname))caches.open(CACHE).then(c=>c.put(e.request,response.clone()));return response;}).catch(()=>caches.match(e.request)));});

// FCM handles background notification payloads and links. Never insert private keys here.
try {
 importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js','https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');
 firebase.initializeApp({apiKey:'AIzaSyCD6_fcCb4rs6Yy83n-NTVvEcSHbC8PQsI',authDomain:'gib-connect.firebaseapp.com',projectId:'gib-connect',messagingSenderId:'412870624968',appId:'1:412870624968:web:246b6a4099a7f98c5fc7fd'});
 firebase.messaging();
} catch (_) { /* The app remains usable if the push SDK cannot load. */ }
self.addEventListener('notificationclick',event=>{if(!event.notification.data?.conversationId)return;event.notification.close();const url=new URL('./index.html',self.registration.scope);url.searchParams.set('salon',event.notification.data.conversationId);event.waitUntil(clients.openWindow(url.href));});
