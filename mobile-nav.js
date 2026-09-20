(() => {
 'use strict';
 const base=new URL('.',document.currentScript.src);
 function init(){
  if(document.querySelector('[data-hd-navigation]'))return;
  document.querySelector('.mobile-dock')?.remove();
  const nav=document.createElement('nav');nav.className='mobile-dock';nav.dataset.hdNavigation='';nav.setAttribute('aria-label','Navegação principal');
  const entries=[['index.html','⌂','Início'],['guerra.html','⚔','Guerra'],['guerra.html#ordem-maior','◆','Ordem'],['mapa-galatico.html','◎','Mapa'],['estratagemas.html','↯','Arsenal']];
  for(const [path,icon,label] of entries){
   const link=document.createElement('a');link.href=new URL(path,base);link.innerHTML=`<span aria-hidden="true">${icon}</span>${label}`;nav.append(link);
  }
  const toggle=document.getElementById('menu-toggle'),sidebar=document.querySelector('.sidebar');
  if(toggle&&sidebar){
   sidebar.id||='hd-main-menu';
   const menu=document.createElement('button');menu.type='button';menu.id='dock-menu';menu.innerHTML='<span aria-hidden="true">☰</span>Menu';
   menu.setAttribute('aria-controls',sidebar.id);toggle.setAttribute('aria-controls',sidebar.id);
   menu.addEventListener('click',()=>toggle.click());nav.append(menu);
   const sync=()=>{const open=sidebar.classList.contains('active');[menu,toggle].forEach(b=>b.setAttribute('aria-expanded',String(open)));};
   new MutationObserver(sync).observe(sidebar,{attributes:true,attributeFilter:['class']});sync();
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sidebar.classList.contains('active')){toggle.click();toggle.focus();}});
   document.addEventListener('click',e=>{if(sidebar.classList.contains('active')&&!sidebar.contains(e.target)&&!toggle.contains(e.target)&&!menu.contains(e.target))toggle.click();});
  }
  const current=()=>nav.querySelectorAll('a').forEach(a=>{
   const url=new URL(a.href),path=location.pathname.endsWith('/')?location.pathname+'index.html':location.pathname;
   const active=url.pathname===path&&(url.hash?url.hash===location.hash:location.hash!=='#ordem-maior');
   if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  });
  current();window.addEventListener('hashchange',current);
  document.body.append(nav);document.body.classList.add('has-mobile-navigation');
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
