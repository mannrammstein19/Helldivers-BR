/* HELLDIVERS-BR — OVERVIEW DA GUERRA GALÁCTICA */
(()=>{'use strict';
const API='https://api.helldivers2.dev/api/v1',REFRESH=60000,CACHE='hdbr_home_overview_v1',HIST='hdbr_home_order_history_v1';
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
 active:'imagens/icones/efeito-dss/major_order.png',
 completed:'imagens/icones/efeito-dss/major_order_vitoria.png',
 failed:'imagens/icones/efeito-dss/major_order_derrota.png',
 pending:'imagens/icones/efeito-dss/major_order.png'
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
function order(d){return arr(d).find(x=>x&&(x.title||x.briefing||x.tasks||x.progress))||null}
function goal(o){const t=o?.tasks?.[0],v=t?.values||[],ty=t?.valueTypes||[],i=ty.indexOf(3),g=i>=0?Number(v[i]):Number(o?.goal);return Number.isFinite(g)&&g>0?g:null}
function prog(o){const p=Array.isArray(o?.progress)?Number(o.progress[0]):Number(o?.progress);if(Number.isFinite(p))return Math.max(0,p);const q=o?.tasks?.[0]?.progress;return Number.isFinite(Number(q?.[0]??q))?Number(q?.[0]??q):0}
function target(o){const direct=clean(o?.targetFaction||o?.target||'');if(direct)return direct;const t=o?.tasks?.[0],v=t?.values||[],ty=t?.valueTypes||[],i=ty.indexOf(1),m={1:'Super Terra',2:'Terminídeos',3:'Autômatos',4:'Iluminados'};return i>=0?m[Number(v[i])]||'':''}
function rate(p,g){const now=Date.now(),old=store(HIST,null);save(HIST,{time:now,progress:p,goal:g});if(!old||old.goal!==g)return null;const h=(now-old.time)/3600000;return h>0?(p-old.progress)/h:null}
function eta(p,g,r){if(r==null||r<=0||!g||p>=g)return null;const h=(g-p)/r;if(!Number.isFinite(h)||h>720)return null;const m=Math.max(1,Math.round(h*60)),d=Math.floor(m/1440),hh=Math.floor(m%1440/60),mm=m%60;return d?`${d}d ${hh}h`:hh?`${hh}h ${mm}min`:`${mm}min`}
function reward(o){
 const r=o?.reward;
 const medalId=897894480;
 const rid=Number(o?.rewardId??r?.id??r?.itemId??r?.itemID);
 if(r&&typeof r==='object'){
   const a=Number(r.amount??r.value??r.quantity);
   let t=clean(r.name||r.description||'');
   if(!t&&rid===medalId)t='MEDALHAS';
   if(!t&&typeof r.type==='string'&&!/^\d+$/.test(r.type.trim()))t=clean(r.type);
   if(Number.isFinite(a)&&a>0)return`${fmt(a)} ${t||'RECOMPENSA'}`;
   if(t)return t;
 }
 return rid===medalId?'MEDALHAS':o?.rewardId?'RECOMPENSA REGISTRADA':'RECOMPENSA NÃO INFORMADA';
}
function orderAboutHTML(){return`<div class="hd-ov-order-about"><small>🎖️ O QUE É UMA ORDEM MAIOR?</small><p>Não é só qualquer missãozinha comum no mapa, meu parceiro. A <strong>Ordem Maior</strong> (ou <em>Major Order</em>, para os íntimos) é a <strong>diretriz estratégica suprema</strong> mandada direto pelo Alto Comando da Super Terra.<br><br>Ela é o verdadeiro motor da nossa guerra galáctica: é o que dita para onde toda a comunidade vai marchar unida, define os rumos da campanha e tem o poder de decidir o destino de uma frente de batalha inteira — seja conquistando um planeta-chave, testando novas tecnologias ou garantindo que a democracia gerida continue firme e forte.<span class="mo-salute">PELA LIBERDADE! · PELA DEMOCRACIA! · PELA SUPER TERRA!</span></p></div>`}
function orderState(s){return['active','completed','failed','pending'].includes(s)?s:'active'}
function applyOrderVisual(card,state){
 state=orderState(state);
 card.classList.remove('order-active','order-completed','order-failed','order-pending');
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
 const g=goal(o),p=prog(o),livePc=g?Math.max(0,Math.min(100,p/g*100)):0;
 const finalPc=Number(snap?.final_percent);
 const pc=state==='completed'?100:(Number.isFinite(finalPc)?Math.max(0,Math.min(100,finalPc)):livePc);
 const r=state==='active'&&g?rate(p,g):null,e=state==='active'?eta(p,g,r):null,t=target(o);
 const brief=clean(o.briefing||o.description)||'Objetivos do Alto Comando indisponíveis.';
 const obj=clean(o.description)||`Objetivo: ${g?fmt(g)+' unidades.':'dados recebidos pelo Alto Comando.'}`;
 const exp=o.expiration||o.expiresAt||o.expireTime;
 const rw=reward(o);
 if(state==='active'){
   b.innerHTML=`<div class="hd-ov-order-main"><div class="hd-ov-kicker">ORDEM MAIOR ATIVA${t?' // ALVO: '+esc(t):''}</div><h3 class="hd-ov-title">${esc(clean(o.title)||'ORDEM MAIOR')}</h3><p class="hd-ov-brief">${esc(brief)}</p><div class="hd-ov-objective">◆ <span>${esc(obj)}</span></div><div class="hd-ov-progress"><i style="width:${pc.toFixed(2)}%"></i></div><div class="hd-ov-progress-label"><span>${g?fmt(p)+' / '+fmt(g):'PROGRESSO DISPONÍVEL NA TELEMETRIA'}</span><strong>${g?pc.toFixed(1)+'%':'—'}</strong></div><div class="hd-ov-order-meta"><div class="hd-ov-statbox"><small>Tempo restante</small><strong>${esc(remain(exp))}</strong></div><div class="hd-ov-statbox"><small>Ritmo observado</small><strong class="yellow">${r!=null?(r>=0?'+':'')+r.toFixed(2)+'/h':'coletando'}</strong></div><div class="hd-ov-statbox"><small>Conclusão estimada</small><strong>${esc(e||'calculando')}</strong></div></div><div class="hd-ov-order-foot"><span>RECOMPENSA // ${esc(rw)}</span><span>ALTO COMANDO</span></div></div>${orderAboutHTML()}`;
   return;
 }
 const completed=state==='completed',failed=state==='failed';
 const kicker=completed?'✓ ORDEM MAIOR CONCLUÍDA // VITÓRIA DA SUPER TERRA':failed?'✕ ORDEM MAIOR ENCERRADA // OBJETIVO NÃO CUMPRIDO':'◉ ORDEM ENCERRADA // AGUARDANDO CONFIRMAÇÃO DO ALTO COMANDO';
 const result=completed?'VITÓRIA':failed?'FALHA':'AGUARDANDO';
 const resultClass=completed?'green':failed?'red':'yellow';
 const progressLeft=completed?(g?`${fmt(g)} / ${fmt(g)}`:'OBJETIVO CUMPRIDO'):Number.isFinite(finalPc)?`ÚLTIMA TELEMETRIA: ${pc.toFixed(1)}%`:'TELEMETRIA FINAL INDISPONÍVEL';
 const statusText=completed?'OBJETIVO CUMPRIDO':failed?'OBJETIVO NÃO CUMPRIDO':'CONFIRMAÇÃO PENDENTE';
 b.innerHTML=`<div class="hd-ov-order-main"><div class="hd-ov-kicker">${kicker}${t?' // ALVO: '+esc(t):''}</div><h3 class="hd-ov-title">${esc(clean(o.title)||'ORDEM MAIOR')}</h3><p class="hd-ov-brief">${esc(brief)}</p><div class="hd-ov-objective">◆ <span>${esc(obj)}</span></div><div class="hd-ov-progress"><i style="width:${pc.toFixed(2)}%"></i></div><div class="hd-ov-progress-label"><span>${esc(progressLeft)}</span><strong>${completed?'100%':Number.isFinite(finalPc)?pc.toFixed(1)+'%':'—'}</strong></div><div class="hd-ov-order-meta"><div class="hd-ov-statbox"><small>Resultado</small><strong class="${resultClass}">${result}</strong></div><div class="hd-ov-statbox"><small>Status final</small><strong>${statusText}</strong></div><div class="hd-ov-statbox"><small>Recompensa prevista</small><strong class="yellow">${esc(rw)}</strong></div></div><div class="hd-ov-order-foot"><span>${completed?'ORDEM CONCLUÍDA':failed?'ORDEM ENCERRADA':'AGUARDANDO RESULTADO'} // REGISTRO PRESERVADO</span><span>ALTO COMANDO</span></div></div>${orderAboutHTML()}`;
}
function renderWar(d){const cs=arr(d);if(!cs.length)return;const total=cs.reduce((n,c)=>n+Number(c?.planet?.statistics?.playerCount||0),0),def=cs.filter(c=>c?.planet?.event).length,atk=cs.length-def;set('hd-ov-players',fmt(total));set('hd-ov-fronts',fmt(cs.length));set('hd-ov-attacks',fmt(atk));set('hd-ov-defenses',fmt(def));const by={term:0,auto:0,illum:0};cs.forEach(c=>{const k=fClass(c?.planet?.event?.faction||c?.planet?.currentOwner);if(by[k]!=null)by[k]+=Number(c?.planet?.statistics?.playerCount||0)});const mx=Math.max(by.term,by.auto,by.illum,1);['term','auto','illum'].forEach(k=>{set('hd-num-'+k,fmt(by[k]));const e=$('hd-bar-'+k);if(e)e.style.width=(by[k]/mx*100).toFixed(1)+'%'});const ranked=[...cs].sort((a,b)=>Number(b?.planet?.statistics?.playerCount||0)-Number(a?.planet?.statistics?.playerCount||0));$('hd-ov-front-list').innerHTML=ranked.slice(0,4).map(c=>{const p=c.planet||{},n=clean(p.name)||'PLANETA',pc=Number(p.statistics?.playerCount||0),fc=fClass(p.event?.faction||p.currentOwner),bg=planetImageUrl(p);return`<div class="hd-front-row" style="--planet-bg:url('${esc(bg)}')"><span class="front-name">${p.event?'🛡 ':''}<i class="front-faction-logo ${fc}" aria-hidden="true"></i><span>${esc(n)}</span></span><span class="hd-front-count"><img class="hd-count-icon" src="imagens/icones/helldiver.png" alt="Helldivers" onerror="this.style.display='none'"><strong class="${fc}">${fmt(pc)}</strong></span></div>`}).join('')||'<div class="hd-ov-loading">SEM FRENTES ATIVAS.</div>';const p=ranked[0]?.planet;if(p){const fc=fName(p.event?.faction||p.currentOwner),pc=Number(p.statistics?.playerCount||0),lib=p.health!=null&&p.maxHealth?Math.max(0,Math.min(100,(1-p.health/p.maxHealth)*100)):0,bg=planetImageUrl(p);$('hd-ov-campaign').innerHTML=`<div class="hd-ov-campaign" style="background-image:url('${esc(bg)}')" title="${esc(clean(p.name)||'Planeta')}"><div class="hd-campaign-tag">${p.event?'DEFESA EM DESTAQUE':'FRENTE EM DESTAQUE'}</div><div class="hd-campaign-name">${esc(clean(p.name)||'PLANETA')}</div><div class="hd-campaign-planet">${esc(clean(p.sector)||'SETOR')} · ${esc(fc)}</div><p class="hd-campaign-desc">A frente com maior concentração de Helldivers no momento. Acompanhe a situação detalhada na Central de Guerra.</p><div class="hd-campaign-meta"><span class="hd-campaign-chip">HELLDIVERS <b>${fmt(pc)}</b></span><span class="hd-campaign-chip">CONTROLE <b>${lib.toFixed(1)}%</b></span></div></div>`}}
function relative(iso){if(!iso)return'AGORA';const s=Math.max(0,Math.floor((Date.now()-new Date(iso))/1000));return s<60?'AGORA':s<3600?'HÁ '+Math.floor(s/60)+'MIN':s<86400?'HÁ '+Math.floor(s/3600)+'H':'HÁ '+Math.floor(s/86400)+'D'}
function renderDispatch(d){const a=arr(d).slice(0,3),b=$('hd-ov-feed');if(!b)return;b.innerHTML=a.length?a.map(x=>`<div class="hd-feed-item"><div class="hd-feed-time">${esc(relative(x.published||x.publishedAt||x.date))}</div><div class="hd-feed-text">${esc(clean(x.message)||'Comunicação do Alto Comando.')}</div></div>`).join(''):'<div class="hd-ov-loading">NENHUM DESPACHO RECENTE.</div>'}
async function update(){
 const st=$('hd-ov-status');
 try{
   if(st){st.textContent='SINCRONIZANDO';st.classList.remove('live')}
   const orderData=await get('assignments','assignments',60000);
   const liveOrder=order(orderData);
   if(liveOrder)renderOrder(orderData,{state:'active',order:liveOrder});
   else{
     const snap=await loadOrderSnapshot();
     if(snap?.order)renderOrder(null,{state:snap.state||'pending',order:snap.order,snapshot:snap});
     else renderOrder([]);
   }
   await new Promise(r=>setTimeout(r,250));
   const campaignData=await get('campaigns','campaigns',60000);renderWar(campaignData);loadPlanetCatalog().then(()=>renderWar(campaignData));
   await new Promise(r=>setTimeout(r,250));
   renderDispatch(await get('dispatches','dispatches',300000));
   if(st){st.textContent='DADOS ATUALIZADOS';st.classList.add('live')}
 }catch(e){
   console.error('[Helldivers-BR] overview',e);
   try{const snap=await loadOrderSnapshot();if(snap?.order)renderOrder(null,{state:snap.state||'pending',order:snap.order,snapshot:snap})}catch{}
   if(st){st.textContent='TELEMETRIA EM CACHE';st.classList.add('live')}
 }
}
document.addEventListener('DOMContentLoaded',()=>{if(!$('hd-ov-order'))return;update();setInterval(update,REFRESH)})})();
