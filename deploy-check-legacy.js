/* Detect published interface changes without a build step or GitHub credentials.
   Conditional requests permit the browser/CDN to revalidate unchanged content.
   No live JSON/API data is included, so war updates never trigger this banner. */
(() => {
 'use strict';
 if(window.__hdDeployCheck||!window.isSecureContext||!crypto.subtle)return;
 window.__hdDeployCheck=true;
 const base=new URL('.',document.currentScript.src);
 const paths=['mobile-nav.js','mobile-nav.css','ptbr.js','index.html','guerra.html','estratagemas.html','faccoes.html','mapa-galatico.html','mapa-classico.html','style.css','home-mobile.css','home-mobile.js','theme.js','pwa.js','deploy-check.js','pwa.css','guerra.css','guerra.js','mapa.css','mapa.js','overview.js','dados.js','warbonds.js','busca.js','manifest.webmanifest'];
 const urls=new Set(paths.map(path=>new URL(path,base).href));
 // Include scripts/styles and the current page for nested sections of the site.
 const pageUrl=new URL(location.href);pageUrl.hash='';pageUrl.search='';
 if(pageUrl.origin===base.origin&&pageUrl.pathname.startsWith(base.pathname))urls.add(pageUrl.href);
 document.querySelectorAll('script[src],link[rel="stylesheet"]').forEach(el=>{
  const url=new URL(el.src||el.href,location.href);
  if(url.origin===base.origin&&url.pathname.startsWith(base.pathname))urls.add(url.href);
 });
 let baseline=null,busy=false,notified=false,lastCheck=0;
 async function snapshot(){
  const hashes=await Promise.all([...urls].sort().map(async url=>{
   const response=await fetch(url,{cache:'no-cache',signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error('Deploy not ready');
   const digest=await crypto.subtle.digest('SHA-256',await response.arrayBuffer());
   return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }));
  return hashes.join(':');
 }
 function notify(){
  // The existing worker update banner has priority, and will reload current files.
  if(document.getElementById('hd-pwa-notice')){notified=true;return;}
  notified=true;
  const box=document.createElement('aside');box.id='hd-pwa-notice';box.setAttribute('aria-label','Atualização do Helldivers BR');
  const text=document.createElement('span');text.setAttribute('role','status');text.textContent='Uma nova versão do Helldivers BR está disponível.';
  const action=document.createElement('button');action.type='button';action.textContent='Atualizar agora';
  action.addEventListener('click',async()=>{
   const registration=await navigator.serviceWorker?.getRegistration(base.href).catch(()=>null);
   if(registration?.waiting){
    navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});
    registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
   }else location.reload();
  });
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='Agora não';dismiss.addEventListener('click',()=>box.remove());
  box.append(text,action,dismiss);document.body.append(box);
 }
 async function check(){
  if(busy||notified||document.hidden||!navigator.onLine)return;
  busy=true;lastCheck=Date.now();
  try{
   const current=await snapshot();
   if(baseline===null)baseline=current;
   else if(current!==baseline){
    // Confirm consistency: do not offer a reload during a partial deployment.
    await new Promise(resolve=>setTimeout(resolve,5000));
    if(!document.hidden&&navigator.onLine&&await snapshot()===current)notify();
   }
  }catch{ /* Offline, an unavailable file or partial deploy: retry later. */ }
  finally{busy=false;}
 }
 function start(){
  check();setInterval(check,300000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastCheck>60000)check();});
  window.addEventListener('online',check);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
