const CACHE = 'bloknot-2025-pro-full-plus-v1';
const PRECACHE = ['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./assets/icons/icon-192.png','./assets/icons/icon-512.png'];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE))); self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e=>{
  e.respondWith(caches.match(e.request).then(cached=> cached || fetch(e.request).then(res=>{
    const copy=res.clone(); caches.open(CACHE).then(c=>c.put(e.request, copy)); return res;
  }).catch(()=> cached)));
});
