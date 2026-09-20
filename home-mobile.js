(() => {
 'use strict';
 const track = document.querySelector('.mission-track');
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
 const menu=document.querySelector('.sidebar'), toggle=document.getElementById('menu-toggle'), dock=document.getElementById('dock-menu');
 dock.addEventListener('click',()=>toggle.click());
 new MutationObserver(()=>{
  const open=menu.classList.contains('active');
  toggle.setAttribute('aria-expanded',String(open));dock.setAttribute('aria-expanded',String(open));
 }).observe(menu,{attributes:true,attributeFilter:['class']});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.classList.contains('active')){toggle.click();toggle.focus();}});
 document.addEventListener('click',e=>{if(menu.classList.contains('active')&&!menu.contains(e.target)&&!toggle.contains(e.target)&&!dock.contains(e.target))toggle.click();});
})();
