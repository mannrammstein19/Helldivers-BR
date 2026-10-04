/* Boletim usa as leituras existentes; tradução reaproveita o serviço do site. */
window.HDBRMapBulletin=(()=>{'use strict';
 const text=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const factions=[
  {pattern:/automaton|aut[oô]mato|cyborg|ciborg/i,name:'Autômatos',file:'logo automatons.png'},
  {pattern:/terminid|termin[ií]deo|inseto/i,name:'Terminídeos',file:'logo terminids.png'},
  {pattern:/illuminat|iluminad/i,name:'Iluminados',file:'logo illuminats.png'}
 ];
 function icons(raw){return factions.filter(f=>f.pattern.test(raw)).map(f=>'<img class="mapa-bulletin-faction" src="imagens/guerra/faccoes/'+f.file+'" alt="'+f.name+'">').join('');}
 function items(dispatches,planets,dispatchMeta,planetMeta){
  const ds=Array.isArray(dispatches)?dispatches:dispatches?.dispatches||[];
  const out=ds.slice(0,3).map(d=>({name:'Alto Comando',message:text(d.message||d.text),dispatch:true,stale:dispatchMeta?.stale===true,time:dispatchMeta?.time})).filter(d=>d.message);
  for(const p of (planets||[]).filter(p=>p.event).sort((a,b)=>(b.statistics?.playerCount||0)-(a.statistics?.playerCount||0)).slice(0,3))out.push({name:text(p.name),message:'Em defesa · '+Number(p.statistics?.playerCount||0).toLocaleString('pt-BR')+' Helldivers em operação',faction:text(p.event.faction),stale:planetMeta?.stale===true,time:planetMeta?.time});
  return out;
 }
 let signature='',generation=0;
 const failures=new Map();
 function paint(list){
  const track=document.getElementById('mapa-bulletin-track'),content=document.getElementById('mapa-bulletin-content');if(!track||!content)return;
  const markup=list.map(d=>'<span class="mapa-bulletin-item">'+icons(d.faction||d.original||d.message)+'<strong>'+esc(d.name)+'</strong> · '+(d.stale?'Última leitura · ':'')+esc(d.message)+'</span>').join('');
  track.innerHTML=markup?markup+'<span aria-hidden="true">'+markup+'</span>':'Nenhum comunicado disponível nesta leitura.';
  track.style.setProperty('--bulletin-duration',Math.max(45,list.reduce((sum,d)=>sum+d.message.length,0)/8)+'s');
  track.classList.toggle('is-scrolling',list.length>0&&!list.some(d=>d.stale));
  content.innerHTML=list.map(d=>'<p>'+icons(d.faction||d.original||d.message)+'<strong>'+esc(d.name)+'</strong><span>'+esc(d.message)+'</span>'+(d.original?'<details><summary>Comunicado original</summary><span lang="en">'+esc(d.original)+'</span></details>':'')+'<small>'+(d.stale?'Última leitura salva · ':'Leitura · ')+(d.time?esc(new Date(d.time).toLocaleString('pt-BR')):'Horário não informado')+'</small></p>').join('')||'<p>Nenhum comunicado disponível nesta leitura.</p>';
 }
 async function render(dispatches,planets,dispatchMeta,planetMeta){
  const list=items(dispatches,planets,dispatchMeta,planetMeta),key=JSON.stringify(list);
  if(key===signature&&!list.some(d=>failures.has(d.message)&&Date.now()-failures.get(d.message)>60000))return;
  signature=key;const token=++generation,translator=window.HDBRMapTranslation;
  const needs=d=>d.dispatch&&translator?.english(d.message);
  paint(list.map(d=>needs(d)?{...d,original:d.message,message:'Traduzindo comunicado do Alto Comando…'}:d));
  const translated=await Promise.all(list.map(async d=>{
   if(!needs(d))return d;
   const original=d.message;
   try{
    if(failures.has(original)&&Date.now()-failures.get(original)<60000)throw new Error('Aguardar nova tentativa');
    const message=await translator.translate(original);
    if(translator.english(message))throw new Error('Tradução indisponível');
    failures.delete(original);return {...d,message,original};
   }catch{if(!failures.has(original)||Date.now()-failures.get(original)>=60000)failures.set(original,Date.now());return {...d,original,message:'Tradução indisponível · abra o comunicado original.'};}
  }));
  if(token===generation)paint(translated);
 }
 return {items,render};
})();
