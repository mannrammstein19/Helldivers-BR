/* Última referência comprovada no Status do jogo: efeito DSS 1217 em Afoyay Bay.
   Isto é referência planetária, não confirmação de operação da estação. */
window.HDBRMapDSS=(()=>{'use strict';
 const key='hdbr-map-dss-last-v1';
 let last={index:136,name:'AFOYAY BAY',time:1791081370763,source:'planetActiveEffects:1217'};
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&Number.isInteger(saved.index)&&Number.isFinite(saved.time)&&saved.time>last.time&&saved.time<=Date.now())last=saved;}catch{}
 function remember(p,time,source){if(!p||!Number.isFinite(time)||time> Date.now()||time<last.time)return;last={index:Number(p.index),name:p.name,time,source};try{localStorage.setItem(key,JSON.stringify(last));}catch{}}
 function resolve(data,planets,meta,planetMeta){
  const station=Array.isArray(data)?data[0]:null;
  const index=station?.planet?.index??station?.planetIndex;
  const name=String(station?.planet?.name||'').toLowerCase();
  const p=(planets||[]).find(p=>index!=null?String(p.index)===String(index):name&&String(p.name).toLowerCase()===name);
  const active=!!station&&!!p&&!/unknown|desconhecid/i.test(name);
  if(active&&!meta?.stale)remember(p,meta?.time,'space-stations');
  const refs=(planets||[]).filter(p=>(p.activeEffects||[]).some(e=>Number(typeof e==='object'?e.galacticEffectId??e.id:e)===1217));
  if(!active&&refs.length===1&&!planetMeta?.stale)remember(refs[0],planetMeta?.time,'planetActiveEffects:1217');
  const status=active?(meta?.stale?'saved':'active'):Array.isArray(data)?'unavailable':'unknown';
  const host=active?p:(planets||[]).find(p=>String(p.index)===String(last.index));
  return {hostIndex:host?.index??null,hostName:host?.name||last.name,status,stale:meta?.stale===true,last:{...last},label:status==='active'?'DSS · Operacional':status==='saved'?'DSS · Última leitura':status==='unavailable'?'DSS · Indisponível':'DSS · Sem confirmação'};
 }
 return {resolve};
})();
