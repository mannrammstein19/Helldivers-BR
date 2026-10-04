/* Atualizações locais: preserva imagens, foco e elementos em vez de desmontar o mapa. */
window.HDBRMapDOM=(()=>{
 'use strict';
 function key(n){
  if(n.nodeType!==1)return '#'+n.nodeType;
  const a=name=>n.getAttribute(name);
  return n.tagName+'|'+(a('id')|| (a('data-index')!=null?'planet:'+a('data-index'):a('data-a')!=null?'route:'+a('data-a')+':'+a('data-b'):a('data-source')!=null?'attack:'+a('data-source')+':'+a('data-target')+':'+(a('class')||'').split(' ')[0]:(a('class')||'').split(' ')[0]));
 }
 function syncAttributes(old,fresh){
  const loadedArt=old.classList.contains('planet-artwork-ready')&&old.querySelector('.mapa-planet-artwork')?.dataset.src===fresh.querySelector('.mapa-planet-artwork')?.dataset.src;
  const keepHref=old.tagName.toLowerCase()==='image'&&old.dataset.src&&old.dataset.src===fresh.dataset.src&&old.hasAttribute('href')&&!fresh.hasAttribute('href');
  for(const a of [...old.attributes])if(!fresh.hasAttribute(a.name)&&!(keepHref&&a.name==='href'))old.removeAttribute(a.name);
  for(const a of [...fresh.attributes])if(old.getAttribute(a.name)!==a.value)old.setAttribute(a.name,a.value);
  if(loadedArt)old.classList.add('planet-artwork-ready');
  // Callbacks usam os elementos da leitura atual; nunca callbacks de um planeta antigo.
  for(const name of ['onclick','onkeydown'])if(fresh[name])old[name]=fresh[name];
 }
 function children(old,fresh,mapping=new Map()){
  const available=new Map();
  for(const n of [...old.childNodes]){const k=key(n);if(!available.has(k))available.set(k,[]);available.get(k).push(n);}
  let cursor=old.firstChild;
  for(const n of [...fresh.childNodes]){
   const k=key(n),queue=available.get(k),match=queue?.shift();
   if(match&&match.nodeType===n.nodeType){
    mapping.set(n,match);
    if(n.nodeType===1){syncAttributes(match,n);children(match,n,mapping);}
    else if(match.nodeValue!==n.nodeValue)match.nodeValue=n.nodeValue;
    if(match!==cursor)old.insertBefore(match,cursor);
    cursor=match.nextSibling;
   }else{old.insertBefore(n,cursor);mapping.set(n,n);}
  }
  for(const queue of available.values())for(const n of queue)n.remove();
  return mapping;
 }
 function html(target,markup){
  if(!target||target._hdMarkup===markup)return;
  target._hdMarkup=markup;
  // Também funciona nos testes sem DOM de navegador.
  if(!document.createElement){if(target.innerHTML!==markup)target.innerHTML=markup;return;}
  const template=document.createElement('template');template.innerHTML=markup;
  children(target,template.content);
 }
 return {children,html};
})();
