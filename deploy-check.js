(() => {
 'use strict';
 if(window.__hdReleaseMonitor)return;
 window.__hdReleaseMonitor=true;
 const base=new URL('.',document.currentScript.src);
 const installed='__HDBR_RELEASE__';
 // Before the first Actions build, keep the existing detector working.
 if(!/^[a-f0-9]{64}$/.test(installed)){
  const script=document.createElement('script');script.src=new URL('deploy-check-legacy.js',base);document.head.append(script);return;
 }
 let busy=false,lastCheck=0,notified=false;
 async function version(){
  const response=await fetch(new URL('version.json',base),{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Version unavailable');
  const data=await response.json();
  if(data.schema!==1||!/^[a-f0-9]{64}$/.test(data.version))throw Error('Invalid version');
  return data.version;
 }
 function notice(){
  if(document.getElementById('hd-pwa-notice')){notified=true;return;}
  notified=true;
  const box=document.createElement('aside');box.id='hd-pwa-notice';box.setAttribute('aria-label','Atualização disponível');
  const text=document.createElement('span');text.setAttribute('role','status');text.textContent='Uma nova versão do Helldivers BR está disponível.';
  const update=document.createElement('button');update.type='button';update.textContent='Atualizar agora';
  update.onclick=async()=>{
   update.disabled=true;
   if(!navigator.onLine){text.textContent='Conecte-se à internet para atualizar.';update.disabled=false;return;}
   try{await version();}catch{text.textContent='Não foi possível atualizar. Tente novamente.';update.disabled=false;return;}
   const registration=await navigator.serviceWorker?.getRegistration(base.href).catch(()=>null);
   if(registration){try{await registration.update();}catch{}}
   if(registration?.waiting){
    navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});
    registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
   }else location.reload();
  };
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='Agora não';dismiss.onclick=()=>box.remove();
  box.append(text,update,dismiss);document.body.append(box);
 }
 async function check(){
  if(busy||notified||document.hidden||!navigator.onLine)return;
  busy=true;lastCheck=Date.now();
  try{
   const current=await version();
   if(current!==installed){
    await new Promise(resolve=>setTimeout(resolve,3000));
    if(!document.hidden&&navigator.onLine&&await version()===current)notice();
   }
  }catch{}finally{busy=false;}
 }
 function start(){check();setInterval(check,300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastCheck>60000)check();});window.addEventListener('online',check);}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
