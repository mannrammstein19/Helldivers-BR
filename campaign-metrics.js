/* Cálculos compartilhados por Guerra e Mapa; nenhuma consulta de rede. */
(() => {
 'use strict';
 const KEY='hdbr_campaign_samples_v1', HOUR=3600000;
 const valid=n=>typeof n==='number'&&Number.isFinite(n);
 let history={};try{history=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
 function progress(p){const s=p?.event||p;return valid(s?.health)&&valid(s?.maxHealth)&&s.maxHealth>0&&s.health>=0&&s.health<=s.maxHealth?(1-s.health/s.maxHealth)*100:null}
 function identity(p){const e=p?.event;return JSON.stringify(e?[p.index,'defense',e.id??null,e.faction,e.maxHealth,e.id!=null?null:e.startTime]:[p.index,'attack',p.currentOwner,p.maxHealth])}
 function observe(planets,reading){
  if(reading?.stale||!valid(reading?.time)||reading.time>Date.now()+60000)return;
  for(const p of planets){const value=progress(p);if(value==null)continue;const key=String(p.index),id=identity(p);
   let entry=history[key];if(!entry||entry.id!==id||!Array.isArray(entry.samples))entry={id,samples:[]};
   const last=entry.samples.at(-1);if(last&&reading.time<=last.time)continue;
   entry.samples=entry.samples.filter(s=>valid(s.time)&&valid(s.progress)&&reading.time-s.time<=30*60000);
   if(!last||reading.time-last.time>=30000)entry.samples.push({time:reading.time,progress:value});
   history[key]=entry;
  }
  for(const key of Object.keys(history))if(!history[key]?.samples?.length||reading.time-history[key].samples.at(-1).time>86400000)delete history[key];
  try{localStorage.setItem(KEY,JSON.stringify(history))}catch{}
 }
 function metrics(p,reading,now=Date.now()){
  const value=progress(p),e=p?.event,start=Date.parse(e?.startTime||''),end=Date.parse(e?.endTime||'');
  const clock=reading?.stale&&valid(reading?.time)?reading.time:now;
  const duration=end-start,enemyRate=duration>0?100/(duration/HOUR):null;
  const enemyProgress=e&&duration>0&&clock<=end?Math.max(0,Math.min(100,(clock-start)/duration*100)):null;
  let rate=null,source='Aguardando nova leitura';
  const entry=history[String(p?.index)],samples=entry?.id===identity(p)&&Array.isArray(entry.samples)?entry.samples:[],first=samples?.[0],last=samples?.at(-1);
  const fresh=!reading?.stale&&valid(reading?.time)&&now-reading.time>=-60000&&now-reading.time<=180000;
  if(fresh&&first&&last&&last.time-first.time>=30000&&now-last.time<=180000){rate=(last.progress-first.progress)/((last.time-first.time)/HOUR);source='Ritmo observado';}
  else if(fresh&&e&&value!=null&&duration>0&&clock>start&&clock<end&&clock-start>=300000){rate=value/((clock-start)/HOUR);source='Média desde o início';}
  const etaHours=value!=null&&rate>0&&value<100?(100-value)/rate:null;
  return {progress:value,rate:Number.isFinite(rate)?rate:null,source,enemyProgress,enemyRate,etaHours,remainingHours:e&&Number.isFinite(end)?Math.max(0,(end-clock)/HOUR):null};
 }
 // Mapeamentos publicados: 0 liberação/defesa, 1 reconhecimento, 2 história.
 // Alta prioridade, invasão e urgência não são inferidas de facção ou Ordem Maior.
 function classify(p,c){if(c?.type===1)return {label:'Reconhecimento',symbol:'⌖'};if(c?.type===2)return {label:'Campanha especial',symbol:'★'};if(p?.event)return {label:'Defesa',symbol:'🛡'};if(c?.type===0)return {label:'Libertação',symbol:'⚑'};return {label:'Campanha',symbol:'⚑'}}
 window.HDBRCampaignMetrics=Object.freeze({progress,identity,observe,metrics,classify});
})();
