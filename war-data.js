/* Cache compartilhado da telemetria. Uma falha nunca substitui a última resposta válida. */
(()=>{'use strict';
 const PREFIX='hdbr_telemetry_v1:',MAX_AGE=86400000,inflight=new Map(),memory=new Map(),metadata=new Map();
 const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
 const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
 function valid(data,name){return ['planets','campaigns','assignments','dispatches','dss','steam'].includes(name)?Array.isArray(data)&&(name!=='planets'||data.length>0):data!=null;}
 function notice(){
  if(!document.body)return;
  let box=document.getElementById('war-data-status');
  const stale=[...metadata.values()].filter(m=>m.stale);
  if(!box){box=document.createElement('div');box.id='war-data-status';box.setAttribute('role','status');box.style.cssText='position:relative;margin:12px;padding:12px 16px;border:1px solid #887337;border-radius:12px;background:#201c10;color:#f2dda0;font:13px/1.5 Arial,sans-serif;';(document.querySelector('main')||document.body).prepend(box);}
  box.hidden=!stale.length;
  if(stale.length){
   const labels={campaigns:'Planetas, jogadores e regiões',planets:'Catálogo de planetas e regiões',assignments:'Ordem Maior',dispatches:'Despachos',dss:'DSS',steam:'Jogadores na Steam'};
   const items=stale.map(m=>(labels[m.name]||'Dados complementares')+': '+(m.time?'leitura salva de '+new Date(m.time).toLocaleString('pt-BR'):'sem leitura disponível'));
   box.textContent='Comunicação parcial · '+items.join(' · ')+'. Os demais dados podem ter leituras mais recentes. Nova tentativa automática após o intervalo de espera.';
  }
 }
 async function get(url,name,ttl,headers,legacy){
  const key=PREFIX+url;
  const run=async()=>{
   const stored=read(key),resident=memory.get(key);
   let saved=stored&&(!resident||stored.time>resident.time)?stored:resident||stored;
   if(!saved&&legacy&&valid(legacy.data,name)){saved=legacy;write(key,saved);}
   const now=Date.now(),usable=saved&&valid(saved.data,name)&&now-saved.time<=MAX_AGE;
   const mark=stale=>{metadata.set(url,{time:saved?.time||0,stale,name});notice();};
   if(usable&&now-saved.time<Math.max(60000,ttl||0)){mark(false);return saved.data;}
   const backoff=read(key+':retry')||{};const blocked=read(PREFIX+'blocked')||0;
   if(now<Math.max(backoff.next||0,blocked)){mark(true);if(usable)return saved.data;throw Error('Aguardando intervalo para nova consulta.');}
   try{
    const response=await fetch(url,{headers,cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(response.status===429){const raw=response.headers.get('Retry-After');const wait=raw?(Number.isFinite(Number(raw))?Number(raw)*1000:Date.parse(raw)-Date.now()):60000;write(PREFIX+'blocked',Date.now()+Math.max(60000,Number.isFinite(wait)?wait:60000));}
    if(!response.ok)throw Error('API HTTP '+response.status);
    const data=await response.json();if(!valid(data,name))throw Error('Resposta da API inválida.');
    saved={time:Date.now(),data};memory.set(key,saved);write(key,saved);write(key+':retry',{next:0,failures:0});mark(false);return data;
   }catch(error){const failures=(backoff.failures||0)+1;write(key+':retry',{failures,next:Date.now()+Math.min(300000,60000*2**Math.min(failures-1,3))});mark(true);if(usable)return saved.data;throw error;}
  };
  if(inflight.has(key))return inflight.get(key);
  const task=run();inflight.set(key,task);try{return await task}finally{inflight.delete(key)}
 }
 window.HDBRWarData={get,meta:url=>metadata.get(url),hasStale:()=>[...metadata.values()].some(m=>m.stale)};
})();
