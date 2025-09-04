self.addEventListener('install', event => {
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  clients.claim();
});
self.addEventListener('fetch', event => {
  // network-first for simplicity
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});