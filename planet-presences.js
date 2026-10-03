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
  return `<section class="planet-presences ${options.labels?'presence-labeled':'presence-icons-only'}${stale?' presence-stale':''}" aria-label="Presenças${stale?' · ÚLTIMA LEITURA':''}"><div class="presence-list">${values.map(e=>`<span class="presence-chip presence-${e.faction}" tabindex="0" role="img" aria-label="${esc(e.name)}${stale?' · ÚLTIMA LEITURA':''}" title="${esc(e.name)}${stale?' · última leitura salva':''}" style="--presence-color:${e.color}">${icon(e)}${options.labels?`<span class="presence-name">${esc(e.name)}</span>`:''}</span>`).join('')}</div></section>`;
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
  const layer=svg('g',{'class':'mapa-presences'+(stale?' presence-stale':''),'pointer-events':'none'}),title=svg('title',{});title.textContent=values.map(e=>e.name).join(' · ');layer.appendChild(title);
  const shown=values.slice(0,3),size=Math.max(7,Math.min(11,radius*1.5)),gap=size+3;
  shown.forEach((e,i)=>{
   const left=x+radius*4.05+i*gap,top=y-radius*3.2;
   layer.appendChild(svg('rect',{x:left-1,y:top-1,width:size+2,height:size+2,rx:2,fill:'#11151b',stroke:e.color,'stroke-width':.6}));
   const image=svg('image',{href:base+e.file,x:left,y:top,width:size,height:size,preserveAspectRatio:'xMidYMid meet','class':'mapa-presence-icon presence-'+e.faction+(e.file.endsWith('.svg')?' presence-svg':''),'aria-hidden':'true'});layer.appendChild(image);
   if(e.key==='fleet'){
    // Ornamento vetorial: presença confirmada, sem inferir posição/movimento real.
    const ship=svg('g',{'class':'mapa-presence-ship','aria-hidden':'true',transform:`translate(${left+size/2} ${top-4})`});
    const hull=svg('path',{'class':'presence-ship-hull',d:'M -5 0 L -2 -2 L 3 -1 L 6 0 L 3 1 L -2 2 Z',fill:e.color,stroke:'#e9ddff','stroke-width':.35});ship.appendChild(hull);layer.appendChild(ship);
   }
  });
  if(values.length>shown.length){const count=svg('text',{x:x+radius*4.05+shown.length*gap+3,y:y-radius*3.2+size,fill:'#fff','font-size':7});count.textContent='+'+(values.length-shown.length);layer.appendChild(count);}
  group.appendChild(layer);
 }
 return {list,render,vitrine,mapBadges,catalog};
})();
