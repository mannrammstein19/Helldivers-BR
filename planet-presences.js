/* Presenças confirmadas pelo estado atual: sem chamadas extras ou planetas fixos.
   IDs conferidos no catálogo helldivers-2/json/effects/planetEffects.json em 03/10/2026 UTC. */
window.HDBRPresences=(()=>{'use strict';
 const catalog=[{"key": "jet", "name": "Brigada Jetpack", "faction": "automaton", "ids": [1202, 1203], "file": "Jet_Brigade_Icon.svg", "aliases": ["THE JET BRIGADE", "THE JET BRIGADE (Enemies)"]}, {"key": "fire", "name": "Corpo Incendiário", "faction": "automaton", "ids": [1248, 1249], "file": "Incineration_Corps_Icon.svg", "aliases": ["THE INCINERATION CORPS (Enemies)", "THE INCINERATION CORPS"]}, {"key": "cyborg", "name": "Cyborgs", "faction": "automaton", "ids": [1360, 1361], "file": "Cyborgs_Icon.svg", "aliases": ["CYBORGS (Enemies)", "CYBORGS"]}, {"key": "predator", "name": "Cepa Predadora", "faction": "terminid", "ids": [1243, 1245], "file": "Predator_Strain_Icon.svg", "aliases": ["PREDATOR STRAIN", "PREDATOR STRAIN (Enemies)"]}, {"key": "rupture", "name": "Cepa Rompedora", "faction": "terminid", "ids": [1303, 1310], "file": "Rupture_Strain_Icon.svg", "aliases": ["RUPTURE STRAIN", "RUPTURE STRAIN (ENEMIES)"]}, {"key": "spore", "name": "Cepa de Esporos", "faction": "terminid", "ids": [1244, 1386], "file": "Spore_Burst_Strain_Icon.svg", "aliases": ["Spore Burst Strain (Enemies)", "SPORE BURST STRAIN"]}, {"key": "masses", "name": "Massas Sem Mente", "faction": "illuminate", "ids": [1377, 1378], "file": "Mindless_Masses_Icon.svg", "aliases": ["MINDLESS MASSES (Enemies)", "MINDLESS MASSES"]}, {"key": "appropriators", "name": "Apropriadores", "faction": "illuminate", "ids": [1379, 1380], "file": "Appropriators_Icon.svg", "aliases": ["APPROPRIATORS (Enemies)", "APPROPRIATORS"]}, {"key": "snatchers", "name": "Raptores de Votos", "faction": "illuminate", "ids": [1402, 1403], "file": "Vote_Snatchers_Icon.svg", "aliases": ["VOTE SNATCHERS (Enemies)", "VOTE SNATCHERS"]}, {"key": "fleet", "name": "Frota de Invasão", "faction": "illuminate", "ids": [1413, 1414], "file": "Invasion_Fleet_Enemy_Icon.png", "aliases": ["INVASION FLEET (Enemies)", "INVASION FLEET"]}, {"key": "seaf", "name": "Forte presença da SEAF", "faction": "human", "ids": [1400, 1401], "file": "Super_Earth_Armed_Forces.webp", "aliases": ["Heavy SEAF Presence (Enemies)", "Heavy SEAF Presence"]}];
 const base='imagens/guerra/presencas/';
 const colors={automaton:'#ff4242',terminid:'#ffc400',illuminate:'#bf83ff',human:'#42bfff'};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toUpperCase();
 const byID=new Map(),byName=new Map();
 for(const e of catalog){e.color=colors[e.faction];for(const id of e.ids)byID.set(String(id),e);for(const name of e.aliases)byName.set(norm(name),e);}
 function identify(value){
  if(value==null)return null;
  const id=typeof value==='number'?value:typeof value==='object'?value.galacticEffectId??value.GalacticEffectId??value.effectId??value.id:null;
  if(id!=null)return byID.get(String(id))||null; // Unknown ID never acquires a guessed name.
  const name=typeof value==='string'?value:value.name??value.title??value.displayName;
  return byName.get(norm(name))||null; // Exact catalogue label, never a description keyword.
 }
 function list(p){
  if(!p)return [];
  const found=new Map();
  function add(v){if(Array.isArray(v)){v.forEach(add);return}const e=identify(v);if(e)found.set(e.key,e);}
  for(const key of ['activeEffects','effects','planetEffects','galacticEffects','modifiers'])add(p[key]);
  if(Array.isArray(p.planetActiveEffects))add(p.planetActiveEffects.filter(e=>String(e.index??e.planetIndex)===String(p.index)));
  return [...found.values()];
 }
 function icon(e){const src=base+e.file;return e.file.endsWith('.svg')?
  `<span class="presence-icon presence-mask" style="--presence-color:${e.color};--presence-image:url('${esc(src)}')" aria-hidden="true"></span>`:
  `<img class="presence-icon" src="${esc(src)}" alt="" loading="lazy" decoding="async">`;}
 function render(p,reading,options={}){
  const values=list(p);if(!values.length)return '';
  const stale=reading?.stale===true;
  return `<section class="planet-presences ${options.labels?'presence-labeled':'presence-icons-only'}${stale?' presence-stale':''}" aria-label="Presenças${stale?' · ÚLTIMA LEITURA':''}"><div class="presence-list">${values.map(e=>`<span class="presence-chip presence-${e.faction}" tabindex="0" role="button" data-presence-gallery="${e.key}" data-presence-stale="${stale}" data-presence-planet-name="${esc(p.name||'')}" aria-haspopup="dialog" aria-label="${esc(e.name)}${stale?' · ÚLTIMA LEITURA':''}" title="${esc(e.name)}${stale?' · última leitura salva':''}" style="--presence-color:${e.color}">${icon(e)}${options.labels?`<span class="presence-name">${esc(e.name)}</span>`:''}</span>`).join('')}</div></section>`;
 }
 function vitrine(status,p,reading){
  const states=[];if(status)states.push({text:status,color:/PERDENDO|RECUO|RECUANDO|RISCO/i.test(status)?'#ff4242':/GANHANDO|VENCENDO|AVANÇO|AVANCANDO/i.test(status)?'#7edb9a':'#b8c3cd'});
  for(const e of list(p))states.push({text:(reading?.stale?'Última leitura: ':'Presença: ')+e.name,color:e.color});
  if(!states.length)return '';
  const sequence=states.length>1?[...states,states[0]]:states;
  return `<span class="presence-vitrine${states.length>1&&!reading?.stale?' is-rotating':''}" aria-label="${esc(states.map(r=>r.text).join(' · '))}" style="--vitrine-count:${states.length};--vitrine-duration:${states.length*10}s"><span class="presence-vitrine-track" aria-hidden="true">${sequence.map(r=>`<span class="presence-vitrine-row" style="color:${r.color}">${esc(r.text)}</span>`).join('')}</span></span>`;
 }
 function mapBadges(group,p,x,y,radius,svg){
  const values=list(p);if(!values.length)return;
  const stale=window.HDBRWarData?.meta('https://api.helldivers2.dev/api/v1/planets')?.stale;
  const layer=svg('g',{'class':'mapa-presences'+(stale?' presence-stale':''),'pointer-events':'none','data-planet-index':String(p.index),'aria-label':(p.name||'Planeta')+': '+values.map(e=>e.name).join(' · ')}),title=svg('title',{});title.textContent=(p.name||'Planeta')+' [índice '+p.index+']: '+values.map(e=>e.name).join(' · ');layer.appendChild(title);
  const shown=values.slice(0,3),size=Math.max(7,Math.min(11,radius*1.5)),gap=size+3;
  const drawnModels=new Set();
  shown.forEach((e,i)=>{
   const left=x+radius*3.05,top=y-radius*.7+i*size*2.65;
   layer.appendChild(svg('line',{'class':'mapa-presence-anchor',x1:x+radius*1.4,y1:y,x2:left-1,y2:top+size/2,stroke:e.color,'stroke-width':.3,'stroke-opacity':.5}));
   const badge=svg('g',{'data-presence-gallery':e.key,'data-presence-stale':String(!!stale),'data-presence-planet-name':p.name||'',role:'button',tabindex:'0','aria-label':'Ver inimigos · '+e.name,'pointer-events':'all',class:'mapa-presence-button'});
   layer.appendChild(badge);
   badge.appendChild(svg('rect',{x:left-1,y:top-1,width:size+2,height:size+2,rx:2,fill:'#11151b',stroke:e.color,'stroke-width':.6}));
   const image=svg('image',{href:base+e.file,x:left,y:top,width:size,height:size,preserveAspectRatio:'xMidYMid meet','class':'mapa-presence-icon presence-'+e.faction+(e.file.endsWith('.svg')?' presence-svg':''),'aria-hidden':'true','data-presence-key':e.key});badge.appendChild(image);
   // Arte decorativa vinculada à presença; não representa localização de nave real.
   const model=({fleet:'nave-frota-iluminada',appropriators:'nave-apropriadores',masses:'nave-iluminada',snatchers:'nave-raptores'})[e.key]||(['fire','jet','cyborg'].includes(e.key)?'nave-automata':null);
   if(model&&!drawnModels.has(model)){
    drawnModels.add(model);
    const ship=svg('g',{'class':'mapa-presence-ship','aria-hidden':'true','data-model':model,'data-planet-index':String(p.index)});
    // Três sprites são composição decorativa, não contagem real informada pela API.
    const small=e.key==='masses'||e.key==='snatchers';
    const formation=small?[[.02,-1.15],[.57,-1.15],[.30,-.74]]:[[0,e.faction==='illuminate'?-1.6:-1.1]];
    const enlargement=small?1.05:model==='nave-automata'?1.03:1;
    formation.forEach(([dx,dy])=>ship.appendChild(svg('image',{'class':'presence-ship-hull',href:'imagens/guerra/modelos/'+model+'.webp',x:left+size*dx,y:top+size*dy,width:size*(small?.52:e.faction==='illuminate'?1:1.65)*enlargement,height:size*(small?.36:1.4)*enlargement,preserveAspectRatio:'xMidYMid meet'})));

    layer.appendChild(ship);
   }
  });
  if(values.length>shown.length){const count=svg('text',{x:x+radius*3.05,y:y-radius*.7+shown.length*size*2.65,fill:'#fff','font-size':7});count.textContent='+'+(values.length-shown.length);layer.appendChild(count);}
  group.appendChild(layer);
 }
 // Ficha editorial: composição possível, não previsão de uma missão individual.
 const galleryBase='https://pub-f324221f4e5e42b08ecfa5062afd5960.r2.dev/helldivers-br/images/presencas/inimigos/';
 const localGalleryBase='imagens/guerra/presencas/inimigos/';
 const gallery={
  jet:['Jet Brigade Trooper','Jet Brigade MG Raider','Jet Brigade Commissar','Assault Raider','Jet Brigade Devastator','Jet Brigade Hulk Bruiser','Jet Brigade Hulk Scorcher'],
  fire:['Pyro Trooper','Incendiary Rocket Raider','Incendiary MG Devastator','Conflagration Devastator','Hulk Firebomber'],
  cyborg:['Agitator','Radical','Vox Engine'],
  predator:['Predator Hunter','Predator Stalker'],
  rupture:['Rupture Warrior','Rupture Spewer','Rupture Charger'],
  spore:['Spore Burst Scavenger','Spore Burst Hunter','Spore Burst Warrior','Spore Burst Bile Titan'],
  masses:['Voteless','Fleshmob','Overseer','Crescent Overseer','Harvester','Watcher'],
  appropriators:['Overseer','Elevated Overseer','Harvester','Watcher'],
  snatchers:['Voteless','Fleshmob','Wretch'],
  fleet:['Voteless','Fleshmob','Overseer','Elevated Overseer','Crescent Overseer','Harvester','Watcher','Stingray','Warp Ship'],
  seaf:[]
 };
 const missing={appropriators:['Obtruder','Gatekeeper','Veracitor'],snatchers:['Crusher']};
 const notes={
  jet:'Unidades com propulsão a jato. Use as imagens para reconhecer as variantes desta brigada.',
  fire:'Variantes com armamento incendiário. Atenção às áreas em chamas durante o combate.',
  cyborg:'Unidades ciborgues associadas às forças autômatas.',
  predator:'Variantes da cepa predadora. A ficha identifica o grupo; a composição varia entre missões.',
  rupture:'Variantes da cepa rompedora. A presença não garante todos os inimigos em cada missão.',
  spore:'Variantes da cepa de esporos. As imagens ajudam a distinguir esta cepa das unidades comuns.',
  masses:'Grupo com grandes hordas de Voteless e Fleshmobs, com apoio de unidades Iluminadas.',
  appropriators:'Grupo com unidades Iluminadas especializadas. Algumas imagens dessas unidades ainda não foram fornecidas.',
  snatchers:'Inclui Wretches e Crushers, além de Voteless e Fleshmobs. A imagem do Crusher ainda não foi fornecida.',
  fleet:'Forças da frota Iluminada. A nave ilustra a frota; não representa uma unidade garantida na missão.',
  seaf:'Presença aliada das Forças Armadas da Super Terra. Não é uma brigada inimiga.'
 };
 function galleryFile(name){return name.toLowerCase().replaceAll(' ','-')+'-enemy-icon.webp';}
 let galleryDialog, galleryOpener;
 function closeGallery(){if(galleryDialog?.open)galleryDialog.close();}
 function openGallery(key,opener){
  const e=catalog.find(v=>v.key===key);if(!e)return;
  if(!galleryDialog){
   galleryDialog=document.createElement('dialog');galleryDialog.className='presence-gallery';galleryDialog.setAttribute('aria-labelledby','presence-gallery-title');
   galleryDialog.innerHTML='<header><div data-presence-heading></div><button type="button" data-presence-close aria-label="Fechar ficha da presença">×</button></header><div data-presence-content></div>';
   document.body.append(galleryDialog);
   galleryDialog.querySelector('[data-presence-close]').addEventListener('click',closeGallery);
   galleryDialog.addEventListener('click',event=>{if(event.target!==galleryDialog)return;const r=galleryDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeGallery();});
   galleryDialog.addEventListener('close',()=>{if(galleryOpener?.isConnected)galleryOpener.focus({preventScroll:true});});
  }
  galleryOpener=opener;galleryDialog.style.setProperty('--presence-color',e.color);
  galleryDialog.querySelector('[data-presence-heading]').innerHTML=icon(e)+'<div><small>INTELIGÊNCIA // PRESENÇA</small><h2 id="presence-gallery-title">'+esc(e.name)+'</h2></div>';
  const stale=opener?.dataset?.presenceStale==='true';
  const planet=opener?.dataset?.presencePlanetName;
  galleryDialog.querySelector('[data-presence-content]').innerHTML=(planet?'<p class="presence-gallery-context">'+esc(planet)+(stale?' · Última leitura salva':'')+'</p>':stale?'<p class="presence-gallery-context">Última leitura salva — presença atual não confirmada.</p>':'')+'<p>'+esc(notes[key])+'</p><p class="presence-gallery-note">Inimigos associados a esta presença. Dificuldade, missão e outras presenças podem alterar a composição. Esta ficha não é uma contagem ao vivo.</p><div class="presence-gallery-grid">'+gallery[key].map(name=>'<figure><img data-presence-photo src="'+esc(galleryBase+galleryFile(name))+'" data-local-src="'+esc(localGalleryBase+galleryFile(name))+'" alt="'+esc(name)+'" width="240" height="200" loading="lazy" decoding="async"><figcaption>'+esc(name)+'</figcaption></figure>').join('')+'</div>'+(missing[key]?.length?'<p class="presence-gallery-missing">Ainda sem foto: '+esc(missing[key].join(', '))+'.</p>':'')+(key==='seaf'?'<div class="presence-gallery-allied">'+icon(e)+'<strong>APOIO ALIADO // SUPER TERRA</strong></div>':'');
  galleryDialog.querySelectorAll('[data-presence-photo]').forEach(img=>img.addEventListener('error',()=>{if(!img.dataset.usedLocal){img.dataset.usedLocal='true';img.src=img.dataset.localSrc;}else{img.hidden=true;img.parentElement.classList.add('photo-unavailable');img.parentElement.querySelector('figcaption').append(' · imagem indisponível');}}));
  if(!galleryDialog.open)galleryDialog.showModal();
  // No computador, ao lado do painel acionado quando há espaço; no celular, centrado.
  galleryDialog.style.margin='auto';galleryDialog.style.left='';galleryDialog.style.top='';galleryDialog.style.position='fixed';
  const r=opener?.getBoundingClientRect?.();const w=galleryDialog.getBoundingClientRect().width;
  if(r&&window.innerWidth>=1000){
   const panel=opener.closest?.('.mapa-intel-card,.mapa-front-panel,.planet-dossier,.hd-region-dialog');const bounds=panel?.getBoundingClientRect?.()||r;
   const right=bounds.right+12,left=bounds.left-w-12;
   if(right+w<=window.innerWidth-12||left>=12){galleryDialog.style.margin='0';galleryDialog.style.left=(right+w<=window.innerWidth-12?right:left)+'px';galleryDialog.style.top=Math.max(12,Math.min(bounds.top,window.innerHeight-galleryDialog.offsetHeight-12))+'px';}
  }
  galleryDialog.querySelector('[data-presence-close]').focus({preventScroll:true});
 }
 if(typeof document!=='undefined'){
  document.addEventListener('pointerdown',event=>{if(event.target.closest?.('[data-presence-gallery]'))event.stopPropagation();},true);
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-presence-gallery]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();openGallery(button.dataset.presenceGallery,button);},true);
  document.addEventListener('keydown',event=>{const button=event.target.closest?.('[data-presence-gallery]');if(button&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopImmediatePropagation();openGallery(button.dataset.presenceGallery,button);}},true);
 }

 return {list,render,vitrine,mapBadges,catalog,gallery};
})();
