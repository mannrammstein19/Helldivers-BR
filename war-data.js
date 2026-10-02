/* HDBR: cliente comum do site; central opcional, cache real e diagnósticos. */
(()=>{'use strict';
 const PREFIX='hdbr_telemetry_v1:',MAX_AGE=86400000,inflight=new Map(),memory=new Map(),metadata=new Map(),retries=new Map(),diagnostics=[];
 const cfg=window.HDBRTelemetryConfig||{},central=String(cfg.centralUrl||'').replace(/\/+$/,'');
 const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
 const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
 const critical=new Set(['planets','campaigns','assignments']);
 let queue=Promise.resolve(),nextCall=0;
 function valid(data,name){return ['planets','campaigns','assignments','dispatches','dss','steam'].includes(name)?Array.isArray(data)&&(name!=='planets'||data.length>=10):data!=null;}
 function usable(item,name){return item&&valid(item.data,name)&&Number.isFinite(item.time)&&item.time>0&&item.time<=Date.now()&&Date.now()-item.time<=MAX_AGE;}
 function notice(){
  if(!document.body)return;
  const all=[...metadata.values()],stale=all.filter(m=>m.stale),sources=new Set(all.filter(m=>!m.stale).map(m=>m.source));
  const live=document.querySelector('.guerra-live');
  if(live){live.textContent=!all.length?'CONECTANDO':stale.length===all.length?'ÚLTIMA LEITURA':stale.length?'TELEMETRIA PARCIAL':sources.size>1?'TELEMETRIA MISTA':sources.has('direct')?'TELEMETRIA DIRETA':'TELEMETRIA ONLINE';live.style.color=stale.length?'#f2c66d':'';}
  let box=document.getElementById('war-data-status');
  if(!box){box=document.createElement('div');box.id='war-data-status';box.setAttribute('role','status');box.style.cssText='position:relative;margin:12px;padding:10px 14px;border:1px solid #887337;border-radius:10px;background:#201c10;color:#f2dda0;font:13px/1.5 Arial,sans-serif;';(document.querySelector('main')||document.body).prepend(box);}
  box.hidden=!stale.length;if(!stale.length)return;
  const labels={campaigns:'Planetas, jogadores e regiões',planets:'Planetas',assignments:'Ordem Maior',dispatches:'Despachos',dss:'DSS',steam:'Steam'};
  const text=document.createElement('div');text.textContent='A atualização está demorando. '+(stale.some(m=>m.time)?'Últimos dados válidos preservados. ':'Conectando às fontes de dados. ');
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Ver leituras e diagnóstico';details.append(summary);
  for(const m of stale){const line=document.createElement('div');line.textContent=(labels[m.name]||m.name)+': '+(m.time?new Date(m.time).toLocaleString('pt-BR'):'sem leitura salva')+' · '+(m.source||'fonte pendente')+' · '+(m.error||'aguardando atualização');details.append(line);}
  const button=document.createElement('button');button.type='button';button.textContent='Tentar atualizar';button.disabled=inflight.size>0;button.style.cssText='margin-top:6px;padding:7px 10px;border:1px solid #887337;border-radius:7px;background:#302913;color:#ffe19b;cursor:pointer';button.addEventListener('click',refresh);
  box.replaceChildren(text,details,button);
 }
 function refresh(){
  // O botão não ignora Retry-After nem cria uma rajada quando a rede volta.
  for(const [key,value]of retries)if(value.next<=Date.now())retries.delete(key);
  window.dispatchEvent(new Event('hdbr-telemetry-retry'));notice();
 }
 function due(){return !metadata.size||[...metadata.values()].some(m=>Date.now()>=(m.next||0));}
 async function request(url,headers,isCentral){
  const execute=async()=>{
   const blocked=Number(read(PREFIX+(isCentral?'central-blocked':'blocked')))||0;
   if(blocked>Date.now())throw Error('HTTP 429; nova tentativa após '+new Date(blocked).toLocaleTimeString('pt-BR'));
   if(!isCentral){const delay=nextCall-Date.now();if(delay>0)await new Promise(r=>setTimeout(r,delay));nextCall=Date.now()+2600;}
   const controller=new AbortController(),timeout=Math.max(1000,Number(isCentral?cfg.timeoutMs:cfg.directTimeoutMs)||(isCentral?45000:15000)),timer=setTimeout(()=>controller.abort(),timeout);
   const start=Date.now();let response;
   try{
    response=await fetch(url,{headers,cache:'no-store',signal:controller.signal});
    if(response.status===429){const raw=response.headers.get('Retry-After'),seconds=Number(raw);const delay=raw!==null&&Number.isFinite(seconds)?seconds*1000:Date.parse(raw)-Date.now();write(PREFIX+(isCentral?'central-blocked':'blocked'),Date.now()+Math.max(1000,Number.isFinite(delay)?delay:60000));}
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json();diagnostics.push({source:isCentral?'central':'community',path:new URL(url,location.href).pathname,durationMs:Date.now()-start,status:response.status,time:Date.now()});return data;
   }catch(e){const reason=['AbortError','TimeoutError'].includes(e.name)?`Tempo limite de ${Math.round(timeout/1000)} segundos`:e.message==='Failed to fetch'?'Falha de conexão ou acesso do navegador':e.message;
    const entry={source:isCentral?'central':'community',path:new URL(url,location.href).pathname,durationMs:Date.now()-start,status:response?.status||null,error:reason,time:Date.now()};diagnostics.push(entry);console.warn('[HDBR telemetria]',entry);throw Error(reason);
   }finally{clearTimeout(timer);if(diagnostics.length>30)diagnostics.splice(0,diagnostics.length-30);}
  };
  if(isCentral)return execute();const task=queue.then(execute,execute);queue=task.catch(()=>{});return task;
 }
 async function get(url,name,ttl,headers,legacy){
  const key=PREFIX+url;
  if(inflight.has(key))return inflight.get(key);
  const run=async()=>{
   const stored=read(key),resident=memory.get(key);let saved=resident&&(!stored||resident.time>=stored.time)?resident:stored;
   if(!saved&&usable(legacy,name)){saved=legacy;write(key,saved);}
   const life=critical.has(name)?60000:Math.max(60000,ttl||60000);
   const mark=(stale,next,error='')=>{metadata.set(url,{time:saved?.time||0,stale,name,next,error,source:saved?.source||'community'});notice();};
   if(usable(saved,name)&&Date.now()<(saved.next||saved.time+life)){mark(!!saved.stale,saved.next||saved.time+life,saved.error);return saved.data;}
   const backoff=retries.get(key)||{},blocked=Number(read(PREFIX+(central?'central-blocked':'blocked')))||0,next=Math.max(backoff.next||0,blocked);
   if(Date.now()<next){mark(true,next,backoff.error||'Limite temporário de consultas');if(usable(saved,name))return saved.data;throw Error(backoff.error||'Aguardando nova consulta.');}
   try{
    const path=new URL(url,location.href).pathname;
    if(central){const target=new URL(central);if(target.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(target.hostname))throw Error('Central deve usar HTTPS');
     const item=await request(central+path,{Accept:'application/json'},true);
     if(!usable(item,name)||typeof item.stale!=='boolean'||!['direct','community','steam'].includes(item.source))throw Error('Resposta da central inválida');
     const next=Number(item.next);saved={data:item.data,time:item.time,source:item.source,stale:item.stale,error:item.error||'',next:Number.isFinite(next)?Math.max(Date.now()+1000,Math.min(next,Date.now()+life)):Date.now()+10000};
    }else{const data=await request(url,headers,false);if(!valid(data,name))throw Error('Resposta da API inválida');saved={time:Date.now(),data,source:'community',stale:false};}
    memory.set(key,saved);write(key,saved);retries.delete(key);mark(!!saved.stale,saved.next||saved.time+life,saved.error);return saved.data;
   }catch(e){const failures=(backoff.failures||0)+1,next=Math.max(Date.now()+Math.min(60000,10000*failures),blocked);retries.set(key,{failures,next,error:e.message});mark(true,next,e.message);if(usable(saved,name))return saved.data;throw e;}
  };
  const task=run();inflight.set(key,task);try{return await task}finally{inflight.delete(key);notice();}
 }
 window.HDBRWarData={get,meta:url=>metadata.get(url),hasStale:()=>[...metadata.values()].some(m=>m.stale),due,refresh,diagnostics:()=>diagnostics.map(r=>({...r})),centralEnabled:!!central};
 window.addEventListener('online',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();
