(() => {
 'use strict';
 const base=new URL('.',document.currentScript.src);
 const iconFiles={'Início':'inicio','Guerra':'guerra','Ordem':'ordem','Mapa':'mapa','Arsenal':'arsenal','Menu':'menu'};
 function appendIcon(target,label,fallback){
  const img=document.createElement('img');
  img.className='mobile-nav-icon';img.alt='';img.setAttribute('aria-hidden','true');
  img.width=28;img.height=28;img.src=new URL(`icons/${iconFiles[label]}.png`,base).href;
  img.addEventListener('error',()=>{
   const span=document.createElement('span');span.setAttribute('aria-hidden','true');span.textContent=fallback;img.replaceWith(span);
  },{once:true});
  target.append(img,document.createTextNode(label));
 }
 function init(){
  if(document.querySelector('[data-hd-navigation]'))return;
  document.querySelector('.mobile-dock')?.remove();
  const nav=document.createElement('nav');nav.className='mobile-dock';nav.dataset.hdNavigation='';nav.setAttribute('aria-label','Navegação principal');
  const entries=[['index.html','⌂','Início'],['guerra.html','⚔','Guerra'],['guerra.html#ordem-maior','◆','Ordem'],['mapa-galatico.html','◎','Mapa'],['estratagemas.html','↯','Arsenal']];
  for(const [path,icon,label] of entries){
   const link=document.createElement('a');link.href=new URL(path,base);appendIcon(link,label,icon);nav.append(link);
  }
  const toggle=document.getElementById('menu-toggle')||document.getElementById('menu-btn'),sidebar=document.querySelector('.sidebar');
  if(toggle&&sidebar){
   sidebar.id||='hd-main-menu';
   const menu=document.createElement('button');menu.type='button';menu.id='dock-menu';appendIcon(menu,'Menu','☰');
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
