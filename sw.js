/* Network-first delivery without caching live pages/assets: each navigation gets
   the current deploy. Only the explicit offline screen is stored. Never cache
   API/JSON responses or replace failed scripts/images with HTML. */
const VERSION='2026-09-20-mobile-3';
const PREFIX='hdbr-offline-'+encodeURIComponent(self.registration.scope)+'-';
const CACHE=PREFIX+VERSION;
const OFFLINE=new URL('offline.html',self.registration.scope).href;
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(async cache=>{
  const response=await fetch(OFFLINE,{cache:'reload'});
  if(!response.ok)throw new Error('Offline page unavailable');
  await cache.put(OFFLINE,response);
 }));
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request,{cache:'no-cache'}).catch(async()=>{
   const cache=await caches.open(CACHE);
   return await cache.match(OFFLINE)||new Response('Sem conexão. Reconecte e tente novamente.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
  }));
 }else if(['script','style'].includes(request.destination)){
  event.respondWith(fetch(request,{cache:'no-cache'}));
 }
});
