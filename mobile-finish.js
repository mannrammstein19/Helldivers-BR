(() => {
 const mq=matchMedia('(max-width:768px)');
 function start(){
  if(document.body.hasAttribute('data-order-only'))return;
  const root=document.getElementById('ordem-maior');if(!root)return;
  let opened=false;
  function sync(){
   const card=root.querySelector('.guerra-order');if(!card)return;
   const wrap=card.querySelector('.mobile-war-objectives');
   if(!mq.matches){if(wrap){wrap.replaceWith(...Array.from(wrap.children).filter(e=>e.tagName!=='SUMMARY'));}return;}
   if(wrap)return;
   const head=card.querySelector(':scope>.guerra-mo-head'),grid=card.querySelector(':scope>.guerra-mo-grid');if(!head||!grid)return;
   const details=document.createElement('details'),summary=document.createElement('summary');details.className='mobile-war-objectives';details.open=opened;summary.textContent='Objetivos da Ordem · '+grid.children.length;head.before(details);details.append(summary,head,grid);
   details.addEventListener('toggle',()=>{if(details.isConnected)opened=details.open;});
  }
  new MutationObserver(sync).observe(root,{childList:true,subtree:true});mq.addEventListener('change',sync);sync();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
