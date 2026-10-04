/* Boletim limitado, sem chamadas próprias, sem duplicação de faixas. */
window.HDBRMapBulletin=(()=>{'use strict';
 const text=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const factions=[
  {pattern:/automaton|aut[oô]mato|cyborg|ciborg/i,name:'Autômatos',file:'logo automatons.png'},
  {pattern:/terminid|termin[ií]deo|inseto/i,name:'Terminídeos',file:'logo terminids.png'},
  {pattern:/illuminat|iluminad/i,name:'Iluminados',file:'logo illuminats.png'}
 ];
 function icons(raw){return factions.filter(f=>f.pattern.test(raw)).map(f=>'<img class="mapa-bulletin-faction" src="imagens/guerra/faccoes/'+f.file+'" alt="'+f.name+'">').join('');}
 function localized(raw){
  if(!raw)return '';
  let cached;try{cached=JSON.parse(localStorage.getItem('hdbr-home-ptbr-v1')||'{}')[raw];}catch{}
  if(cached)return text(cached);
  // Without a confirmed translation show a factual notice, not an invented summary.
  if(/\b(the|our|must|have|has|with|from|will|their|this|that|successfully)\b/i.test(raw))return 'Novo comunicado do Alto Comando disponível nos despachos.';
  return raw;
 }
 function items(dispatches,planets,dispatchMeta,planetMeta,options={}){
  const ds=Array.isArray(dispatches)?dispatches:dispatches?.dispatches||[];
  const out=ds.slice(0,3).map(d=>{const raw=text(d.message||d.text);const message=localized(raw);return {name:'Alto Comando',message,dispatch:true,stale:dispatchMeta?.stale===true,time:dispatchMeta?.time};}).filter(d=>d.message);
  const active=new Set((options.activeIndexes||[]).map(String));
  for(const p of (planets||[]).filter(p=>p.event||active.has(String(p.index))).sort((a,b)=>(b.statistics?.playerCount||0)-(a.statistics?.playerCount||0)).slice(0,3)){
   const m=options.metrics?.(p),defending=!!p.event;
   let message=defending?'Defesa em andamento':'Campanha de libertação em andamento';
   if(m?.progress!=null)message+=' · '+Number(m.progress).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%';
   message+=' · '+Number(p.statistics?.playerCount||0).toLocaleString('pt-BR')+' Helldivers em operação';
   if(defending&&Number.isFinite(m?.rate)&&Number.isFinite(m?.remainingHours)&&m.remainingHours>0&&m.progress!=null&&m.progress<100&&m.rate<(100-m.progress)/m.remainingHours)message+=' · Sugestão do portal: reforçar esta defesa';
   else if(!defending&&m?.progress>=90&&m.progress<100)message+=' · Reta final da libertação';
   out.push({name:text(p.name),message,faction:text(p.event?.faction||p.currentOwner),stale:planetMeta?.stale===true,time:planetMeta?.time});
  }
  const dss=options.dss;
  if(dss?.hostIndex!=null)out.push({name:'DSS',message:dss.status==='active'?'Localização informada nesta leitura: '+text(dss.hostName||dss.last.name):dss.status==='unknown'?'Localização atual sem confirmação · última referência: '+text(dss.last.name):dss.status==='saved'?'Última localização informada: '+text(dss.hostName||dss.last.name):'Indisponível nesta leitura · última referência: '+text(dss.last.name),stale:dss.stale===true,time:dss.last.time});
  return out;
 }
 let list=[],index=0,timer=null,signature='',enabled=true,motion=true,lastPaint='';
 function paint(){
  const track=document.getElementById('mapa-bulletin-track');if(!track)return;
  const d=list[index%Math.max(1,list.length)];
  const message=d?icons(d.faction||d.message)+'<strong>'+esc(d.name)+'</strong> · '+(d.stale?'Última leitura · ':'')+esc(d.message.slice(0,360)):'Nenhum comunicado disponível nesta leitura.';
  if(message!==lastPaint){
   track.innerHTML='<span class="mapa-bulletin-message">'+message+'</span>';lastPaint=message;
   const line=track.firstElementChild;
   // Measure once per changed message; only the compositor runs between updates.
   const overflow=line?Math.max(0,line.scrollWidth-track.clientWidth):0;
   if(motion&&overflow>0&&!window.matchMedia?.('(prefers-reduced-motion:reduce)')?.matches)
    line.animate?.([{transform:'translateX(0)',offset:0},{transform:'translateX(0)',offset:.15},{transform:'translateX(-'+overflow+'px)',offset:.85},{transform:'translateX(-'+overflow+'px)',offset:1}],{duration:10000,fill:'forwards'});
  }
 }
 function schedule(){
  if(timer!=null)clearTimeout(timer);timer=null;
  if(!enabled||!motion||document.hidden||window.matchMedia?.('(prefers-reduced-motion:reduce)')?.matches||list.length<2)return;
  timer=setTimeout(()=>{timer=null;index=(index+1)%list.length;paint();schedule();},10000);
 }
 function configure(options={}){
  enabled=options.enabled!==false;motion=options.motion!==false;
  if(!motion||!enabled)document.getElementById('mapa-bulletin-track')?.firstElementChild?.getAnimations?.().forEach(a=>a.cancel());
  if(enabled)paint();schedule();
 }
 function render(dispatches,planets,dispatchMeta,planetMeta,options={}){
  const next=items(dispatches,planets,dispatchMeta,planetMeta,options).slice(0,7),key=JSON.stringify(next);
  if(key===signature)return;
  signature=key;list=next;index%=Math.max(1,list.length);
  if(enabled)paint();if(timer==null||list.length<2)schedule();
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&enabled)paint();schedule();});
 return {items,render,configure};
})();
