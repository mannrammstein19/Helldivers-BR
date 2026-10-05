(() => {
 'use strict';
 const media=matchMedia('(min-width:769px)');let serial=0;
 function decorate(card){
  const title=card.querySelector(':scope > .hd-ov-title,:scope > h3');
  if(title && /^ordem maior$/i.test(title.textContent.trim()) && !title.querySelector('.order-hud-emblem')){
   const text=document.createElement('span');text.className='order-hud-title-text';text.textContent=title.textContent;
   const frame=document.createElement('span');frame.className='order-hud-emblem';frame.setAttribute('aria-hidden','true');
   const img=document.createElement('img');img.src='imagens/ui/order-major-hud.png';img.alt='';frame.append(img);title.replaceChildren(text,frame);title.classList.add('order-hud-title');
  }
 }
 function measure(card){
  const wrap=card.querySelector('.order-objectives-popover');if(!wrap)return;
  const available=Math.max(0,wrap.getBoundingClientRect().top-card.getBoundingClientRect().top-23);
  card.style.setProperty('--order-panel-space',available+'px');
 }
 function sync(root){
  const card=root.querySelector('.hd-ov-order-main,.guerra-order');if(!card)return;decorate(card);
  const grid=card.querySelector(':scope > .hd-mo-objectives-grid,:scope > .guerra-mo-grid');
  if(!grid)return;
  let wrap=card.querySelector('.order-objectives-popover');
  if(!media.matches){wrap?.remove();card.classList.remove('order-desktop-summary');card.style.removeProperty('--order-original-height');return;}
  if(!wrap){
   card.style.setProperty('--order-original-height',card.getBoundingClientRect().height+'px');
   wrap=document.createElement('div');wrap.className='order-objectives-popover';
   const id='order-objectives-panel-'+(++serial);
   wrap.innerHTML='<button type="button" class="order-show-objectives" aria-expanded="false" aria-controls="'+id+'">◆ Objetivos da Ordem <span>Mostrar ▴</span></button><section class="order-objectives-panel" id="'+id+'" aria-label="Objetivos da Ordem" hidden><header><h2>◆ Objetivos da Ordem</h2><button type="button" aria-label="Fechar objetivos">✕</button></header><div class="order-objectives-content"></div></section>';
   const button=wrap.firstElementChild,panel=wrap.lastElementChild;
   const setOpen=(open,focus=false)=>{measure(card);panel.hidden=!open;button.setAttribute('aria-expanded',String(open));button.querySelector('span').textContent=open?'Ocultar ▾':'Mostrar ▴';if(focus)button.focus();};
   button.addEventListener('click',()=>setOpen(panel.hidden));
   panel.querySelector('button').addEventListener('click',()=>setOpen(false,true));
   wrap.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();setOpen(false,true);}});
   card.append(wrap);card.classList.add('order-desktop-summary');
   if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>measure(card)).observe(card);
   requestAnimationFrame(()=>measure(card));
  }
  const signature=grid.outerHTML;
  if(wrap._signature!==signature){wrap._signature=signature;const clone=grid.cloneNode(true);clone.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));clone.querySelectorAll('.hd-mo-task,.guerra-mo-task').forEach(task=>{
    const bar=task.querySelector('.hd-mo-task-progress,.guerra-mo-progress');
    const label=task.querySelector('.hd-mo-task-progress-label,.guerra-mo-progress-label');
    if(bar&&label){bar.classList.add('order-labeled-progress');bar.append(label);}
   });wrap.querySelector('.order-objectives-content').replaceChildren(clone);}
 }
 function start(){const roots=[document.getElementById('hd-ov-order'),document.getElementById('ordem-maior')].filter(Boolean);roots.forEach(root=>{new MutationObserver(()=>sync(root)).observe(root,{childList:true,subtree:true,characterData:true});sync(root);});media.addEventListener('change',()=>roots.forEach(sync));}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
