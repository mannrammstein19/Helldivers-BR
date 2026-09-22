(() => {
 const media=matchMedia('(max-width:768px)'),opened=new Set();
 function sync(){
  const root=document.getElementById('ordem-maior');if(!root)return;
  if(!media.matches){
   root.querySelectorAll('.order-task-details').forEach(d=>d.replaceWith(d.querySelector('.guerra-mo-meta')));
   const hero=root.querySelector('.order-mobile-hero');
   if(hero){hero._slots.forEach(({node,slot})=>slot.replaceWith(node));hero.remove();}
   return;
  }
  const article=root.querySelector('.guerra-order');
  if(article&&!article.querySelector('.order-mobile-hero')){
   const title=article.querySelector('h3'),summary=article.querySelector('.guerra-mo-summary');
   if(title&&summary){
    const hero=document.createElement('header');hero.className='order-mobile-hero';hero._slots=[];
    [title,summary].forEach(node=>{const slot=document.createComment('mobile-layout');node.replaceWith(slot);hero._slots.push({node,slot});hero.append(node);});
    article.prepend(hero);
   }
  }
  root.querySelectorAll('.guerra-mo-task').forEach((card,i)=>{
   const meta=card.querySelector('.guerra-mo-meta');if(!meta||meta.closest('details'))return;
   const key=card.querySelector('h4')?.textContent||String(i);
   const details=document.createElement('details'),summary=document.createElement('summary');
   details.className='order-task-details';summary.textContent='Ritmo e previsão';details.open=opened.has(key);
   details.append(summary);meta.replaceWith(details);details.append(meta);
   details.addEventListener('toggle',()=>{if(details.isConnected){if(details.open)opened.add(key);else opened.delete(key);}});
  });
 }
 function start(){const root=document.getElementById('ordem-maior');if(!root)return;new MutationObserver(sync).observe(root,{childList:true,subtree:true});media.addEventListener('change',sync);sync();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
