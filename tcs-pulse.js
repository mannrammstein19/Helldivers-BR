/* Mesma animação em todos os planetas: 30 quadros a 120 ms + 10 quadros de pausa.
   Um relógio compartilhado e defasagens por planeta preservam o pulso após redraw. */
window.HDBRTCSPulse=(()=>{
 'use strict';
 const frameSize=96,frameCount=40,frameDuration=120,cycle=frameCount*frameDuration;
 const epoch=Date.now(),offsets=new Map();let nodes=[],timer=null;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 function offset(index){
  const key=String(index);if(!offsets.has(key)){
   let hash=2166136261;for(const c of key)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
   offsets.set(key,hash%cycle);
  }return offsets.get(key);
 }
 function frame(index,now=Date.now()){
  return Math.floor(((now-epoch+offset(index))%cycle+cycle)%cycle/frameDuration);
 }
 function enabled(){
  if(typeof document==='undefined'||document.hidden||reduced?.matches)return false;
  if(document.body?.classList?.contains('map-static'))return false;
  const viewport=document.getElementById?.('mapa-viewport');
  return !viewport?.classList?.contains('map-hide-infrastructure')&&!viewport?.classList?.contains('mapa-clean');
 }
 function update(now=Date.now()){
  for(const n of nodes){
   const f=frame(n.getAttribute('data-tcs-planet'),now);
   const transform=`translate(${-f*frameSize} 0)`;
   if(n.getAttribute('transform')!==transform)n.setAttribute('transform',transform);
  }
 }
 function run(){
  timer=null;if(!nodes.length||!enabled())return;
  update();timer=setTimeout(run,60);
 }
 function sync(root){
  nodes=root?.querySelectorAll?[...root.querySelectorAll('.mapa-tcs-pulse-frame')]:[];
  update();if(timer==null)run();
 }
 function layer(group,p,x,y,radius,svg,state){
  if(!state||!['allied','attacked'].includes(state.state))return;
  const size=radius*8;
  const pulse=svg('svg',{class:'mapa-tcs-pulse',x:x-size/2,y:y-size/2,width:size,height:size,viewBox:'0 0 96 96',overflow:'hidden','pointer-events':'none','aria-hidden':'true'});
  // Borda circular suave evita que os limites quadrados do GIF apareçam no mapa.
  const id='tcs-edge-'+String(p.index).replace(/[^\w-]/g,''),defs=svg('defs',{});
  const gradient=svg('radialGradient',{id:id+'-gradient'});
  gradient.appendChild(svg('stop',{offset:'.7','stop-color':'white','stop-opacity':1}));
  gradient.appendChild(svg('stop',{offset:'1','stop-color':'white','stop-opacity':0}));
  const mask=svg('mask',{id,maskUnits:'userSpaceOnUse',x:0,y:0,width:96,height:96});
  mask.appendChild(svg('circle',{cx:48,cy:48,r:48,fill:`url(#${id}-gradient)`}));
  defs.appendChild(gradient);defs.appendChild(mask);
  // Luminância preserva a textura; o pulso inteiro recebe a mesma tonalidade azul.
  const blueID=id+'-blue',blue=svg('filter',{id:blueID,x:0,y:0,width:'100%',height:'100%',colorInterpolationFilters:'sRGB','color-interpolation-filters':'sRGB'});
  blue.appendChild(svg('feColorMatrix',{type:'matrix',values:'0.064 0.215 0.021 0 0 0.162 0.544 0.055 0 0 0.213 0.715 0.072 0 0 0 0 0 1 0'}));
  defs.appendChild(blue);pulse.appendChild(defs);
  const masked=svg('g',{mask:`url(#${id})`});pulse.appendChild(masked);
  const image=svg('image',{class:'mapa-tcs-pulse-frame',filter:`url(#${blueID})`,href:'imagens/guerra/infraestrutura/tcs-pulso.png',x:0,y:0,width:frameSize*frameCount,height:frameSize,'data-tcs-planet':String(p.index),transform:`translate(${-frame(p.index)*frameSize} 0)`});
  masked.appendChild(image);group.appendChild(pulse);
 }
 if(typeof document!=='undefined')document.addEventListener?.('visibilitychange',()=>sync(document.getElementById?.('mapa-svg')||document));
 reduced?.addEventListener?.('change',()=>sync(document.getElementById?.('mapa-svg')||document));
 return {layer,sync,frame,offset,epoch,cycle,frameSize,frameDuration};
})();
