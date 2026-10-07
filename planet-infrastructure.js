/* Infraestrutura TCS+: o efeito 1395 registra as torres, não sua operação.
   Usa exclusivamente a leitura de planetas já recebida pela Central. */
window.HDBRInfrastructure=(()=>{
 'use strict';
 const effectID=1395,iconPath='imagens/guerra/infraestrutura/tcs-mais.svg';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function matches(v){
  if(v==null)return false;
  const id=typeof v==='object'?v.galacticEffectId??v.GalacticEffectId??v.effectId??v.id:typeof v==='number'?v:null;
  if(id!=null)return Number(id)===effectID;
  if(typeof v==='string'&&/^\d+$/.test(v))return Number(v)===effectID;
  const name=typeof v==='string'?v:v.name??v.title??v.displayName;
  return String(name||'').trim().toUpperCase()==='TERMINID CONTROL SYSTEM+';
 }
 function has(p){
  if(!p)return false;
  for(const key of ['activeEffects','effects','planetEffects','galacticEffects','modifiers']){
   if(Array.isArray(p[key])&&p[key].some(matches))return true;
  }
  return Array.isArray(p.planetActiveEffects)&&p.index!=null&&p.planetActiveEffects.some(e=>
   String(e.index??e.planetIndex)===String(p.index)&&matches(e));
 }
 function resolve(p,reading){
  if(!has(p))return null;
  const owner=String(p.currentOwner??p.owner??'').trim().toLowerCase();
  const human=['1','human','humans','super earth','super terra','superterra'].includes(owner);
  const enemy=['2','3','4','terminid','terminids','automaton','automatons','illuminate','illuminates'].includes(owner);
  // Uma invasão não significa derrota; libertação não comprova reparo automático.
  const state=enemy?'compromised':human?(p.event?'attacked':'allied'):'unknown';
  const labels={compromised:'COMPROMETIDO',attacked:'SOB ATAQUE',allied:'CONTROLE ALIADO',unknown:'SEM CONFIRMAÇÃO'};
  const colors={compromised:'#ff706b',attacked:'#ffd064',allied:'#64c9ff',unknown:'#b8c3cd'};
  const notes={
   compromised:'Planeta sob controle inimigo. Situação estimada pelo controle; a API ainda registra a infraestrutura TCS+.',
   attacked:'Planeta aliado em defesa. O ataque não confirma perda do planeta nem desligamento das torres.',
   allied:'Planeta sob controle da Super Terra. A API não confirma se todas as torres foram reparadas ou estão operacionais.',
   unknown:'Infraestrutura registrada, mas o controle atual do planeta não foi identificado.'
  };
  return {state,label:labels[state],color:colors[state],note:notes[state],stale:reading?.stale===true,time:reading?.time||null};
 }
 function stamp(s){return s.stale?'ÚLTIMA LEITURA SALVA'+(s.time?' · '+new Date(s.time).toLocaleString('pt-BR'):''):'';}
 function render(p,reading,{compact=false,planets=[]}={}){
  const s=resolve(p,reading);if(!s)return '';
  const status=`${s.label}${s.stale?' · ÚLTIMA LEITURA':''}`;
  const heading=`<img src="${iconPath}" alt="" width="32" height="32"><div><strong>${compact?'TCS+':'Sistema de Controle de Terminídios+'}</strong><span class="infrastructure-state">${esc(status)}</span></div>`;
  if(compact)return `<div class="planet-infrastructure infrastructure-compact" style="--infrastructure-color:${s.color}" title="${esc(s.note)}">${heading}</div>`;
  const network=planets.filter(has).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
  const rows=network.map(v=>{const t=resolve(v,reading);return `<li><span>${esc(v.name||'Planeta #'+v.index)}</span><strong style="color:${t.color}">${esc(t.label)}</strong></li>`;}).join('');
  return `<article class="planet-infrastructure infrastructure-dossier" style="--infrastructure-color:${s.color}"><header>${heading}</header><p>Uma rede de torres dispersa Termicida para repelir os Terminídios que emergem da Névoa.</p><p class="infrastructure-note">${esc(s.note)}</p>${s.stale?`<p class="infrastructure-note">${esc(stamp(s))} — situação atual não confirmada.</p>`:''}<p class="infrastructure-note">A situação acompanha o controle e a defesa do planeta. Não indica bônus numérico de libertação nem confirmação de reparo.</p>${rows?`<details class="infrastructure-network"><summary>Rede TCS+ · ${network.length} planetas registrados</summary><ul>${rows}</ul></details>`:''}</article>`;
 }
 function mapBadge(group,p,x,y,radius,svg,reading){
  const s=resolve(p,reading);if(!s)return;
  const size=Math.max(7,Math.min(11,radius*1.7)),left=x-size/2,top=y-radius*2.2-size;
  const layer=svg('g',{class:'mapa-infrastructure'+(s.stale?' infrastructure-stale':''),'pointer-events':'none','aria-label':'TCS+ · '+s.label+(s.stale?' · Última leitura salva':'')});
  const title=svg('title',{});title.textContent='TCS+ · '+s.label+' · '+s.note+(s.stale?' · '+stamp(s):'');layer.appendChild(title);
  layer.appendChild(svg('line',{x1:x,y1:top+size+1,x2:x,y2:y-radius*1.5,stroke:s.color,'stroke-width':.4,'stroke-opacity':.6}));
  layer.appendChild(svg('rect',{x:left-1,y:top-1,width:size+2,height:size+2,rx:2,fill:'#111b25',stroke:s.color,'stroke-width':.7}));
  layer.appendChild(svg('image',{href:iconPath,x:left,y:top,width:size,height:size,preserveAspectRatio:'xMidYMid meet','aria-hidden':'true'}));
  group.appendChild(layer);
 }
 return {has,resolve,render,mapBadge};
})();
