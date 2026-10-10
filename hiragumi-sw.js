const VERSION='hiragumi-consult-pwa-20261010-1';

self.addEventListener('install',event=>{
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(self.clients.claim());
});

// Sensitive consultation content and API responses are intentionally not cached.
// The service worker exists for app installation and update lifecycle only.
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  if(
    url.pathname==='/hiragumi' ||
    url.pathname==='/hiragumi-consultation.html' ||
    url.pathname==='/hiragumi.webmanifest'
  ){
    event.respondWith(fetch(req,{cache:'no-store'}));
  }
});

self.addEventListener('message',event=>{
  if(event.data==='SKIP_WAITING')self.skipWaiting();
});
