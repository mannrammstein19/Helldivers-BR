/* Boletim usa as leituras existentes: não cria consultas ou acontecimentos. */
window.HDBRMapBulletin=(()=>{'use strict';
 const text=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function items(dispatches,planets,dispatchMeta,planetMeta){
  const ds=Array.isArray(dispatches)?dispatches:dispatches?.dispatches||[];
  const out=ds.slice(0,3).map(d=>({name:'Alto Comando',message:text(d.message||d.text),stale:dispatchMeta?.stale===true,time:dispatchMeta?.time})).filter(d=>d.message);
  for(const p of (planets||[]).filter(p=>p.event).sort((a,b)=>(b.statistics?.playerCount||0)-(a.statistics?.playerCount||0)).slice(0,3))out.push({name:text(p.name),message:'Em defesa · '+Number(p.statistics?.playerCount||0).toLocaleString('pt-BR')+' Helldivers em operação',stale:planetMeta?.stale===true,time:planetMeta?.time});
  return out;
 }
 let signature='';
 function render(dispatches,planets,dispatchMeta,planetMeta){
  const track=document.getElementById('mapa-bulletin-track'),content=document.getElementById('mapa-bulletin-content');if(!track||!content)return;
  const list=items(dispatches,planets,dispatchMeta,planetMeta),key=JSON.stringify(list);if(key===signature)return;signature=key;
  const markup=list.map(d=>'<span class="mapa-bulletin-item"><strong>'+esc(d.name)+'</strong> · '+(d.stale?'Última leitura · ':'')+esc(d.message)+'</span>').join('');
  track.innerHTML=markup?markup+'<span aria-hidden="true">'+markup+'</span>':'Nenhum comunicado disponível nesta leitura.';
  track.style.setProperty('--bulletin-duration',Math.max(45,list.reduce((sum,d)=>sum+d.message.length,0)/8)+'s');
  track.classList.toggle('is-scrolling',list.length>0&&!list.some(d=>d.stale));
  content.innerHTML=list.map(d=>'<p><strong>'+esc(d.name)+'</strong><span>'+esc(d.message)+'</span><small>'+(d.stale?'Última leitura salva · ':'Leitura · ')+(d.time?esc(new Date(d.time).toLocaleString('pt-BR')):'Horário não informado')+'</small></p>').join('')||'<p>Nenhum comunicado disponível nesta leitura.</p>';
 }
 return {items,render};
})();
