/* ================================================================
   HELLDIVERS-BR — MAPA GALÁCTICO
   Frontend puro: GitHub Pages + API comunitária Helldivers 2.
   Usa o endpoint /v1/planets (todos os planetas, com posição e
   linhas de suprimento) e /v2/space-stations (planeta da DSS).

   ATENÇÃO (nota de manutenção):
   Os nomes exatos dos campos de posição/waypoints na API comunitária
   não puderam ser testados ao vivo neste ambiente. O código abaixo
   tenta várias variações de nome de campo conhecidas (position.x/y,
   positionX/Y, position_x/y). Se o mapa carregar sem nenhum ponto,
   é sinal de que o formato mudou — abra o console do navegador (F12)
   e me mande o que aparecer lá que eu ajusto rapidinho.
   ================================================================ */
(() => {
    'use strict';

    const API = 'https://api.helldivers2.dev/api';
    const V1 = `${API}/v1`;
    const V2 = `${API}/v2`;
    const REFRESH = 60 * 1000;
    const CACHE_KEY = 'hdbr_mapa_cache_v1';
    const CACHE_TTL = { planets: 3 * 60 * 1000, dss: 2 * 60 * 1000, campaigns: 60 * 1000, assignments: 60 * 1000 };

    const HEADERS = {
        'X-Super-Client': 'mannrammstein19.github.io/Helldivers-BR',
        'X-Super-Contact': 'https://github.com/mannrammstein19/Helldivers-BR',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.5'
    };

    const $ = id => document.getElementById(id);

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    }
    function text(value) {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'object') return value['pt-BR'] || value['pt-PT'] || value['en-US'] || Object.values(value)[0] || '';
        return String(value);
    }
    function clean(value) { return text(value).replace(/<[^>]*>/g, '').trim(); }

    function factionKey(owner) {
        const n = String(owner || '').toLowerCase();
        if (n.includes('terminid')) return 'terminid';
        if (n.includes('automaton')) return 'automaton';
        if (n.includes('illuminate')) return 'illuminate';
        if (n.includes('human')) return 'human';
        return 'unknown';
    }
    function factionName(owner) {
        const n = String(owner || '').toLowerCase();
        if (n.includes('terminid')) return 'Terminídeos';
        if (n.includes('automaton')) return 'Autômatos';
        if (n.includes('illuminate')) return 'Iluminados';
        if (n.includes('human')) return 'Super Terra';
        return owner || 'Desconhecida';
    }
    const FACTION_COLORS = { unknown:'#6b7280', human:'#d7d52c', terminid:'#ff9900', automaton:'#ff4242', illuminate:'#8b3fd6' };
    function factionColor(owner) { return FACTION_COLORS[factionKey(owner)] || FACTION_COLORS.human; }

    // Ícones de facção usados dentro dos planetas. Mantemos só 4 recursos e
    // reutilizamos via <symbol>/<use> no SVG para não duplicar imagens pesadas.
    const FACTION_ICONS = {
        human:{ primary:'imagens/icones/faccoes/logo super terra.svg', fallback:'imagens/ui/icons/logo super terra.svg' },
        automaton:{ primary:'imagens/guerra/faccoes/logo automatons.png', fallback:'imagens/icones/faccoes/logo automatons.png' },
        terminid:{ primary:'imagens/guerra/faccoes/logo terminids.png', fallback:'imagens/icones/faccoes/logo terminids.png' },
        illuminate:{ primary:'imagens/guerra/faccoes/logo illuminats.png', fallback:'imagens/icones/faccoes/logo illuminates.png' }
    };
    function factionIconInfo(owner) { return FACTION_ICONS[factionKey(owner)] || FACTION_ICONS.human; }
    function factionIconUrl(owner) { return factionIconInfo(owner).primary; }

    // Mesmo padrão visual da Central de Guerra / Overview: uma imagem por bioma
    // com exceções pontuais por planeta. Não há chamada extra de API aqui.
    const BIOME_IMAGES = {
        'desert dunes':'Sandy_base_Landscape.png','desert cliffs':'Sandy_spiky_Landscape.png',
        'acidic badlands':'Sandy_acid_Landscape.png','rocky canyons':'Sandy_mineral_Landscape.png',
        'moon':'Sandy_moon_Landscape.png','volcanic jungle':'Primordial_base_Landscape.png',
        'deadlands':'Primordial_dead_Landscape.png','ethereal jungle':'Primordial_purple_Landscape.png',
        'ionic jungle':'Primordial_blue_Landscape.png','icy glaciers':'Arctic_glacier_base_Landscape.png',
        'boneyard':'Arctic_glacier_coldrocky_Landscape.png','plains':'Moor_baseplanet_Landscape.png',
        'tundra':'Moor_tundra_Landscape.png','scorched moor':'Moor_arid_Landscape.png',
        'ionic crimson':'Moor_red_Landscape.png','basic swamp':'Swamp_base_Landscape.png',
        'haunted swamp':'Swamp_haunted_Landscape.png','hive world':'Bug_hiveworld_Landscape.png',
        'supercolony':'Supercolony_Landscape.png','magma desert':'Magma_Base_Landscape.png',
        'cyberstan megafactory':'Cyberstan_landscape.png','super earth metropolis':'Super_Earth_landscape.png',
        'void source forest':'Rift_active_landscape.png'
    };
    const PLANET_IMAGES = { '262':'Magma_Base_Landscape.png', '269':'Brilliance_Planet_Landscape_Header.jpg' };
    const PLANET_IMAGES_BY_NAME = { 'k':'Magma_Base_Landscape.png', 'brilliance':'Brilliance_Planet_Landscape_Header.jpg' };
    const PLANET_IMG_PATH = 'imagens/planetas/';
    function planetBiome(p) { return clean(p?.biome?.name || p?.biome) || 'Bioma desconhecido'; }
    function planetImageUrl(p) {
        const index = String(p?.index ?? '').trim();
        const name = clean(p?.name).toLowerCase().trim();
        const specific = PLANET_IMAGES[index] || PLANET_IMAGES_BY_NAME[name];
        const biome = planetBiome(p).toLowerCase().trim();
        return PLANET_IMG_PATH + (specific || BIOME_IMAGES[biome] || 'Sandy_base_Landscape.png');
    }
    function biomeLabel(p) {
        const raw=planetBiome(p);
        const names={'icy glaciers':'Geleiras','boneyard':'Planície glacial','desert cliffs':'Deserto com falésias','desert dunes':'Dunas desérticas','deciduous forest':'Floresta temperada','moon':'Terreno lunar','tundra':'Tundra','plains':'Planícies','swamp':'Pântano','volcanic jungle':'Selva vulcânica','magma desert':'Deserto de magma','rainforest':'Floresta tropical','scorched moor':'Planície árida'};
        return names[raw.toLowerCase()]||raw;
    }

    // Orientações editoriais baseadas nos efeitos registrados; bioma não presume modificadores.
    function preparationNotes(p) {
        const advice={
            'blizzards':'Mobilidade e visibilidade reduzidas: planeje deslocamentos curtos e mantenha contato com a equipe.',
            'sandstorms':'Mobilidade e visibilidade reduzidas: marque os objetivos antes de atravessar a tempestade.',
            'ion storms':'Estratagemas podem ficar indisponíveis durante a tempestade. Planeje munição e equipamento para esses intervalos.',
            'tremors':'Tremores podem atordoar aliados e inimigos. Evite depender de uma travessia exposta sem alternativa de cobertura.',
            'meteor storms':'Há risco de impactos de meteoros. Observe o terreno e mantenha uma rota de saída.',
            'fire tornadoes':'Tornados de fogo exigem desvios. Evite concentrar a equipe em uma única passagem.',
            'volcanic activity':'Há projeção de rochas incandescentes. Mantenha atenção ao ambiente durante os deslocamentos.',
            'extreme cold':'Confira o modificador de frio ativo na missão antes de escolher armas que dependem de calor. O bioma gelado, sozinho, não indica bônus para armas incendiárias.',
            'intense heat':'Confira o modificador de calor ativo e planeje pausas de deslocamento e gerenciamento de calor das armas.',
            'thick fog':'Com visibilidade limitada, use marcações e confirme o alvo antes de disparar.',
            'rainstorms':'Planeje a navegação e a comunicação da equipe para períodos de visibilidade reduzida.'
        };
        return [...new Set(planetEffects(p).map(h=>advice[h.key]).filter(Boolean))];
    }

    let effectCatalog={};
    async function loadEffectCatalog() {
        try {
            const response=await fetch('https://raw.githubusercontent.com/helldivers-2/json/master/planets/planets.json',{cache:'force-cache',signal:AbortSignal.timeout(8000)});
            if(!response.ok)return;
            effectCatalog=await response.json();
            if(!effectCatalog||typeof effectCatalog!=='object')effectCatalog={};
            if(quickIntelPlanet)showQuickIntel(quickIntelPlanet,{sticky:true});
        } catch { /* Dados atuais continuam disponíveis sem o catálogo opcional. */ }
    }
    function uniqueEffectNames(p) {
        const names = [];
        const add = value => {
            if (Array.isArray(value)) value.forEach(add);
            else if (typeof value === 'string' && clean(value) && !names.some(n => n.toLowerCase() === clean(value).toLowerCase())) names.push(clean(value));
            else if (value && typeof value === 'object') {
                const candidate = value.name || value.title || value.effect || value.displayName;
                if (candidate) add(candidate);
            }
        };
        const liveHazards = Array.isArray(p?.hazards) ? p.hazards : [];
        liveHazards.forEach(h => add(h?.name || h));

        // O catálogo contém também "weather_effects" de ciclo/variação (por
        // exemplo, calor de dia e frio à noite). Eles não devem ser exibidos
        // como se fossem condições simultâneas. Só usamos "environmentals"
        // como fallback quando a telemetria atual não trouxe hazards.
        if (!names.length) {
            const cat = (effectCatalog[String(p?.index)]||{});
            add(cat.environmentals);
        }

        // Compatibilidade com campos de efeitos atuais da API, sem juntar
        // weather_effects do catálogo.
        ['effects','activeEffects','planetEffects','galacticEffects','modifiers'].forEach(k => add(p?.[k]));

        // NÃO adicionar a facção do planeta como "efeito".
        // Ex.: estar sob controle Automaton não significa "Presença de Autômatos"
        // como condição ambiental. A facção já aparece no cabeçalho do card.
        return names.filter(n => {
            const k = n.toLowerCase();
            return k !== 'none'
                && !['automaton','automatons','terminid','terminids','illuminate','illuminates',
                     'human','humans','super earth','superterra'].includes(k);
        });
    }

    function planetEffects(p) {
        const seen=new Set();
        return uniqueEffectNames(p).map(hazardInfo).filter(info=>{const key=info.key||info.name.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
    }
    function renderPlanetEffects(p) {
        const effects=planetEffects(p);
        const box=$('mapa-intel-effects');
        box.hidden=!effects.length;
        box.innerHTML=effects.map(info=>`<span class="intel-effect" tabindex="0" role="img" aria-label="${escapeHTML(info.name)}" title="${escapeHTML(info.name)}">${hazardIconHTML(info)}<span class="intel-effect-label">${escapeHTML(info.name)}</span></span>`).join('');
        $('planet-dossier-effects').innerHTML=effects.length?effects.map(info=>`<div class="dossier-effect">${hazardIconHTML(info)}<span>${escapeHTML(info.name)}</span></div>`).join(''):'<p>Nenhum efeito adicional informado.</p>';
    }
    function planetClimateLabel(p) {
        const direct = clean(p?.weather?.name || p?.weather?.description || p?.climate || p?.weatherName || (typeof p?.weather === 'string' ? p.weather : ''));
        if (direct && !['none','null','unknown'].includes(direct.toLowerCase())) return direct;
        const hazards = Array.isArray(p?.hazards) ? p.hazards : [];
        const names = hazards.filter(h=>!['none','null',''].includes(clean(h?.name||h).toLowerCase())).map(h => hazardInfo(h?.name || h).name).filter(Boolean);
        return names.length ? names.join(' · ') : 'Sem condição registrada';
    }

    // Mesmo catálogo usado na Central de Guerra (guerra.js), pra manter os dois
    // painéis consistentes: nome PT-BR + ícone local + fallback do wiki.gg + emoji.
    const HAZARD_INFO = {
        'extreme cold': { name:'Frio Extremo', icon:'❄', file:'Extreme Cold.png', wikiFile:'Extreme Cold Environmental Condition Icon.svg' },
        'blizzards': { name:'Tempestades de Neve', icon:'❄', file:'Blizzards.png', wikiFile:'Blizzards Environmental Condition Icon.svg' },
        'meteor storms': { name:'Tempestades de Meteoros', icon:'☄', file:'Meteor Storms.png', wikiFile:'Meteor Storms Environmental Condition Icon.svg' },
        'rainstorms': { name:'Tempestades de Chuva', icon:'☔', file:'Rainstorms.png', wikiFile:'Rainstorms Environmental Condition Icon.svg' },
        'sandstorms': { name:'Tempestades de Areia', icon:'≋', file:'Sandstorms.png', wikiFile:'Sandstorms Environmental Condition Icon.svg' },
        'thick fog': { name:'Névoa Densa', icon:'◌', file:'Thick Fog .png', wikiFile:'Thick Fog Environmental Condition Icon.svg' },
        'tremors': { name:'Tremores', icon:'≋', file:'Tremors .png', wikiFile:'Tremors Environmental Condition Icon.svg' },
        'volcanic activity': { name:'Atividade Vulcânica', icon:'🌋', file:'Volcanic Activity.png', wikiFile:'Volcanic Activity Environmental Condition Icon.svg' },
        'intense heat': { name:'Calor Intenso', icon:'🔥', file:'Intense Heat.png', wikiFile:'Intense Heat Environmental Condition Icon.svg' },
        'fire tornadoes': { name:'Tornados de Fogo', icon:'🌪', file:'Fire Tornados.png', wikiFile:'Fire Tornados Environmental Condition Icon.svg' },
        'acid storms': { name:'Tempestades Ácidas', icon:'☣', file:'Acid Storms.png', wikiFile:'Acid Storms Environmental Condition Icon.svg' },
        'heavy gloom shroud': { name:'Manto de Escuridão Intensa', icon:'◐', file:'Heavy Gloom Shroud .png', wikiFile:'Heavy Gloom Shroud Environmental Condition Icon.svg' },
        'ion storms': { name:'Tempestades de Íons', icon:'⚡', file:'Ion Storms.png', wikiFile:'Ion Storms Environmental Condition Icon.svg' },
        'flooding': { name:'Inundações', icon:'≋', file:'', wikiFile:'' }
    };
    const HAZARD_ICON_PATH = 'imagens/ui/efeito-planeta/';
    const WIKI_FILE = name => `https://helldivers.wiki.gg/wiki/Special:Redirect/file/${encodeURIComponent(name)}`;

    function hazardInfo(raw) {
        const n = clean(raw).toLowerCase().replace(/[_-]+/g,' ');
        const key = Object.keys(HAZARD_INFO).find(k => n.includes(k));
        return key ? { ...HAZARD_INFO[key], key } : {
            name: clean(raw) || 'Efeito desconhecido', icon:'⚠', file:'', wikiFile:'', key:''
        };
    }
    function hazardIconSources(info) {
        if (!info || !info.file) return [];
        const wikiName = info.wikiFile || `${info.name} Environmental Condition Icon.svg`;
        return [HAZARD_ICON_PATH + info.file, WIKI_FILE(wikiName)];
    }
    function hazardIconHTML(info) {
        const sources = hazardIconSources(info);
        if (!sources.length) return `<span class="hazard-fallback">${info?.icon || '⚠'}</span>`;
        const [local, wiki] = sources.map(s => escapeHTML(s));
        return `<img src="${local}" alt="" class="hazard-img" data-fallback="${wiki}" onerror="if(this.dataset.fallback && this.src!==this.dataset.fallback){this.src=this.dataset.fallback}else{this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='inline'}"><span class="hazard-fallback" style="display:none">${escapeHTML(info?.icon || '⚠')}</span>`;
    }

    function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; } }
    function writeCache(cache) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {} }

    async function fetchJSON(url, cacheName) {
        return window.HDBRWarData.get(url,cacheName,CACHE_TTL[cacheName],HEADERS,readCache()[cacheName]);
    }

    // Tenta várias formas conhecidas de a API expor a posição do planeta.
    function getPosition(p) {
        if (p?.position && typeof p.position.x === 'number' && typeof p.position.y === 'number') return { x: p.position.x, y: p.position.y };
        if (typeof p?.positionX === 'number' && typeof p?.positionY === 'number') return { x: p.positionX, y: p.positionY };
        if (typeof p?.position_x === 'number' && typeof p?.position_y === 'number') return { x: p.position_x, y: p.position_y };
        return null;
    }
    function getWaypoints(p) {
        if (Array.isArray(p?.waypoints)) return p.waypoints;
        return [];
    }

    // ================================================================
    // ESTADO GLOBAL
    // ================================================================
    let campaignIndexes = new Set();
    let campaigns = [];
    let campaignsKnown = false;
    let majorOrderData = null;
    let loadingPlanets = false;
    let geometryCache = null;
    let allPlanets = [];               // lista crua vinda da API
    const nodeByIndex = new Map();     // index -> { data, circle, ring, group }
    let dssHostIndex = null;
    let activeFaction = 'all';
    let searchQuery = '';
    let selectedIndex = null;
    let lineRecords = [];
    let quickIntelIndex = null;
    let quickIntelPlanet = null;
    let quickIntelHideTimer = 0;
    const layerVisibility = { routes:true, territories:true, sectors:true, invasions:true, activeFronts:false };
    // Arte personalizada da capital; o símbolo anterior permanece como fallback.
    const SUPER_EARTH_CUSTOM_IMAGE = 'icons/super-terra-personalizada.png';
    let invasionLinks = [];

    const SVG_NS = 'http://www.w3.org/2000/svg';
    function svgEl(tag, attrs = {}) {
        const el = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        return el;
    }

    function formatCompactNumber(value) {
        const n = Number(value || 0);
        if (n >= 1000000) return `${(n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace('.', ',')}M`;
        if (n >= 1000) return `${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace('.', ',')}K`;
        return n.toLocaleString('pt-BR');
    }

    function campaignProgress(p) {
        const event=p?.event;
        if(!event || event.health == null || event.maxHealth == null) return null;
        const health=Number(event.health),max=Number(event.maxHealth);
        if(!Number.isFinite(health)||!Number.isFinite(max)||max<=0||health<0||health>max) return null;
        return (1-health/max)*100;
    }

    // Progresso de libertação de um planeta inimigo em campanha ativa.
    // A API expõe a vida restante do planeta; quanto menor a vida, maior a libertação.
    function liberationProgress(p) {
        if(p?.health == null || p?.maxHealth == null) return null;
        const health=Number(p?.health),max=Number(p?.maxHealth);
        if(!Number.isFinite(health)||!Number.isFinite(max)||max<=0||health<0||health>max) return null;
        return (1-health/max)*100;
    }

    function isOffensiveCampaignPlanet(p) {
        if(!p || p.event || !campaignIndexes.has(String(p.index))) return false;
        const owner=factionKey(p.currentOwner || p.owner);
        return owner!=='human' && owner!=='unknown';
    }

    function warProgress(p) {
        if(p?.event) return campaignProgress(p);
        return isOffensiveCampaignPlanet(p) ? liberationProgress(p) : null;
    }

    function formatPercentDetailed(value) {
        if(value == null || !Number.isFinite(Number(value))) return '—';
        const percent=Math.max(0,Math.min(100,Number(value)||0));
        const digits=percent>0 && percent<0.1 ? 2 : (percent<10 ? 1 : 0);
        return `${percent.toFixed(digits).replace('.',',')}%`;
    }

    const offensiveSamples = new Map((()=>{try{return JSON.parse(localStorage.getItem('hdbr_offensiveSamples_v1')||'[]')}catch{return []}})());
    function recordOffensiveSamples(list,now=Date.now()) {
        const active=new Set();
        (Array.isArray(list)?list:[]).forEach(campaign=>{
            const p=campaign?.planet;
            if(!p || p.event) return;
            const owner=factionKey(p.currentOwner || p.owner);
            if(owner==='human'||owner==='unknown') return;
            const progress=liberationProgress(p);
            if(progress==null) return;
            const key=String(p.index ?? clean(p.name));
            active.add(key);
            const signature=JSON.stringify([p.currentOwner,p.maxHealth]);
            let record=offensiveSamples.get(key);
            if(!record||record.signature!==signature)record={signature,values:[]};
            record.values=record.values.filter(v=>now-v.time<=45*60*1000);
            const last=record.values.at(-1);
            if(!last||now-last.time>=45000) record.values.push({time:now,progress});
            offensiveSamples.set(key,record);
        });
        for(const key of offensiveSamples.keys()) if(!active.has(key)) offensiveSamples.delete(key);
        try{localStorage.setItem('hdbr_offensiveSamples_v1',JSON.stringify([...offensiveSamples]))}catch{}
    }

    function offensiveForecast(p,now=Date.now()) {
        const progress=liberationProgress(p);
        const unknown={tone:'neutral',title:'COLETANDO RITMO',detail:'Aguardando nova leitura da API para calcular a tendência.',rate:null,eta:null};
        if(progress==null) return unknown;
        if(progress>=100) return {tone:'good',title:'LIBERTAÇÃO CONCLUÍDA',detail:'Aguardando confirmação da guerra galáctica.',rate:null,eta:'CONCLUÍDO'};
        const key=String(p.index ?? clean(p.name));
        const values=offensiveSamples.get(key)?.values || [];
        const first=values[0],last=values.at(-1);
        if(!first||!last||last.time-first.time<55000||now-last.time>REFRESH*2) return unknown;
        const hours=(last.time-first.time)/3600000;
        const rate=(last.progress-first.progress)/hours;
        if(!Number.isFinite(rate)) return unknown;
        if(rate>0.01) {
            const etaHours=(100-progress)/rate;
            const eta=Number.isFinite(etaHours)&&etaHours>0&&etaHours<=720?durationLabel(etaHours):null;
            return {tone:'good',title:'AVANÇO DA LIBERTAÇÃO',detail:`Ritmo observado: +${rate.toFixed(2).replace('.',',')}%/h${eta?` · conclusão estimada em ${eta}`:''}.`,rate,eta};
        }
        if(rate<-0.01) return {tone:'bad',title:'INIMIGO RECUPERA TERRENO',detail:`Variação observada: ${rate.toFixed(2).replace('.',',')}%/h.`,rate,eta:null};
        return {tone:'neutral',title:'FRENTE ESTÁVEL',detail:'O progresso variou pouco entre as últimas leituras.',rate,eta:null};
    }

    function isSuperEarth(p) {
        const name=clean(p?.name).toLowerCase().replace(/\s+/g,' ').trim();
        return ['super earth','super terra','superterra'].includes(name);
    }

    function visiblePosition(p) {
        if (isSuperEarth(p)) return {x:0,y:0};
        const pos=getPosition(p);
        if(p.disabled === true || !pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return null;
        // Coordenadas zeradas de planetas não localizados não são a capital.
        if(Math.abs(pos.x)<1e-7 && Math.abs(pos.y)<1e-7) return null;
        return pos;
    }

    const defenseSamples = new Map((()=>{try{return JSON.parse(localStorage.getItem('hdbr_defenseSamples_v1')||'[]')}catch{return []}})());
    function eventDates(event) {
        return {start:Date.parse(event?.startTime || ''),end:Date.parse(event?.endTime || '')};
    }
    function recordDefenseSamples(planets,now=Date.now()) {
        const active=new Set();
        planets.forEach(p=>{
            const progress=campaignProgress(p);
            if(progress==null) return;
            const key=String(p.index),e=p.event;
            const signature=JSON.stringify([e.id,e.startTime,e.endTime,e.maxHealth]);
            active.add(key);
            let record=defenseSamples.get(key);
            if(!record||record.signature!==signature) record={signature,values:[]};
            record.values=record.values.filter(v=>now-v.time<=30*60*1000);
            const last=record.values.at(-1);
            if(!last||now-last.time>=45000) record.values.push({time:now,progress});
            defenseSamples.set(key,record);
        });
        for(const key of defenseSamples.keys()) if(!active.has(key)) defenseSamples.delete(key);
        try{localStorage.setItem('hdbr_defenseSamples_v1',JSON.stringify([...defenseSamples]))}catch{}
    }
    function defenseForecast(p,now=Date.now()) {
        const progress=campaignProgress(p),dates=eventDates(p?.event);
        const unknown={tone:'neutral',title:'SEM PROJEÇÃO',detail:'Aguardando dados válidos de progresso e prazo.'};
        if(progress==null) return unknown;
        if(progress>=100) return {tone:'good',title:'OBJETIVO DE DEFESA ATINGIDO',detail:'Aguardando confirmação da atualização da guerra.'};
        if(!Number.isFinite(dates.end)) return unknown;
        const remaining=(dates.end-now)/3600000;
        if(remaining<=0) return {tone:'neutral',title:'PRAZO ENCERRADO',detail:'Aguardando confirmação do resultado pela API.'};
        const values=defenseSamples.get(String(p.index))?.values||[];
        const first=values[0],last=values.at(-1);
        let rate=null,source='';
        if(first&&last&&last.time-first.time>=5*60000&&now-last.time<3*60000) {
            rate=(last.progress-first.progress)/((last.time-first.time)/3600000);
            source='ritmo observado nos últimos '+Math.round((last.time-first.time)/60000)+' min';
        } else if(Number.isFinite(dates.start)&&dates.start<now&&dates.start<dates.end&&now-dates.start>=5*60000) {
            rate=progress/((now-dates.start)/3600000);
            source='ritmo médio desde o início';
        }
        if(rate==null||!Number.isFinite(rate)) return {...unknown,detail:'Coletando ritmo de avanço. '+durationLabel(remaining)+' restantes.'};
        const needed=(100-progress)/remaining;
        const ratio=rate/needed;
        const tone=ratio>1.05?'good':ratio<.95?'bad':'neutral';
        const title=tone==='good'?'TENDÊNCIA DE VITÓRIA':tone==='bad'?'DEFESA EM RISCO':'DISPUTA EQUILIBRADA';
        return {tone,title,detail:`Estimativa pelo ${source}: ${rate.toFixed(1).replace('.',',')}%/h. Necessário: ${needed.toFixed(1).replace('.',',')}%/h. Restam ${durationLabel(remaining)}. O resultado pode mudar.`};
    }
    function durationLabel(hours) {
        const mins=Math.max(0,Math.ceil(hours*60));
        return `${Math.floor(mins/60)}h ${mins%60}min`;
    }


    // ================================================================
    // ORDEM MAIOR + OFENSIVAS DA SUPER TERRA (painéis abaixo do mapa)
    // ================================================================
    function majorOrderArray(data) {
        return Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
    }

    function majorOrderPick(data) {
        return majorOrderArray(data).find(item=>item && (item.title || item.briefing || item.tasks || item.progress || item.setting)) || null;
    }

    function majorOrderTasks(order) {
        const tasks=Array.isArray(order?.tasks)?order.tasks:(Array.isArray(order?.setting?.tasks)?order.setting.tasks:[]);
        if(tasks.length) return tasks.filter(Boolean);
        const goal=Number(order?.goal);
        const progress=Array.isArray(order?.progress)?Number(order.progress[0]):Number(order?.progress);
        return [{_direct:true,type:Number(order?.type||order?.setting?.type||0),title:clean(order?.description||order?.setting?.taskDescription),_goal:Number.isFinite(goal)?goal:null,_progress:Number.isFinite(progress)?progress:0,_faction:order?.targetFaction||order?.target||''}];
    }

    function majorOrderTaskValue(task,valueType) {
        const types=Array.isArray(task?.valueTypes)?task.valueTypes:[];
        const values=Array.isArray(task?.values)?task.values:[];
        const index=types.indexOf(valueType);
        return index>=0?values[index]:null;
    }

    function majorOrderTaskGoal(task) {
        const goal=task?._direct?Number(task._goal):Number(majorOrderTaskValue(task,3));
        return Number.isFinite(goal)&&goal>0?goal:null;
    }

    function majorOrderTaskProgress(order,task,index) {
        if(task?._direct) return Math.max(0,Number(task._progress)||0);
        const direct=Array.isArray(order?.progress)?Number(order.progress[index]):Number(task?.progress?.[0]??task?.progress);
        return Number.isFinite(direct)?Math.max(0,direct):0;
    }

    function majorOrderTaskFactionId(task) {
        if(task?._direct) {
            if(Number.isFinite(Number(task._faction))) return Number(task._faction);
            const name=String(task._faction||'').toLowerCase();
            if(name.includes('terminid')) return 2;
            if(name.includes('automaton')) return 3;
            if(name.includes('illuminate')) return 4;
            if(name.includes('human')||name.includes('super')) return 1;
            return 0;
        }
        const id=Number(majorOrderTaskValue(task,1));
        return Number.isFinite(id)?id:0;
    }

    function majorOrderTaskFactionClass(task) {
        return ({1:'human',2:'terminid',3:'automaton',4:'illuminate'})[majorOrderTaskFactionId(task)] || 'neutral';
    }

    function majorOrderTaskPlanetIndex(task) {
        const id=Number(majorOrderTaskValue(task,12));
        return Number.isFinite(id)&&id>0?id:0;
    }

    function majorOrderPlanetName(id) {
        if(!id) return '';
        const p=allPlanets.find(item=>Number(item?.index)===Number(id));
        return p?planetName(p):`PLANETA #${id}`;
    }

    function majorOrderTaskTypeName(task) {
        return ({2:'OBJETIVO ESPECIAL',3:'ERRADICAÇÃO',9:'OBJETIVO ESPECIAL',11:'LIBERTAÇÃO',12:'DEFESA',13:'CONTROLE'})[Number(task?.type||0)] || 'OBJETIVO';
    }

    function majorOrderTaskTitle(task,index) {
        const direct=clean(task?.title||task?.description||task?.name);
        if(direct) return direct;
        const type=Number(task?.type||0),goal=majorOrderTaskGoal(task),planet=majorOrderPlanetName(majorOrderTaskPlanetIndex(task));
        const faction=({1:'Super Terra',2:'Terminídeos',3:'Autômatos',4:'Iluminados'})[majorOrderTaskFactionId(task)] || '';
        if(type===3) return `Eliminar ${goal?goal.toLocaleString('pt-BR')+' ':''}${faction||'inimigos'}`;
        if(type===11) return planet?`Liberar ${planet}`:'Cumprir objetivo de libertação';
        if(type===12) return planet?`Defender ${planet}`:(faction?`Defender território contra ${faction}`:'Defender território da Super Terra');
        if(type===13) return planet?`Manter controle de ${planet}`:'Manter controle do objetivo designado';
        return planet?`${majorOrderTaskTypeName(task)} · ${planet}`:`Objetivo ${index+1} do Alto Comando`;
    }

    function majorOrderTaskCampaign(task) {
        const index=majorOrderTaskPlanetIndex(task);
        if(!index) return null;
        return campaigns.find(c=>Number(c?.planet?.index)===Number(index)) || null;
    }

    function majorOrderTaskLivePercent(task,done=false) {
        if(done) return 100;
        if(![11,12,13].includes(Number(task?.type||0))) return null;
        const p=majorOrderTaskCampaign(task)?.planet;
        if(!p) return null;
        return p.event?campaignProgress(p):liberationProgress(p);
    }

    function majorOrderExpiration(order) {
        if(order?.expiration||order?.expiresAt||order?.expireTime) return order.expiration||order.expiresAt||order.expireTime;
        const seconds=Number(order?.expiresIn);
        return Number.isFinite(seconds)&&seconds>0?new Date(Date.now()+seconds*1000).toISOString():null;
    }

    function remainingMajorOrder(iso) {
        if(!iso) return 'PRAZO INDISPONÍVEL';
        const sec=Math.floor((new Date(iso).getTime()-Date.now())/1000);
        if(!Number.isFinite(sec)||sec<=0) return 'PRAZO ENCERRADO';
        const d=Math.floor(sec/86400),h=Math.floor((sec%86400)/3600),m=Math.floor((sec%3600)/60);
        return d?`${d}D ${h}H`:h?`${h}H ${m}MIN`:`${m}MIN`;
    }

    function renderMajorOrder(assignments) {
        const box=$('mapa-major-order');
        if(!box) return;
        const order=majorOrderPick(assignments);
        if(!order) {
            box.innerHTML='<div class="mapa-command-empty">Nenhuma Ordem Maior ativa foi informada pela API neste momento.</div>';
            return;
        }
        const tasks=majorOrderTasks(order);
        const expiration=majorOrderExpiration(order);
        const taskData=tasks.map((task,index)=>{
            const goal=majorOrderTaskGoal(task),progress=majorOrderTaskProgress(order,task,index);
            const assignmentDone=Boolean(goal&&progress>=goal);
            const campaign=majorOrderTaskCampaign(task),live=majorOrderTaskLivePercent(task,assignmentDone);
            const hasLive=Number.isFinite(live);
            const percent=hasLive?Math.max(0,Math.min(100,live)):(goal?Math.max(0,Math.min(100,progress/goal*100)):0);
            const done=assignmentDone||percent>=99.999;
            const planet=campaign?.planet;
            const cls=planet?factionKey(planet.event?.faction||planet.currentOwner||planet.owner):majorOrderTaskFactionClass(task);
            return {task,index,goal,progress,percent,done,cls};
        });
        const doneCount=taskData.filter(item=>item.done).length;
        const timeLabel=remainingMajorOrder(expiration);
        const cards=taskData.map(item=>{
            const title=majorOrderTaskTitle(item.task,item.index);
            const type=majorOrderTaskTypeName(item.task);
            const meta=majorOrderPlanetName(majorOrderTaskPlanetIndex(item.task)) || type;
            const counter=item.goal?`${Math.min(item.progress,item.goal).toLocaleString('pt-BR')} / ${item.goal.toLocaleString('pt-BR')}`:'TELEMETRIA ATIVA';
            return `<article class="mapa-mo-task ${escapeHTML(item.cls)}${item.done?' is-complete':''}">
                <div class="mapa-mo-task-top"><span>OBJETIVO ${String(item.index+1).padStart(2,'0')} // ${escapeHTML(type)}</span><strong>${escapeHTML(meta)}</strong></div>
                <h3>${escapeHTML(title)}</h3>
                <div class="mapa-mo-progress"><i style="width:${item.percent>0?`max(${item.percent.toFixed(2)}%, 2px)`:'0%'}"></i></div>
                <div class="mapa-mo-progress-row"><span>${escapeHTML(counter)}</span><strong>${formatPercentDetailed(item.percent)}</strong></div>
                <div class="mapa-mo-task-status">${item.done?'✓ CUMPRIDO':'EM ANDAMENTO'}</div>
            </article>`;
        }).join('');
        box.innerHTML=`<article class="mapa-mo-shell">
            <div class="mapa-mo-summary">
                <div><small>STATUS</small><strong>${doneCount===taskData.length&&taskData.length?'OBJETIVOS CUMPRIDOS':'EM EXECUÇÃO'}</strong></div>
                <div><small>TEMPO RESTANTE</small><strong>${escapeHTML(timeLabel)}</strong></div>
                <div><small>OBJETIVOS</small><strong>${doneCount} / ${taskData.length}</strong></div>
            </div>
            <div class="mapa-mo-grid">${cards}</div>
        </article>`;
    }

    function offensiveCampaigns() {
        return campaigns.filter(c=>{
            const p=c?.planet;
            if(!p||p.event) return false;
            const owner=factionKey(p.currentOwner||p.owner);
            return owner!=='human'&&owner!=='unknown';
        }).sort((a,b)=>Number(b?.planet?.statistics?.playerCount||0)-Number(a?.planet?.statistics?.playerCount||0));
    }

    function renderOffensiveCampaigns() {
        const grid=$('mapa-offensive-grid'),counter=$('mapa-offensive-count');
        if(!grid) return;
        const active=offensiveCampaigns();
        if(counter) counter.textContent=String(active.length);
        $('mapa-offensive-no-results').hidden=true;
        $('mapa-offensive-results').textContent='';
        if(!active.length) {
            grid.innerHTML='<div class="mapa-command-empty">Nenhuma frente ofensiva da Super Terra está ativa neste momento.</div>';
            return;
        }
        grid.innerHTML=active.map(campaign=>{
            const p=campaign.planet;
            const owner=p.currentOwner||p.owner;
            const enemyKey=factionKey(owner),enemyName=factionName(owner);
            const accent=factionColor(owner),progress=liberationProgress(p);
            const players=Number(p.statistics?.playerCount||0),regen=regenPercentPerHour(p);
            const forecast=offensiveForecast(p);
            const rateText=forecast.rate==null?'COLETANDO':`${forecast.rate>=0?'+':''}${forecast.rate.toFixed(2).replace('.',',')}%/h`;
            const etaText=forecast.eta||(forecast.rate==null?'AGUARDANDO AMOSTRAS':forecast.rate<=0?'SEM AVANÇO LÍQUIDO':'SEM PRAZO CONFIÁVEL');
            const photo=planetImageUrl(p),iconInfo=factionIconInfo(owner),icon=iconInfo.primary,iconFallback=iconInfo.fallback||'';
            return `<article class="mapa-offensive-card ${escapeHTML(enemyKey)}" style="--accent:${escapeHTML(accent)}" data-search="${escapeHTML([planetName(p),clean(p.sector),enemyName].join(" "))}" data-planet-index="${escapeHTML(String(p.index))}" tabindex="0" role="button" aria-label="Abrir ${escapeHTML(planetName(p))} no mapa">
                <div class="mapa-offensive-visual">
                    <img src="${escapeHTML(photo)}" alt="" loading="lazy" decoding="async">
                    <div class="mapa-offensive-shade"></div>
                    <div class="mapa-offensive-badge"><img src="${escapeHTML(icon)}" data-fallback="${escapeHTML(iconFallback)}" alt="" onerror="if(this.dataset.fallback&&this.src!==new URL(this.dataset.fallback,document.baseURI).href){this.src=this.dataset.fallback}else{this.style.display='none'}"><span>${escapeHTML(enemyName)}</span></div>
                    <div class="mapa-offensive-title"><small>LIBERTAÇÃO // ${escapeHTML(clean(p.sector)||'SETOR DESCONHECIDO')}</small><strong>${escapeHTML(planetName(p))}</strong></div>
                </div>
                <div class="mapa-offensive-body">
                    <div class="mapa-offensive-progress-head"><span>PROGRESSO DA LIBERTAÇÃO</span><strong>${formatPercentDetailed(progress)}</strong></div>
                    <div class="mapa-offensive-progress"><i style="width:${progress>0?`max(${progress.toFixed(2)}%, 2px)`:'0%'}"></i></div>
                    <div class="mapa-offensive-metrics">
                        <div><small>HELLDIVERS</small><strong>${players.toLocaleString('pt-BR')}</strong></div>
                        <div><small>REGEN./H</small><strong>${formatRate(regen)}/h</strong></div>
                        <div><small>RITMO</small><strong>${escapeHTML(rateText)}</strong></div>
                        <div><small>ESTIMATIVA</small><strong>${escapeHTML(etaText)}</strong></div>
                    </div>
                    <div class="mapa-offensive-status" data-tone="${escapeHTML(forecast.tone)}"><strong>${escapeHTML(forecast.title)}</strong><span>${escapeHTML(forecast.detail)}</span></div>
                    <div class="mapa-offensive-open">⌖ VER NO MAPA</div>
                </div>
            </article>`;
        }).join('');
        filterOffensiveCards();
    }

    function filterOffensiveCards() {
        const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
        const terms=normalize($('mapa-offensive-search')?.value).trim().split(/\s+/).filter(Boolean);
        const cards=Array.from($('mapa-offensive-grid')?.querySelectorAll('.mapa-offensive-card')||[]);
        let visible=0;
        cards.forEach(card=>{card.hidden=!terms.every(term=>normalize(card.dataset.search).includes(term));if(!card.hidden)visible++;});
        $('mapa-offensive-results').textContent=terms.length?`${visible} de ${cards.length} planetas`:'';
        $('mapa-offensive-no-results').hidden=!cards.length||visible>0;
    }

    function positionDossier() {
        const dossier=$('planet-modal'),card=$('mapa-intel-card');
        if(!dossier?.classList.contains('open')||!card)return;
        dossier.style.visibility=card.style.visibility;
        const wrap=card.parentElement,w=wrap.clientWidth,h=wrap.clientHeight,margin=8;
        dossier.style.maxHeight=Math.max(80,h-margin*2)+'px';
        const width=dossier.offsetWidth,height=dossier.offsetHeight;
        const x=parseFloat(card.style.left)||margin,y=parseFloat(card.style.top)||margin;
        let left=x+card.offsetWidth+12;
        if(left+width>w-margin) left=x-width-12>=margin?x-width-12:x+16;
        dossier.style.left=Math.max(margin,Math.min(w-width-margin,left))+'px';
        dossier.style.top=Math.max(margin,Math.min(h-height-margin,y+12))+'px';
    }

    function positionQuickIntel() {
        const card=$('mapa-intel-card'),svg=$('mapa-svg');
        if(!card?.classList.contains('open')||!quickIntelPlanet) return;
        const node=nodeByIndex.get(String(quickIntelPlanet.index));
        if(!node) return;
        const wrap=card.parentElement,wr=wrap.getBoundingClientRect();
        const dot=node.circle.getBoundingClientRect();
        const sx=wrap.clientWidth/wr.width,sy=wrap.clientHeight/wr.height;
        const x=(dot.left+dot.width/2-wr.left)*sx,y=(dot.top+dot.height/2-wr.top)*sy;
        const w=wrap.clientWidth,h=wrap.clientHeight;
        if(x<0||x>w||y<0||y>h) {card.style.visibility='hidden';$('mapa-intel-leader')?.setAttribute('hidden','');positionDossier();return;}
        card.style.visibility='visible';
        // Réserve espaço para o planeta e seus anéis antes de posicionar o cartão.
        const gap=Math.max(32,dot.width*sx/2+20),margin=8;
        const cw=card.offsetWidth;
        const rightFits=x+gap+cw<=w-margin,leftFits=x-gap-cw>=margin;
        const above=y-gap-margin,below=h-y-gap-margin;
        const available=rightFits||leftFits?h-margin*2:Math.max(above,below);
        card.style.maxHeight=Math.max(80,Math.min(680,available))+'px';
        const ch=card.offsetHeight;
        let left,top;
        if(rightFits||leftFits){
            left=rightFits?x+gap:x-gap-cw;
            top=Math.max(margin,Math.min(h-ch-margin,y-ch/2));
        }else{
            left=Math.max(margin,Math.min(w-cw-margin,x-cw/2));
            top=above>=below?y-gap-ch:y+gap;
        }
        card.style.left=left+'px';card.style.top=top+'px';
        const leader=$('mapa-intel-leader');
        if(leader) {
            leader.removeAttribute('hidden');
            leader.setAttribute('viewBox',`0 0 ${w} ${h}`);
            const anchorX=x<left?left:x>left+cw?left+cw:Math.max(left+16,Math.min(left+cw-16,x));
            const anchorY=y<top?top:y>top+ch?top+ch:Math.max(top,Math.min(top+ch,y));
            leader.querySelector('path').setAttribute('d',`M ${x} ${y} L ${anchorX} ${anchorY}`);
        }
        positionDossier();
    }

    function regenPercentPerHour(p) {
        const regen = Number(p?.regenPerSecond ?? p?.regen_per_second ?? 0);
        const maxHealth = Number(p?.maxHealth ?? p?.max_health ?? 0);
        if (!regen || !maxHealth) return 0;
        return Math.max(0, (regen * 3600 / maxHealth) * 100);
    }

    function formatRate(value) {
        const n = Number(value || 0);
        if (!n) return '0%';
        if (n < .01) return '<0,01%';
        return `${n.toFixed(n < 1 ? 2 : 1).replace('.', ',')}%`;
    }

    function getAttackingIndexes(p) {
        return Array.isArray(p?.attacking) ? p.attacking.map(Number).filter(Number.isFinite) : [];
    }

    function getInvasionLinks(planets) {
        const indexed=new Map(planets.map(p=>[Number(p.index),p]));
        const seen=new Set(),links=[];
        planets.forEach(source=>{
            const attacker=factionKey(source.currentOwner||source.owner);
            if(attacker==='unknown'||!visiblePosition(source)) return;
            getAttackingIndexes(source).forEach(index=>{
                const target=indexed.get(index);
                if(!target||!visiblePosition(target)||index===Number(source.index)) return;
                if(attacker==='human') {
                    if(!isOffensiveCampaignPlanet(target)) return;
                } else {
                    if(!target.event||factionKey(target.currentOwner||target.owner)!=='human') return;
                    const invading=factionKey(target.event.faction);
                    if(invading!=='unknown'&&invading!==attacker) return;
                }
                const key=source.index+'>'+index;
                if(seen.has(key)) return;
                seen.add(key);links.push({source,target,faction:attacker});
            });
        });
        return links;
    }

    function drawInvasions(planets,group,mapSize) {
        invasionLinks=getInvasionLinks(planets);
        const defs=$('mapa-svg').querySelector('defs');
        ['human','automaton','terminid','illuminate'].forEach(key=>{
            const marker=svgEl('marker',{id:'invasion-arrow-'+key,viewBox:'0 0 10 10',refX:8.7,refY:5,markerWidth:5.6,markerHeight:5.6,orient:'auto',markerUnits:'strokeWidth'});
            marker.appendChild(svgEl('path',{d:'M 0 0 L 10 5 L 0 10 L 2.5 5 Z',fill:FACTION_COLORS[key]}));
            defs.appendChild(marker);
        });
        invasionLinks.forEach(({source,target,faction})=>{
            const a=visiblePosition(source),b=visiblePosition(target);
            const x1=a.x*SCALE,y1=-a.y*SCALE,x2=b.x*SCALE,y2=-b.y*SCALE;
            const distance=Math.hypot(x2-x1,y2-y1);
            const startPad=mapSize/260*1.7,endPad=mapSize/260*(isSuperEarth(target)?4.8:2.8);
            if(distance<=startPad+endPad) return;
            const ux=(x2-x1)/distance,uy=(y2-y1)/distance;
            const path=svgEl('path',{class:'mapa-invasion-arrow',d:`M ${x1+ux*startPad} ${y1+uy*startPad} L ${x2-ux*endPad} ${y2-uy*endPad}`,stroke:FACTION_COLORS[faction],'marker-end':`url(#invasion-arrow-${faction})`,'vector-effect':'non-scaling-stroke','data-source':source.index,'data-target':target.index});
            const title=svgEl('title');title.textContent=`${planetName(source)} → ${planetName(target)} · ${faction==='human'?'Libertação':'Invasão'}`;path.appendChild(title);group.appendChild(path);
        });
    }

    function getAttackTargetNames(p, limit = 2) {
        const ids = getAttackingIndexes(p);
        const names = ids.map(id => allPlanets.find(pl => Number(pl.index) === id))
            .filter(Boolean).map(pl => clean(pl.name) || `Planeta ${pl.index}`);
        if (!names.length) return '';
        const shown = names.slice(0, limit);
        return shown.join(' · ') + (names.length > limit ? ` · +${names.length - limit}` : '');
    }

    function isCoarseInput() {
        return (window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
    }

    function cancelQuickIntelHide() {
        if (quickIntelHideTimer) window.clearTimeout(quickIntelHideTimer);
        quickIntelHideTimer = 0;
    }

    function showQuickIntel(p, options = {}) {
        const card = $('mapa-intel-card');
        if (!card || !p) return;
        cancelQuickIntelHide();
        if(quickIntelIndex!==String(p.index)) closePlanetModal(false);
        quickIntelPlanet = p;
        quickIntelIndex = String(p.index);
        const owner = p.currentOwner || p.owner;
        const event = p.event;
        const offensive = isOffensiveCampaignPlanet(p);
        const accent = factionColor(event ? (event.faction || owner) : (offensive ? 'Humans' : owner));
        const progress = warProgress(p);
        const players = Number(p.statistics?.playerCount || 0);
        const regions = Array.isArray(p.regions) ? p.regions.length : 0;
        const attacks = getAttackingIndexes(p).length;
        const regen = regenPercentPerHour(p);
        const targets = getAttackTargetNames(p);
        const biome = planetBiome(p);
        const climate = planetClimateLabel(p);
        const ownerName = factionName(owner);
        const ownerIconInfo = factionIconInfo(owner);
        const ownerIcon = ownerIconInfo.primary;
        const photoUrl = planetImageUrl(p);

        card.style.setProperty('--accent', accent);
        card.dataset.sticky = options.sticky ? '1' : '0';
        $('mapa-intel-title').textContent = planetName(p);
        $('mapa-intel-sector').textContent = clean(p.sector) || 'Setor desconhecido';
        $('mapa-intel-status').textContent = event
            ? `INVASÃO · ATACANTE: ${factionName(event.faction)}`
            : offensive
                ? `OFENSIVA DA SUPER TERRA · ALVO: ${ownerName}`
                : `CONTROLADO POR · ${ownerName}`;
        renderPlanetEffects(p);
        $('mapa-intel-biome').textContent = biomeLabel(p);
        $('mapa-intel-climate').textContent = climate;
        $('mapa-intel-faction-name').textContent = ownerName.toUpperCase();
        const factionImg = $('mapa-intel-faction-icon');
        if (factionImg) {
            factionImg.src = ownerIcon;
            factionImg.alt = `Símbolo ${ownerName}`;
            factionImg.style.display = '';
            factionImg.dataset.fallback = ownerIconInfo.fallback || '';
            factionImg.onerror = () => {
                if (factionImg.dataset.fallback && factionImg.src !== new URL(factionImg.dataset.fallback, document.baseURI).href) {
                    factionImg.src = factionImg.dataset.fallback;
                } else {
                    factionImg.style.display = 'none';
                }
            };
        }
        const photo = $('mapa-intel-photo');
        if (photo) {
            photo.src = photoUrl;
            photo.alt = `Paisagem de ${clean(p.name) || 'planeta'}`;
            photo.hidden = false;
            photo.onerror = () => { photo.hidden = true; };
        }
        $('mapa-intel-players').textContent = players.toLocaleString('pt-BR');
        $('mapa-intel-regen').textContent = `${formatRate(regen)}/h`;
        $('mapa-intel-regions').textContent = regions.toLocaleString('pt-BR');
        $('mapa-intel-attacking').textContent = attacks.toLocaleString('pt-BR');

        const progressBox = $('mapa-intel-progress');
        if (progress != null) {
            progressBox.hidden = false;
            const label=$('mapa-intel-progress-label');
            if(label) label.textContent=event?'PROGRESSO DA DEFESA':'PROGRESSO DA LIBERTAÇÃO';
            $('mapa-intel-progress-value').textContent = formatPercentDetailed(progress);
            $('mapa-intel-progress-bar').style.width = `${progress}%`;
            $('mapa-intel-progress-bar').style.background = accent;
        } else {
            progressBox.hidden = true;
        }

        const route = $('mapa-intel-route');
        const origins=invasionLinks.filter(link=>String(link.target.index)===String(p.index)).map(link=>planetName(link.source));
        if(event) {
            route.hidden=false;
            route.innerHTML=`<small>ORIGEM DA INVASÃO</small><span>${escapeHTML(origins.length?origins.join(' · '):'Origem não informada nas conexões da API.')}</span>`;
        } else if(offensive) {
            route.hidden=false;
            route.innerHTML=`<small>ORIGEM DA OFENSIVA</small><span>${escapeHTML(origins.length?origins.join(' · '):'Origem não informada nas conexões da API.')}</span>`;
        } else if(targets) {
            route.hidden=false;
            route.innerHTML=`<small>ROTAS OFENSIVAS</small><span>${escapeHTML(targets)}</span>`;
        } else {route.hidden=true;route.textContent='';}

        const forecast=$('mapa-intel-forecast');
        if(forecast) {
            forecast.hidden=!(event||offensive);
            if(event||offensive) {
                const prediction=event?defenseForecast(p):offensiveForecast(p);
                forecast.dataset.tone=prediction.tone;
                forecast.querySelector('strong').textContent=prediction.title;
                forecast.querySelector('p').textContent=prediction.detail;
            }
        }
        card.classList.add('open');
        card.setAttribute('aria-hidden', 'false');
        if (options.sticky) card.classList.add('sticky'); else card.classList.remove('sticky');
        positionQuickIntel();
    }

    function hideQuickIntel(options = {}) {
        closePlanetModal(false);
        const card = $('mapa-intel-card');
        if (!card) return;
        cancelQuickIntelHide();
        card.classList.remove('open', 'sticky');
        card.style.visibility='';
        $('mapa-intel-leader')?.setAttribute('hidden','');
        card.setAttribute('aria-hidden', 'true');
        card.dataset.sticky = '0';
        quickIntelIndex = null;
        quickIntelPlanet = null;
        if (options.clearSelection !== false) setSelectedPlanet(null);
    }

    function scheduleQuickIntelHide() {
        const card = $('mapa-intel-card');
        if (!card || card.dataset.sticky === '1') return;
        cancelQuickIntelHide();
        quickIntelHideTimer = window.setTimeout(() => hideQuickIntel({ clearSelection:false }), 260);
    }

    function cross(o, a, b) {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }

    function convexHull(points) {
        if (points.length <= 2) return points.slice();
        const pts = points.slice().sort((a,b) => a.x === b.x ? a.y - b.y : a.x - b.x);
        const lower = [];
        for (const p of pts) {
            while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop();
            lower.push(p);
        }
        const upper = [];
        for (let i = pts.length - 1; i >= 0; i--) {
            const p = pts[i];
            while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop();
            upper.push(p);
        }
        lower.pop(); upper.pop();
        return lower.concat(upper);
    }

    function expandPolygon(points, factor = 1.12, extra = 0) {
        if (!points.length) return [];
        const cx = points.reduce((s,p)=>s+p.x,0) / points.length;
        const cy = points.reduce((s,p)=>s+p.y,0) / points.length;
        return points.map(p => {
            const dx = p.x - cx, dy = p.y - cy;
            const len = Math.hypot(dx,dy) || 1;
            return { x: cx + dx * factor + dx / len * extra, y: cy + dy * factor + dy / len * extra };
        });
    }

    function polygonPath(points) {
        if (!points.length) return '';
        return points.map((p,i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') + ' Z';
    }

    // Demarcação APROXIMADA: células de proximidade agrupadas pelo setor da API.
    // Não são os polígonos oficiais. Só recalcula se posições/setores mudarem.
    function buildSectorGeometry(points) {
        const signature = JSON.stringify(points.map(p => [p.raw.index,p.x,p.y,clean(p.raw.sector)]));
        if (geometryCache?.signature === signature) return geometryCache.sectors;
        const radius = Math.max(...points.map(p => Math.hypot(p.x,p.y))) * 1.06 || SCALE;
        const perimeter = Array.from({length:96}, (_,i) => ({x:radius*Math.cos(i*Math.PI/48),y:radius*Math.sin(i*Math.PI/48)}));
        const sectors = new Map();
        points.forEach((p,i) => {
            let poly = perimeter.slice();
            for (let j=0;j<points.length && poly.length;j++) {
                if(i===j) continue;
                const q=points[j], nx=q.x-p.x, ny=q.y-p.y;
                if(Math.abs(nx)+Math.abs(ny)<1e-9) continue;
                const c=(q.x*q.x+q.y*q.y-p.x*p.x-p.y*p.y)/2;
                const next=[];
                for(let k=0;k<poly.length;k++) {
                    const a=poly[k], b=poly[(k+1)%poly.length];
                    const da=a.x*nx+a.y*ny-c, db=b.x*nx+b.y*ny-c;
                    if(da<=1e-7) next.push(a);
                    if((da<=1e-7)!==(db<=1e-7)) {
                        const t=da/(da-db);
                        next.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
                    }
                }
                poly=next;
            }
            const name=clean(p.raw.sector)||'Setor desconhecido';
            if(!sectors.has(name)) sectors.set(name,{name,paths:[],edges:new Map()});
            const sector=sectors.get(name);
            sector.paths.push(polygonPath(poly));
            // Suprime arestas entre planetas do mesmo setor.
            for(let k=0;k<poly.length;k++) {
                const a=poly[k],b=poly[(k+1)%poly.length];
                const key=[`${a.x.toFixed(3)},${a.y.toFixed(3)}`,`${b.x.toFixed(3)},${b.y.toFixed(3)}`].sort().join('|');
                if(sector.edges.has(key)) sector.edges.delete(key);
                else sector.edges.set(key,`M ${a.x} ${a.y} L ${b.x} ${b.y}`);
            }
        });
        geometryCache={signature,sectors};
        return sectors;
    }

    function drawSectors(points, territories, outlines) {
        const owners=new Map();
        points.forEach(({raw})=>{
            const name=clean(raw.sector)||'Setor desconhecido';
            if(!owners.has(name)) owners.set(name,new Set());
            const key=factionKey(raw.currentOwner||raw.owner);
            if(key!=='human' && key!=='unknown') owners.get(name).add(key);
        });
        buildSectorGeometry(points).forEach(sector=>{
            const enemies=[...owners.get(sector.name)].sort();
            if(enemies.length) {
                const patternId='sector-hatch-'+enemies.join('-');
                const defs=$('mapa-svg').querySelector('defs');
                if(!defs.querySelector('#'+patternId)) {
                    const pattern=svgEl('pattern',{id:patternId,patternUnits:'userSpaceOnUse',width:6*enemies.length,height:6,patternTransform:'rotate(35)'});
                    enemies.forEach((key,i)=>{
                        pattern.appendChild(svgEl('rect',{x:i*6,y:0,width:6,height:6,fill:FACTION_COLORS[key],'fill-opacity':.15}));
                        pattern.appendChild(svgEl('path',{d:`M ${i*6} 0 V 6`,stroke:FACTION_COLORS[key],'stroke-opacity':.45,'stroke-width':1.2}));
                    });
                    defs.appendChild(pattern);
                }
                territories.appendChild(svgEl('path',{class:'mapa-sector-fill',d:sector.paths.join(' '),fill:`url(#${patternId})`,'data-sector':sector.name}));
            }
            outlines.appendChild(svgEl('path',{class:'mapa-sector-border',d:[...sector.edges.values()].join(' '),'vector-effect':'non-scaling-stroke','data-sector':sector.name}));
        });
    }

    function planetName(p) {
        const name=clean(p.name);
        return isSuperEarth(p)?'Super Terra':name||'Planeta desconhecido';
    }

    function updateHUD(planets, routeCount) {
        const players = planets.reduce((sum,p)=>sum + Number(p?.statistics?.playerCount || 0), 0);
        const fronts = campaignsKnown ? campaignIndexes.size : null;
        const sectors = new Set(planets.map(p => clean(p?.sector)).filter(Boolean)).size;
        const set = (id,val) => { const el=$(id); if (el) el.textContent=val; };
        set('mapa-hud-players', players.toLocaleString('pt-BR'));
        set('mapa-hud-fronts', fronts == null ? '—' : fronts.toLocaleString('pt-BR'));
        set('mapa-hud-sectors', sectors.toLocaleString('pt-BR'));
        set('mapa-hud-routes', Number(routeCount || 0).toLocaleString('pt-BR'));
    }

    function applyLayerVisibility() {
        const viewport = $('mapa-viewport');
        if (!viewport) return;
        viewport.classList.toggle('hide-routes', !layerVisibility.routes);
        viewport.classList.toggle('hide-territories', !layerVisibility.territories);
        viewport.classList.toggle('hide-sectors', !layerVisibility.sectors);
        viewport.classList.toggle('hide-invasions', !layerVisibility.invasions);
        viewport.classList.toggle('only-active-fronts', !!layerVisibility.activeFronts);
    }

    function setSelectedPlanet(index) {
        selectedIndex = index == null ? null : String(index);
        const viewport = $('mapa-viewport');
        viewport?.classList.toggle('selection-active', selectedIndex != null);
        const neighbors = new Set();
        lineRecords.forEach(rec => {
            const a = String(rec.a), b = String(rec.b);
            const connected = selectedIndex != null && (a === selectedIndex || b === selectedIndex);
            if (connected) neighbors.add(a === selectedIndex ? b : a);
            rec.base.classList.toggle('route-connected', connected);
            rec.line.classList.toggle('route-connected', connected);
            rec.base.classList.toggle('route-muted', selectedIndex != null && !connected);
            rec.line.classList.toggle('route-muted', selectedIndex != null && !connected);
        });
        nodeByIndex.forEach(({ group }, key) => {
            const k = String(key);
            const selected = selectedIndex != null && k === selectedIndex;
            const neighbor = selectedIndex != null && neighbors.has(k);
            group.classList.toggle('selected', selected);
            group.classList.toggle('selected-neighbor', neighbor);
            group.classList.toggle('selection-muted', selectedIndex != null && !selected && !neighbor);
        });
    }

    // ================================================================
    // MONTAGEM DO MAPA (SVG)
    // ================================================================
    const SCALE = 500; // amplia as coordenadas normalizadas da API para um espaço mais confortável de desenhar
    let bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };

    function computeBounds(points) {
        if (!points.length) return { minX: -SCALE, maxX: SCALE, minY: -SCALE, maxY: SCALE };
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        points.forEach(({ x, y }) => {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
        });
        const padX = (maxX - minX) * 0.08 || 40;
        const padY = (maxY - minY) * 0.08 || 40;
        return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
    }

    function buildDefs() {
        const defs = svgEl('defs', {});
        const gradients = {
            human: ['#fff9d0', '#d7d52c', '#8a8712'],
            terminid: ['#ffe0b0', '#ff9900', '#a35f00'],
            automaton: ['#ffd0d0', '#ff4242', '#a11c1c'],
            illuminate: ['#e8d0ff', '#8b3fd6', '#4f1f80'],
            dss: ['#fff6d0', '#ffd23f', '#b8860b']
        };
        Object.entries(gradients).forEach(([key, [light, mid, dark]]) => {
            const grad = svgEl('radialGradient', { id: `planet-grad-${key}`, cx: '32%', cy: '26%', r: '75%' });
            grad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': light }));
            grad.appendChild(svgEl('stop', { offset: '45%', 'stop-color': mid }));
            grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': dark }));
            defs.appendChild(grad);
        });

        // Quatro símbolos compartilhados; cada planeta cria só um <use> leve.
        const iconBoxes = {
            human:{x:10,y:10,w:80,h:80},
            automaton:{x:2,y:14,w:96,h:72},
            terminid:{x:9,y:8,w:82,h:84},
            illuminate:{x:10,y:10,w:80,h:80}
        };
        Object.entries(FACTION_ICONS).forEach(([key, iconInfo]) => {
            const box = iconBoxes[key] || iconBoxes.human;
            const symbol = svgEl('symbol', { id:`faction-icon-${key}`, viewBox:'0 0 100 100', overflow:'visible' });
            const image = svgEl('image', {
                href:iconInfo.primary, x:box.x, y:box.y, width:box.w, height:box.h,
                preserveAspectRatio:'xMidYMid meet'
            });
            if (iconInfo.fallback) {
                image.addEventListener('error', () => {
                    if (image.getAttribute('href') !== iconInfo.fallback) image.setAttribute('href', iconInfo.fallback);
                }, { once:false });
            }
            symbol.appendChild(image);
            defs.appendChild(symbol);
        });
        return defs;
    }

    // Agrupa os planetas de cada facção inimiga num "blob" de território
    // (a Super Terra fica de fora — como controla a maioria dos planetas,
    // um halo dela cobriria o mapa inteiro sem ajudar em nada).
    function buildFactionHalos(withPos) {
        const groups = { terminid: [], automaton: [], illuminate: [] };
        withPos.forEach(({ raw, x, y }) => {
            const key = factionKey(raw.currentOwner || raw.owner);
            if (groups[key]) groups[key].push({ x, y });
        });
        const halos = [];
        Object.entries(groups).forEach(([key, pts]) => {
            if (pts.length < 3) return;
            const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
            const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
            const dists = pts.map(p => Math.hypot(p.x - cx, p.y - cy));
            const avgDist = dists.reduce((s, d) => s + d, 0) / dists.length;
            const maxDist = Math.max(...dists);
            const radius = Math.min(maxDist * 1.05, avgDist * 2.6);
            halos.push({ key, cx, cy, radius });
        });
        return halos;
    }

    function buildMap(planets) {
        const svg = $('mapa-svg');
        if (!svg) return;
        svg.innerHTML = '';
        nodeByIndex.clear();
        lineRecords = [];
        selectedIndex = null;
        hideQuickIntel({ clearSelection:false });

        const withPos = planets
            .map(p => {
                const pos = visiblePosition(p);
                if (!pos) return null;
                return { raw: p, x: pos.x * SCALE, y: -pos.y * SCALE };
            })
            .filter(Boolean).sort((a,b)=>Number(isSuperEarth(a.raw))-Number(isSuperEarth(b.raw)));

        if (!withPos.length) {
            $('mapa-loading').innerHTML = '<div class="error-state">⚠ Não consegui ler as posições dos planetas nesta versão da API. Veja o console (F12) para mais detalhes.</div>';
            console.error('[Helldivers-BR/Mapa] Nenhum planeta com posição reconhecida. Exemplo de objeto recebido:', planets[0]);
            return;
        }

        bounds = computeBounds(withPos.map(w => ({ x: w.x, y: w.y })));
        const w = bounds.maxX - bounds.minX;
        const h = bounds.maxY - bounds.minY;
        const mapSize = Math.max(w,h);
        const cxMap = (bounds.minX + bounds.maxX) / 2;
        const cyMap = (bounds.minY + bounds.maxY) / 2;
        svg.setAttribute('viewBox', `${bounds.minX} ${bounds.minY} ${w} ${h}`);

        const viewport = svgEl('g', { id: 'mapa-viewport' });
        const cartographyGroup = svgEl('g', { class:'mapa-cartography' });
        const territoryGroup = svgEl('g', { class:'mapa-territories' });
        const sectorGroup = svgEl('g', { class:'mapa-sectors' });
        const borderGroup = svgEl('g', { class:'mapa-sector-borders' });
        const linesGroup = svgEl('g', { class:'mapa-lines' });
        const dotsGroup = svgEl('g', { class:'mapa-dots' });
        const invasionGroup = svgEl('g', { class:'mapa-invasions' });
        viewport.appendChild(cartographyGroup);
        viewport.appendChild(territoryGroup);
        viewport.appendChild(borderGroup);
        viewport.appendChild(sectorGroup);
        viewport.appendChild(linesGroup);
        viewport.appendChild(invasionGroup);
        viewport.appendChild(dotsGroup);
        svg.appendChild(buildDefs());
        svg.appendChild(viewport);

        drawSectors(withPos, territoryGroup, borderGroup);

        // Rótulos de setor no plano de fundo.
        const sectorMap = new Map();
        withPos.forEach(({raw,x,y}) => {
            const sector = clean(raw.sector) || 'SETOR DESCONHECIDO';
            if (!sectorMap.has(sector)) sectorMap.set(sector, []);
            sectorMap.get(sector).push({x,y});
        });
        sectorMap.forEach((pts,sector) => {
            const sx = pts.reduce((sum,p)=>sum+p.x,0)/pts.length;
            const sy = pts.reduce((sum,p)=>sum+p.y,0)/pts.length;
            const g = svgEl('g', { class:'mapa-sector-group', transform:`translate(${sx} ${sy})` });
            const label = svgEl('text', { class:'mapa-sector-label', x:0, y:0, 'text-anchor':'middle' });
            label.textContent = sector;
            const count = svgEl('text', { class:'mapa-sector-count', x:0, y:mapSize/95, 'text-anchor':'middle' });
            count.textContent = `${pts.length} PLANETAS`;
            g.appendChild(label); g.appendChild(count); sectorGroup.appendChild(g);
        });

        const posByIndex = new Map(withPos.map(w => [w.raw.index, w]));

        // Linhas de suprimento em duas camadas. Fronteiras entre facções recebem destaque próprio.
        const drawn = new Set();
        withPos.forEach(({ raw, x, y }) => {
            getWaypoints(raw).forEach(targetIndex => {
                const target = posByIndex.get(targetIndex);
                if (!target) return;
                const key = [raw.index, targetIndex].sort((a, b) => a - b).join('-');
                if (drawn.has(key)) return;
                drawn.add(key);
                const fA = factionKey(raw.currentOwner || raw.owner);
                const fB = factionKey(target.raw.currentOwner || target.raw.owner);
                const isFront = fA !== fB;
                const activeRoute = campaignIndexes.has(String(raw.index)) || campaignIndexes.has(String(targetIndex));
                const common = { x1:x, y1:y, x2:target.x, y2:target.y, 'data-a':raw.index, 'data-b':targetIndex, 'vector-effect':'non-scaling-stroke' };
                const base = svgEl('line', { ...common, class:`mapa-supply-line-base${isFront ? ' mapa-front-line-base' : ''}${activeRoute ? ' active-front-route' : ''}` });
                const line = svgEl('line', { ...common, class:`mapa-supply-line${isFront ? ' mapa-front-line' : ''}${activeRoute ? ' active-front-route' : ''}` });
                linesGroup.appendChild(base);
                linesGroup.appendChild(line);
                lineRecords.push({ a:raw.index, b:targetIndex, base, line, isFront });
            });
        });

        drawInvasions(planets,invasionGroup,mapSize);
        const normalRadius = mapSize / 260;

        withPos.forEach(({ raw, x, y }) => {
            const capital=isSuperEarth(raw);
            const baseRadius=normalRadius*(capital?1.9:1);
            const owner = raw.currentOwner || raw.owner;
            const fKey = factionKey(owner);
            const accent = factionColor(owner);
            const underAttack = !!raw.event;
            const offensive = !underAttack && campaignIndexes.has(String(raw.index)) && fKey!=='human' && fKey!=='unknown';
            const progress = underAttack ? campaignProgress(raw) : (offensive ? liberationProgress(raw) : null);
            const displayName = planetName(raw);
            const sectorName = clean(raw.sector) || 'Setor desconhecido';
            const group = svgEl('g', {
                class:'mapa-planet-group' + (fKey==='human' && !capital && !underAttack && !campaignIndexes.has(String(raw.index)) ? ' peaceful-human' : '') + (capital ? ' super-earth' : '') + (campaignIndexes.has(String(raw.index)) ? ' campaign-active' : ' planet-inactive'), 'data-index': raw.index, 'data-faction': fKey,
                tabindex:'0', role:'button', 'aria-label':`${displayName}, ${sectorName}. Abrir informações táticas.`
            });

            if(capital) {
                [4,3,2.2].forEach((r,i)=>group.appendChild(svgEl('circle',{
                    class:'mapa-earth-glory',cx:x,cy:y,r:baseRadius*r,fill:'#ffe68a','fill-opacity':.025+i*.015,'pointer-events':'none'
                })));
                for(let i=0;i<12;i++) {
                    const a=i*Math.PI/6;
                    group.appendChild(svgEl('line',{class:'mapa-earth-glory',x1:x+Math.cos(a)*baseRadius*2.3,y1:y+Math.sin(a)*baseRadius*2.3,x2:x+Math.cos(a)*baseRadius*3.5,y2:y+Math.sin(a)*baseRadius*3.5,stroke:'#ffe68a','stroke-opacity':.3,'stroke-width':.65,'pointer-events':'none'}));
                }
            }
            // Área invisível maior: facilita o toque no celular sem aumentar o planeta visualmente.
            group.appendChild(svgEl('circle', {
                class:'mapa-planet-hit', cx:x, cy:y, r:baseRadius * 3.05, fill:'transparent'
            }));

            const halo = svgEl('circle', {
                class:'mapa-planet-halo', cx:x, cy:y, r:baseRadius * ((underAttack || offensive) ? 2.7 : 2.1),
                fill:accent
            });
            group.appendChild(halo);

            if (underAttack || offensive) {
                const ringColor=underAttack?factionColor(raw.event?.faction):FACTION_COLORS.human;
                const ringRadius=baseRadius*2.08;
                const ringWidth=baseRadius*.48;
                // Defesa e libertação usam o mesmo indicador circular. A cor diferencia
                // a origem: atacante inimigo na defesa; Super Terra na ofensiva.
                const track=svgEl('circle',{
                    class:underAttack?'mapa-defense-track':'mapa-offense-track',cx:x,cy:y,r:ringRadius,
                    fill:'none',stroke:'#303845','stroke-width':ringWidth
                });
                group.appendChild(track);
                if(progress!=null && progress>0) {
                    const circumference=2*Math.PI*ringRadius;
                    const filled=circumference*Math.min(100,Math.max(0,progress))/100;
                    const progressRing=svgEl('circle',{
                        class:underAttack?'mapa-defense-fill':'mapa-offense-fill',cx:x,cy:y,r:ringRadius,
                        fill:'none',stroke:ringColor,'stroke-width':ringWidth,
                        'stroke-dasharray':`${filled} ${circumference-filled}`,
                        'stroke-linecap':'butt',transform:`rotate(-90 ${x} ${y})`,
                        role:'img','aria-label':`${underAttack?'Defesa':'Libertação'} concluída: ${progress.toFixed(1)}%`
                    });
                    group.appendChild(progressRing);
                }
            }

            const circle = svgEl('circle', {
                class:'mapa-planet-dot', cx:x, cy:y,
                r:(underAttack || offensive) ? baseRadius * 1.38 : baseRadius,
                fill:capital ? 'url(#planet-grad-human)' : fKey === 'human' ? '#5089a2' : (fKey === 'unknown' ? '#6b7280' : `url(#planet-grad-${fKey})`)
            });
            const title = svgEl('title', {});
            title.textContent = `${clean(raw.name) || 'Planeta desconhecido'} — ${clean(raw.sector) || 'Setor desconhecido'}`;
            circle.appendChild(title);
            group.appendChild(circle);

            // Símbolo do proprietário dentro da bolinha. O anel externo continua
            // mostrando o atacante quando houver defesa/invasão.
            const iconSize = baseRadius * ((underAttack || offensive) ? 2.05 : 1.55);
            const symbol = svgEl('use', {
                class:'mapa-planet-faction-icon',href:`#faction-icon-${fKey === 'unknown' ? 'human' : fKey}`,
                x:x-iconSize/2,y:y-iconSize/2,width:iconSize,height:iconSize,'aria-hidden':'true'
            });
            group.appendChild(symbol);
            if(capital && SUPER_EARTH_CUSTOM_IMAGE) {
                const size=baseRadius*2;
                const custom=svgEl('image',{class:'mapa-earth-custom',href:SUPER_EARTH_CUSTOM_IMAGE,x:x-size/2,y:y-size/2,width:size,height:size,preserveAspectRatio:'xMidYMid meet','pointer-events':'none'});
                custom.addEventListener('load',()=>{symbol.style.display='none';});
                custom.addEventListener('error',()=>{custom.remove();symbol.style.display='';});
                group.appendChild(custom);
            }

            if (dssHostIndex != null && String(dssHostIndex) === String(raw.index)) {
                const size = baseRadius * .95;
                const cy2 = y - baseRadius * 3.2;
                const dssHalo = svgEl('circle', { class:'mapa-dss-halo', cx:x, cy:cy2, r:size*1.6, fill:'#ffd23f' });
                group.appendChild(dssHalo);
                const diamond = svgEl('path', {
                    class:'mapa-dss-marker', d:`M ${x} ${cy2-size} L ${x+size} ${cy2} L ${x} ${cy2+size} L ${x-size} ${cy2} Z`,
                    fill:'url(#planet-grad-dss)', stroke:'#111', 'stroke-width':.3
                });
                group.appendChild(diamond);
                const dssLabel = svgEl('text', { class:'mapa-dss-label', x, y:cy2-size*1.9, 'text-anchor':'middle' });
                dssLabel.textContent = 'DSS';
                group.appendChild(dssLabel);
            }

            const label = svgEl('text', { class:'mapa-planet-label', x, y:y+baseRadius*2.65, 'text-anchor':'middle' });
            label.textContent = planetName(raw);
            group.appendChild(label);

            const players = Number(raw.statistics?.playerCount || 0);
            const playerLabel = svgEl('text', { class:'mapa-player-label', x, y:y+baseRadius*3.75, 'text-anchor':'middle' });
            playerLabel.textContent = `${formatCompactNumber(players)} HD`;
            group.appendChild(playerLabel);

            if (underAttack) {
                const attacker=factionKey(raw.event?.faction);
                if(attacker!=='human'&&attacker!=='unknown') {
                    const badge=svgEl('g',{class:'mapa-attacker-badge','aria-label':`Atacante: ${factionName(raw.event.faction)}`});
                    badge.appendChild(svgEl('circle',{cx:x+baseRadius*2.65,cy:y-baseRadius*2.65,r:baseRadius*1.05,fill:'#090d12',stroke:factionColor(raw.event.faction),'stroke-width':.6}));
                    badge.appendChild(svgEl('use',{href:`#faction-icon-${attacker}`,x:x+baseRadius*1.75,y:y-baseRadius*3.55,width:baseRadius*1.8,height:baseRadius*1.8}));
                    const title=svgEl('title');title.textContent='Atacante: '+factionName(raw.event.faction);badge.appendChild(title);group.appendChild(badge);
                }
                const eventLabel = svgEl('text', { class:'mapa-event-label', x, y:y-baseRadius*3.45, 'text-anchor':'middle', fill:factionColor(raw.event?.faction || owner) });
                eventLabel.textContent = progress == null ? 'DEFENDENDO' : `DEFENDENDO ${formatPercentDetailed(progress)}`;
                group.appendChild(eventLabel);
            } else if(offensive) {
                const eventLabel=svgEl('text',{class:'mapa-event-label',x,y:y-baseRadius*3.45,'text-anchor':'middle',fill:FACTION_COLORS.human});
                eventLabel.textContent=progress==null?'LIBERTAÇÃO':`LIBERTAÇÃO ${formatPercentDetailed(progress)}`;
                group.appendChild(eventLabel);
            }

            group.addEventListener('keydown', event => {
                if(event.key==='Enter'||event.key===' ') {
                    event.preventDefault();setSelectedPlanet(raw.index);showQuickIntel(raw,{sticky:true});
                }
            });
            group.addEventListener('click', event => {
                event.stopPropagation();
                setSelectedPlanet(raw.index);
                showQuickIntel(raw,{sticky:true});
            });
            dotsGroup.appendChild(group);
            nodeByIndex.set(String(raw.index), { data:raw, group, circle });
        });

        updateHUD(planets, drawn.size);
        applyFilters();
        applyLayerVisibility();
        setupPanZoom(svg, viewport);
    }

    // ================================================================
    // FILTROS (facção + busca)
    // ================================================================
    function applyFilters() {
        const q = searchQuery.trim().toLowerCase();
        nodeByIndex.forEach(({ data, group }) => {
            const owner = data.currentOwner || data.owner;
            const matchesFaction = activeFaction === 'all' || factionKey(owner) === activeFaction;
            const matchesSearch = !q || (clean(data.name).toLowerCase().includes(q) || planetName(data).toLowerCase().includes(q)) || clean(data.sector).toLowerCase().includes(q);
            const show = matchesFaction && matchesSearch;
            group.classList.toggle('filtered-out', !show);
            group.classList.toggle('search-match', !!q && show);
        });
    }

    // ================================================================
    // PAN & ZOOM
    // ================================================================
    function setupPanZoom(svg, viewport) {
        const LABEL_ZOOM_THRESHOLD = 3.5;
        const DETAIL_ZOOM_THRESHOLD = 3.0;
        const LOW_DETAIL_THRESHOLD = 1.18;

        let state = svg._mapaPanZoomState;
        if (state) {
            state.viewport = viewport;
            state.requestApply(true);
            return;
        }

        state = {
            viewport,
            scale:1, tx:0, ty:0,
            isPanning:false, lastX:0, lastY:0, moved:false,
            pinchStartDist:null, pinchStartScale:1,
            activePointers:new Map(),
            rafId:0,
            dragRect:null,
            dragViewBox:null
        };
        svg._mapaPanZoomState = state;
        svg._activePointers = state.activePointers;

        state.applyNow = () => {
            state.rafId = 0;
            const vp = state.viewport;
            if (!vp) return;
            vp.setAttribute('transform', `translate(${state.tx},${state.ty}) scale(${state.scale})`);
            vp.classList.toggle('mapa-labels-on', state.scale >= LABEL_ZOOM_THRESHOLD);
            vp.classList.toggle('mapa-human-details-on', state.scale >= 5);
            vp.classList.toggle('mapa-detail-on', state.scale >= DETAIL_ZOOM_THRESHOLD);
            vp.classList.toggle('mapa-low-detail', state.scale < LOW_DETAIL_THRESHOLD);
            vp.classList.toggle('mapa-sector-fade', state.scale >= 4.2);
            applyLayerVisibility();
            positionQuickIntel();
        };

        state.requestApply = (immediate = false) => {
            if (immediate) {
                if (state.rafId) cancelAnimationFrame(state.rafId);
                state.rafId = 0;
                state.applyNow();
                return;
            }
            if (state.rafId) return;
            state.rafId = requestAnimationFrame(state.applyNow);
        };

        const clientToSvgPoint = (clientX, clientY) => {
            const pt = svg.createSVGPoint();
            pt.x = clientX; pt.y = clientY;
            return pt.matrixTransform(svg.getScreenCTM().inverse());
        };

        state.zoomAt = (clientX, clientY, factor) => {
            const before = clientToSvgPoint(clientX, clientY);
            const newScale = Math.max(.5, Math.min(12, state.scale * factor));
            if (newScale === state.scale) return;
            state.tx = before.x - (before.x - state.tx) * (newScale / state.scale);
            state.ty = before.y - (before.y - state.ty) * (newScale / state.scale);
            state.scale = newScale;
            state.requestApply();
        };

        svg.addEventListener('wheel', event => {
            event.preventDefault();
            state.zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.18 : 1 / 1.18);
        }, { passive:false });

        svg.addEventListener('pointerdown', event => {
            state.activePointers.set(event.pointerId, event);
            state.viewport?.classList.add('mapa-is-moving');
            state.dragRect = svg.getBoundingClientRect();
            const vb = svg.viewBox.baseVal;
            state.dragViewBox = { width:vb.width, height:vb.height };
            if (event.pointerType === 'touch' && state.activePointers.size > 1) return;
            state.isPanning = true; state.moved = false;
            state.lastX = event.clientX; state.lastY = event.clientY;
            // Captura só ao arrastar; o toque simples continua chegando ao planeta.
        });

        svg.addEventListener('pointermove', event => {
            if (state.activePointers.has(event.pointerId)) state.activePointers.set(event.pointerId, event);
            if (state.activePointers.size === 2) {
                state.moved = true;
                const pts = [...state.activePointers.values()];
                const dist = Math.hypot(pts[0].clientX-pts[1].clientX, pts[0].clientY-pts[1].clientY);
                const midX = (pts[0].clientX+pts[1].clientX)/2;
                const midY = (pts[0].clientY+pts[1].clientY)/2;
                if (state.pinchStartDist == null) {
                    state.pinchStartDist = dist;
                    state.pinchStartScale = state.scale;
                } else {
                    state.zoomAt(midX, midY, (dist/state.pinchStartDist) * (state.pinchStartScale/state.scale));
                }
                return;
            }
            if (!state.isPanning) return;
            const dx = event.clientX-state.lastX, dy = event.clientY-state.lastY;
            if (Math.abs(dx)>2 || Math.abs(dy)>2) state.moved = true;
            if (state.moved) { try { svg.setPointerCapture(event.pointerId); } catch {} }
            const rect = state.dragRect || svg.getBoundingClientRect();
            const vb = state.dragViewBox || svg.viewBox.baseVal;
            const units = Math.max(vb.width/rect.width, vb.height/rect.height);
            state.tx += dx*units;
            state.ty += dy*units;
            state.lastX = event.clientX; state.lastY = event.clientY;
            state.requestApply();
        });

        const clearPointer = event => {
            state.activePointers.delete(event.pointerId);
            if (state.activePointers.size === 1) {
                const remaining = [...state.activePointers.values()][0];
                state.lastX = remaining.clientX; state.lastY = remaining.clientY;
            }
            if (state.activePointers.size < 2) state.pinchStartDist = null;
            if (state.activePointers.size === 0) {
                state.isPanning = false;
                state.dragRect = null;
                state.dragViewBox = null;
                state.viewport?.classList.remove('mapa-is-moving');
            }
            try { svg.releasePointerCapture(event.pointerId); } catch {}
        };
        svg.addEventListener('pointerup', clearPointer);
        svg.addEventListener('pointercancel', clearPointer);
        svg.addEventListener('pointerleave', event => {
            if (event.pointerType !== 'touch') clearPointer(event);
        });

        svg.addEventListener('click', event => {
            if (state.moved) { event.stopPropagation(); state.moved = false; }
        }, true);

        const bindZoomButton = (id, fn) => {
            const btn = $(id);
            if (!btn || btn.dataset.mapaBound === '1') return;
            btn.dataset.mapaBound = '1';
            btn.addEventListener('click', fn);
        };
        bindZoomButton('mapa-zoom-in', () => {
            const r=svg.getBoundingClientRect(); state.zoomAt(r.left+r.width/2,r.top+r.height/2,1.35);
        });
        bindZoomButton('mapa-zoom-out', () => {
            const r=svg.getBoundingClientRect(); state.zoomAt(r.left+r.width/2,r.top+r.height/2,1/1.35);
        });
        bindZoomButton('mapa-zoom-reset', () => {
            state.scale=1; state.tx=0; state.ty=0; state.requestApply(true);
        });

        state.requestApply(true);
    }

    // ================================================================
    // DOSSIÊ TÁTICO (modal ao clicar no planeta)
    // ================================================================
    function openPlanetModal(p) {
        const modal = $('planet-modal');
        if (!modal) return;
        const owner=p.currentOwner||p.owner;
        modal.querySelector('.tactical-modal-card').style.setProperty('--accent',factionColor(p.event?.faction||owner));
        $('planet-modal-title').textContent=planetName(p);
        modal.querySelector('.tactical-modal-sector').textContent='ANÁLISE COMPLEMENTAR';
        const reading=window.HDBRWarData?.meta(`${V1}/planets`);
        $('planet-dossier-source').textContent='Bioma, estatísticas e regiões: registro do planeta na API comunitária.'+(reading?.time?' Leitura: '+new Date(reading.time).toLocaleString('pt-BR')+(reading.stale?' (dados salvos).':'.'):'')+' Efeitos: telemetria disponível; catálogo comunitário quando não há hazards informados.';

        const notes=preparationNotes(p);
        $('planet-dossier-advice').innerHTML=notes.length
            ? '<ul>'+notes.map(note=>`<li>${escapeHTML(note)}</li>`).join('')+'</ul>'
            : '<p>A API não informou um efeito com orientação específica disponível. Escolha o equipamento conforme a facção, o objetivo e os modificadores exibidos na missão.</p>';
        const stats=p.statistics||{};
        const statValue=value=>value==null||value===''||typeof value==='boolean'||!Number.isFinite(Number(value))||Number(value)<0?'—':Number(value).toLocaleString('pt-BR');
        const rows=[['MISSÕES VENCIDAS',stats.missionsWon],['MISSÕES PERDIDAS',stats.missionsLost],['BAIXAS DE HELLDIVERS',stats.deaths]];
        $('planet-dossier-history').innerHTML=rows.map(([label,value])=>`<div><small>${label}</small><strong>${statValue(value)}</strong></div>`).join('');
        const regions=Array.isArray(p.regions)?p.regions:[];
        $('planet-dossier-regions').innerHTML=regions.length?'<ul>'+regions.map(r=>`<li><strong>${escapeHTML(clean(r.name)||'Região sem nome')}</strong><span>${r.isAvailable===true?'Disponível':r.isAvailable===false?'Indisponível':'Disponibilidade não informada'}${r.players!=null?' · '+statValue(r.players)+' Helldivers':''}</span></li>`).join('')+'</ul>':'<p>A API não informou regiões para este planeta.</p>';

        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        $('mapa-intel-details')?.setAttribute('aria-expanded','true');
        positionDossier();
        modal.querySelector('[data-close-planet]')?.focus({preventScroll:true});
    }
    function closePlanetModal(restoreFocus = true) {
        const modal = $('planet-modal');
        if (!modal) return;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        $('mapa-intel-details')?.setAttribute('aria-expanded','false');
        if(restoreFocus) $('mapa-intel-details')?.focus({preventScroll:true});
    }

    // ================================================================
    // CARREGAMENTO E ATUALIZAÇÃO
    // ================================================================
    async function loadDSS() {
        try {
            const data = await fetchJSON(`${V2}/space-stations`, 'dss');
            const station = Array.isArray(data) ? data[0] : null;
            const hostName = clean(station?.planet?.name).toLowerCase();
            if (!hostName) { dssHostIndex = null; return; }
            const match = allPlanets.find(p => clean(p.name).toLowerCase() === hostName);
            dssHostIndex = match ? match.index : (station?.planet?.index ?? null);
        } catch (err) {
            console.warn('[Helldivers-BR/Mapa] DSS indisponível:', err);
            dssHostIndex = null;
        }
    }

    async function loadPlanets(force = false) {
        if (loadingPlanets || (force && (document.hidden || $('mapa-svg')?._mapaPanZoomState?.isPanning || $('planet-modal')?.getAttribute('aria-hidden') === 'false'))) return;
        loadingPlanets = true;
        try {
            const [planetResult, campaignResult, assignmentResult] = await Promise.allSettled([
                fetchJSON(`${V1}/planets`, 'planets'),
                fetchJSON(`${V1}/campaigns`, 'campaigns'),
                fetchJSON(`${V1}/assignments`, 'assignments')
            ]);
            if (planetResult.status !== 'fulfilled') throw planetResult.reason;
            const data=planetResult.value;
            const nextPlanets=Array.isArray(data)?data:data?.planets;
            if (!Array.isArray(nextPlanets) || !nextPlanets.length) throw new Error('Dados de planetas vazios ou inválidos.');
            allPlanets=nextPlanets;
            recordDefenseSamples(allPlanets,window.HDBRWarData.meta(`${V1}/planets`)?.time||Date.now());
            if(campaignResult.status==='fulfilled') {
                const data=campaignResult.value;
                const list=Array.isArray(data)?data:data?.campaigns;
                if(Array.isArray(list)) {
                    // Mesma leitura de planeta no mapa, nos cartões e nos objetivos.
                    const byIndex=new Map(allPlanets.map(p=>[String(p.index),p]));
                    campaigns=list.map(c=>({...c,planet:byIndex.get(String(c.planet?.index))||c.planet}));
                    campaignIndexes=new Set(list.map(c=>c.planet?.index).filter(i=>i!=null).map(String));
                    campaignsKnown=true;
                    recordOffensiveSamples(campaigns,window.HDBRWarData.meta(`${V1}/planets`)?.time||Date.now());
                }
            }
            if(assignmentResult.status==='fulfilled') majorOrderData=assignmentResult.value;

            const selected=selectedIndex;
            const inspector=quickIntelIndex;
            const sticky=$('mapa-intel-card')?.dataset.sticky==='1';
            await loadDSS();
            buildMap(allPlanets);
            if(campaignResult.status==='fulfilled' || campaigns.length) renderOffensiveCampaigns();
            else {
                if($('mapa-offensive-count')) $('mapa-offensive-count').textContent='—';
                if($('mapa-offensive-grid')) $('mapa-offensive-grid').innerHTML='<div class="mapa-command-empty">Campanhas temporariamente indisponíveis. Nova tentativa automática em um minuto.</div>';
            }
            if(majorOrderData) renderMajorOrder(majorOrderData);
            else if($('mapa-major-order')) $('mapa-major-order').innerHTML='<div class="mapa-command-empty">Ordem Maior temporariamente indisponível. Nova tentativa automática em um minuto.</div>';

            if(selected!=null) setSelectedPlanet(selected);
            if(inspector!=null) {
                const p=allPlanets.find(p=>String(p.index)===inspector);
                if(p) showQuickIntel(p,{sticky});
            }
            $('mapa-loading')?.classList.add('hidden');
            const status=$('mapa-tactical-hud')?.querySelector('.mapa-hud-status span');
            if(status) status.textContent=window.HDBRWarData.hasStale()?'ÚLTIMA LEITURA · SEM ATUALIZAÇÃO':campaignResult.status==='rejected'?'CAMPANHAS INDISPONÍVEIS':'ATUALIZADO · '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
        } catch(err) {
            console.error('[Helldivers-BR/Mapa]',err);
            const status=$('mapa-tactical-hud')?.querySelector('.mapa-hud-status span');
            if(status) status.textContent='SEM ATUALIZAÇÃO · TENTANDO NOVAMENTE';
            const forecast=$('mapa-intel-forecast');
            if(forecast&&!forecast.hidden) {forecast.dataset.tone='neutral';forecast.querySelector('strong').textContent='DADOS DESATUALIZADOS';forecast.querySelector('p').textContent='Aguardando nova leitura da API para atualizar a projeção.';}
            if(!nodeByIndex.size) $('mapa-loading').innerHTML=`<div class="error-state">⚠ ${escapeHTML(err.message)} Nova tentativa automática em um minuto.</div>`;
        } finally { loadingPlanets=false; }
    }

    function bindUI() {
        document.querySelectorAll('.mapa-filter').forEach(button=>{
            button.setAttribute('aria-pressed',String(button.classList.contains('active')));
            const info=FACTION_ICONS[button.dataset.faction];
            if(!info) return;
            const image=document.createElement('img');
            image.className='mapa-filter-icon';image.alt='';image.width=22;image.height=22;
            image.decoding='async';
            let fallbackUsed=false;
            image.addEventListener('error',()=>{
                if(!fallbackUsed&&info.fallback){fallbackUsed=true;image.src=info.fallback;}
                else image.hidden=true;
            });
            image.src=info.primary;button.prepend(image);
        });
        document.querySelectorAll('.mapa-layer').forEach(button=>button.setAttribute('aria-pressed',String(button.classList.contains('active'))));
        window.addEventListener('resize',positionQuickIntel);
        if(window.ResizeObserver) new ResizeObserver(positionQuickIntel).observe($('mapa-intel-card'));
        $('mapa-intel-photo')?.addEventListener('load',positionQuickIntel);
        $('mapa-busca')?.addEventListener('input', event => { searchQuery = event.target.value; applyFilters(); });
        $('mapa-filtros')?.addEventListener('click', event => {
            const btn = event.target.closest('.mapa-filter');
            if (!btn) return;
            document.querySelectorAll('.mapa-filter').forEach(b => {b.classList.remove('active');b.setAttribute('aria-pressed','false');});
            btn.classList.add('active');
            btn.setAttribute('aria-pressed','true');
            activeFaction = btn.dataset.faction;
            applyFilters();
        });
        $('mapa-layer-controls')?.addEventListener('click', event => {
            const btn = event.target.closest('.mapa-layer');
            if (!btn) return;
            const layer = btn.dataset.layer;
            if (!(layer in layerVisibility)) return;
            layerVisibility[layer] = !layerVisibility[layer];
            btn.classList.toggle('active', layerVisibility[layer]);
            btn.setAttribute('aria-pressed',String(layerVisibility[layer]));
            applyLayerVisibility();
        });
        $('planet-modal')?.addEventListener('click', event => {
            if (event.target.matches('[data-close-planet]') || event.target.closest('[data-close-planet]')) closePlanetModal();
        });

        const openOffensiveCard = card => {
            const index=card?.dataset?.planetIndex;
            if(index==null) return;
            const p=allPlanets.find(item=>String(item.index)===String(index));
            if(!p) return;
            document.querySelector('.mapa-panel')?.scrollIntoView({behavior:'smooth',block:'center'});
            setSelectedPlanet(p.index);
            showQuickIntel(p,{sticky:true});
            window.setTimeout(positionQuickIntel,420);
        };
        $('mapa-offensive-grid')?.addEventListener('click', event => openOffensiveCard(event.target.closest('.mapa-offensive-card')));
        $('mapa-offensive-grid')?.addEventListener('keydown', event => {
            if(event.key!=='Enter'&&event.key!==' ') return;
            const card=event.target.closest('.mapa-offensive-card');
            if(!card) return;
            event.preventDefault();openOffensiveCard(card);
        });

        $('mapa-offensive-search')?.addEventListener('input',filterOffensiveCards);
        $('mapa-intel-details')?.setAttribute('aria-controls','planet-modal');
        $('mapa-intel-details')?.setAttribute('aria-expanded','false');
        if(window.ResizeObserver) new ResizeObserver(positionDossier).observe($('planet-modal'));
        $('mapa-intel-close')?.addEventListener('click', () => hideQuickIntel());
        $('mapa-intel-details')?.addEventListener('click', () => {
            if (!quickIntelPlanet) return;
            setSelectedPlanet(quickIntelPlanet.index);
            openPlanetModal(quickIntelPlanet);
        });
        $('mapa-intel-card')?.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') cancelQuickIntelHide(); });
        $('mapa-intel-card')?.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') scheduleQuickIntelHide(); });
        $('mapa-svg')?.addEventListener('click', event => {
            if (!event.target.closest?.('.mapa-planet-group')) hideQuickIntel();
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                if ($('planet-modal')?.classList.contains('open')) closePlanetModal();
                else hideQuickIntel();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        bindUI();
        loadEffectCatalog();
        loadPlanets();
        setInterval(() => loadPlanets(true), REFRESH);
    });
})();