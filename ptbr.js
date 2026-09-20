/* Home localization: only public order/dispatch text, using the same translation
   provider already used by the Central. No API data, markup or private text is sent. */
(() => {
 'use strict';
 const KEY='hdbr-home-ptbr-v1',pending=new Map(),seen=new WeakMap();
 let cache={};try{cache=JSON.parse(localStorage.getItem(KEY)||'{}');}catch{}
 const known={
  'MAJOR ORDER':'ORDEM MAIOR','LIBERATE':'LIBERTAR','DEFEND':'DEFENDER',
  'ORDER COMPLETE':'ORDEM CONCLUÍDA','ORDER FAILED':'ORDEM NÃO CUMPRIDA',
  'AWAITING ORDERS':'AGUARDANDO ORDENS','SUPER EARTH':'SUPER TERRA'
 };
 function english(text){
  const words=text.toLowerCase().match(/[a-zà-ú]+/g)||[];
  const en=words.filter(w=>['the','and','of','to','our','must','have','has','with','from','will','all','are','your','their','this','that','order','major','liberate','defend','complete','victory','forces','enemy','attack','hold','planet','planets','freedom','democracy','successfully','against','super','earth','dispatch','reinforcements','destroy','kill','defeat','eliminate','protect','capture'].includes(w)).length;
  const pt=words.filter(w=>['o','a','os','as','de','da','do','dos','das','para','uma','um','em','com','não','ordem','maior','libertar','defender','concluída','terra','reforços','democracia','forças','planetas'].includes(w)).length;
  return en>pt||(pt===0&&words.length>1&&!/[ãõçáéíóúâêô]/i.test(text));
 }
 // Keep chunks safely below the provider's per-query byte limit.
 function chunks(text){
  const result=[];let chunk='';const encoder=new TextEncoder();
  for(const token of text.match(/\S+\s*/g)||[]){
   if(encoder.encode(chunk+token).length>450&&chunk){result.push(chunk.trim());chunk='';}
   for(const char of token){
    if(encoder.encode(chunk+char).length>450){result.push(chunk);chunk='';}
    chunk+=char;
   }
  }
  if(chunk)result.push(chunk);return result;
 }
 async function translate(raw){
  raw=String(raw||'').trim();if(!raw)return raw;
  if(known[raw.toUpperCase()])return known[raw.toUpperCase()];
  if(cache[raw])return cache[raw];
  if(!english(raw))return raw;
  if(pending.has(raw))return pending.get(raw);
  const task=(async()=>{
   const translated=[];
   for(const part of chunks(raw)){
    const url=new URL('https://api.mymemory.translated.net/get');url.searchParams.set('q',part);url.searchParams.set('langpair','en|pt-br');
    const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('Translation unavailable');
    const data=await response.json(),value=data?.responseData?.translatedText;
    if(Number(data.responseStatus)!==200||!value||data.quotaFinished)throw new Error('Translation unavailable');
    translated.push(String(value));
   }
   const result=translated.join(' ');cache[raw]=result;
   const entries=Object.entries(cache).slice(-200);cache=Object.fromEntries(entries);
   try{localStorage.setItem(KEY,JSON.stringify(cache));}catch{}
   return result;
  })();
  pending.set(raw,task);try{return await task;}finally{pending.delete(raw);}
 }
 const selector='#hd-ov-order .hd-ov-title,#hd-ov-order .hd-ov-brief,#hd-ov-order .hd-mo-task h4,#hd-ov-feed .hd-feed-text';
 function localize(){
  document.querySelectorAll(selector).forEach(el=>{
   const source=el.textContent.trim();if(!source||seen.get(el)===source)return;
   seen.set(el,source);
   translate(source).then(result=>{
    if(!el.isConnected||el.textContent.trim()!==source)return;
    seen.set(el,result);if(result!==source)el.textContent=result;
    el.lang=english(result)?'en':'pt-BR';
    el.title=english(result)?'Tradução indisponível no momento; texto original.':'';
   }).catch(()=>{if(el.isConnected&&el.textContent.trim()===source){el.lang='en';el.title='Tradução indisponível no momento; texto original.';}});
  });
 }
 function start(){
  const overview=document.querySelector('.hd-overview-wrap');if(!overview)return;
  let scheduled=false;
  new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;localize();});}}).observe(overview,{childList:true,subtree:true,characterData:true});
  localize();
  window.addEventListener('online',()=>{document.querySelectorAll(selector).forEach(el=>seen.delete(el));localize();});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
