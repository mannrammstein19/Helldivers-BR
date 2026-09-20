(() => {
 'use strict';
 if(window.__hdPwaLoaded)return;
 window.__hdPwaLoaded=true;
 const base=new URL('.',document.currentScript.src);
 const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('pwa.css',base);document.head.append(style);
 const detector=document.createElement('script');detector.src=new URL('deploy-check.js',base);document.head.append(detector);
 let installEvent;
 const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
 function banner(message,label,action){
  document.getElementById('hd-pwa-notice')?.remove();
  const box=document.createElement('aside');box.id='hd-pwa-notice';box.setAttribute('aria-label','Helldivers BR');
  const text=document.createElement('span');text.textContent=message;
  const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',action);
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Dispensar aviso');close.addEventListener('click',()=>box.remove());
  box.append(text,button,close);document.body.append(box);
 }
 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();installEvent=event;
  ready(()=>{
   if(matchMedia('(display-mode: standalone)').matches)return;
   let button=document.getElementById('hd-install');
   if(!button){button=document.createElement('button');button.id='hd-install';button.type='button';button.textContent='↓ Instalar Helldivers BR';(document.querySelector('.sidebar')||document.body).append(button);}
   button.hidden=false;
   button.onclick=async()=>{if(!installEvent)return;const prompt=installEvent;installEvent=null;await prompt.prompt();await prompt.userChoice;button.hidden=true;};
  });
 });
 window.addEventListener('appinstalled',()=>{installEvent=null;document.getElementById('hd-install')?.remove();});
 if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
 ready(async()=>{
  try{
   const registration=await navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname,updateViaCache:'none'});
   const offer=()=>{
    if(!registration.waiting||!navigator.serviceWorker.controller)return;
    banner('Nova versão do terminal disponível.','Atualizar agora',()=>{
     const worker=registration.waiting;if(!worker)return;
     navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});
     worker.postMessage({type:'ACTIVATE_UPDATE'});
    });
   };
   offer();
   registration.addEventListener('updatefound',()=>{
    const worker=registration.installing;
    worker?.addEventListener('statechange',()=>{if(worker.state==='installed')offer();});
   });
   let lastCheck=Date.now();
   document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&Date.now()-lastCheck>60000){lastCheck=Date.now();registration.update().catch(()=>{});}
   });
   registration.update().catch(()=>{});
  }catch(error){console.warn('Registro da PWA indisponível:',error);}
 });
})();
