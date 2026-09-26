/* Telemetria: cache preservado, recuperação curta e limites do servidor respeitados. */
(()=>{'use strict';
 const PREFIX='hdbr_telemetry_v1:',MAX_AGE=86400000,inflight=new Map(),memory=new Map(),metadata=new Map(),retries=new Map();
 const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
 const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
 const critical=new Set(['planets','campaigns','assignments']);
 function valid(data,name){return ['planets','campaigns','assignments','dispatches','dss','steam'].includes(name)?Array.isArray(data)&&(name!=='planets'||data.length>0):data!=null;}
 function notice(){
  if(!document.body)return;
  const all=[...metadata.values()],stale=all.filter(m=>m.stale);
  const live=document.querySelector('.guerra-live');
  if(live){live.textContent=!all.length?'CONECTANDO':stale.length===all.length?'SEM ATUALIZAÇÃO':stale.length?'TELEMETRIA PARCIAL':'TELEMETRIA ONLINE';live.style.color=stale.length?'#f2c66d':'';}
  let box=document.getElementById('war-data-status');
  if(!box){box=document.createElement('div');box.id='war-data-status';box.setAttribute('role','status');box.style.cssText='position:relative;margin:12px;padding:12px 16px;border:1px solid #887337;border-radius:12px;background:#201c10;color:#f2dda0;font:13px/1.5 Arial,sans-serif;';(document.querySelector('main')||document.body).prepend(box);}
  box.hidden=!stale.length;
  if(!stale.length)return;
  const labels={campaigns:'Planetas, jogadores e regiões',planets:'Catálogo de planetas',assignments:'Ordem Maior',dispatches:'Despachos',dss:'DSS',steam:'Steam'};
  const blocked=Number(read(PREFIX+'blocked'))||0;
  const text=document.createElement('div');
  text.textContent=(stale.length===all.length?'Sem atualização da API. ':'Comunicação parcial. ')+(blocked>Date.now()?'Limite temporário da API; nova tentativa após '+new Date(blocked).toLocaleTimeString('pt-BR')+'. ':'Tentativas com espera de 10 a 30 segundos, verificadas a cada 10 segundos nesta aba. ');
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Ver últimas leituras e falhas';details.append(summary);
  for(const m of stale){const line=document.createElement('div');line.textContent=(labels[m.name]||m.name)+': '+(m.time?'leitura salva de '+new Date(m.time).toLocaleString('pt-BR'):'sem leitura salva')+' · '+(m.error||'aguardando nova consulta');details.append(line);}
  const button=document.createElement('button');button.type='button';button.textContent='Tentar atualizar agora';button.disabled=blocked>Date.now()||inflight.size>0;button.style.cssText='margin-top:8px;padding:9px 12px;border:1px solid #887337;border-radius:8px;background:#302913;color:#ffe19b;cursor:pointer';button.addEventListener('click',refresh);
  box.replaceChildren(text,details,button);
 }
 function refresh(){
  if((Number(read(PREFIX+'blocked'))||0)>Date.now()){notice();return;}
  retries.clear();for(const m of metadata.values())if(m.stale)m.next=0;
  window.dispatchEvent(new Event('hdbr-telemetry-retry'));
 }
 function due(){return !metadata.size||[...metadata.values()].some(m=>Date.now()>=Math.max(m.next||0,Number(read(PREFIX+'blocked'))||0));}
 async function get(url,name,ttl,headers,legacy){
  const key=PREFIX+url;
  const run=async()=>{
   const stored=read(key),resident=memory.get(key);
   let saved=stored&&(!resident||stored.time>resident.time)?stored:resident||stored;
   if(!saved&&legacy&&valid(legacy.data,name)){saved=legacy;write(key,saved);}
   const now=Date.now(),life=critical.has(name)?30000:Math.max(30000,ttl||60000),usable=saved&&valid(saved.data,name)&&now-saved.time<=MAX_AGE&&saved.time<=now;
   const mark=(stale,next,error='')=>{metadata.set(url,{time:saved?.time||0,stale,name,next,error});notice();};
   if(usable&&now-saved.time<life){mark(false,saved.time+life);return saved.data;}
   // Esperas de falhas comuns são apenas desta aba. Não herdar os 5 minutos da versão antiga.
   const backoff=retries.get(key)||{},blocked=Number(read(PREFIX+'blocked'))||0;
   const next=Math.max(backoff.next||0,blocked);
   if(now<next){mark(true,next,blocked>now?'Limite de consultas da API':backoff.error);if(usable)return saved.data;throw Error('Aguardando nova consulta.');}
   try{
    const response=await fetch(url,{headers,cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(response.status===429){const raw=response.headers.get('Retry-After');const wait=raw?(Number.isFinite(Number(raw))?Number(raw)*1000:Date.parse(raw)-Date.now()):60000;write(PREFIX+'blocked',Date.now()+Math.max(1000,Number.isFinite(wait)?wait:60000));}
    if(!response.ok)throw Error('API HTTP '+response.status);
    const data=await response.json();if(!valid(data,name))throw Error('Resposta da API inválida');
    saved={time:Date.now(),data};memory.set(key,saved);write(key,saved);retries.delete(key);mark(false,saved.time+life);return data;
   }catch(error){
    const failures=(backoff.failures||0)+1,delay=Math.min(30000,10000*failures);
    const reason=error.name==='TimeoutError'||error.name==='AbortError'?'Tempo limite de 8 segundos':error.message==='Failed to fetch'?'Falha de conexão com a API (rede ou acesso do navegador)':error.message;
    const next=Math.max(Date.now()+delay,Number(read(PREFIX+'blocked'))||0);retries.set(key,{failures,next,error:reason});mark(true,next,reason);if(usable)return saved.data;throw error;
   }
  };
  if(inflight.has(key))return inflight.get(key);
  const task=run();inflight.set(key,task);try{return await task}finally{inflight.delete(key);notice();}
 }
 window.HDBRWarData={get,meta:url=>metadata.get(url),hasStale:()=>[...metadata.values()].some(m=>m.stale),due,refresh};
 window.addEventListener('online',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();
