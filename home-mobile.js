(() => {
 'use strict';
 const track = document.querySelector('.mission-track');
 if(!track)return;
 const cards = [...track.children];
 const dots = [...document.querySelectorAll('.mission-pagination button')];
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 dots.forEach((dot, i) => dot.addEventListener('click', () => track.scrollTo({left:cards[i].offsetLeft-cards[0].offsetLeft,behavior:reduced.matches?'instant':'smooth'})));
 let frame;
 track.addEventListener('scroll', () => {
  cancelAnimationFrame(frame); frame=requestAnimationFrame(() => {
   const current = cards.reduce((best,c,i) => Math.abs(c.offsetLeft-cards[0].offsetLeft-track.scrollLeft)<Math.abs(cards[best].offsetLeft-cards[0].offsetLeft-track.scrollLeft)?i:best,0);
   dots.forEach((d,i)=>d.setAttribute('aria-pressed',String(i===current)));
  });
 },{passive:true});
 track.addEventListener('keydown',e=>{
  if(e.target!==track || !['ArrowLeft','ArrowRight'].includes(e.key))return;
  e.preventDefault(); track.scrollBy({left:(cards[0].offsetWidth+12)*(e.key==='ArrowRight'?1:-1),behavior:reduced.matches?'instant':'smooth'});
 });
 // Reuse the existing order renderer and data, without requesting a second feed.
 const order=document.getElementById('hd-ov-order'),sourceStatus=document.getElementById('hd-ov-status');
 const summaryTitle=document.getElementById('mobile-order-title'),summaryBrief=document.getElementById('mobile-order-brief');
 const summaryState=document.getElementById('mobile-order-state'),summaryMeta=document.getElementById('mobile-order-meta');
 function syncOrder(){
  const title=order.querySelector('.hd-ov-title'),stale=!sourceStatus.textContent.includes('DADOS ATUALIZADOS');
  summaryTitle.textContent=title?.textContent||'A missão continua.';
  summaryBrief.textContent=order.querySelector('.hd-ov-brief')?.textContent||'Consulte os objetivos e o andamento da operação na Central de Guerra.';
  summaryState.textContent=title?(order.classList.contains('order-completed')?'CONCLUÍDA — AGUARDANDO NOVAS ORDENS':order.classList.contains('order-failed')?'PERDIDA — AGUARDANDO NOVAS ORDENS':order.classList.contains('order-unknown')?'RESULTADO INDISPONÍVEL — AGUARDANDO NOVAS ORDENS':order.classList.contains('order-pending')?'AGUARDANDO CONFIRMAÇÃO DO RESULTADO':stale?'ÚLTIMO REGISTRO':'EM ANDAMENTO'):'CONSULTE A CENTRAL';
  summaryMeta.replaceChildren();
  [...order.querySelectorAll('.hd-mo-summary .hd-ov-statbox')].slice(0,2).forEach(stat=>{
   const label=stat.querySelector('small'),value=stat.querySelector('strong');if(!label||!value)return;
   const item=document.createElement('span'),strong=document.createElement('strong');
   item.append(label.textContent+': ');strong.textContent=value.textContent;item.append(strong);summaryMeta.append(item);
  });
  summaryMeta.hidden=!summaryMeta.children.length;
  const objectives=document.getElementById('mobile-order-objectives');
  if(objectives){const source=order.querySelector('.hd-mo-objectives-grid');objectives.replaceChildren(...(source?[...source.children].map(card=>card.cloneNode(true)):[]));}
 }
 new MutationObserver(syncOrder).observe(order,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
 new MutationObserver(syncOrder).observe(sourceStatus,{childList:true,subtree:true});
 syncOrder();
})();
