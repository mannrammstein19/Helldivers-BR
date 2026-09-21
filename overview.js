/* HELLDIVERS-BR — OVERVIEW DA GUERRA GALÁCTICA */
(()=>{'use strict';
const API='https://api.helldivers2.dev/api/v1',REFRESH=60000,CACHE='hdbr_home_overview_v1',HIST='hdbr_home_order_history_v1',TASK_HIST='hdbr_home_order_task_history_v2';
/* ORDEM MAIOR PERSISTENTE
   O site tenta a API ao vivo primeiro. Quando a ordem some, le este snapshot
   atualizado pelo GitHub Actions diretamente do repositorio (raw), sem depender
   de um novo build do GitHub Pages. */
const ORDER_SNAPSHOT_LOCAL='dados/major-order.json';
const ORDER_SNAPSHOT_RAW='https://raw.githubusercontent.com/mannrammstein19/Helldivers-BR/main/dados/major-order.json';
const ORDER_SNAPSHOT_CACHE='hdbr_major_order_snapshot_v1';
/* IMAGENS DOS ESTADOS DA ORDEM MAIOR.
   Basta salvar as duas novas imagens nestes caminhos. Se ainda nao existirem,
   o CSS usa major_order.png como fallback automaticamente. */
const ORDER_IMAGES={
 active:'imagens/fundos/major-order/major-order-ativa.png',
 completed:'imagens/fundos/major-order/major-order-vitoria.png',
 failed:'imagens/fundos/major-order/major-order-derrota.png',
 pending:'imagens/fundos/major-order/major-order-ativa.png'
};
const HEAD={'X-Super-Client':'mannrammstein19.github.io/Helldivers-BR','X-Super-Contact':'https://github.com/mannrammstein19/Helldivers-BR','Accept-Language':'pt-BR,pt;q=0.9,en;q=0.5'};
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const clean=v=>(typeof v==='object'&&v?v['pt-BR']||v['pt-PT']||v['en-US']||Object.values(v)[0]||'':String(v??'')).replace(/<[^>]*>/g,'').trim();
const fmt=n=>Number(n||0).toLocaleString('pt-BR');
function set(id,v){const e=$(id);if(e)e.textContent=v} function store(k,d){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}} function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
function arr(d){return Array.isArray(d)?d:(Array.isArray(d?.data)?d.data:[])}
async function get(ep,key,ttl){const s=store(CACHE,{}),now=Date.now();if(s[key]&&now-s[key].time<ttl)return s[key].data;const r=await fetch(`${API}/${ep}`,{headers:HEAD,cache:'no-store'});if(r.status===429)throw Error('RATE LIMIT');if(!r.ok)throw Error(`HTTP ${r.status}`);const d=await r.json();s[key]={time:now,data:d};save(CACHE,s);return d}
function remain(iso){if(!iso)return'prazo indisponível';const x=Math.floor((new Date(iso)-Date.now())/1000);if(x<=0)return'prazo esgotado';const d=Math.floor(x/86400),h=Math.floor(x%86400/3600),m=Math.floor(x%3600/60);return d?`${d}d ${h}h`:h?`${h}h ${m}min`:`${m}min`}
function fName(n){const m={1:'Super Terra',2:'Terminídeos',3:'Autômatos',4:'Iluminados'};if(Number(n) in m)return m[Number(n)];const x=String(n||'').toLowerCase();return x.includes('terminid')?'Terminídeos':x.includes('automaton')?'Autômatos':x.includes('illuminate')?'Iluminados':'Super Terra'}
function fClass(n){const m={2:'term',3:'auto',4:'illum',1:'human'};if(Number(n) in m)return m[Number(n)];const x=String(n||'').toLowerCase();return x.includes('terminid')?'term':x.includes('automaton')?'auto':x.includes('illuminate')?'illum':'human'}
const BIOME_IMAGES={
'desert dunes':'Sandy_base_Landscape.png','desert cliffs':'Sandy_spiky_Landscape.png','acidic badlands':'Sandy_acid_Landscape.png','rocky canyons':'Sandy_mineral_Landscape.png','moon':'Sandy_moon_Landscape.png','volcanic jungle':'Primordial_base_Landscape.png','deadlands':'Primordial_dead_Landscape.png','ethereal jungle':'Primordial_purple_Landscape.png','ionic jungle':'Primordial_blue_Landscape.png','icy glaciers':'Arctic_glacier_base_Landscape.png','boneyard':'Arctic_glacier_coldrocky_Landscape.png','plains':'Moor_baseplanet_Landscape.png','tundra':'Moor_tundra_Landscape.png','scorched moor':'Moor_arid_Landscape.png','ionic crimson':'Moor_red_Landscape.png','basic swamp':'Swamp_base_Landscape.png','haunted swamp':'Swamp_haunted_Landscape.png','hive world':'Bug_hiveworld_Landscape.png','supercolony':'Supercolony_Landscape.png','magma desert':'Magma_Base_Landscape.png','cyberstan megafactory':'Cyberstan_landscape.png','super earth metropolis':'Super_Earth_landscape.png','void source forest':'Rift_active_landscape.png'};
/* =========================================================
   IMAGENS ESPECIFICAS DE PLANETAS
   Se um planeta tiver uma imagem propria, coloque aqui.
   O numero e o ID/index do planeta vindo da API.
   ========================================================= */
const PLANET_IMAGES={'262':'Magma_Base_Landscape.png','269':'Brilliance_Planet_Landscape_Header.jpg'};
/* Alternativa por NOME: use quando quiser forcar uma imagem pelo nome do planeta. */
const PLANET_IMAGES_BY_NAME={'k':'Magma_Base_Landscape.png','brilliance':'Brilliance_Planet_Landscape_Header.jpg'};
/* PASTA DAS IMAGENS DOS PLANETAS — altere somente se mover a pasta. */
const PLANET_IMG_PATH='imagens/planetas/';
let planetCatalog={};
function catalogBiome(p){const c=planetCatalog[String(p?.index??'')]||{};return clean(p?.biome?.name||p?.biome)||clean(c?.biome?.name||c?.biome)||''}
function planetImageUrl(p){const index=String(p?.index??'').trim(),name=clean(p?.name).toLowerCase().trim();const specific=PLANET_IMAGES[index]||PLANET_IMAGES_BY_NAME[name];const biome=catalogBiome(p).toLowerCase().trim();return PLANET_IMG_PATH+(specific||BIOME_IMAGES[biome]||'Sandy_base_Landscape.png')}
async function loadPlanetCatalog(){try{const r=await fetch('https://raw.githubusercontent.com/helldivers-2/json/master/planets/planets.json',{cache:'force-cache'});if(r.ok){const d=await r.json();planetCatalog=d&&typeof d==='object'?d:{};return planetCatalog}}catch{}return planetCatalog}
function order(d){return arr(d).find(x=>x&&(x.title||x.briefing||x.tasks||x.progress||x.setting))||null}
function assignmentTitle(o){return clean(o?.title||o?.setting?.overrideTitle)||'ORDEM MAIOR'}
function assignmentBrief(o){return clean(o?.briefing||o?.setting?.overrideBrief||o?.description||o?.setting?.taskDescription)||'Objetivos do Alto Comando indisponíveis.'}
function assignmentTasks(o){
 const a=Array.isArray(o?.tasks)?o.tasks:(Array.isArray(o?.setting?.tasks)?o.setting.tasks:[]);
 if(a.length)return a.filter(Boolean);
 const directGoal=Number(o?.goal),directProgress=Array.isArray(o?.progress)?Number(o.progress[0]):Number(o?.progress);
 return [{
   _direct:true,
   type:Number(o?.type||o?.setting?.type||0),
   title:clean(o?.description||o?.setting?.taskDescription),
   _goal:Number.isFinite(directGoal)?directGoal:null,
   _progress:Number.isFinite(directProgress)?directProgress:0,
   _faction:o?.targetFaction||o?.target||''
 }];
}
function taskValue(t,valueType){
 const types=Array.isArray(t?.valueTypes)?t.valueTypes:[];
 const values=Array.isArray(t?.values)?t.values:[];
 const i=types.indexOf(valueType);
 return i>=0?values[i]:null;
}
function taskGoal(t){
 const g=t?._direct?Number(t._goal):Number(taskValue(t,3));
 return Number.isFinite(g)&&g>0?g:null;
}
function taskProgress(o,t,i){
 if(t?._direct)return Math.max(0,Number(t._progress)||0);
 const p=Array.isArray(o?.progress)?Number(o.progress[i]):Number(t?.progress?.[0]??t?.progress);
 return Number.isFinite(p)?Math.max(0,p):0;
}
function taskFactionValue(t){
 if(t?._direct){
   const raw=t._faction;
   if(Number.isFinite(Number(raw)))return Number(raw);
   const x=String(raw||'').toLowerCase();
   return x.includes('terminid')?2:x.includes('automaton')?3:x.includes('illuminate')?4:x.includes('human')||x.includes('super')?1:0;
 }
 const n=Number(taskValue(t,1));
 return Number.isFinite(n)?n:0;
}
function taskPlanetIndex(t){
 const n=Number(taskValue(t,12));
 return Number.isFinite(n)&&n>0?n:0;
}
function taskLiberationFlag(t){
 const n=Number(taskValue(t,11));
 return Number.isFinite(n)?n:null;
}
function planetNameByIndex(id){
 if(!id)return'';
 const c=planetCatalog[String(id)]||{};
 return clean(c?.name||c?.names||c?.planetName)||`PLANETA #${id}`;
}
function taskTypeName(t){
 const m={2:'OBJETIVO ESPECIAL',3:'ERRADICAÇÃO',9:'OBJETIVO ESPECIAL',11:'LIBERTAÇÃO',12:'DEFESA',13:'CONTROLE'};
 const n=Number(t?.type||0);
 return m[n]||`OBJETIVO${n?' TIPO '+n:''}`;
}
function taskFactionName(t){
 const n=taskFactionValue(t);
 return n?fName(n):'';
}
function taskFactionClass(t){
 const n=taskFactionValue(t);
 return n?fClass(n):'neutral';
}
function taskTitle(t,i){
 const direct=clean(t?.title||t?.description||t?.name);
 if(direct)return direct;
 const type=Number(t?.type||0),g=taskGoal(t),fac=taskFactionName(t),planet=planetNameByIndex(taskPlanetIndex(t));
 if(type===3)return`Eliminar ${g?fmt(g)+' ':''}${fac||'inimigos'}`;
 if(type===11)return planet?`Liberar ${planet}`:`Cumprir objetivo de libertação`;
 if(type===12){
   if(planet)return`Defender ${planet}`;
   if(g&&fac)return`Defender ${fmt(g)} ${g===1?'planeta':'planetas'} contra ${fac}`;
   if(g)return`Concluir ${fmt(g)} ${g===1?'defesa':'defesas'}`;
   return fac?`Defender território contra ${fac}`:'Defender território da Super Terra';
 }
 if(type===13)return planet?`Manter controle de ${planet}`:'Manter controle do objetivo designado';
 if(planet&&fac)return`${taskTypeName(t)} em ${planet} // ${fac}`;
 if(planet)return`${taskTypeName(t)} em ${planet}`;
 if(g&&fac)return`${taskTypeName(t)} // ${fmt(g)} // ${fac}`;
 if(fac)return`${taskTypeName(t)} // ${fac}`;
 if(g)return`${taskTypeName(t)} // alvo ${fmt(g)}`;
 return`Objetivo ${i+1} do Alto Comando`;
}
function taskTargetMeta(t){
 const fac=taskFactionName(t),planet=planetNameByIndex(taskPlanetIndex(t));
 return fac||planet||taskTypeName(t);
}
function taskRate(o,i,p,g){
 if(!g||g<=1)return null;
 const now=Date.now(),all=store(TASK_HIST,{}),orderKey=String(o?.id??o?.index??o?.id32??'ordem'),key=`${orderKey}:${i}:${g}`,old=all[key];
 let r=null;
 if(old&&Number(old.goal)===Number(g)){
   const elapsed=now-Number(old.time||0),h=elapsed/3600000;
   if(elapsed>=30000&&h>0&&p>=Number(old.progress||0))r=(p-Number(old.progress||0))/h;
   else if(elapsed<30000&&Number.isFinite(Number(old.rate)))r=Number(old.rate);
 }
 if(!old||now-Number(old.time||0)>=30000){
   all[key]={time:now,progress:p,goal:g,rate:Number.isFinite(r)?r:null};
   const keys=Object.keys(all);
   if(keys.length>80)keys.sort((a,b)=>Number(all[b]?.time||0)-Number(all[a]?.time||0)).slice(80).forEach(k=>delete all[k]);
   save(TASK_HIST,all);
 }
 return Number.isFinite(r)?r:null;
}
function eta(p,g,r){if(r==null||r<=0||!g||p>=g)return null;const h=(g-p)/r;if(!Number.isFinite(h)||h>2160)return null;const m=Math.max(1,Math.round(h*60)),w=Math.floor(m/10080),d=Math.floor(m%10080/1440),hh=Math.floor(m%1440/60),mm=m%60;return w?`${w}sem ${d}d`:d?`${d}d ${hh}h`:hh?`${hh}h ${mm}min`:`${mm}min`}
function reward(o){
 return window.HDBRRewards.render(o);
}

function taskPercent(progress,goal,state){
 if(state==='completed')return 100;
 if(!goal)return 0;
 return Math.max(0,Math.min(100,(progress/goal)*100));
}
function taskIsDone(progress,goal,state){return state==='completed'||Boolean(goal&&progress>=goal)}
function orderExpiration(o){
 if(o?.expiration||o?.expiresAt||o?.expireTime)return o.expiration||o.expiresAt||o.expireTime;
 const sec=Number(o?.expiresIn);
 return Number.isFinite(sec)&&sec>0?new Date(Date.now()+sec*1000).toISOString():null;
}
function orderTaskCard(o,t,i,state){
 const g=taskGoal(t),p=taskProgress(o,t,i),pc=taskPercent(p,g,state),done=taskIsDone(p,g,state);
 const fc=taskFactionClass(t),type=taskTypeName(t),meta=taskTargetMeta(t),title=taskTitle(t,i);
 const rateValue=state==='active'&&g&&g>1&&!done?taskRate(o,i,p,g):null;
 const estimate=state==='active'&&!done?eta(p,g,rateValue):null;
 const progressText=g?`${fmt(state==='completed'?g:p)} / ${fmt(g)}`:(done?'OBJETIVO CUMPRIDO':'TELEMETRIA EM ACOMPANHAMENTO');
 const status=done?'CUMPRIDO':state==='failed'?'ENCERRADO':state==='unknown'?'ENCERRADO':state==='pending'?'AGUARDANDO':'EM ANDAMENTO';
 const rateText=done?'FINALIZADO':state!=='active'?'ÚLTIMO REGISTRO':rateValue!=null?`${rateValue>=0?'+':''}${fmt(Math.round(rateValue))}/h`:'COLETANDO';
 const etaText=done?'CONCLUÍDO':state!=='active'?'—':estimate||((g&&g<=1)?'ACOMPANHANDO':'CALCULANDO');
 return`<article class="hd-mo-task ${fc}${done?' is-complete':''}">
   <div class="hd-mo-task-kicker"><span>OBJETIVO ${String(i+1).padStart(2,'0')} // ${esc(type)}</span><strong>${esc(meta)}</strong></div>
   <h4>${esc(title)}</h4>
   <div class="hd-mo-task-progress"><i style="width:${pc.toFixed(2)}%"></i></div>
   <div class="hd-mo-task-progress-label"><span>${esc(progressText)}</span><strong>${g?pc.toFixed(1)+'%':'—'}</strong></div>
   <div class="hd-mo-task-meta">
     <div><small>Ritmo observado</small><strong>${esc(rateText)}</strong></div>
     <div><small>Conclusão estimada</small><strong>${esc(etaText)}</strong></div>
   </div>
   <div class="hd-mo-task-status">${done?'✓ ':''}${esc(status)}</div>
 </article>`;
}

function orderAboutHTML(){return`<div class="hd-mo-about-popover">
 <button class="hd-mo-about-trigger" type="button" aria-expanded="false">
   <span><b>🎖️ O QUE É UMA ORDEM MAIOR?</b><small>CLIQUE PARA SABER A IMPORTÂNCIA</small></span>
   <i aria-hidden="true">▲</i>
 </button>
 <div class="hd-ov-order-about" aria-hidden="true">
   <div class="hd-mo-about-panel-head"><strong>🎖️ O QUE É UMA ORDEM MAIOR?</strong><button type="button" class="hd-mo-about-close" aria-label="Fechar">✕</button></div>
   <p>Não é só qualquer missãozinha comum no mapa, meu parceiro. A <strong>Ordem Maior</strong> (ou <em>Major Order</em>, para os íntimos) é a <strong>diretriz estratégica suprema</strong> mandada direto pelo Alto Comando da Super Terra.<br><br>Ela é o verdadeiro motor da nossa guerra galáctica: é o que dita para onde toda a comunidade vai marchar unida, define os rumos da campanha e tem o poder de decidir o destino de uma frente de batalha inteira — seja conquistando um planeta-chave, testando novas tecnologias ou garantindo que a democracia gerida continue firme e forte.<span class="mo-salute">PELA LIBERDADE! · PELA DEMOCRACIA! · PELA SUPER TERRA!</span></p>
 </div>
</div>`}
function bindOrderAbout(root){
 const wrap=root?.querySelector('.hd-mo-about-popover');
 const trigger=wrap?.querySelector('.hd-mo-about-trigger');
 const panel=wrap?.querySelector('.hd-ov-order-about');
 const close=wrap?.querySelector('.hd-mo-about-close');
 if(!wrap||!trigger||!panel)return;
 const setOpen=open=>{
   wrap.classList.toggle('is-open',open);
   trigger.setAttribute('aria-expanded',open?'true':'false');
   panel.setAttribute('aria-hidden',open?'false':'true');
 };
 trigger.addEventListener('click',()=>setOpen(!wrap.classList.contains('is-open')));
 close?.addEventListener('click',()=>setOpen(false));
}
function orderState(s){return['active','completed','failed','pending','unknown'].includes(s)?s:'active'}
function applyOrderVisual(card,state){
 state=orderState(state);
 card.classList.remove('order-active','order-completed','order-failed','order-pending','order-unknown');
 card.classList.add(`order-${state}`);
 const img=ORDER_IMAGES[state]||ORDER_IMAGES.active;
 card.style.setProperty('--major-order-image',`url("${img}")`);
}
async function loadOrderSnapshot(){
 const now=Date.now(),cached=store(ORDER_SNAPSHOT_CACHE,null);
 if(cached?.data&&now-Number(cached.time||0)<300000)return cached.data;
 const stamp=Math.floor(now/300000);
 for(const base of [ORDER_SNAPSHOT_RAW,ORDER_SNAPSHOT_LOCAL]){
   try{
     const r=await fetch(`${base}?v=${stamp}`,{cache:'no-store'});
     if(!r.ok)continue;
     const d=await r.json();
     if(d&&d.order){save(ORDER_SNAPSHOT_CACHE,{time:now,data:d});return d}
   }catch{}
 }
 return cached?.data||null;
}
function renderOrder(d,opt={}){
 const b=$('hd-ov-order'),snap=opt.snapshot||null,o=opt.order||order(d),state=orderState(opt.state||snap?.state||'active');
 if(!b)return;
 if(!o){b.innerHTML='<div class="hd-ov-error">NENHUMA ORDEM MAIOR REGISTRADA NO MOMENTO.</div>';return}
 applyOrderVisual(b,state);

 const tasks=assignmentTasks(o);
 const taskData=tasks.map((t,i)=>({t,i,g:taskGoal(t),p:taskProgress(o,t,i)}));
 const doneCount=state==='completed'?taskData.length:taskData.filter(x=>taskIsDone(x.p,x.g,state)).length;
 const brief=assignmentBrief(o),exp=orderExpiration(o),rw=reward(o);
 const count=taskData.length;
 const singleFaction=count===1?taskFactionName(taskData[0].t):'';
 const taskHTML=taskData.map(x=>orderTaskCard(o,x.t,x.i,state)).join('');

 const completed=state==='completed',failed=state==='failed',pending=state==='pending'||state==='unknown';
 const kicker=state==='active'
   ?`ORDEM MAIOR ATIVA // ${count} ${count===1?'OBJETIVO':'OBJETIVOS'}${singleFaction?' // ALVO: '+singleFaction:''}`
   :completed?'✓ ORDEM MAIOR CONCLUÍDA // VITÓRIA DA SUPER TERRA'
   :failed?'✕ ORDEM MAIOR PERDIDA // AGUARDANDO NOVAS ORDENS'
   :state==='unknown'?'ORDEM ENCERRADA // RESULTADO INDISPONÍVEL — AGUARDANDO NOVAS ORDENS'
   :'◉ ORDEM SEM ATUALIZAÇÃO // AGUARDANDO CONFIRMAÇÃO DO RESULTADO';

 const statusMain=state==='active'?'EM ANDAMENTO':completed?'VITÓRIA':failed?'FALHA':state==='unknown'?'RESULTADO INDISPONÍVEL':'AGUARDANDO';
 const statusClass=completed?'green':failed?'red':'yellow';
 const footer=completed?'ORDEM CONCLUÍDA':failed?'ORDEM ENCERRADA':state==='unknown'?'AGUARDANDO NOVAS ORDENS':pending?'AGUARDANDO RESULTADO':'ORDEM EM EXECUÇÃO';

 b.innerHTML=`<div class="hd-ov-order-main">
   <div class="hd-ov-kicker">${esc(kicker)}</div>
   <h3 class="hd-ov-title">${esc(assignmentTitle(o))}</h3>
   <p class="hd-ov-brief">${esc(brief)}</p>

   <div class="hd-mo-summary">
     <div class="hd-ov-statbox"><small>Tempo restante</small><strong>${esc(state==='active'?remain(exp):'ENCERRADA')}</strong></div>
     <div class="hd-ov-statbox"><small>Objetivos concluídos</small><strong class="${statusClass}">${doneCount} / ${count}</strong></div>
     <div class="hd-ov-statbox"><small>Recompensa</small><strong class="yellow">${rw}</strong></div>
   </div>

   <div class="hd-mo-objectives-head">
     <span>◆ OBJETIVOS DA ORDEM</span>
     <small>${count} ${count===1?'FRENTE / OBJETIVO':'FRENTES / OBJETIVOS'} // ${esc(statusMain)}</small>
   </div>

   <div class="hd-mo-objectives-grid">${taskHTML}</div>

   <div class="hd-ov-order-foot"><span>${esc(footer)} // ${count} ${count===1?'OBJETIVO':'OBJETIVOS'} REGISTRADOS</span><span>ALTO COMANDO</span></div>
 </div>${orderAboutHTML()}`;
 bindOrderAbout(b);
}
function renderWar(d){const cs=arr(d);if(!cs.length)return;const total=cs.reduce((n,c)=>n+Number(c?.planet?.statistics?.playerCount||0),0),def=cs.filter(c=>c?.planet?.event).length,atk=cs.length-def;set('hd-ov-players',fmt(total));set('hd-ov-fronts',fmt(cs.length));set('hd-ov-attacks',fmt(atk));set('hd-ov-defenses',fmt(def));const defenseCard=document.querySelector('.hd-war-number.defenses');if(defenseCard)defenseCard.classList.toggle('invasion-alert',def>0);const by={term:0,auto:0,illum:0};cs.forEach(c=>{const k=fClass(c?.planet?.event?.faction||c?.planet?.currentOwner);if(by[k]!=null)by[k]+=Number(c?.planet?.statistics?.playerCount||0)});const mx=Math.max(by.term,by.auto,by.illum,1);['term','auto','illum'].forEach(k=>{set('hd-num-'+k,fmt(by[k]));const e=$('hd-bar-'+k);if(e)e.style.width=(by[k]/mx*100).toFixed(1)+'%'});const ranked=[...cs].sort((a,b)=>Number(b?.planet?.statistics?.playerCount||0)-Number(a?.planet?.statistics?.playerCount||0));$('hd-ov-front-list').innerHTML=ranked.slice(0,4).map(c=>{const p=c.planet||{},n=clean(p.name)||'PLANETA',pc=Number(p.statistics?.playerCount||0),fc=fClass(p.event?.faction||p.currentOwner),bg=planetImageUrl(p);return`<div class="hd-front-row" style="--planet-bg:url('${esc(bg)}')"><span class="front-name">${p.event?'🛡 ':''}<i class="front-faction-logo ${fc}" aria-hidden="true"></i><span>${esc(n)}</span></span><span class="hd-front-count"><img class="hd-count-icon" src="imagens/ui/icons/helldiver.png" alt="Helldivers" onerror="this.style.display='none'"><strong class="${fc}">${fmt(pc)}</strong></span></div>`}).join('')||'<div class="hd-ov-loading">SEM FRENTES ATIVAS.</div>';const p=ranked[0]?.planet;if(p){const fc=fName(p.event?.faction||p.currentOwner),pc=Number(p.statistics?.playerCount||0),lib=p.health!=null&&p.maxHealth?Math.max(0,Math.min(100,(1-p.health/p.maxHealth)*100)):0,bg=planetImageUrl(p);$('hd-ov-campaign').innerHTML=`<div class="hd-ov-campaign" style="background-image:url('${esc(bg)}')" title="${esc(clean(p.name)||'Planeta')}"><div class="hd-campaign-tag">${p.event?'DEFESA EM DESTAQUE':'FRENTE EM DESTAQUE'}</div><div class="hd-campaign-name">${esc(clean(p.name)||'PLANETA')}</div><div class="hd-campaign-planet">${esc(clean(p.sector)||'SETOR')} · ${esc(fc)}</div><p class="hd-campaign-desc">A frente com maior concentração de Helldivers no momento. Acompanhe a situação detalhada na Central de Guerra.</p><div class="hd-campaign-meta"><span class="hd-campaign-chip">HELLDIVERS <b>${fmt(pc)}</b></span><span class="hd-campaign-chip">CONTROLE <b>${lib.toFixed(1)}%</b></span></div></div>`}}
function relative(iso){if(!iso)return'AGORA';const s=Math.max(0,Math.floor((Date.now()-new Date(iso))/1000));return s<60?'AGORA':s<3600?'HÁ '+Math.floor(s/60)+'MIN':s<86400?'HÁ '+Math.floor(s/3600)+'H':'HÁ '+Math.floor(s/86400)+'D'}
function renderDispatch(d){const a=arr(d).slice(0,3),b=$('hd-ov-feed');if(!b)return;b.innerHTML=a.length?a.map(x=>`<div class="hd-feed-item"><div class="hd-feed-time">${esc(relative(x.published||x.publishedAt||x.date))}</div><div class="hd-feed-text">${esc(clean(x.message)||'Comunicação do Alto Comando.')}</div></div>`).join(''):'<div class="hd-ov-loading">NENHUM DESPACHO RECENTE.</div>'}
async function update(){
 const st=$('hd-ov-status');
 try{
   if(st){st.textContent='SINCRONIZANDO';st.classList.remove('live')}
   await loadPlanetCatalog();
   const orderData=await get('assignments','assignments',60000);
   const liveOrder=order(orderData);
   const snap=await loadOrderSnapshot();
   const resolved=window.HDBROrderState.resolve(liveOrder,snap);
   renderOrder(null,resolved);
   await new Promise(r=>setTimeout(r,250));
   const campaignData=await get('campaigns','campaigns',60000);renderWar(campaignData);
   await new Promise(r=>setTimeout(r,250));
   renderDispatch(await get('dispatches','dispatches',300000));
   if(st){st.textContent='DADOS ATUALIZADOS';st.classList.add('live')}
 }catch(e){
   console.error('[Helldivers-BR] overview',e);
   try{const snap=await loadOrderSnapshot();if(snap?.order)renderOrder(null,window.HDBROrderState.resolve(null,snap))}catch{}
   if(st){st.textContent='TELEMETRIA EM CACHE';st.classList.add('live')}
 }
}
document.addEventListener('DOMContentLoaded',()=>{if(!$('hd-ov-order'))return;update();setInterval(update,REFRESH)})})();
