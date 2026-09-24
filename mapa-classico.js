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
	const PLANET_IMAGES_BY_NAME = {
		'k': 'Magma_Base_Landscape.png',
		'brilliance': 'Brilliance_Planet_Landscape_Header.jpg',
		'luxuriant': 'Luxuriant_Planet_Landscape_Header.png',
		'fronteria': 'Tropical_Oasis_Biome_Header.png'
	};
    const PLANET_IMG_PATH = 'imagens/planetas/';
    // Classificação visual editorial do portal; não altera os dados da API.
    const SPECIAL_LOCATIONS = {
        'penta': {file:'penta.png', label:'Buraco negro', color:'#ffc75a'},
        'meridia': {file:'meridia.png', label:'Buraco negro', color:'#ba6bff'},
        'ivis': {file:'destrocos.png', label:'Planeta destruído', color:'#b7c0c9'},
        'moradesh': {file:'destrocos.png', label:'Planeta destruído', color:'#b7c0c9'},
        "angel's venture": {file:'destrocos.png', label:'Planeta destruído', color:'#b7c0c9'}
    };
    function specialLocation(p) {
        const name=clean(p?.name).toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
        return SPECIAL_LOCATIONS[name] || null;
    }

    function planetBiome(p) { return clean(p?.biome?.name || p?.biome) || 'Bioma desconhecido'; }
    function planetImageUrl(p) {
        const special=specialLocation(p);
        if(special) return PLANET_IMG_PATH+special.file;
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
        return [...new Set(planetEffects(p).map(h=>advice[h.key]?(h.possible?'Se '+h.name+' estiver ativo: ':'')+advice[h.key]:null).filter(Boolean))];
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
        const result=[],seen=new Set();
        const add=(value,possible)=>{
            if(Array.isArray(value)){value.forEach(v=>add(v,possible));return;}
            const raw=typeof value==='string'?value:value?.name||value?.title;
            if(!raw||['none','null'].includes(raw.toLowerCase()))return;
            const info=hazardInfo(raw),key=(info.key||info.name).toLowerCase().replace(/[_-]+/g,' ');
            if(seen.has(key))return;
            seen.add(key);result.push({...info,possible});
        };
        uniqueEffectNames(p).forEach(v=>add(v,false));
        const catalog=(effectCatalog[String(p?.index)]||{});
        add(catalog.environmentals,true);
        add(catalog.weather_effects,true);
        return result;
    }
    function renderPlanetEffects(p) {
        const effects=planetEffects(p);
        const box=$('mapa-intel-effects');
        box.hidden=!effects.length;
        box.innerHTML=effects.map(info=>`<span class="intel-effect${info.possible?' effect-possible':''}" tabindex="0" role="img" aria-label="${escapeHTML(info.name)} — ${info.possible?'Possível no planeta':'Informado pela API'}" title="${escapeHTML(info.name)} — ${info.possible?'Possível no planeta':'Informado pela API'}">${hazardIconHTML(info)}<span class="intel-effect-label">${escapeHTML(info.name)} · ${info.possible?'possível':'API'}</span></span>`).join('');
        $('planet-dossier-effects').innerHTML=effects.length?effects.map(info=>`<div class="dossier-effect">${hazardIconHTML(info)}<span>${escapeHTML(info.name)}<small class="effect-source">${info.possible?'Possível no planeta · catálogo':'Informado pela API'}</small></span></div>`).join(''):'<p>Nenhum efeito adicional informado.</p>';
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
        'normal temp': { name:'Temperatura Normal', icon:'♨', file:'Normal Temp.png', localOnly:true, description:'Condição térmica normal.', recommendation:'Confira os demais efeitos ambientais antes da missão.' },
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
        if (info.localOnly) return [HAZARD_ICON_PATH + info.file];
        const wikiName = info.wikiFile || `${info.name} Environmental Condition Icon.svg`;
        return [HAZARD_ICON_PATH + info.file, WIKI_FILE(wikiName)];
    }
    function hazardIconHTML(info) {
        if (info?.localOnly) return `<img src="${escapeHTML(HAZARD_ICON_PATH + info.file)}" alt="" class="hazard-img" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"><span class="hazard-fallback" style="display:none;color:#fff" aria-label="Temperatura Normal">♨</span>`;
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
        if(specialLocation(p)) return false;
        if(!p || p.event || !campaignIndexes.has(String(p.index))) return false;
        const owner=factionKey(p.currentOwner || p.owner);
        return owner!=='human' && owner!=='unknown';
    }

    function warProgress(p) {
        if(specialLocation(p)) return null;
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
        // Deslocamento cartográfico local; não modifica coordenadas da API.
        const name=clean(p.name).toLowerCase();
        if(name==='meridia' || name==='ivis') {
            const peer=allPlanets.find(other=>clean(other.name).toLowerCase()===(name==='meridia'?'ivis':'meridia'));
            const other=peer && getPosition(peer);
            if(other && Math.hypot(pos.x-other.x,pos.y-other.y)<.09) {
                return {x:(pos.x+other.x)/2+(name==='meridia'?-.045:.045),y:pos.y};
            }
        }
        return pos;
    }

    const defenseSamples = new Map((()=>{try{return JSON.parse(localStorage.getItem('hdbr_defenseSamples_v1')||'[]')}catch{return []}})());
    function eventDates(event) {
        return {start:Date.parse(event?.startTime || ''),end:Date.parse(event?.endTime || '')};
    }
    // Avanço do relógio da invasão, não dano/baixas inimigas.
    function invasionProgress(p, now=Date.now()) {
        const {start,end}=eventDates(p?.event);
        if(!p?.event || !Number.isFinite(start) || !Number.isFinite(end) || end<=start) return null;
        return Math.max(0,Math.min(100,(now-start)/(end-start)*100));
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
        if(window.matchMedia('(max-width: 600px)').matches) {
            dossier.style.visibility='visible';dossier.style.left='8px';dossier.style.top='8px';dossier.style.maxHeight='calc(100% - 16px)';return;
        }
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
        if(window.matchMedia('(max-width: 600px)').matches) {
            card.style.visibility='visible';card.style.left='8px';card.style.top='auto';
            card.style.maxHeight='58%';$('mapa-intel-leader')?.setAttribute('hidden','');
            positionDossier();return;
        }
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
            if(specialLocation(source)) return;
            const attacker=factionKey(source.currentOwner||source.owner);
            if(attacker==='unknown'||!visiblePosition(source)) return;
            getAttackingIndexes(source).forEach(index=>{
                const target=indexed.get(index);
                if(!target||specialLocation(target)||!visiblePosition(target)||index===Number(source.index)) return;
                if(attacker==='human') {
                    // Defesa tem prioridade: não desenhar ofensiva saindo de planeta invadido.
                    if(source.event || !isOffensiveCampaignPlanet(target)) return;
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
            const marker=svgEl('marker',{id:'invasion-arrow-'+key,viewBox:'0 0 10 10',refX:10,refY:5,markerWidth:7,markerHeight:7,orient:'auto',markerUnits:'userSpaceOnUse'});
            marker.appendChild(svgEl('path',{d:'M 0 1 L 10 5 L 0 9 L 2.5 5 Z',fill:FACTION_COLORS[key]}));
            defs.appendChild(marker);
        });
        invasionLinks.forEach(({source,target,faction})=>{
            const a=visiblePosition(source),b=visiblePosition(target);
            const x1=a.x*SCALE,y1=-a.y*SCALE,x2=b.x*SCALE,y2=-b.y*SCALE;
            const distance=Math.hypot(x2-x1,y2-y1);
            const startPad=mapSize/260*1.7,endPad=mapSize/260*(isSuperEarth(target)?4.8:2.8);
            if(distance<=startPad+endPad) return;
            const ux=(x2-x1)/distance,uy=(y2-y1)/distance;
            const path=svgEl('path',{class:'mapa-invasion-arrow',d:`M ${x1+ux*startPad} ${y1+uy*startPad} L ${x2-ux*endPad} ${y2-uy*endPad}`,stroke:FACTION_COLORS[faction],'marker-end':`url(#invasion-arrow-${faction})`,'data-source':source.index,'data-target':target.index});
            const title=svgEl('title');title.textContent=`${planetName(source)} → ${planetName(target)} · ${faction==='human'?'Libertação':'Invasão'}`;path.appendChild(title);group.appendChild(path);
        });
    }

    function getAttackTargetNames(p, limit = 2) {
        const ids = invasionLinks.filter(link=>String(link.source.index)===String(p.index)).map(link=>Number(link.target.index));
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
        const special=specialLocation(p);
        card.classList.toggle("special-location",!!special);
        const owner = p.currentOwner || p.owner;
        const event = special ? null : p.event;
        const offensive = isOffensiveCampaignPlanet(p);
        const accent = factionColor(event ? (event.faction || owner) : (offensive ? 'Humans' : owner));
        const progress = warProgress(p);
        const players = Number(p.statistics?.playerCount || 0);
        const regions = Array.isArray(p.regions) ? p.regions.length : 0;
        const attacks = invasionLinks.filter(link=>String(link.source.index)===String(p.index)).length;
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
        const bosses=MAP_BOSS_MARKERS[clean(p.name).toLowerCase()] || [];
        let bossNote=$('mapa-intel-boss-note');
        if(!bossNote) {
            bossNote=document.createElement('div');bossNote.id='mapa-intel-boss-note';
            $('mapa-intel-status').after(bossNote);
        }
        bossNote.hidden=!bosses.length;
        bossNote.textContent=bosses.length ? bosses.map(b=>b.name).join(' · ')+' — marcações do portal, sem confirmação ao vivo da API.' : '';
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
            $('mapa-intel-progress-bar').style.background = event ? '#4da6ff' : accent;
        } else {
            progressBox.hidden = true;
        }

        const enemyBox=$('mapa-intel-enemy-progress');
        enemyBox.hidden=!event;
        if(event) {
            const enemyProgress=invasionProgress(p);
            $('mapa-intel-enemy-value').textContent=formatPercentDetailed(enemyProgress);
            $('mapa-intel-enemy-bar').style.width=`${enemyProgress ?? 0}%`;
            $('mapa-intel-enemy-bar').style.background=factionColor(event.faction);
            $('mapa-intel-enemy-note').textContent=enemyProgress==null
                ? 'Horários da invasão indisponíveis.' : 'Avanço pelo relógio da invasão.';
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
        if(special) {
            card.style.setProperty('--accent',special.color);
            $('mapa-intel-status').textContent=special.label.toUpperCase()+' · INACESSÍVEL';
            $('mapa-intel-faction-name').textContent=special.label.toUpperCase();
            if(factionImg) { factionImg.src=PLANET_IMG_PATH+special.file; factionImg.alt=special.label; factionImg.dataset.fallback=''; }
            if(photo) photo.alt=special.label+' · '+planetName(p);
            progressBox.hidden=true;
            route.hidden=true;
            if(forecast) forecast.hidden=true;
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

    // v51 — contornos adaptados de SVGMap.svg, fornecido pelo usuário.
    // Fonte: Helldivers Wiki — https://helldivers.wiki.gg/wiki/Planets_and_Sectors
    // Somente geometria: posições, controle e campanhas continuam vindos da API.
    const SECTOR_OUTLINES = {"sol":"M50.002,0.000L49.761,4.901L49.041,9.755L47.849,14.514L46.196,19.134L44.098,23.570L41.575,27.779L38.652,31.720L35.357,35.355L31.722,38.650L27.780,41.574L23.571,44.096L19.136,46.194L14.516,47.847L9.756,49.039L4.902,49.759L0.002,50.000L-4.899,49.759L-9.753,49.039L-14.513,47.847L-19.133,46.194L-23.568,44.096L-27.777,41.574L-31.718,38.650L-35.354,35.355L-38.649,31.720L-41.572,27.779L-44.095,23.570L-46.193,19.134L-47.846,14.514L-49.038,9.755L-49.758,4.901L-49.999,0.000L-49.758,-4.901L-49.038,-9.754L-47.845,-14.514L-46.192,-19.134L-44.094,-23.570L-41.572,-27.779L-38.649,-31.720L-35.354,-35.355L-31.718,-38.651L-27.777,-41.573L-23.568,-44.096L-19.132,-46.194L-14.512,-47.847L-9.752,-49.039L-4.899,-49.759L0.002,-50.000L4.903,-49.759L9.757,-49.039L14.516,-47.847L19.137,-46.194L23.572,-44.096L27.781,-41.573L31.722,-38.651L35.358,-35.355L38.653,-31.720L41.576,-27.779L44.098,-23.570L46.196,-19.134L47.849,-14.514L49.042,-9.754L49.761,-4.901Z","altus":"M50.337,0.125L50.186,-3.879L49.738,-7.818L49.000,-11.678L47.981,-15.443L46.689,-19.097L45.131,-22.626L43.316,-26.015L41.251,-29.247L38.945,-32.308L36.404,-35.183L33.638,-37.856L30.653,-40.313L27.458,-42.538L24.062,-44.515L20.470,-46.230L16.693,-47.667L12.737,-48.811L8.610,-49.648L4.321,-50.161L-0.123,-50.335L-0.123,-50.335L-0.123,-52.808L-0.123,-55.282L-0.123,-57.755L-0.123,-60.229L-0.123,-62.703L-0.123,-65.176L-0.123,-67.650L-0.123,-70.123L-0.123,-72.596L-0.123,-75.070L-0.123,-77.543L-0.123,-80.017L-0.123,-82.491L-0.123,-84.964L-0.123,-87.437L-0.123,-89.911L-0.123,-92.384L-0.123,-94.858L-0.123,-97.332L-0.123,-99.805L8.056,-99.476L16.056,-98.507L23.851,-96.921L31.414,-94.744L38.721,-92.002L45.745,-88.718L52.460,-84.918L58.840,-80.626L64.859,-75.868L70.491,-70.669L75.710,-65.053L80.490,-59.045L84.805,-52.671L88.630,-45.955L91.937,-38.922L94.701,-31.597L96.896,-24.006L98.496,-16.172L99.475,-8.121L99.808,0.123L99.808,0.123L97.334,0.123L94.860,0.123L92.387,0.123L89.913,0.123L87.440,0.123L84.966,0.123L82.493,0.123L80.019,0.123L77.546,0.123L75.072,0.123L72.599,0.123L70.125,0.123L67.652,0.123L65.178,0.123L62.705,0.123L60.231,0.123L57.758,0.123L55.284,0.123L52.811,0.123L50.337,0.123L50.337,0.123L50.337,0.123L50.337,0.123L50.337,0.123L50.337,0.123L50.337,0.123L50.337,0.123L50.337,0.124L50.337,0.124L50.337,0.124L50.337,0.124L50.337,0.124L50.337,0.124L50.337,0.124L50.337,0.124L50.337,0.125L50.337,0.125L50.337,0.125L50.337,0.125Z","barnard":"M145.290,39.097L144.104,43.331L142.811,47.476L141.415,51.532L139.920,55.498L138.332,59.375L136.655,63.162L134.893,66.859L133.051,70.466L131.133,73.982L129.145,77.408L127.091,80.742L124.974,83.985L122.801,87.137L120.574,90.197L118.300,93.165L115.982,96.040L113.625,98.823L111.234,101.514L108.813,104.111L106.367,106.615L106.367,106.615L104.575,104.823L102.783,103.032L100.992,101.240L99.200,99.448L97.409,97.657L95.617,95.865L93.825,94.074L92.034,92.282L90.242,90.490L88.451,88.699L86.659,86.907L84.867,85.116L83.076,83.324L81.284,81.532L79.492,79.741L77.701,77.949L75.909,76.157L74.118,74.366L72.326,72.574L70.534,70.783L68.506,72.757L66.442,74.657L64.344,76.482L62.215,78.232L60.057,79.910L57.872,81.514L55.662,83.046L53.430,84.507L51.179,85.897L48.910,87.216L46.625,88.465L44.328,89.645L42.020,90.756L39.703,91.799L37.381,92.775L35.055,93.684L32.727,94.526L30.400,95.303L28.077,96.015L25.759,96.663L25.759,96.663L25.107,94.231L24.456,91.800L23.804,89.369L23.153,86.938L22.501,84.507L21.850,82.076L21.198,79.645L20.547,77.213L19.896,74.782L19.244,72.351L18.592,69.920L17.941,67.489L17.290,65.058L16.638,62.627L15.987,60.196L15.335,57.764L14.684,55.333L14.032,52.902L13.381,50.471L12.729,48.040L17.780,46.514L22.358,44.651L26.488,42.489L30.191,40.072L33.491,37.439L36.411,34.633L38.975,31.694L41.204,28.663L43.123,25.582L44.755,22.492L46.122,19.433L47.248,16.447L48.156,13.576L48.868,10.859L49.409,8.339L49.800,6.057L50.066,4.053L50.229,2.369L50.313,1.046L50.340,0.125L50.340,0.125L52.813,0.125L55.287,0.125L57.760,0.125L60.234,0.125L62.707,0.125L65.181,0.125L67.654,0.125L70.128,0.125L72.601,0.125L75.075,0.125L77.548,0.125L80.022,0.125L82.495,0.125L84.969,0.125L87.442,0.125L89.916,0.125L92.389,0.125L94.863,0.125L97.336,0.125L99.810,0.125L99.801,1.464L99.775,2.800L99.731,4.131L99.670,5.458L99.592,6.780L99.497,8.098L99.385,9.411L99.256,10.720L99.110,12.023L98.947,13.321L98.768,14.615L98.572,15.902L98.359,17.185L98.130,18.461L97.885,19.732L97.623,20.997L97.346,22.256L97.052,23.509L96.743,24.755L96.417,25.995L96.417,25.995L98.861,26.650L101.305,27.305L103.748,27.960L106.192,28.615L108.635,29.271L111.079,29.926L113.523,30.581L115.966,31.236L118.410,31.891L120.854,32.546L123.297,33.201L125.741,33.857L128.184,34.512L130.628,35.167L133.072,35.822L135.515,36.477L137.959,37.132L140.403,37.787L142.846,38.442Z","cancri":"M106.367,106.615L100.323,112.343L94.050,117.670L87.564,122.595L80.882,127.119L74.021,131.243L66.996,134.966L59.826,138.290L52.527,141.215L45.115,143.740L37.608,145.866L30.022,147.595L22.375,148.925L14.682,149.857L6.960,150.393L-0.773,150.532L-8.501,150.274L-16.208,149.620L-23.875,148.570L-31.487,147.125L-39.027,145.285L-39.027,145.285L-37.721,140.411L-36.415,135.536L-35.108,130.662L-33.802,125.788L-32.496,120.914L-31.190,116.040L-29.884,111.165L-28.578,106.291L-27.271,101.417L-25.965,96.543L-24.659,91.668L-23.353,86.794L-22.047,81.920L-20.741,77.046L-19.435,72.171L-18.128,67.297L-16.822,62.423L-15.516,57.548L-14.210,52.674L-12.904,47.800L-11.622,48.133L-10.330,48.430L-9.031,48.691L-7.726,48.917L-6.417,49.109L-5.104,49.265L-3.790,49.388L-2.476,49.477L-1.163,49.532L0.146,49.554L1.451,49.544L2.749,49.502L4.040,49.427L5.321,49.321L6.591,49.184L7.849,49.016L9.093,48.817L10.321,48.589L11.532,48.330L12.724,48.043L12.724,48.043L13.376,50.474L14.027,52.905L14.678,55.336L15.330,57.767L15.982,60.198L16.633,62.629L17.284,65.060L17.936,67.492L18.587,69.923L19.239,72.354L19.890,74.785L20.542,77.216L21.193,79.647L21.845,82.078L22.496,84.509L23.148,86.941L23.799,89.372L24.451,91.803L25.102,94.234L25.754,96.665L28.611,95.858L31.406,94.977L34.138,94.026L36.806,93.008L39.410,91.927L41.950,90.787L44.425,89.592L46.835,88.346L49.180,87.053L51.459,85.715L53.671,84.338L55.816,82.925L57.895,81.480L59.906,80.007L61.848,78.509L63.723,76.990L65.529,75.454L67.265,73.906L68.932,72.348L70.529,70.785L70.529,70.785L72.321,72.576L74.113,74.368L75.905,76.160L77.697,77.951L79.489,79.743L81.280,81.534L83.072,83.325L84.864,85.117L86.656,86.909L88.448,88.700L90.240,90.492L92.032,92.283L93.824,94.074L95.616,95.866L97.407,97.658L99.199,99.449L100.991,101.241L102.783,103.032L104.575,104.823Z","gothmar":"M-12.901,47.797L-13.556,50.241L-14.210,52.684L-14.865,55.127L-15.520,57.571L-16.174,60.014L-16.829,62.457L-17.483,64.900L-18.138,67.344L-18.793,69.787L-19.447,72.230L-20.102,74.673L-20.757,77.116L-21.411,79.560L-22.066,82.003L-22.721,84.446L-23.375,86.890L-24.030,89.333L-24.685,91.776L-25.339,94.219L-25.994,96.663L-26.645,99.094L-27.297,101.525L-27.949,103.956L-28.600,106.387L-29.252,108.818L-29.903,111.249L-30.555,113.680L-31.206,116.112L-31.858,118.543L-32.509,120.974L-33.161,123.405L-33.812,125.836L-34.464,128.267L-35.115,130.698L-35.767,133.129L-36.418,135.561L-37.070,137.992L-37.721,140.423L-38.373,142.854L-39.024,145.285L-39.025,145.285L-39.025,145.285L-39.026,145.285L-39.026,145.285L-39.027,145.285L-39.027,145.285L-39.028,145.285L-39.028,145.285L-39.029,145.285L-39.029,145.285L-39.030,145.285L-39.030,145.285L-39.031,145.285L-39.031,145.285L-39.032,145.285L-39.032,145.285L-39.033,145.285L-39.033,145.285L-39.034,145.285L-39.034,145.285L-43.383,144.032L-47.628,142.668L-51.768,141.201L-55.803,139.636L-59.734,137.979L-63.561,136.235L-67.283,134.412L-70.900,132.514L-74.412,130.548L-77.819,128.519L-81.121,126.434L-84.318,124.298L-87.411,122.118L-90.397,119.898L-93.279,117.646L-96.056,115.367L-98.727,113.067L-101.292,110.752L-103.752,108.428L-106.107,106.100L-106.107,106.100L-104.341,104.334L-102.574,102.568L-100.808,100.802L-99.042,99.037L-97.275,97.271L-95.509,95.505L-93.742,93.739L-91.976,91.973L-90.210,90.207L-88.443,88.441L-86.677,86.675L-84.910,84.910L-83.144,83.144L-81.378,81.378L-79.611,79.612L-77.845,77.846L-76.078,76.080L-74.312,74.314L-72.546,72.548L-70.779,70.783L-69.851,71.700L-68.911,72.605L-67.959,73.498L-66.995,74.379L-66.020,75.247L-65.033,76.102L-64.035,76.944L-63.026,77.774L-62.006,78.591L-60.975,79.394L-59.933,80.184L-58.881,80.961L-57.818,81.724L-56.745,82.474L-55.662,83.210L-54.568,83.932L-53.465,84.640L-52.352,85.334L-51.229,86.014L-50.096,86.680L-50.096,86.680L-48.830,84.486L-47.563,82.292L-46.296,80.098L-45.029,77.904L-43.763,75.711L-42.496,73.517L-41.229,71.323L-39.963,69.129L-38.696,66.935L-37.429,64.741L-36.162,62.547L-34.895,60.354L-33.628,58.160L-32.362,55.966L-31.095,53.772L-29.828,51.578L-28.561,49.384L-27.295,47.190L-26.028,44.996L-24.761,42.802L-24.207,43.122L-23.648,43.434L-23.084,43.739L-22.517,44.037L-21.945,44.328L-21.369,44.612L-20.789,44.889L-20.205,45.158L-19.617,45.420L-19.025,45.675L-18.429,45.922L-17.830,46.162L-17.226,46.394L-16.619,46.618L-16.008,46.834L-15.394,47.043L-14.776,47.243L-14.154,47.436L-13.529,47.621L-12.901,47.797Z","cantolus":"M-24.764,42.802L-26.030,44.996L-27.297,47.190L-28.564,49.384L-29.831,51.578L-31.098,53.772L-32.364,55.966L-33.631,58.160L-34.898,60.354L-36.165,62.547L-37.431,64.741L-38.698,66.935L-39.965,69.129L-41.232,71.323L-42.498,73.517L-43.765,75.711L-45.032,77.904L-46.299,80.098L-47.566,82.292L-48.832,84.486L-50.099,86.680L-51.231,86.014L-52.354,85.334L-53.467,84.640L-54.571,83.932L-55.664,83.210L-56.747,82.474L-57.821,81.724L-58.883,80.961L-59.936,80.184L-60.977,79.394L-62.009,78.591L-63.029,77.774L-64.038,76.944L-65.036,76.102L-66.022,75.247L-66.998,74.379L-67.961,73.498L-68.913,72.605L-69.853,71.700L-70.782,70.783L-70.782,70.783L-72.548,72.548L-74.314,74.314L-76.081,76.080L-77.847,77.846L-79.614,79.612L-81.380,81.378L-83.146,83.144L-84.913,84.910L-86.679,86.675L-88.445,88.441L-90.212,90.207L-91.978,91.973L-93.745,93.739L-95.511,95.505L-97.277,97.271L-99.044,99.037L-100.810,100.802L-102.577,102.568L-104.343,104.334L-106.110,106.100L-108.523,103.608L-110.912,101.022L-113.273,98.343L-115.601,95.571L-117.891,92.706L-120.139,89.748L-122.341,86.698L-124.490,83.557L-126.584,80.324L-128.617,77.000L-130.584,73.585L-132.482,70.079L-134.305,66.483L-136.050,62.798L-137.710,59.023L-139.282,55.158L-140.762,51.205L-142.144,47.163L-143.424,43.033L-144.597,38.815L-144.597,38.815L-142.200,38.173L-139.803,37.531L-137.407,36.889L-135.010,36.247L-132.613,35.605L-130.216,34.963L-127.820,34.321L-125.423,33.679L-123.026,33.037L-120.629,32.395L-118.232,31.753L-115.836,31.111L-113.439,30.469L-111.042,29.827L-108.645,29.185L-106.249,28.543L-103.852,27.901L-101.455,27.259L-99.058,26.617L-96.662,25.975L-96.987,24.735L-97.296,23.489L-97.589,22.236L-97.867,20.978L-98.128,19.714L-98.373,18.444L-98.602,17.169L-98.815,15.888L-99.011,14.602L-99.190,13.311L-99.353,12.014L-99.499,10.712L-99.628,9.405L-99.741,8.094L-99.836,6.777L-99.914,5.455L-99.975,4.130L-100.019,2.799L-100.045,1.464L-100.054,0.125L-100.054,0.125L-97.530,0.125L-95.006,0.125L-92.482,0.125L-89.958,0.125L-87.434,0.125L-84.910,0.125L-82.386,0.125L-79.862,0.125L-77.338,0.125L-74.814,0.125L-72.290,0.125L-69.766,0.125L-67.242,0.125L-64.718,0.125L-62.194,0.125L-59.670,0.125L-57.146,0.125L-54.622,0.125L-52.098,0.125L-49.574,0.125L-49.396,4.054L-48.952,7.775L-48.269,11.294L-47.372,14.612L-46.285,17.732L-45.037,20.658L-43.650,23.391L-42.152,25.936L-40.567,28.295L-38.922,30.470L-37.242,32.466L-35.552,34.284L-33.878,35.928L-32.246,37.401L-30.681,38.705L-29.210,39.844L-27.856,40.820L-26.647,41.637L-25.608,42.297L-24.764,42.802Z","idun":"M-49.574,0.125L-52.098,0.125L-54.622,0.125L-57.146,0.125L-59.670,0.125L-62.194,0.125L-64.718,0.125L-67.242,0.125L-69.766,0.125L-72.290,0.125L-74.814,0.125L-77.338,0.125L-79.862,0.125L-82.386,0.125L-84.910,0.125L-87.434,0.125L-89.958,0.125L-92.482,0.125L-95.006,0.125L-97.530,0.125L-100.054,0.125L-100.045,1.464L-100.019,2.799L-99.975,4.130L-99.914,5.455L-99.836,6.777L-99.741,8.094L-99.629,9.405L-99.500,10.712L-99.354,12.014L-99.191,13.311L-99.012,14.602L-98.816,15.888L-98.603,17.169L-98.374,18.444L-98.129,19.714L-97.868,20.978L-97.590,22.236L-97.296,23.489L-96.987,24.735L-96.662,25.975L-96.662,25.975L-101.442,27.255L-106.223,28.536L-111.004,29.816L-115.785,31.097L-120.566,32.377L-125.347,33.657L-130.128,34.938L-134.909,36.218L-139.690,37.498L-144.471,38.779L-149.251,40.059L-154.032,41.340L-158.813,42.620L-163.594,43.900L-168.375,45.181L-173.156,46.461L-177.937,47.741L-182.718,49.022L-187.499,50.302L-192.280,51.583L-192.920,49.115L-193.529,46.634L-194.107,44.141L-194.654,41.637L-195.169,39.121L-195.652,36.593L-196.104,34.054L-196.523,31.504L-196.910,28.943L-197.265,26.372L-197.586,23.790L-197.875,21.199L-198.130,18.597L-198.352,15.985L-198.541,13.365L-198.696,10.734L-198.816,8.095L-198.903,5.447L-198.955,2.790L-198.972,0.125L-198.972,0.125L-196.499,0.125L-194.026,0.125L-191.553,0.125L-189.080,0.125L-186.607,0.125L-184.134,0.125L-181.661,0.125L-179.188,0.125L-176.715,0.125L-174.242,0.125L-171.769,0.125L-169.296,0.125L-166.823,0.125L-164.350,0.125L-161.877,0.125L-159.404,0.125L-156.931,0.125L-154.458,0.125L-151.985,0.125L-149.512,0.125L-149.492,-1.877L-149.447,-3.872L-149.376,-5.861L-149.279,-7.844L-149.156,-9.819L-149.007,-11.788L-148.833,-13.750L-148.634,-15.704L-148.410,-17.651L-148.162,-19.590L-147.888,-21.521L-147.590,-23.445L-147.268,-25.360L-146.921,-27.267L-146.550,-29.166L-146.156,-31.056L-145.738,-32.937L-145.297,-34.809L-144.832,-36.672L-144.344,-38.525L-144.344,-38.525L-139.529,-37.234L-134.714,-35.944L-129.899,-34.654L-125.085,-33.363L-120.270,-32.073L-115.455,-30.782L-110.640,-29.491L-105.826,-28.201L-101.011,-26.911L-96.196,-25.620L-91.381,-24.329L-86.566,-23.039L-81.752,-21.749L-76.937,-20.458L-72.122,-19.167L-67.308,-17.877L-62.493,-16.587L-57.678,-15.296L-52.863,-14.006L-48.048,-12.715L-48.195,-12.122L-48.335,-11.525L-48.467,-10.927L-48.592,-10.325L-48.710,-9.721L-48.821,-9.115L-48.925,-8.506L-49.021,-7.895L-49.110,-7.281L-49.191,-6.665L-49.265,-6.046L-49.331,-5.425L-49.390,-4.802L-49.441,-4.177L-49.484,-3.549L-49.520,-2.920L-49.548,-2.288L-49.568,-1.654L-49.579,-1.018L-49.583,-0.380L-49.583,-0.380L-49.583,-0.354L-49.583,-0.329L-49.583,-0.303L-49.583,-0.278L-49.583,-0.253L-49.583,-0.227L-49.583,-0.202L-49.583,-0.177L-49.582,-0.152L-49.582,-0.128L-49.582,-0.102L-49.581,-0.078L-49.581,-0.053L-49.580,-0.028L-49.579,-0.002L-49.578,0.023L-49.577,0.048L-49.576,0.073L-49.575,0.099L-49.574,0.125Z","kelvin":"M-0.123,-99.802L-0.123,-97.329L-0.123,-94.856L-0.123,-92.382L-0.123,-89.909L-0.123,-87.435L-0.123,-84.961L-0.123,-82.488L-0.123,-80.014L-0.123,-77.541L-0.123,-75.068L-0.123,-72.594L-0.123,-70.121L-0.123,-67.647L-0.123,-65.173L-0.123,-62.700L-0.123,-60.226L-0.123,-57.753L-0.123,-55.280L-0.123,-52.806L-0.123,-50.332L-3.557,-50.184L-6.929,-49.807L-10.230,-49.209L-13.452,-48.397L-16.588,-47.380L-19.631,-46.164L-22.572,-44.759L-25.403,-43.171L-28.117,-41.408L-30.707,-39.479L-33.164,-37.391L-35.482,-35.151L-37.651,-32.767L-39.665,-30.248L-41.515,-27.600L-43.195,-24.832L-44.695,-21.952L-46.010,-18.967L-47.130,-15.884L-48.048,-12.713L-48.048,-12.713L-52.863,-14.003L-57.678,-15.293L-62.493,-16.584L-67.308,-17.875L-72.122,-19.165L-76.937,-20.455L-81.752,-21.746L-86.566,-23.037L-91.381,-24.327L-96.196,-25.618L-101.011,-26.908L-105.826,-28.198L-110.640,-29.489L-115.455,-30.780L-120.270,-32.070L-125.085,-33.360L-129.899,-34.651L-134.714,-35.942L-139.529,-37.232L-144.344,-38.522L-143.815,-40.428L-143.262,-42.324L-142.685,-44.209L-142.084,-46.083L-141.459,-47.947L-140.811,-49.800L-140.139,-51.642L-139.443,-53.472L-138.725,-55.291L-137.984,-57.098L-137.220,-58.894L-136.434,-60.677L-135.625,-62.448L-134.794,-64.207L-133.941,-65.953L-133.066,-67.686L-132.170,-69.407L-131.253,-71.114L-130.314,-72.807L-129.354,-74.487L-129.354,-74.487L-127.220,-73.255L-125.086,-72.024L-122.952,-70.792L-120.818,-69.559L-118.684,-68.327L-116.550,-67.096L-114.416,-65.864L-112.283,-64.631L-110.149,-63.399L-108.015,-62.167L-105.881,-60.936L-103.747,-59.704L-101.613,-58.471L-99.479,-57.239L-97.345,-56.008L-95.211,-54.776L-93.077,-53.543L-90.944,-52.311L-88.810,-51.080L-86.676,-49.848L-83.462,-55.044L-80.034,-59.923L-76.408,-64.492L-72.601,-68.755L-68.628,-72.717L-64.506,-76.385L-60.250,-79.763L-55.878,-82.857L-51.404,-85.673L-46.845,-88.215L-42.218,-90.490L-37.537,-92.502L-32.820,-94.257L-28.082,-95.761L-23.340,-97.018L-18.609,-98.035L-13.906,-98.816L-9.246,-99.368L-4.647,-99.695L-0.123,-99.802Z","iptus":"M124.809,-216.255L121.061,-209.764L117.313,-203.272L113.565,-196.781L109.817,-190.290L106.069,-183.798L102.321,-177.307L98.573,-170.815L94.826,-164.324L91.077,-157.833L87.329,-151.341L83.582,-144.850L79.834,-138.359L76.086,-131.867L72.338,-125.376L68.590,-118.884L64.842,-112.393L61.094,-105.902L57.346,-99.410L53.598,-92.919L49.850,-86.428L47.955,-87.497L45.992,-88.547L43.961,-89.575L41.864,-90.577L39.700,-91.547L37.472,-92.484L35.180,-93.382L32.823,-94.238L30.405,-95.048L27.923,-95.808L25.381,-96.515L22.779,-97.163L20.116,-97.750L17.395,-98.271L14.616,-98.723L11.779,-99.101L8.886,-99.402L5.937,-99.622L2.933,-99.757L-0.125,-99.802L-0.125,-99.802L-0.125,-107.271L-0.125,-114.740L-0.125,-122.209L-0.125,-129.678L-0.125,-137.147L-0.125,-144.616L-0.125,-152.085L-0.125,-159.553L-0.125,-167.022L-0.125,-174.491L-0.125,-181.960L-0.125,-189.429L-0.125,-196.898L-0.124,-204.367L-0.124,-211.836L-0.124,-219.304L-0.124,-226.773L-0.124,-234.242L-0.124,-241.711L-0.124,-249.180L-0.074,-249.181L-0.024,-249.183L0.026,-249.184L0.077,-249.185L0.127,-249.186L0.178,-249.187L0.228,-249.187L0.279,-249.188L0.330,-249.188L0.381,-249.189L0.432,-249.189L0.483,-249.189L0.533,-249.190L0.584,-249.190L0.635,-249.190L0.685,-249.190L0.735,-249.190L0.786,-249.190L0.836,-249.190L0.886,-249.190L0.886,-249.190L6.886,-249.119L12.931,-248.904L19.016,-248.540L25.137,-248.026L31.291,-247.355L37.473,-246.526L43.680,-245.535L49.908,-244.378L56.152,-243.051L62.409,-241.551L68.674,-239.875L74.945,-238.018L81.216,-235.978L87.485,-233.750L93.746,-231.332L99.996,-228.720L106.232,-225.909L112.448,-222.897L118.642,-219.680L124.809,-216.255Z","celeste":"M200.746,0.125L195.699,0.125L190.652,0.125L185.605,0.125L180.558,0.125L175.511,0.125L170.464,0.125L165.417,0.125L160.370,0.125L155.323,0.125L150.276,0.125L145.230,0.125L140.183,0.125L135.136,0.125L130.089,0.125L125.042,0.125L119.995,0.125L114.948,0.125L109.901,0.125L104.854,0.125L99.808,0.125L99.789,-1.592L99.712,-3.857L99.542,-6.624L99.246,-9.848L98.790,-13.484L98.141,-17.485L97.264,-21.806L96.126,-26.403L94.693,-31.228L92.932,-36.237L90.809,-41.385L88.290,-46.626L85.342,-51.913L81.931,-57.203L78.023,-62.449L73.585,-67.605L68.582,-72.628L62.982,-77.469L56.750,-82.085L49.853,-86.430L49.853,-86.430L51.097,-88.586L52.342,-90.741L53.587,-92.897L54.831,-95.052L56.076,-97.207L57.321,-99.363L58.565,-101.518L59.810,-103.674L61.055,-105.830L62.299,-107.985L63.544,-110.141L64.789,-112.296L66.033,-114.451L67.278,-116.607L68.522,-118.762L69.767,-120.918L71.012,-123.073L72.256,-125.229L73.501,-127.385L74.746,-129.540L77.898,-127.684L81.028,-125.736L84.133,-123.694L87.210,-121.560L90.256,-119.332L93.266,-117.013L96.238,-114.601L99.169,-112.097L102.054,-109.500L104.892,-106.813L107.677,-104.033L110.407,-101.161L113.079,-98.199L115.690,-95.144L118.235,-91.999L120.712,-88.763L123.117,-85.437L125.447,-82.019L127.698,-78.511L129.868,-74.912L129.868,-74.912L132.062,-76.179L134.257,-77.446L136.451,-78.713L138.645,-79.979L140.839,-81.246L143.034,-82.513L145.228,-83.780L147.422,-85.047L149.616,-86.313L151.811,-87.580L154.005,-88.847L156.199,-90.113L158.394,-91.380L160.588,-92.647L162.782,-93.914L164.976,-95.181L167.171,-96.447L169.365,-97.714L171.559,-98.981L173.754,-100.247L175.909,-96.448L178.027,-92.511L180.100,-88.439L182.120,-84.232L184.079,-79.892L185.968,-75.421L187.781,-70.820L189.509,-66.090L191.144,-61.234L192.679,-56.252L194.105,-51.147L195.414,-45.919L196.599,-40.571L197.651,-35.103L198.564,-29.517L199.328,-23.816L199.937,-17.999L200.381,-12.069L200.653,-6.027L200.746,0.125Z","korpus":"M250.206,0.125L250.184,3.481L250.117,6.827L250.007,10.161L249.854,13.485L249.657,16.798L249.417,20.099L249.134,23.388L248.809,26.665L248.442,29.929L248.033,33.181L247.582,36.419L247.090,39.644L246.556,42.855L245.982,46.053L245.368,49.236L244.713,52.405L244.018,55.558L243.283,58.697L242.509,61.820L241.695,64.927L241.695,64.927L239.306,64.287L236.917,63.646L234.527,63.006L232.138,62.365L229.749,61.725L227.360,61.085L224.971,60.444L222.581,59.804L220.192,59.163L217.803,58.523L215.414,57.882L213.024,57.242L210.635,56.601L208.246,55.961L205.856,55.320L203.467,54.679L201.078,54.039L198.689,53.398L196.300,52.758L193.910,52.117L193.203,54.683L192.463,57.235L191.689,59.772L190.884,62.296L190.045,64.804L189.175,67.298L188.272,69.777L187.338,72.240L186.372,74.687L185.375,77.119L184.347,79.534L183.288,81.933L182.199,84.316L181.080,86.682L179.930,89.030L178.751,91.361L177.542,93.675L176.305,95.971L175.038,98.248L173.742,100.507L173.742,100.507L171.570,99.253L169.398,97.999L167.226,96.745L165.054,95.491L162.882,94.237L160.709,92.983L158.537,91.729L156.365,90.474L154.193,89.220L152.021,87.966L149.849,86.712L147.677,85.458L145.505,84.204L143.332,82.950L141.160,81.696L138.988,80.441L136.816,79.187L134.644,77.933L132.472,76.679L130.300,75.425L131.265,73.728L132.209,72.018L133.132,70.294L134.032,68.557L134.910,66.806L135.765,65.043L136.598,63.267L137.409,61.478L138.196,59.677L138.960,57.863L139.701,56.038L140.418,54.200L141.112,52.351L141.782,50.491L142.428,48.619L143.049,46.736L143.647,44.843L144.219,42.938L144.767,41.023L145.290,39.097L145.290,39.097L142.846,38.442L140.402,37.787L137.959,37.132L135.515,36.477L133.071,35.822L130.627,35.167L128.184,34.512L125.740,33.857L123.296,33.201L120.852,32.546L118.409,31.891L115.965,31.236L113.521,30.581L111.077,29.926L108.634,29.271L106.190,28.615L103.746,27.960L101.302,27.305L98.858,26.650L96.415,25.995L96.740,24.755L97.049,23.508L97.343,22.255L97.620,20.996L97.881,19.731L98.126,18.460L98.355,17.184L98.568,15.901L98.764,14.614L98.944,13.321L99.106,12.022L99.252,10.719L99.382,9.411L99.494,8.098L99.589,6.780L99.668,5.458L99.729,4.131L99.772,2.800L99.799,1.464L99.808,0.125L99.808,0.125L107.327,0.125L114.847,0.125L122.367,0.125L129.887,0.125L137.407,0.125L144.927,0.125L152.447,0.125L159.967,0.125L167.487,0.125L175.007,0.125L182.527,0.125L190.047,0.125L197.566,0.125L205.086,0.125L212.606,0.125L220.126,0.125L227.646,0.125L235.166,0.125L242.686,0.125L250.206,0.125L250.206,0.125Z","gallux":"M259.540,150.037L255.223,157.265L250.745,164.310L246.112,171.171L241.330,177.850L236.407,184.345L231.348,190.657L226.159,196.786L220.847,202.731L215.419,208.494L209.880,214.073L204.237,219.468L198.497,224.681L192.664,229.710L186.747,234.555L180.751,239.218L174.682,243.696L168.547,247.992L162.352,252.104L156.104,256.033L149.809,259.777L149.809,259.777L148.559,257.613L147.309,255.449L146.060,253.285L144.810,251.121L143.561,248.957L142.311,246.793L141.061,244.629L139.812,242.465L138.562,240.300L137.312,238.136L136.063,235.972L134.813,233.808L133.563,231.644L132.314,229.480L131.064,227.316L129.815,225.151L128.565,222.987L127.315,220.823L126.066,218.659L124.816,216.495L127.655,214.842L130.471,213.152L133.261,211.427L136.027,209.666L138.768,207.870L141.483,206.039L144.173,204.174L146.837,202.274L149.475,200.340L152.086,198.372L154.670,196.371L157.228,194.338L159.757,192.271L162.259,190.172L164.733,188.041L167.178,185.879L169.595,183.685L171.982,181.459L174.341,179.204L176.669,176.917L176.669,176.917L173.154,173.402L169.639,169.887L166.124,166.372L162.609,162.857L159.094,159.342L155.579,155.827L152.063,152.312L148.548,148.797L145.033,145.281L141.518,141.766L138.003,138.251L134.488,134.736L130.973,131.221L127.457,127.706L123.943,124.191L120.427,120.675L116.912,117.160L113.397,113.645L109.882,110.130L106.367,106.615L107.749,105.215L109.113,103.797L110.458,102.361L111.784,100.908L113.092,99.437L114.381,97.949L115.650,96.445L116.899,94.923L118.129,93.385L119.339,91.831L120.529,90.260L121.699,88.674L122.847,87.071L123.976,85.453L125.083,83.819L126.170,82.170L127.234,80.506L128.278,78.827L129.300,77.133L130.300,75.425L130.300,75.425L136.762,79.156L143.224,82.886L149.686,86.617L156.148,90.347L162.610,94.078L169.072,97.809L175.534,101.539L181.996,105.270L188.458,109.001L194.920,112.731L201.382,116.462L207.844,120.193L214.306,123.923L220.768,127.654L227.230,131.384L233.692,135.115L240.154,138.846L246.616,142.576L253.078,146.307Z","morgon":"M176.669,176.917L174.341,179.204L171.983,181.459L169.595,183.685L167.179,185.879L164.734,188.041L162.260,190.172L159.758,192.271L157.229,194.338L154.671,196.371L152.087,198.372L149.476,200.340L146.838,202.274L144.174,204.174L141.484,206.039L138.768,207.870L136.027,209.666L133.261,211.427L130.471,213.152L127.655,214.842L124.816,216.495L124.816,216.495L123.580,214.354L122.343,212.212L121.107,210.071L119.870,207.930L118.634,205.788L117.397,203.647L116.161,201.505L114.924,199.364L113.688,197.223L112.451,195.081L111.215,192.940L109.978,190.799L108.742,188.657L107.505,186.516L106.269,184.374L105.032,182.233L103.796,180.092L102.559,177.950L101.323,175.809L100.086,173.667L97.826,174.943L95.547,176.190L93.250,177.408L90.935,178.597L88.603,179.757L86.254,180.887L83.888,181.987L81.506,183.057L79.106,184.096L76.691,185.105L74.260,186.084L71.813,187.031L69.351,187.947L66.873,188.831L64.381,189.684L61.874,190.504L59.353,191.293L56.818,192.049L54.269,192.772L51.706,193.463L51.063,191.066L50.421,188.670L49.778,186.274L49.136,183.878L48.494,181.481L47.851,179.085L47.208,176.689L46.566,174.293L45.923,171.896L45.281,169.500L44.638,167.104L43.996,164.708L43.354,162.311L42.711,159.915L42.069,157.519L41.426,155.123L40.783,152.726L40.141,150.330L39.499,147.934L38.856,145.538L43.234,144.305L47.507,142.962L51.675,141.514L55.737,139.966L59.694,138.326L63.546,136.599L67.291,134.791L70.932,132.907L74.466,130.954L77.895,128.938L81.218,126.865L84.435,124.741L87.547,122.571L90.553,120.362L93.453,118.119L96.247,115.849L98.935,113.558L101.518,111.251L103.994,108.935L106.364,106.615L106.364,106.615L109.879,110.130L113.395,113.645L116.910,117.160L120.425,120.675L123.941,124.191L127.456,127.706L130.971,131.221L134.486,134.736L138.002,138.251L141.517,141.766L145.032,145.281L148.547,148.797L152.062,152.312L155.578,155.827L159.093,159.342L162.608,162.857L166.123,166.372L169.639,169.887L173.154,173.402Z","rictus":"M124.816,216.495L112.043,223.362L99.378,229.274L86.860,234.290L74.529,238.472L62.426,241.878L50.591,244.569L39.062,246.605L27.882,248.046L17.088,248.952L6.723,249.382L-3.175,249.397L-12.566,249.057L-21.409,248.421L-29.664,247.550L-37.292,246.504L-44.252,245.342L-50.504,244.125L-56.009,242.912L-60.726,241.764L-64.615,240.740L-64.615,240.740L-63.336,235.967L-62.057,231.194L-60.779,226.421L-59.499,221.648L-58.220,216.876L-56.942,212.103L-55.663,207.330L-54.384,202.557L-53.105,197.784L-51.826,193.011L-50.547,188.238L-49.268,183.465L-47.989,178.693L-46.710,173.920L-45.432,169.147L-44.153,164.374L-42.874,159.601L-41.595,154.828L-40.316,150.055L-39.037,145.282L-39.036,145.282L-39.036,145.282L-39.035,145.282L-39.035,145.282L-39.034,145.282L-39.034,145.282L-39.033,145.282L-39.033,145.282L-39.032,145.282L-39.032,145.282L-39.031,145.282L-39.031,145.282L-39.030,145.282L-39.030,145.282L-39.029,145.282L-39.029,145.282L-39.028,145.282L-39.028,145.282L-39.027,145.282L-39.027,145.282L-35.212,146.265L-31.375,147.146L-27.517,147.925L-23.640,148.601L-19.748,149.177L-15.843,149.650L-11.927,150.022L-8.002,150.291L-4.072,150.458L-0.138,150.523L3.798,150.485L7.731,150.346L11.661,150.104L15.585,149.759L19.500,149.312L23.404,148.762L27.294,148.109L31.168,147.354L35.024,146.496L38.859,145.535L38.859,145.535L39.501,147.931L40.144,150.327L40.786,152.724L41.429,155.120L42.071,157.516L42.713,159.912L43.356,162.309L43.998,164.705L44.641,167.101L45.284,169.497L45.926,171.894L46.568,174.290L47.211,176.686L47.853,179.082L48.496,181.479L49.138,183.875L49.781,186.271L50.423,188.667L51.066,191.064L51.708,193.460L54.271,192.770L56.820,192.046L59.356,191.290L61.877,190.502L64.384,189.681L66.876,188.828L69.353,187.944L71.816,187.028L74.262,186.081L76.693,185.103L79.109,184.094L81.508,183.054L83.891,181.984L86.257,180.884L88.606,179.754L90.938,178.595L93.252,177.406L95.549,176.188L97.828,174.941L100.089,173.665L100.089,173.665L101.325,175.806L102.561,177.948L103.798,180.089L105.034,182.231L106.271,184.373L107.507,186.514L108.743,188.656L109.980,190.797L111.216,192.938L112.453,195.080L113.689,197.221L114.925,199.363L116.162,201.505L117.398,203.646L118.634,205.787L119.871,207.929L121.107,210.070L122.343,212.212L123.580,214.354Z","saleria":"M-39.037,145.285L-40.316,150.058L-41.595,154.831L-42.874,159.604L-44.153,164.377L-45.432,169.149L-46.710,173.922L-47.989,178.695L-49.268,183.468L-50.547,188.241L-51.826,193.014L-53.105,197.787L-54.384,202.560L-55.663,207.332L-56.942,212.105L-58.220,216.878L-59.499,221.651L-60.779,226.424L-62.057,231.197L-63.336,235.970L-64.615,240.743L-67.792,239.858L-70.953,238.932L-74.095,237.965L-77.220,236.959L-80.327,235.912L-83.415,234.826L-86.485,233.700L-89.536,232.535L-92.568,231.332L-95.580,230.090L-98.572,228.810L-101.544,227.493L-104.495,226.138L-107.425,224.746L-110.335,223.317L-113.222,221.851L-116.089,220.349L-118.932,218.812L-121.754,217.239L-124.553,215.630L-124.553,215.630L-123.316,213.488L-122.080,211.346L-120.843,209.204L-119.607,207.062L-118.370,204.921L-117.134,202.779L-115.897,200.637L-114.661,198.495L-113.424,196.353L-112.188,194.211L-110.951,192.069L-109.715,189.928L-108.478,187.786L-107.242,185.644L-106.005,183.502L-104.769,181.360L-103.532,179.218L-102.295,177.076L-101.059,174.934L-99.823,172.793L-102.075,171.456L-104.308,170.092L-106.522,168.699L-108.716,167.277L-110.891,165.829L-113.045,164.353L-115.178,162.849L-117.291,161.319L-119.383,159.761L-121.454,158.178L-123.504,156.568L-125.532,154.931L-127.538,153.270L-129.521,151.583L-131.483,149.870L-133.422,148.132L-135.337,146.370L-137.230,144.583L-139.099,142.773L-140.945,140.938L-140.945,140.938L-139.203,139.196L-137.462,137.454L-135.720,135.712L-133.978,133.970L-132.237,132.229L-130.495,130.487L-128.753,128.745L-127.012,127.003L-125.270,125.262L-123.528,123.520L-121.787,121.778L-120.045,120.037L-118.304,118.295L-116.562,116.553L-114.820,114.811L-113.079,113.069L-111.337,111.328L-109.595,109.586L-107.854,107.844L-106.112,106.102L-103.044,109.116L-99.925,112.011L-96.759,114.788L-93.549,117.449L-90.298,119.995L-87.010,122.427L-83.688,124.746L-80.337,126.955L-76.958,129.054L-73.557,131.044L-70.136,132.928L-66.699,134.705L-63.249,136.379L-59.790,137.950L-56.325,139.418L-52.858,140.787L-49.392,142.056L-45.931,143.228L-42.478,144.304L-39.037,145.285Z","meridian":"M-106.110,106.100L-107.851,107.842L-109.593,109.583L-111.335,111.325L-113.076,113.067L-114.818,114.809L-116.560,116.551L-118.301,118.292L-120.043,120.034L-121.784,121.776L-123.526,123.518L-125.268,125.259L-127.009,127.001L-128.751,128.743L-130.493,130.484L-132.234,132.226L-133.976,133.968L-135.718,135.710L-137.459,137.452L-139.201,139.193L-140.943,140.935L-142.764,139.077L-144.561,137.197L-146.333,135.293L-148.081,133.366L-149.804,131.416L-151.501,129.444L-153.174,127.450L-154.820,125.434L-156.440,123.397L-158.035,121.338L-159.602,119.258L-161.144,117.156L-162.658,115.034L-164.145,112.892L-165.605,110.729L-167.037,108.546L-168.441,106.344L-169.818,104.122L-171.166,101.880L-172.485,99.620L-172.485,99.620L-174.626,100.857L-176.768,102.093L-178.909,103.329L-181.050,104.566L-183.192,105.803L-185.333,107.039L-187.475,108.276L-189.616,109.512L-191.757,110.748L-193.899,111.985L-196.040,113.222L-198.182,114.458L-200.323,115.694L-202.465,116.931L-204.606,118.167L-206.747,119.404L-208.889,120.641L-211.030,121.877L-213.171,123.113L-215.313,124.350L-216.903,121.548L-218.458,118.724L-219.978,115.877L-221.462,113.009L-222.909,110.119L-224.320,107.207L-225.694,104.275L-227.031,101.321L-228.330,98.348L-229.592,95.354L-230.815,92.341L-232.001,89.308L-233.147,86.256L-234.254,83.185L-235.323,80.096L-236.351,76.989L-237.340,73.863L-238.288,70.720L-239.196,67.560L-240.063,64.382L-240.063,64.382L-235.289,63.104L-230.516,61.826L-225.742,60.547L-220.969,59.269L-216.196,57.991L-211.422,56.712L-206.649,55.434L-201.875,54.156L-197.102,52.877L-192.329,51.599L-187.555,50.320L-182.782,49.042L-178.008,47.764L-173.235,46.485L-168.461,45.207L-163.688,43.928L-158.914,42.650L-154.141,41.372L-149.368,40.093L-144.594,38.815L-143.432,42.997L-142.163,47.096L-140.793,51.111L-139.325,55.042L-137.763,58.888L-136.113,62.650L-134.378,66.326L-132.563,69.915L-130.672,73.419L-128.710,76.835L-126.681,80.163L-124.588,83.404L-122.437,86.556L-120.233,89.619L-117.978,92.592L-115.678,95.476L-113.336,98.269L-110.958,100.971L-108.548,103.582L-106.110,106.100Z","theseus":"M-192.280,51.583L-199.544,53.528L-206.808,55.474L-214.072,57.419L-221.336,59.365L-228.600,61.311L-235.864,63.256L-243.128,65.202L-250.392,67.147L-257.656,69.093L-264.920,71.039L-272.184,72.984L-279.448,74.930L-286.712,76.876L-293.977,78.821L-301.241,80.767L-308.505,82.712L-315.769,84.658L-323.033,86.604L-330.297,88.549L-337.561,90.495L-338.689,86.161L-339.763,81.806L-340.783,77.429L-341.747,73.031L-342.656,68.612L-343.509,64.173L-344.305,59.714L-345.045,55.236L-345.728,50.738L-346.354,46.222L-346.922,41.688L-347.432,37.136L-347.883,32.566L-348.275,27.980L-348.608,23.376L-348.882,18.757L-349.095,14.122L-349.248,9.471L-349.340,4.805L-349.370,0.125L-349.370,0.125L-341.850,0.125L-334.330,0.125L-326.811,0.125L-319.291,0.125L-311.771,0.125L-304.251,0.125L-296.731,0.125L-289.211,0.125L-281.691,0.125L-274.171,0.125L-266.651,0.125L-259.131,0.125L-251.611,0.125L-244.091,0.125L-236.572,0.125L-229.052,0.125L-221.532,0.125L-214.012,0.125L-206.492,0.125L-198.972,0.125L-198.955,2.790L-198.903,5.447L-198.816,8.095L-198.696,10.734L-198.541,13.365L-198.353,15.985L-198.131,18.597L-197.876,21.199L-197.587,23.790L-197.266,26.372L-196.911,28.943L-196.524,31.504L-196.105,34.054L-195.653,36.593L-195.170,39.121L-194.655,41.637L-194.108,44.141L-193.530,46.634L-192.920,49.115L-192.280,51.583Z","sagan":"M-129.354,-74.487L-130.952,-71.660L-132.524,-68.732L-134.063,-65.702L-135.563,-62.573L-137.019,-59.346L-138.424,-56.021L-139.773,-52.600L-141.060,-49.084L-142.279,-45.473L-143.423,-41.770L-144.488,-37.975L-145.468,-34.090L-146.355,-30.115L-147.146,-26.051L-147.832,-21.900L-148.410,-17.663L-148.873,-13.341L-149.215,-8.935L-149.429,-4.446L-149.512,0.125L-149.512,0.125L-154.458,0.125L-159.404,0.125L-164.350,0.125L-169.296,0.125L-174.242,0.125L-179.188,0.125L-184.134,0.125L-189.080,0.125L-194.026,0.125L-198.972,0.125L-203.918,0.125L-208.864,0.125L-213.810,0.125L-218.756,0.125L-223.702,0.125L-228.648,0.125L-233.594,0.125L-238.540,0.125L-243.486,0.125L-248.432,0.125L-248.411,-3.204L-248.345,-6.523L-248.237,-9.831L-248.086,-13.128L-247.892,-16.414L-247.656,-19.689L-247.378,-22.952L-247.058,-26.203L-246.697,-29.442L-246.295,-32.668L-245.851,-35.881L-245.366,-39.081L-244.841,-42.268L-244.276,-45.440L-243.671,-48.599L-243.026,-51.744L-242.342,-54.873L-241.618,-57.988L-240.855,-61.088L-240.054,-64.172L-240.054,-64.172L-237.665,-63.532L-235.276,-62.891L-232.887,-62.251L-230.497,-61.611L-228.108,-60.970L-225.719,-60.330L-223.329,-59.689L-220.940,-59.049L-218.551,-58.408L-216.162,-57.768L-213.772,-57.127L-211.383,-56.487L-208.994,-55.846L-206.605,-55.205L-204.215,-54.565L-201.826,-53.924L-199.437,-53.284L-197.048,-52.643L-194.658,-52.003L-192.269,-51.362L-191.576,-53.907L-190.850,-56.438L-190.092,-58.954L-189.301,-61.457L-188.479,-63.945L-187.625,-66.419L-186.739,-68.877L-185.823,-71.321L-184.875,-73.750L-183.897,-76.163L-182.888,-78.560L-181.849,-80.941L-180.779,-83.306L-179.680,-85.655L-178.552,-87.987L-177.394,-90.302L-176.207,-92.600L-174.991,-94.881L-173.747,-97.144L-172.474,-99.390L-172.474,-99.390L-170.318,-98.145L-168.162,-96.900L-166.006,-95.655L-163.850,-94.410L-161.694,-93.164L-159.538,-91.919L-157.382,-90.674L-155.225,-89.429L-153.069,-88.184L-150.914,-86.939L-148.758,-85.694L-146.602,-84.448L-144.446,-83.203L-142.290,-81.958L-140.134,-80.713L-137.978,-79.468L-135.821,-78.223L-133.665,-76.978L-131.509,-75.733Z","marspira":"M-74.735,-129.095L-73.503,-126.961L-72.271,-124.827L-71.039,-122.693L-69.807,-120.560L-68.575,-118.426L-67.343,-116.292L-66.111,-114.158L-64.879,-112.024L-63.647,-109.890L-62.415,-107.756L-61.183,-105.622L-59.951,-103.489L-58.719,-101.355L-57.487,-99.221L-56.256,-97.087L-55.023,-94.953L-53.791,-92.819L-52.559,-90.685L-51.328,-88.551L-50.095,-86.418L-52.212,-85.159L-54.309,-83.839L-56.387,-82.458L-58.443,-81.016L-60.475,-79.514L-62.480,-77.951L-64.457,-76.328L-66.404,-74.645L-68.319,-72.902L-70.200,-71.100L-72.044,-69.238L-73.850,-67.317L-75.616,-65.337L-77.339,-63.299L-79.018,-61.202L-80.650,-59.047L-82.235,-56.833L-83.768,-54.562L-85.249,-52.234L-86.676,-49.848L-86.676,-49.848L-90.966,-52.324L-95.256,-54.801L-99.546,-57.279L-103.835,-59.756L-108.125,-62.232L-112.415,-64.710L-116.705,-67.187L-120.995,-69.663L-125.285,-72.141L-129.575,-74.618L-133.865,-77.094L-138.154,-79.571L-142.444,-82.049L-146.734,-84.525L-151.024,-87.002L-155.314,-89.480L-159.604,-91.957L-163.894,-94.433L-168.184,-96.911L-172.474,-99.388L-168.443,-106.089L-164.161,-112.616L-159.635,-118.962L-154.870,-125.121L-149.874,-131.086L-144.654,-136.850L-139.216,-142.406L-133.567,-147.748L-127.715,-152.870L-121.665,-157.763L-115.424,-162.422L-109.000,-166.841L-102.399,-171.011L-95.628,-174.927L-88.694,-178.582L-81.603,-181.969L-74.362,-185.082L-66.979,-187.913L-59.459,-190.456L-51.810,-192.705L-51.810,-192.705L-51.158,-190.274L-50.507,-187.844L-49.855,-185.413L-49.204,-182.982L-48.552,-180.552L-47.901,-178.121L-47.249,-175.691L-46.598,-173.260L-45.947,-170.829L-45.295,-168.399L-44.643,-165.968L-43.992,-163.537L-43.341,-161.107L-42.689,-158.676L-42.037,-156.246L-41.386,-153.815L-40.734,-151.384L-40.083,-148.954L-39.432,-146.523L-38.780,-144.092L-40.686,-143.564L-42.582,-143.012L-44.467,-142.435L-46.341,-141.834L-48.205,-141.209L-50.057,-140.561L-51.898,-139.889L-53.728,-139.194L-55.546,-138.475L-57.353,-137.734L-59.148,-136.970L-60.930,-136.183L-62.701,-135.374L-64.459,-134.542L-66.204,-133.688L-67.936,-132.813L-69.656,-131.916L-71.363,-130.997L-73.056,-130.056L-74.735,-129.095Z","talus":"M-0.122,-249.183L-0.122,-241.714L-0.122,-234.245L-0.122,-226.776L-0.122,-219.307L-0.122,-211.838L-0.122,-204.369L-0.122,-196.900L-0.122,-189.431L-0.122,-181.963L-0.122,-174.494L-0.122,-167.025L-0.122,-159.556L-0.122,-152.087L-0.122,-144.618L-0.122,-137.149L-0.122,-129.680L-0.122,-122.212L-0.123,-114.743L-0.123,-107.274L-0.123,-99.805L-3.159,-99.760L-6.144,-99.627L-9.076,-99.409L-11.955,-99.111L-14.779,-98.736L-17.549,-98.288L-20.263,-97.770L-22.921,-97.187L-25.521,-96.542L-28.063,-95.839L-30.545,-95.081L-32.968,-94.272L-35.330,-93.416L-37.631,-92.517L-39.869,-91.578L-42.045,-90.604L-44.156,-89.597L-46.203,-88.561L-48.183,-87.501L-50.098,-86.420L-50.098,-86.420L-51.330,-88.554L-52.562,-90.688L-53.794,-92.822L-55.026,-94.956L-56.258,-97.089L-57.490,-99.223L-58.722,-101.357L-59.954,-103.491L-61.186,-105.625L-62.418,-107.759L-63.650,-109.893L-64.882,-112.027L-66.114,-114.160L-67.346,-116.294L-68.578,-118.428L-69.810,-120.562L-71.042,-122.696L-72.274,-124.830L-73.506,-126.964L-74.738,-129.098L-73.058,-130.059L-71.365,-130.999L-69.658,-131.918L-67.939,-132.815L-66.206,-133.691L-64.461,-134.544L-62.703,-135.376L-60.933,-136.185L-59.150,-136.972L-57.356,-137.737L-55.549,-138.478L-53.731,-139.197L-51.901,-139.892L-50.059,-140.564L-48.207,-141.213L-46.343,-141.838L-44.469,-142.439L-42.584,-143.016L-40.688,-143.569L-38.782,-144.097L-38.782,-144.097L-39.434,-146.528L-40.086,-148.959L-40.737,-151.389L-41.388,-153.820L-42.040,-156.251L-42.691,-158.681L-43.343,-161.112L-43.994,-163.542L-44.646,-165.973L-45.297,-168.404L-45.949,-170.834L-46.600,-173.265L-47.252,-175.696L-47.903,-178.126L-48.555,-180.557L-49.206,-182.987L-49.858,-185.418L-50.509,-187.849L-51.161,-190.279L-51.812,-192.710L-54.358,-191.999L-56.890,-191.254L-59.408,-190.478L-61.912,-189.669L-64.402,-188.828L-66.877,-187.955L-69.336,-187.051L-71.781,-186.115L-74.210,-185.149L-76.623,-184.151L-79.020,-183.124L-81.401,-182.066L-83.765,-180.978L-86.113,-179.860L-88.443,-178.712L-90.756,-177.536L-93.052,-176.330L-95.329,-175.096L-97.589,-173.834L-99.830,-172.543L-99.830,-172.543L-101.067,-174.684L-102.303,-176.825L-103.540,-178.967L-104.776,-181.108L-106.013,-183.249L-107.249,-185.391L-108.486,-187.532L-109.722,-189.674L-110.959,-191.815L-112.195,-193.956L-113.432,-196.098L-114.668,-198.239L-115.905,-200.380L-117.141,-202.522L-118.378,-204.663L-119.614,-206.805L-120.851,-208.946L-122.087,-211.087L-123.324,-213.229L-124.560,-215.370L-118.515,-218.788L-112.428,-222.009L-106.303,-225.037L-100.144,-227.874L-93.954,-230.522L-87.738,-232.983L-81.499,-235.260L-75.242,-237.356L-68.970,-239.272L-62.687,-241.011L-56.397,-242.575L-50.104,-243.967L-43.812,-245.189L-37.525,-246.243L-31.246,-247.133L-24.981,-247.859L-18.731,-248.425L-12.502,-248.832L-6.298,-249.084L-0.122,-249.183Z","umlaut":"M299.666,0.125L297.193,0.125L294.720,0.125L292.247,0.125L289.774,0.125L287.301,0.125L284.828,0.125L282.355,0.125L279.882,0.125L277.409,0.125L274.936,0.125L272.463,0.125L269.990,0.125L267.517,0.125L265.044,0.125L262.571,0.125L260.098,0.125L257.625,0.125L255.152,0.125L252.679,0.125L250.206,0.125L250.130,-5.828L249.881,-12.304L249.422,-19.265L248.722,-26.675L247.745,-34.499L246.458,-42.699L244.825,-51.239L242.814,-60.082L240.389,-69.194L237.517,-78.536L234.164,-88.073L230.295,-97.768L225.876,-107.585L220.874,-117.487L215.253,-127.438L208.980,-137.402L202.021,-147.343L194.341,-157.223L185.907,-167.007L176.684,-176.658L176.684,-176.658L178.443,-178.417L180.203,-180.176L181.962,-181.936L183.722,-183.695L185.481,-185.454L187.240,-187.214L189.000,-188.973L190.759,-190.733L192.519,-192.492L194.278,-194.251L196.037,-196.011L197.797,-197.770L199.556,-199.529L201.316,-201.289L203.075,-203.048L204.834,-204.808L206.594,-206.567L208.353,-208.326L210.112,-210.086L211.872,-211.845L222.965,-200.168L233.099,-188.338L242.317,-176.400L250.662,-164.398L258.174,-152.376L264.897,-140.378L270.873,-128.450L276.142,-116.636L280.748,-104.979L284.733,-93.524L288.139,-82.317L291.007,-71.400L293.380,-60.819L295.301,-50.618L296.810,-40.841L297.950,-31.533L298.764,-22.738L299.293,-14.500L299.580,-6.864L299.666,0.125Z","draco":"M386.080,-103.295L381.252,-102.003L376.425,-100.710L371.598,-99.417L366.770,-98.125L361.943,-96.833L357.115,-95.540L352.288,-94.248L347.461,-92.955L342.633,-91.662L337.806,-90.370L332.978,-89.078L328.151,-87.785L323.323,-86.493L318.496,-85.200L313.669,-83.907L308.841,-82.615L304.014,-81.323L299.186,-80.030L294.359,-78.737L289.532,-77.445L288.480,-81.279L287.380,-85.092L286.231,-88.884L285.032,-92.655L283.786,-96.405L282.492,-100.132L281.151,-103.836L279.762,-107.518L278.327,-111.176L276.845,-114.811L275.317,-118.422L273.743,-122.009L272.124,-125.570L270.460,-129.107L268.752,-132.618L266.999,-136.103L265.203,-139.562L263.363,-142.994L261.480,-146.400L259.554,-149.778L259.554,-149.778L263.883,-152.276L268.211,-154.774L272.539,-157.272L276.867,-159.770L281.196,-162.269L285.524,-164.767L289.852,-167.265L294.181,-169.764L298.509,-172.262L302.837,-174.760L307.166,-177.258L311.494,-179.757L315.822,-182.255L320.150,-184.753L324.479,-187.251L328.807,-189.749L333.135,-192.248L337.464,-194.746L341.792,-197.244L346.120,-199.742L348.687,-195.238L351.197,-190.697L353.649,-186.120L356.043,-181.508L358.379,-176.861L360.656,-172.179L362.874,-167.463L365.032,-162.714L367.129,-157.932L369.166,-153.117L371.141,-148.271L373.055,-143.393L374.906,-138.483L376.694,-133.544L378.420,-128.575L380.081,-123.576L381.678,-118.548L383.211,-113.491L384.678,-108.407L386.080,-103.295Z","orion":"M250.206,0.125L247.733,0.125L245.260,0.125L242.787,0.125L240.314,0.125L237.841,0.125L235.368,0.125L232.895,0.125L230.422,0.125L227.949,0.125L225.476,0.125L223.003,0.125L220.530,0.125L218.057,0.125L215.584,0.125L213.111,0.125L210.638,0.125L208.165,0.125L205.692,0.125L203.218,0.125L200.746,0.125L200.654,-6.007L200.385,-12.029L199.945,-17.941L199.342,-23.740L198.585,-29.425L197.679,-34.996L196.634,-40.451L195.456,-45.789L194.153,-51.008L192.733,-56.108L191.204,-61.087L189.572,-65.943L187.846,-70.677L186.033,-75.285L184.141,-79.768L182.177,-84.123L180.149,-88.350L178.064,-92.447L175.931,-96.413L173.756,-100.247L173.756,-100.247L171.562,-98.981L169.367,-97.714L167.173,-96.447L164.978,-95.181L162.784,-93.914L160.590,-92.647L158.395,-91.380L156.201,-90.113L154.006,-88.847L151.812,-87.580L149.618,-86.313L147.423,-85.047L145.229,-83.780L143.034,-82.513L140.840,-81.246L138.646,-79.979L136.451,-78.713L134.257,-77.446L132.062,-76.179L129.868,-74.912L127.695,-78.516L125.440,-82.029L123.108,-85.450L120.701,-88.779L118.223,-92.017L115.676,-95.164L113.065,-98.218L110.393,-101.181L107.663,-104.052L104.877,-106.830L102.041,-109.517L99.156,-112.111L96.227,-114.614L93.256,-117.024L90.247,-119.341L87.203,-121.566L84.128,-123.699L81.024,-125.738L77.896,-127.686L74.746,-129.540L74.746,-129.540L77.249,-133.876L79.752,-138.211L82.256,-142.547L84.759,-146.883L87.262,-151.219L89.765,-155.554L92.269,-159.890L94.772,-164.226L97.275,-168.562L99.779,-172.897L102.282,-177.233L104.785,-181.569L107.288,-185.905L109.792,-190.240L112.295,-194.576L114.798,-198.912L117.302,-203.248L119.805,-207.584L122.308,-211.919L124.812,-216.255L128.486,-214.094L133.286,-211.118L139.070,-207.310L145.696,-202.656L153.021,-197.138L160.904,-190.741L169.203,-183.449L177.774,-175.245L186.477,-166.113L195.168,-156.039L203.707,-145.005L211.950,-132.995L219.755,-119.994L226.981,-105.985L233.486,-90.952L239.126,-74.880L243.760,-57.753L247.247,-39.553L249.442,-20.266L250.206,0.125Z","borgus":"M349.124,0.125L349.093,4.808L349.001,9.477L348.848,14.130L348.635,18.768L348.361,23.390L348.028,27.996L347.635,32.584L347.184,37.156L346.673,41.711L346.105,46.247L345.478,50.766L344.794,55.265L344.053,59.746L343.254,64.207L342.400,68.648L341.489,73.070L340.523,77.470L339.501,81.850L338.425,86.208L337.293,90.545L337.293,90.545L332.513,89.264L327.733,87.983L322.954,86.702L318.174,85.421L313.394,84.141L308.614,82.860L303.834,81.579L299.054,80.298L294.274,79.017L289.494,77.736L284.715,76.455L279.935,75.174L275.155,73.894L270.375,72.613L265.595,71.332L260.815,70.051L256.035,68.770L251.255,67.489L246.475,66.208L241.695,64.927L242.509,61.820L243.283,58.697L244.018,55.558L244.713,52.405L245.368,49.236L245.982,46.053L246.556,42.855L247.090,39.644L247.582,36.419L248.033,33.181L248.442,29.929L248.809,26.665L249.134,23.388L249.417,20.099L249.657,16.798L249.854,13.485L250.007,10.161L250.117,6.827L250.184,3.481L250.206,0.125L250.206,0.125L255.152,0.125L260.098,0.125L265.044,0.125L269.989,0.125L274.935,0.125L279.881,0.125L284.827,0.125L289.773,0.125L294.719,0.125L299.665,0.125L304.611,0.125L309.557,0.125L314.503,0.125L319.449,0.125L324.395,0.125L329.340,0.125L334.286,0.125L339.232,0.125L344.178,0.125Z","ursa":"M337.293,90.545L336.070,95.010L334.788,99.451L333.450,103.868L332.055,108.259L330.604,112.625L329.097,116.965L327.534,121.279L325.917,125.566L324.245,129.826L322.519,134.058L320.739,138.263L318.906,142.439L317.020,146.586L315.082,150.704L313.092,154.793L311.050,158.852L308.958,162.880L306.814,166.877L304.621,170.843L302.378,174.777L302.378,174.777L295.946,171.064L289.514,167.350L283.082,163.637L276.651,159.923L270.219,156.210L263.787,152.496L257.355,148.783L250.923,145.069L244.492,141.356L238.060,137.642L231.628,133.929L225.196,130.215L218.765,126.502L212.333,122.788L205.901,119.075L199.469,115.361L193.038,111.648L186.606,107.934L180.174,104.221L173.742,100.507L175.038,98.248L176.304,95.971L177.542,93.675L178.750,91.361L179.929,89.030L181.079,86.682L182.198,84.316L183.287,81.933L184.346,79.534L185.374,77.119L186.371,74.687L187.337,72.240L188.271,69.777L189.174,67.298L190.045,64.804L190.883,62.296L191.689,59.772L192.463,57.235L193.203,54.683L193.910,52.117L193.910,52.117L201.079,54.039L208.248,55.960L215.418,57.882L222.587,59.803L229.756,61.724L236.925,63.646L244.094,65.567L251.263,67.489L258.433,69.410L265.602,71.331L272.771,73.253L279.940,75.174L287.109,77.095L294.278,79.017L301.447,80.938L308.617,82.860L315.786,84.781L322.955,86.702L330.124,88.624Z","ferris":"M302.380,174.777L292.129,191.443L281.385,206.976L270.226,221.415L258.725,234.799L246.960,247.168L235.006,258.560L222.940,269.016L210.836,278.573L198.771,287.273L186.821,295.153L175.062,302.253L163.569,308.612L152.418,314.270L141.686,319.266L131.448,323.639L121.780,327.428L112.759,330.672L104.459,333.411L96.956,335.684L90.328,337.530L90.328,337.530L89.687,335.141L89.047,332.752L88.406,330.364L87.766,327.975L87.125,325.586L86.485,323.198L85.844,320.809L85.204,318.420L84.563,316.031L83.923,313.642L83.282,311.254L82.642,308.865L82.001,306.476L81.361,304.088L80.720,301.699L80.080,299.310L79.439,296.921L78.799,294.532L78.158,292.144L77.518,289.755L81.921,288.543L87.296,286.961L93.563,284.969L100.643,282.528L108.456,279.597L116.923,276.138L125.964,272.111L135.500,267.475L145.450,262.193L155.736,256.223L166.277,249.527L176.996,242.065L187.811,233.797L198.643,224.684L209.412,214.686L220.040,203.764L230.447,191.877L240.552,178.987L250.277,165.054L259.542,150.037L259.542,150.037L261.684,151.274L263.826,152.512L265.968,153.748L268.110,154.985L270.252,156.223L272.394,157.459L274.536,158.696L276.677,159.934L278.819,161.171L280.961,162.407L283.103,163.645L285.245,164.882L287.387,166.118L289.529,167.356L291.671,168.593L293.812,169.829L295.954,171.067L298.096,172.304L300.238,173.540Z","hanzo":"M77.518,289.757L78.158,292.146L78.799,294.535L79.439,296.924L80.080,299.313L80.720,301.701L81.361,304.090L82.001,306.479L82.642,308.867L83.282,311.256L83.923,313.645L84.563,316.034L85.204,318.422L85.844,320.811L86.485,323.200L87.125,325.589L87.766,327.978L88.406,330.366L89.047,332.755L89.687,335.144L90.328,337.532L85.990,338.664L81.630,339.740L77.248,340.763L72.846,341.729L68.423,342.640L63.980,343.496L59.518,344.294L55.035,345.036L50.534,345.721L46.015,346.348L41.477,346.918L36.921,347.429L32.347,347.881L27.757,348.275L23.150,348.608L18.526,348.882L13.887,349.096L9.232,349.250L4.562,349.342L-0.123,349.373L-0.123,349.373L-0.123,344.376L-0.123,339.379L-0.123,334.381L-0.123,329.384L-0.123,324.387L-0.123,319.391L-0.123,314.394L-0.123,309.397L-0.123,304.399L-0.123,299.402L-0.123,294.405L-0.123,289.409L-0.123,284.412L-0.123,279.415L-0.123,274.417L-0.123,269.420L-0.123,264.423L-0.122,259.427L-0.122,254.430L-0.122,249.433L-0.072,249.434L-0.022,249.435L0.028,249.436L0.078,249.437L0.129,249.438L0.180,249.439L0.230,249.440L0.281,249.440L0.332,249.441L0.383,249.441L0.434,249.442L0.484,249.442L0.535,249.442L0.586,249.442L0.636,249.442L0.687,249.442L0.737,249.443L0.787,249.443L0.838,249.443L0.888,249.443L0.888,249.443L6.821,249.372L12.809,249.160L18.848,248.801L24.933,248.291L31.059,247.627L37.223,246.805L43.418,245.820L49.641,244.670L55.888,243.350L62.153,241.856L68.432,240.184L74.721,238.330L81.014,236.291L87.308,234.063L93.598,231.642L99.878,229.023L106.146,226.203L112.395,223.178L118.622,219.944L124.821,216.497L124.821,216.497L126.071,218.662L127.320,220.826L128.570,222.990L129.820,225.154L131.069,227.318L132.319,229.482L133.568,231.646L134.818,233.811L136.068,235.975L137.317,238.139L138.567,240.303L139.816,242.467L141.066,244.631L142.316,246.795L143.566,248.959L144.815,251.123L146.065,253.288L147.314,255.452L148.564,257.616L149.814,259.780L146.436,261.706L143.032,263.589L139.601,265.428L136.143,267.225L132.659,268.977L129.149,270.686L125.614,272.349L122.054,273.968L118.469,275.542L114.860,277.069L111.227,278.551L107.571,279.987L103.891,281.375L100.189,282.717L96.464,284.011L92.717,285.257L88.949,286.456L85.159,287.605L81.349,288.706L77.518,289.757Z","akira":"M-0.125,249.433L-0.125,251.956L-0.125,254.481L-0.125,257.004L-0.125,259.529L-0.125,262.052L-0.125,264.577L-0.125,267.100L-0.125,269.625L-0.125,272.148L-0.125,274.672L-0.125,277.197L-0.125,279.720L-0.125,282.245L-0.125,284.768L-0.125,287.293L-0.125,289.816L-0.125,292.341L-0.125,294.864L-0.125,297.389L-0.125,299.912L-4.146,299.886L-8.155,299.807L-12.150,299.675L-16.132,299.492L-20.101,299.257L-24.055,298.971L-27.995,298.633L-31.920,298.245L-35.831,297.807L-39.725,297.318L-43.605,296.780L-47.468,296.193L-51.315,295.557L-55.145,294.872L-58.958,294.138L-62.754,293.357L-66.532,292.527L-70.293,291.651L-74.035,290.728L-77.758,289.757L-77.758,289.757L-79.052,294.585L-80.345,299.412L-81.639,304.240L-82.932,309.067L-84.226,313.894L-85.519,318.722L-86.813,323.549L-88.106,328.376L-89.400,333.204L-90.693,338.031L-91.987,342.859L-93.281,347.686L-94.574,352.513L-95.868,357.341L-97.161,362.168L-98.455,366.996L-99.748,371.823L-101.042,376.650L-102.335,381.478L-103.629,386.305L-108.737,384.903L-113.819,383.436L-118.872,381.903L-123.896,380.306L-128.892,378.644L-133.859,376.919L-138.795,375.131L-143.701,373.279L-148.576,371.366L-153.420,369.390L-158.232,367.354L-163.012,365.256L-167.758,363.098L-172.472,360.880L-177.151,358.603L-181.797,356.267L-186.407,353.872L-190.982,351.420L-195.521,348.910L-200.024,346.342L-200.024,346.342L-196.250,339.807L-192.477,333.271L-188.703,326.735L-184.929,320.200L-181.156,313.664L-177.382,307.128L-173.608,300.592L-169.835,294.057L-166.061,287.521L-162.287,280.985L-158.514,274.449L-154.740,267.913L-150.966,261.378L-147.192,254.842L-143.419,248.306L-139.645,241.770L-135.872,235.235L-132.098,228.699L-128.324,222.163L-124.550,215.628L-118.515,219.038L-112.437,222.253L-106.320,225.276L-100.169,228.110L-93.987,230.755L-87.779,233.215L-81.547,235.491L-75.295,237.587L-69.028,239.504L-62.748,241.244L-56.461,242.810L-50.169,244.204L-43.876,245.428L-37.586,246.485L-31.304,247.376L-25.031,248.104L-18.774,248.672L-12.534,249.081L-6.317,249.334L-0.125,249.433Z","guang":"M-99.823,172.790L-103.570,179.281L-107.318,185.773L-111.066,192.264L-114.814,198.755L-118.562,205.247L-122.310,211.738L-126.058,218.230L-129.806,224.721L-133.554,231.212L-137.302,237.704L-141.050,244.195L-144.798,250.686L-148.546,257.178L-152.293,263.669L-156.042,270.161L-159.790,276.652L-163.537,283.143L-167.285,289.635L-171.033,296.126L-174.781,302.617L-178.741,300.294L-182.667,297.920L-186.558,295.495L-190.416,293.022L-194.238,290.499L-198.025,287.927L-201.776,285.308L-205.492,282.640L-209.170,279.926L-212.812,277.164L-216.416,274.356L-219.982,271.502L-223.509,268.603L-226.998,265.658L-230.448,262.669L-233.858,259.636L-237.228,256.559L-240.558,253.439L-243.846,250.276L-247.094,247.070L-247.094,247.070L-241.786,241.763L-236.479,236.456L-231.171,231.149L-225.864,225.843L-220.557,220.536L-215.249,215.229L-209.942,209.922L-204.634,204.615L-199.327,199.308L-194.019,194.001L-188.712,188.694L-183.405,183.388L-178.097,178.081L-172.790,172.774L-167.482,167.467L-162.175,162.160L-156.867,156.853L-151.560,151.546L-146.252,146.239L-140.945,140.933L-139.099,142.768L-137.230,144.579L-135.337,146.366L-133.422,148.129L-131.483,149.866L-129.521,151.579L-127.538,153.266L-125.532,154.928L-123.504,156.565L-121.454,158.175L-119.383,159.759L-117.291,161.316L-115.178,162.846L-113.045,164.350L-110.891,165.826L-108.716,167.275L-106.522,168.696L-104.308,170.089L-102.075,171.454L-99.823,172.790Z","tarragon":"M-140.945,140.933L-144.504,144.491L-148.062,148.049L-151.621,151.607L-155.180,155.165L-158.738,158.723L-162.297,162.281L-165.856,165.839L-169.414,169.397L-172.973,172.956L-176.532,176.514L-180.090,180.072L-183.649,183.630L-187.208,187.188L-190.766,190.746L-194.325,194.304L-197.884,197.862L-201.442,201.421L-205.001,204.979L-208.560,208.537L-212.118,212.095L-218.106,205.936L-223.855,199.677L-229.370,193.325L-234.653,186.887L-239.706,180.370L-244.532,173.780L-249.135,167.124L-253.515,160.410L-257.677,153.642L-261.623,146.830L-265.355,139.979L-268.877,133.095L-272.190,126.187L-275.298,119.261L-278.203,112.322L-280.908,105.379L-283.416,98.438L-285.729,91.506L-287.849,84.589L-289.780,77.695L-289.780,77.695L-287.295,77.029L-284.809,76.364L-282.324,75.698L-279.838,75.032L-277.352,74.366L-274.867,73.701L-272.381,73.035L-269.895,72.369L-267.410,71.703L-264.924,71.038L-262.438,70.372L-259.953,69.706L-257.467,69.040L-254.981,68.375L-252.496,67.709L-250.010,67.043L-247.524,66.377L-245.039,65.711L-242.553,65.046L-240.068,64.380L-239.201,67.557L-238.293,70.718L-237.345,73.861L-236.356,76.986L-235.327,80.094L-234.259,83.183L-233.152,86.254L-232.006,89.306L-230.820,92.339L-229.597,95.352L-228.335,98.345L-227.036,101.319L-225.699,104.272L-224.325,107.205L-222.914,110.116L-221.467,113.006L-219.983,115.875L-218.463,118.722L-216.908,121.546L-215.318,124.348L-215.318,124.348L-213.177,123.111L-211.035,121.875L-208.894,120.638L-206.752,119.401L-204.611,118.165L-202.470,116.929L-200.328,115.692L-198.187,114.455L-196.045,113.219L-193.904,111.982L-191.762,110.746L-189.621,109.510L-187.480,108.273L-185.338,107.036L-183.197,105.800L-181.055,104.564L-178.914,103.327L-176.773,102.091L-174.631,100.854L-172.490,99.617L-171.170,101.878L-169.821,104.119L-168.445,106.342L-167.040,108.544L-165.608,110.727L-164.147,112.890L-162.660,115.032L-161.146,117.155L-159.604,119.256L-158.036,121.336L-156.442,123.395L-154.822,125.433L-153.176,127.449L-151.504,129.443L-149.806,131.415L-148.083,133.364L-146.336,135.291L-144.563,137.195L-142.766,139.075L-140.945,140.933Z","alstrad":"M-212.116,212.095L-213.865,213.844L-215.613,215.593L-217.362,217.341L-219.111,219.090L-220.860,220.839L-222.608,222.587L-224.357,224.336L-226.106,226.085L-227.855,227.834L-229.603,229.582L-231.352,231.331L-233.101,233.080L-234.850,234.829L-236.599,236.578L-238.347,238.326L-240.096,240.075L-241.845,241.824L-243.594,243.573L-245.342,245.321L-247.091,247.070L-254.086,239.872L-260.800,232.561L-267.237,225.147L-273.400,217.635L-279.293,210.034L-284.918,202.351L-290.280,194.595L-295.382,186.772L-300.228,178.890L-304.819,170.958L-309.161,162.981L-313.257,154.969L-317.110,146.929L-320.723,138.868L-324.099,130.794L-327.243,122.714L-330.158,114.637L-332.847,106.570L-335.313,98.520L-337.561,90.495L-337.561,90.495L-335.172,89.855L-332.782,89.215L-330.393,88.575L-328.004,87.935L-325.615,87.295L-323.225,86.655L-320.836,86.015L-318.447,85.375L-316.057,84.735L-313.668,84.095L-311.279,83.455L-308.890,82.815L-306.500,82.175L-304.111,81.535L-301.722,80.895L-299.333,80.255L-296.943,79.615L-294.554,78.975L-292.165,78.335L-289.775,77.695L-287.312,86.392L-284.629,94.881L-281.739,103.162L-278.653,111.235L-275.382,119.100L-271.938,126.756L-268.333,134.205L-264.579,141.445L-260.686,148.477L-256.668,155.301L-252.536,161.917L-248.300,168.325L-243.974,174.525L-239.568,180.516L-235.094,186.300L-230.564,191.875L-225.989,197.242L-221.382,202.401L-216.754,207.352L-212.116,212.095Z","xzar":"M-299.913,0.125L-302.385,0.125L-304.858,0.125L-307.331,0.125L-309.804,0.125L-312.277,0.125L-314.750,0.125L-317.223,0.125L-319.696,0.125L-322.169,0.125L-324.641,0.125L-327.114,0.125L-329.587,0.125L-332.060,0.125L-334.533,0.125L-337.006,0.125L-339.479,0.125L-341.952,0.125L-344.425,0.125L-346.897,0.125L-349.370,0.125L-349.340,4.805L-349.248,9.471L-349.095,14.122L-348.882,18.757L-348.608,23.376L-348.275,27.980L-347.883,32.566L-347.432,37.136L-346.922,41.688L-346.354,46.222L-345.728,50.738L-345.045,55.236L-344.305,59.714L-343.509,64.173L-342.656,68.612L-341.747,73.031L-340.783,77.429L-339.763,81.806L-338.689,86.161L-337.561,90.495L-337.561,90.495L-339.999,91.147L-342.437,91.800L-344.875,92.453L-347.313,93.105L-349.752,93.758L-352.190,94.410L-354.628,95.062L-357.066,95.715L-359.504,96.368L-361.942,97.020L-364.380,97.672L-366.819,98.325L-369.257,98.978L-371.695,99.630L-374.133,100.282L-376.571,100.935L-379.009,101.588L-381.447,102.240L-383.886,102.892L-386.324,103.545L-388.742,94.023L-390.938,84.371L-392.904,74.597L-394.637,64.707L-396.131,54.709L-397.381,44.610L-398.381,34.417L-399.126,24.138L-399.612,13.779L-399.832,3.347L-399.782,-7.149L-399.456,-17.704L-398.850,-28.309L-397.957,-38.958L-396.773,-49.643L-395.293,-60.358L-393.511,-71.095L-391.422,-81.847L-389.021,-92.607L-386.302,-103.367L-386.302,-103.367L-381.475,-102.074L-376.648,-100.781L-371.820,-99.487L-366.993,-98.193L-362.165,-96.900L-357.338,-95.606L-352.511,-94.313L-347.683,-93.020L-342.856,-91.726L-338.028,-90.432L-333.201,-89.139L-328.374,-87.845L-323.546,-86.552L-318.719,-85.259L-313.892,-83.965L-309.064,-82.671L-304.237,-81.378L-299.409,-80.084L-294.582,-78.791L-289.755,-77.498L-290.726,-73.774L-291.651,-70.032L-292.528,-66.272L-293.358,-62.495L-294.140,-58.699L-294.874,-54.887L-295.559,-51.057L-296.195,-47.211L-296.783,-43.348L-297.321,-39.470L-297.809,-35.576L-298.247,-31.666L-298.635,-27.742L-298.972,-23.803L-299.258,-19.849L-299.493,-15.881L-299.676,-11.900L-299.807,-7.905L-299.886,-3.896L-299.913,0.125Z","nanos":"M-172.476,-99.390L-173.749,-97.145L-174.994,-94.882L-176.209,-92.601L-177.396,-90.304L-178.554,-87.989L-179.683,-85.657L-180.782,-83.308L-181.851,-80.943L-182.890,-78.562L-183.899,-76.165L-184.878,-73.752L-185.825,-71.323L-186.742,-68.879L-187.627,-66.420L-188.481,-63.946L-189.304,-61.458L-190.094,-58.955L-190.852,-56.438L-191.578,-53.907L-192.272,-51.362L-192.272,-51.362L-194.661,-52.003L-197.050,-52.643L-199.439,-53.284L-201.829,-53.924L-204.218,-54.565L-206.607,-55.205L-208.996,-55.846L-211.386,-56.487L-213.775,-57.127L-216.164,-57.768L-218.553,-58.408L-220.943,-59.049L-223.332,-59.689L-225.721,-60.330L-228.111,-60.970L-230.500,-61.611L-232.889,-62.251L-235.278,-62.891L-237.668,-63.532L-240.057,-64.172L-240.858,-61.088L-241.620,-57.988L-242.344,-54.873L-243.029,-51.744L-243.674,-48.599L-244.279,-45.440L-244.844,-42.268L-245.369,-39.081L-245.853,-35.881L-246.297,-32.668L-246.700,-29.442L-247.061,-26.203L-247.381,-22.952L-247.659,-19.689L-247.895,-16.414L-248.088,-13.128L-248.239,-9.831L-248.348,-6.523L-248.413,-3.204L-248.435,0.125L-248.435,0.125L-251.009,0.125L-253.582,0.125L-256.156,0.125L-258.730,0.125L-261.304,0.125L-263.878,0.125L-266.452,0.125L-269.026,0.125L-271.600,0.125L-274.174,0.125L-276.748,0.125L-279.322,0.125L-281.895,0.125L-284.469,0.125L-287.043,0.125L-289.617,0.125L-292.191,0.125L-294.765,0.125L-297.339,0.125L-299.913,0.125L-299.776,-9.003L-299.373,-17.975L-298.717,-26.789L-297.817,-35.442L-296.687,-43.931L-295.337,-52.253L-293.778,-60.407L-292.023,-68.388L-290.082,-76.196L-287.968,-83.826L-285.691,-91.276L-283.263,-98.543L-280.696,-105.625L-278.001,-112.520L-275.190,-119.223L-272.273,-125.734L-269.264,-132.048L-266.172,-138.163L-263.010,-144.077L-259.789,-149.787L-259.789,-149.787L-255.423,-147.268L-251.058,-144.748L-246.692,-142.228L-242.326,-139.708L-237.961,-137.188L-233.595,-134.668L-229.229,-132.148L-224.864,-129.628L-220.498,-127.109L-216.132,-124.589L-211.767,-122.069L-207.401,-119.549L-203.036,-117.029L-198.670,-114.509L-194.304,-111.989L-189.939,-109.470L-185.573,-106.950L-181.207,-104.430L-176.842,-101.910Z","hydra":"M-99.830,-172.540L-104.616,-169.652L-109.280,-166.657L-113.824,-163.560L-118.246,-160.366L-122.547,-157.078L-126.726,-153.700L-130.785,-150.237L-134.722,-146.694L-138.537,-143.073L-142.231,-139.380L-145.803,-135.619L-149.254,-131.794L-152.583,-127.909L-155.790,-123.968L-158.876,-119.975L-161.840,-115.936L-164.682,-111.853L-167.402,-107.732L-170.000,-103.576L-172.476,-99.390L-172.476,-99.390L-174.618,-100.626L-176.760,-101.862L-178.902,-103.098L-181.044,-104.334L-183.185,-105.570L-185.328,-106.806L-187.469,-108.042L-189.611,-109.278L-191.753,-110.514L-193.895,-111.750L-196.037,-112.986L-198.179,-114.222L-200.321,-115.458L-202.463,-116.694L-204.604,-117.930L-206.746,-119.166L-208.888,-120.402L-211.030,-121.638L-213.172,-122.874L-215.314,-124.110L-213.665,-126.931L-211.981,-129.728L-210.261,-132.501L-208.506,-135.250L-206.717,-137.974L-204.893,-140.673L-203.034,-143.347L-201.142,-145.995L-199.216,-148.618L-197.257,-151.214L-195.265,-153.783L-193.241,-156.325L-191.184,-158.841L-189.095,-161.328L-186.974,-163.788L-184.823,-166.220L-182.640,-168.624L-180.426,-170.998L-178.182,-173.344L-175.908,-175.660L-177.718,-177.470L-179.528,-179.280L-181.338,-181.090L-183.148,-182.900L-184.957,-184.709L-186.768,-186.519L-188.577,-188.329L-190.387,-190.139L-192.197,-191.949L-194.007,-193.759L-195.817,-195.569L-197.627,-197.379L-199.437,-199.188L-201.246,-200.998L-203.056,-202.808L-204.866,-204.618L-206.676,-206.428L-208.486,-208.238L-210.296,-210.048L-212.106,-211.857L-209.320,-214.607L-206.498,-217.321L-203.642,-219.998L-200.750,-222.639L-197.824,-225.241L-194.864,-227.807L-191.870,-230.333L-188.843,-232.822L-185.783,-235.271L-182.690,-237.681L-179.566,-240.052L-176.409,-242.382L-173.221,-244.671L-170.002,-246.920L-166.752,-249.127L-163.472,-251.293L-160.162,-253.417L-156.823,-255.497L-153.455,-257.535L-150.057,-259.530L-150.057,-259.530L-147.546,-255.181L-145.035,-250.831L-142.523,-246.482L-140.012,-242.132L-137.501,-237.783L-134.989,-233.433L-132.478,-229.084L-129.967,-224.734L-127.455,-220.385L-124.944,-216.035L-122.432,-211.686L-119.921,-207.336L-117.410,-202.986L-114.898,-198.637L-112.387,-194.287L-109.876,-189.938L-107.364,-185.588L-104.853,-181.239L-102.342,-176.889Z","lacaille":"M-64.622,-240.493L-67.799,-239.608L-70.959,-238.682L-74.102,-237.715L-77.227,-236.709L-80.334,-235.662L-83.422,-234.575L-86.492,-233.450L-89.543,-232.285L-92.575,-231.081L-95.587,-229.839L-98.579,-228.559L-101.551,-227.241L-104.502,-225.885L-107.432,-224.492L-110.342,-223.062L-113.230,-221.596L-116.096,-220.093L-118.940,-218.555L-121.761,-216.980L-124.560,-215.370L-124.560,-215.370L-125.835,-217.578L-127.110,-219.786L-128.385,-221.994L-129.660,-224.202L-130.935,-226.410L-132.209,-228.618L-133.484,-230.826L-134.759,-233.034L-136.034,-235.242L-137.309,-237.450L-138.584,-239.658L-139.858,-241.866L-141.133,-244.074L-142.408,-246.282L-143.683,-248.490L-144.958,-250.698L-146.233,-252.906L-147.508,-255.114L-148.783,-257.322L-150.057,-259.530L-153.455,-257.535L-156.823,-255.497L-160.162,-253.416L-163.472,-251.293L-166.752,-249.127L-170.002,-246.920L-173.221,-244.671L-176.409,-242.381L-179.566,-240.051L-182.690,-237.680L-185.783,-235.270L-188.843,-232.821L-191.870,-230.332L-194.864,-227.805L-197.824,-225.240L-200.750,-222.638L-203.642,-219.998L-206.498,-217.321L-209.320,-214.607L-212.106,-211.857L-212.106,-211.857L-213.854,-213.606L-215.603,-215.355L-217.352,-217.104L-219.101,-218.852L-220.850,-220.601L-222.598,-222.350L-224.347,-224.099L-226.096,-225.848L-227.844,-227.596L-229.593,-229.345L-231.342,-231.094L-233.091,-232.843L-234.839,-234.591L-236.588,-236.340L-238.337,-238.089L-240.086,-239.838L-241.834,-241.586L-243.583,-243.335L-245.332,-245.084L-247.081,-246.832L-239.897,-253.815L-232.599,-260.520L-225.194,-266.950L-217.690,-273.107L-210.095,-278.997L-202.417,-284.620L-194.663,-289.982L-186.841,-295.084L-178.960,-299.931L-171.027,-304.525L-163.050,-308.870L-155.036,-312.969L-146.995,-316.824L-138.933,-320.441L-130.858,-323.820L-122.779,-326.966L-114.703,-329.883L-106.639,-332.572L-98.593,-335.037L-90.574,-337.282L-90.574,-337.282L-89.277,-332.443L-87.979,-327.604L-86.681,-322.764L-85.384,-317.924L-84.086,-313.085L-82.788,-308.245L-81.491,-303.406L-80.193,-298.567L-78.896,-293.727L-77.598,-288.887L-76.301,-284.048L-75.003,-279.208L-73.705,-274.369L-72.408,-269.530L-71.110,-264.690L-69.812,-259.850L-68.515,-255.011L-67.217,-250.171L-65.920,-245.332Z","tanis":"M90.310,-337.290L89.670,-334.901L89.029,-332.511L88.389,-330.122L87.749,-327.733L87.109,-325.344L86.469,-322.955L85.829,-320.565L85.189,-318.176L84.549,-315.787L83.909,-313.397L83.269,-311.008L82.629,-308.619L81.989,-306.230L81.349,-303.841L80.709,-301.451L80.069,-299.062L79.429,-296.673L78.789,-294.283L78.149,-291.894L77.509,-289.505L73.786,-290.475L70.044,-291.399L66.283,-292.275L62.505,-293.104L58.709,-293.886L54.896,-294.619L51.066,-295.304L47.219,-295.940L43.356,-296.528L39.476,-297.066L35.582,-297.554L31.671,-297.993L27.746,-298.381L23.806,-298.718L19.852,-299.005L15.884,-299.240L11.901,-299.423L7.906,-299.554L3.898,-299.634L-0.124,-299.660L-0.124,-299.660L-0.124,-297.136L-0.124,-294.612L-0.124,-292.088L-0.124,-289.564L-0.124,-287.040L-0.124,-284.516L-0.124,-281.992L-0.124,-279.468L-0.124,-276.944L-0.124,-274.420L-0.124,-271.896L-0.124,-269.372L-0.124,-266.848L-0.124,-264.324L-0.124,-261.800L-0.124,-259.276L-0.124,-256.752L-0.124,-254.228L-0.124,-251.704L-0.124,-249.180L-3.465,-249.146L-6.796,-249.068L-10.115,-248.947L-13.424,-248.782L-16.722,-248.575L-20.008,-248.325L-23.281,-248.032L-26.543,-247.697L-29.792,-247.321L-33.029,-246.902L-36.252,-246.442L-39.462,-245.942L-42.658,-245.400L-45.840,-244.818L-49.008,-244.196L-52.162,-243.534L-55.301,-242.832L-58.424,-242.090L-61.532,-241.310L-64.625,-240.490L-64.625,-240.490L-66.576,-247.768L-68.527,-255.045L-70.478,-262.323L-72.429,-269.600L-74.380,-276.878L-76.331,-284.156L-78.282,-291.433L-80.233,-298.711L-82.184,-305.989L-84.136,-313.266L-86.086,-320.544L-88.038,-327.822L-89.989,-335.099L-91.940,-342.377L-93.891,-349.654L-95.842,-356.932L-97.793,-364.210L-99.744,-371.487L-101.695,-378.765L-103.646,-386.042L-98.681,-387.338L-93.691,-388.571L-88.677,-389.740L-83.638,-390.847L-78.576,-391.889L-73.491,-392.868L-68.383,-393.782L-63.254,-394.630L-58.102,-395.414L-52.929,-396.131L-47.735,-396.782L-42.521,-397.366L-37.287,-397.884L-32.033,-398.333L-26.760,-398.715L-21.468,-399.028L-16.158,-399.272L-10.830,-399.447L-5.485,-399.552L-0.123,-399.588L-0.123,-399.588L-0.123,-397.064L-0.123,-394.540L-0.123,-392.017L-0.123,-389.493L-0.123,-386.970L-0.123,-384.446L-0.123,-381.923L-0.123,-379.399L-0.123,-376.876L-0.123,-374.352L-0.123,-371.829L-0.123,-369.305L-0.123,-366.782L-0.123,-364.258L-0.123,-361.735L-0.123,-359.212L-0.123,-356.688L-0.123,-354.165L-0.124,-351.641L-0.124,-349.118L4.560,-349.087L9.229,-348.995L13.883,-348.843L18.522,-348.630L23.145,-348.356L27.751,-348.023L32.341,-347.631L36.914,-347.179L41.469,-346.669L46.006,-346.101L50.525,-345.474L55.026,-344.790L59.507,-344.049L63.969,-343.251L68.411,-342.396L72.833,-341.486L77.234,-340.519L81.614,-339.498L85.973,-338.421L90.310,-337.290Z","arturion":"M199.778,-346.092L196.029,-339.601L192.281,-333.109L188.532,-326.617L184.784,-320.125L181.036,-313.633L177.287,-307.141L173.539,-300.649L169.790,-294.157L166.042,-287.666L162.293,-281.174L158.545,-274.682L154.797,-268.190L151.048,-261.698L147.299,-255.206L143.551,-248.714L139.803,-242.222L136.054,-235.731L132.306,-229.239L128.557,-222.747L124.809,-216.255L119.630,-219.146L114.334,-221.938L108.925,-224.626L103.402,-227.204L97.768,-229.667L92.025,-232.009L86.172,-234.226L80.213,-236.312L74.148,-238.262L67.979,-240.070L61.708,-241.731L55.335,-243.239L48.863,-244.591L42.292,-245.779L35.624,-246.799L28.861,-247.646L22.005,-248.313L15.055,-248.797L8.015,-249.091L0.886,-249.190L0.886,-249.190L0.836,-249.190L0.786,-249.190L0.735,-249.190L0.685,-249.190L0.635,-249.190L0.584,-249.190L0.533,-249.190L0.483,-249.189L0.432,-249.189L0.381,-249.189L0.330,-249.188L0.279,-249.188L0.228,-249.187L0.178,-249.187L0.127,-249.186L0.077,-249.185L0.026,-249.184L-0.024,-249.183L-0.074,-249.181L-0.124,-249.180L-0.124,-249.180L-0.124,-251.704L-0.124,-254.228L-0.124,-256.752L-0.124,-259.277L-0.124,-261.801L-0.124,-264.325L-0.124,-266.849L-0.124,-269.373L-0.124,-271.897L-0.124,-274.421L-0.124,-276.945L-0.124,-279.469L-0.124,-281.994L-0.124,-284.518L-0.124,-287.042L-0.124,-289.566L-0.124,-292.090L-0.124,-294.614L-0.124,-297.138L-0.124,-299.662L3.898,-299.636L7.906,-299.557L11.901,-299.425L15.884,-299.242L19.852,-299.007L23.806,-298.721L27.746,-298.383L31.671,-297.995L35.582,-297.557L39.476,-297.068L43.356,-296.530L47.219,-295.943L51.066,-295.307L54.896,-294.622L58.709,-293.888L62.505,-293.107L66.283,-292.277L70.044,-291.401L73.786,-290.478L77.509,-289.507L77.509,-289.507L78.149,-291.897L78.789,-294.286L79.429,-296.675L80.069,-299.065L80.709,-301.454L81.349,-303.843L81.989,-306.232L82.629,-308.621L83.269,-311.011L83.909,-313.400L84.549,-315.789L85.189,-318.179L85.829,-320.568L86.469,-322.957L87.109,-325.346L87.749,-327.735L88.389,-330.125L89.029,-332.514L89.670,-334.903L90.310,-337.292L85.973,-338.424L81.614,-339.500L77.234,-340.522L72.833,-341.488L68.411,-342.399L63.969,-343.253L59.507,-344.051L55.026,-344.793L50.526,-345.477L46.006,-346.103L41.469,-346.672L36.914,-347.183L32.341,-347.634L27.752,-348.027L23.146,-348.360L18.523,-348.633L13.885,-348.847L9.231,-349.000L4.562,-349.092L-0.121,-349.123L-0.121,-349.123L-0.121,-351.646L-0.121,-354.169L-0.121,-356.693L-0.121,-359.216L-0.121,-361.739L-0.121,-364.263L-0.121,-366.786L-0.121,-369.309L-0.121,-371.833L-0.121,-374.356L-0.121,-376.880L-0.121,-379.403L-0.121,-381.926L-0.121,-384.450L-0.121,-386.973L-0.121,-389.496L-0.121,-392.020L-0.121,-394.543L-0.121,-397.067L-0.121,-399.590L12.100,-399.408L24.103,-398.871L35.886,-397.995L47.446,-396.795L58.780,-395.286L69.885,-393.485L80.758,-391.406L91.397,-389.064L101.800,-386.476L111.962,-383.655L121.882,-380.619L131.556,-377.382L140.981,-373.958L150.156,-370.365L159.077,-366.617L167.742,-362.730L176.147,-358.718L184.290,-354.598L192.168,-350.384L199.778,-346.092Z","falstaff":"M282.538,-282.493L277.245,-277.201L271.952,-271.909L266.659,-266.618L261.367,-261.326L256.074,-256.034L250.781,-250.743L245.488,-245.451L240.195,-240.160L234.902,-234.868L229.610,-229.576L224.317,-224.285L219.024,-218.993L213.731,-213.701L208.439,-208.410L203.146,-203.118L197.853,-197.827L192.560,-192.535L187.267,-187.243L181.974,-181.952L176.682,-176.660L174.352,-178.946L171.992,-181.202L169.603,-183.428L167.185,-185.622L164.739,-187.786L162.264,-189.917L159.761,-192.017L157.230,-194.084L154.671,-196.119L152.086,-198.121L149.474,-200.090L146.835,-202.025L144.170,-203.926L141.479,-205.793L138.763,-207.625L136.021,-209.423L133.255,-211.185L130.464,-212.912L127.648,-214.603L124.809,-216.257L128.557,-222.749L132.306,-229.241L136.054,-235.733L139.803,-242.225L143.551,-248.717L147.299,-255.209L151.048,-261.701L154.797,-268.193L158.545,-274.684L162.293,-281.176L166.042,-287.668L169.790,-294.160L173.539,-300.652L177.287,-307.144L181.036,-313.636L184.784,-320.128L188.532,-326.619L192.281,-333.111L196.029,-339.603L199.778,-346.095L204.309,-343.433L208.801,-340.713L213.255,-337.936L217.670,-335.103L222.045,-332.213L226.379,-329.268L230.673,-326.268L234.925,-323.213L239.136,-320.104L243.304,-316.942L247.429,-313.727L251.511,-310.459L255.548,-307.140L259.541,-303.769L263.490,-300.347L267.393,-296.875L271.249,-293.353L275.059,-289.781L278.822,-286.161L282.538,-282.493Z","mirin":"M346.118,-199.742L341.789,-197.244L337.461,-194.746L333.133,-192.248L328.805,-189.749L324.476,-187.251L320.148,-184.753L315.820,-182.255L311.491,-179.757L307.163,-177.258L302.835,-174.760L298.507,-172.262L294.178,-169.764L289.850,-167.265L285.522,-164.767L281.193,-162.269L276.865,-159.770L272.537,-157.272L268.208,-154.774L263.880,-152.276L259.552,-149.778L257.556,-153.176L255.517,-156.546L253.435,-159.886L251.311,-163.197L249.145,-166.478L246.937,-169.729L244.688,-172.948L242.398,-176.137L240.068,-179.294L237.697,-182.420L235.287,-185.513L232.838,-188.574L230.349,-191.602L227.822,-194.597L225.257,-197.558L222.653,-200.485L220.013,-203.377L217.335,-206.235L214.620,-209.058L211.870,-211.845L211.870,-211.845L215.403,-215.377L218.936,-218.910L222.470,-222.442L226.003,-225.975L229.537,-229.507L233.070,-233.039L236.603,-236.572L240.137,-240.104L243.670,-243.636L247.204,-247.169L250.737,-250.701L254.271,-254.234L257.804,-257.766L261.337,-261.298L264.871,-264.831L268.404,-268.363L271.938,-271.895L275.471,-275.428L279.004,-278.960L282.538,-282.493L286.205,-278.777L289.824,-275.014L293.394,-271.205L296.914,-267.348L300.385,-263.446L303.806,-259.498L307.175,-255.506L310.493,-251.469L313.760,-247.388L316.974,-243.264L320.134,-239.096L323.242,-234.886L326.295,-230.635L329.295,-226.342L332.239,-222.008L335.128,-217.634L337.960,-213.219L340.737,-208.766L343.456,-204.273L346.118,-199.742Z","jinxi":"M450.065,0.125L450.025,6.162L449.906,12.179L449.709,18.177L449.434,24.155L449.081,30.112L448.651,36.049L448.145,41.964L447.562,47.857L446.904,53.727L446.171,59.575L445.364,65.399L444.482,71.199L443.527,76.975L442.498,82.726L441.398,88.451L440.225,94.150L438.980,99.823L437.664,105.469L436.278,111.087L434.821,116.677L434.821,116.677L429.945,115.371L425.069,114.064L420.192,112.758L415.316,111.451L410.439,110.144L405.563,108.838L400.686,107.531L395.810,106.224L390.934,104.918L386.057,103.611L381.181,102.305L376.305,100.998L371.428,99.691L366.552,98.385L361.675,97.078L356.799,95.772L351.922,94.465L347.046,93.158L342.170,91.852L337.293,90.545L338.425,86.208L339.501,81.850L340.523,77.470L341.489,73.070L342.400,68.648L343.254,64.207L344.053,59.746L344.794,55.265L345.478,50.766L346.105,46.247L346.673,41.711L347.184,37.156L347.635,32.584L348.028,27.996L348.361,23.390L348.635,18.768L348.848,14.130L349.001,9.477L349.093,4.808L349.124,0.125L349.124,0.125L346.651,0.125L344.178,0.125L341.705,0.125L339.232,0.125L336.759,0.125L334.286,0.125L331.813,0.125L329.340,0.125L326.867,0.125L324.394,0.125L321.921,0.125L319.448,0.125L316.975,0.125L314.502,0.125L312.029,0.125L309.556,0.125L307.083,0.125L304.610,0.125L302.137,0.125L299.664,0.125L299.637,-3.893L299.558,-7.899L299.427,-11.891L299.244,-15.870L299.010,-19.835L298.724,-23.786L298.388,-27.723L298.001,-31.645L297.563,-35.552L297.076,-39.444L296.539,-43.320L295.953,-47.180L295.318,-51.023L294.634,-54.851L293.902,-58.661L293.122,-62.453L292.295,-66.228L291.420,-69.986L290.498,-73.725L289.529,-77.445L289.529,-77.445L294.356,-78.737L299.184,-80.030L304.011,-81.323L308.839,-82.615L313.666,-83.907L318.494,-85.200L323.321,-86.493L328.148,-87.785L332.976,-89.078L337.803,-90.370L342.631,-91.662L347.458,-92.955L352.286,-94.248L357.113,-95.540L361.940,-96.833L366.768,-98.125L371.595,-99.417L376.423,-100.710L381.250,-102.003L386.077,-103.295L387.370,-98.334L388.600,-93.349L389.767,-88.339L390.871,-83.305L391.911,-78.248L392.887,-73.167L393.799,-68.064L394.646,-62.940L395.427,-57.793L396.143,-52.625L396.793,-47.436L397.376,-42.227L397.892,-36.998L398.340,-31.749L398.721,-26.482L399.033,-21.196L399.277,-15.891L399.452,-10.570L399.557,-5.231L399.592,0.125L399.592,0.125L402.115,0.125L404.639,0.125L407.163,0.125L409.686,0.125L412.210,0.125L414.734,0.125L417.257,0.125L419.781,0.125L422.304,0.125L424.828,0.125L427.352,0.125L429.875,0.125L432.399,0.125L434.923,0.125L437.446,0.125L439.970,0.125L442.494,0.125L445.017,0.125L447.541,0.125L450.065,0.125Z","farsight":"M480.657,128.963L476.562,143.412L472.103,157.513L467.300,171.267L462.171,184.674L456.736,197.734L451.015,210.446L445.026,222.811L438.790,234.829L432.327,246.500L425.654,257.824L418.793,268.801L411.762,279.432L404.581,289.715L397.269,299.652L389.846,309.242L382.332,318.486L374.745,327.383L367.106,335.933L359.433,344.137L351.747,351.995L351.747,351.995L348.285,348.533L344.824,345.072L341.362,341.610L337.900,338.148L334.439,334.687L330.977,331.225L327.515,327.764L324.054,324.302L320.592,320.840L317.130,317.379L313.669,313.917L310.207,310.456L306.746,306.994L303.284,303.532L299.822,300.071L296.361,296.609L292.899,293.147L289.437,289.686L285.976,286.224L282.514,282.762L286.183,279.047L289.804,275.284L293.375,271.474L296.897,267.618L300.369,263.716L303.790,259.768L307.160,255.776L310.478,251.739L313.745,247.658L316.959,243.533L320.120,239.366L323.227,235.157L326.280,230.905L329.279,226.612L332.222,222.278L335.110,217.904L337.942,213.489L340.717,209.036L343.435,204.543L346.095,200.013L346.095,200.013L343.909,198.751L341.724,197.489L339.538,196.227L337.352,194.966L335.166,193.704L332.981,192.442L330.795,191.180L328.609,189.919L326.423,188.657L324.238,187.395L322.052,186.133L319.866,184.872L317.680,183.610L315.494,182.348L313.309,181.086L311.123,179.825L308.937,178.563L306.752,177.301L304.566,176.039L302.380,174.777L304.623,170.843L306.817,166.877L308.960,162.880L311.053,158.852L313.094,154.793L315.085,150.704L317.023,146.586L318.908,142.439L320.741,138.263L322.521,134.058L324.247,129.826L325.919,125.566L327.537,121.279L329.099,116.965L330.606,112.625L332.057,108.259L333.453,103.868L334.791,99.451L336.072,95.010L337.296,90.545L337.296,90.545L344.464,92.466L351.632,94.387L358.800,96.308L365.968,98.228L373.136,100.149L380.304,102.070L387.472,103.991L394.640,105.912L401.808,107.833L408.976,109.754L416.144,111.675L423.312,113.596L430.480,115.516L437.648,117.437L444.816,119.358L451.984,121.279L459.152,123.200L466.320,125.121L473.488,127.042Z","leo":"M351.747,351.995L347.122,356.560L342.438,361.065L337.696,365.509L332.896,369.892L328.039,374.212L323.126,378.470L318.157,382.664L313.132,386.794L308.053,390.860L302.920,394.860L297.734,398.794L292.495,402.661L287.204,406.462L281.862,410.194L276.468,413.858L271.024,417.453L265.531,420.979L259.988,424.434L254.397,427.818L248.758,431.130L248.758,431.130L245.048,424.704L241.337,418.278L237.627,411.853L233.916,405.427L230.206,399.001L226.495,392.576L222.785,386.150L219.074,379.724L215.364,373.298L211.653,366.873L207.943,360.447L204.232,354.021L200.522,347.595L196.811,341.170L193.101,334.744L189.390,328.318L185.680,321.892L181.969,315.466L178.259,309.041L174.548,302.615L181.930,298.221L189.249,293.615L196.500,288.797L203.674,283.767L210.765,278.527L217.765,273.076L224.669,267.414L231.468,261.542L238.156,255.460L244.725,249.168L251.170,242.667L257.482,235.956L263.655,229.037L269.682,221.909L275.555,214.573L281.268,207.029L286.814,199.277L292.185,191.318L297.376,183.151L302.378,174.777L302.378,174.777L304.563,176.039L306.749,177.301L308.935,178.563L311.121,179.825L313.306,181.086L315.492,182.348L317.678,183.610L319.864,184.872L322.049,186.133L324.235,187.395L326.421,188.657L328.607,189.919L330.792,191.180L332.978,192.442L335.164,193.704L337.350,194.966L339.535,196.227L341.721,197.489L343.907,198.751L346.093,200.013L343.432,204.543L340.714,209.036L337.939,213.489L335.107,217.904L332.219,222.278L329.276,226.612L326.277,230.905L323.224,235.157L320.116,239.366L316.955,243.533L313.741,247.658L310.475,251.739L307.156,255.776L303.786,259.768L300.365,263.716L296.893,267.618L293.372,271.474L289.800,275.284L286.180,279.047L282.512,282.762L282.512,282.762L285.974,286.224L289.435,289.686L292.897,293.147L296.359,296.609L299.821,300.071L303.282,303.532L306.744,306.994L310.206,310.456L313.667,313.917L317.129,317.379L320.591,320.840L324.053,324.302L327.514,327.764L330.976,331.225L334.438,334.687L337.900,338.148L341.361,341.610L344.823,345.072L348.285,348.533Z","rigel":"M248.758,431.130L239.307,436.463L229.521,441.701L219.403,446.825L208.956,451.815L198.184,456.653L187.091,461.319L175.679,465.793L163.952,470.057L151.912,474.090L139.565,477.874L126.913,481.390L113.959,484.617L100.707,487.537L87.160,490.131L73.321,492.378L59.195,494.261L44.783,495.758L30.090,496.852L15.119,497.522L-0.126,497.750L-0.126,497.750L-0.126,495.378L-0.126,493.006L-0.126,490.634L-0.126,488.262L-0.126,485.890L-0.126,483.518L-0.126,481.146L-0.126,478.774L-0.126,476.402L-0.126,474.030L-0.126,471.658L-0.126,469.286L-0.126,466.914L-0.126,464.542L-0.126,462.170L-0.126,459.798L-0.126,457.426L-0.126,455.054L-0.126,452.682L-0.126,450.310L5.913,450.270L11.933,450.152L17.934,449.955L23.915,449.679L29.875,449.326L35.813,448.897L41.731,448.390L47.626,447.807L53.499,447.149L59.348,446.416L65.174,445.608L70.976,444.726L76.754,443.770L82.506,442.741L88.233,441.640L93.934,440.466L99.608,439.220L105.255,437.903L110.875,436.515L116.467,435.057L116.467,435.057L115.814,432.619L115.160,430.181L114.506,427.743L113.853,425.305L113.199,422.867L112.545,420.429L111.892,417.991L111.238,415.552L110.585,413.114L109.931,410.676L109.277,408.238L108.624,405.800L107.970,403.362L107.317,400.924L106.663,398.486L106.009,396.047L105.356,393.609L104.702,391.171L104.049,388.733L103.395,386.295L98.430,387.590L93.440,388.823L88.425,389.993L83.387,391.099L78.325,392.142L73.240,393.120L68.132,394.034L63.002,394.883L57.851,395.666L52.678,396.383L47.484,397.035L42.270,397.619L37.035,398.136L31.781,398.586L26.508,398.967L21.217,399.280L15.907,399.525L10.579,399.699L5.234,399.805L-0.128,399.840L-0.128,399.840L-0.128,397.316L-0.128,394.793L-0.128,392.270L-0.128,389.746L-0.128,387.223L-0.128,384.699L-0.128,382.176L-0.128,379.652L-0.128,377.129L-0.128,374.605L-0.128,372.082L-0.128,369.558L-0.128,367.035L-0.128,364.511L-0.128,361.988L-0.128,359.464L-0.128,356.941L-0.128,354.417L-0.128,351.893L-0.128,349.370L10.531,349.211L21.004,348.742L31.288,347.976L41.380,346.928L51.278,345.610L60.978,344.036L70.478,342.220L79.776,340.174L88.869,337.911L97.753,335.447L106.427,332.794L114.886,329.965L123.130,326.973L131.154,323.833L138.957,320.557L146.534,317.159L153.885,313.653L161.006,310.051L167.894,306.367L174.546,302.615L174.546,302.615L178.257,309.041L181.967,315.466L185.678,321.892L189.388,328.318L193.099,334.744L196.810,341.170L200.520,347.595L204.231,354.021L207.941,360.447L211.652,366.873L215.363,373.298L219.073,379.724L222.784,386.150L226.495,392.576L230.205,399.001L233.916,405.427L237.626,411.853L241.337,418.278L245.048,424.704Z","omega":"M116.467,435.057L110.875,436.515L105.255,437.903L99.608,439.220L93.933,440.466L88.232,441.640L82.505,442.741L76.753,443.770L70.975,444.726L65.173,445.608L59.347,446.416L53.498,447.149L47.625,447.807L41.730,448.390L35.812,448.897L29.874,449.326L23.914,449.679L17.933,449.955L11.933,450.152L5.913,450.270L-0.126,450.310L-0.126,450.310L-0.126,452.682L-0.126,455.054L-0.126,457.426L-0.126,459.798L-0.126,462.170L-0.126,464.542L-0.126,466.914L-0.126,469.286L-0.126,471.658L-0.126,474.030L-0.126,476.402L-0.126,478.774L-0.126,481.146L-0.126,483.518L-0.126,485.890L-0.126,488.262L-0.126,490.634L-0.126,493.006L-0.126,495.378L-0.126,497.750L-6.801,497.706L-13.454,497.575L-20.086,497.357L-26.696,497.052L-33.283,496.662L-39.847,496.187L-46.387,495.627L-52.902,494.983L-59.392,494.255L-65.858,493.445L-72.297,492.552L-78.709,491.577L-85.095,490.521L-91.452,489.385L-97.782,488.168L-104.082,486.872L-110.353,485.497L-116.594,484.043L-122.805,482.511L-128.985,480.902L-128.985,480.902L-126.423,471.345L-123.862,461.788L-121.301,452.230L-118.739,442.673L-116.178,433.116L-113.617,423.558L-111.055,414.001L-108.494,404.444L-105.933,394.886L-103.371,385.329L-100.810,375.771L-98.249,366.214L-95.687,356.657L-93.126,347.099L-90.565,337.542L-88.003,327.984L-85.442,318.427L-82.881,308.870L-80.319,299.312L-77.758,289.755L-74.035,290.725L-70.293,291.649L-66.532,292.525L-62.754,293.354L-58.958,294.136L-55.145,294.869L-51.315,295.554L-47.468,296.190L-43.605,296.778L-39.725,297.316L-35.831,297.804L-31.920,298.243L-27.995,298.631L-24.055,298.968L-20.101,299.255L-16.132,299.490L-12.150,299.673L-8.155,299.804L-4.146,299.884L-0.125,299.910L-0.125,299.910L-0.125,304.907L-0.125,309.903L-0.125,314.900L-0.125,319.896L-0.125,324.892L-0.125,329.889L-0.125,334.886L-0.125,339.882L-0.126,344.879L-0.126,349.875L-0.126,354.871L-0.126,359.868L-0.126,364.864L-0.126,369.861L-0.126,374.858L-0.126,379.854L-0.126,384.850L-0.126,389.847L-0.126,394.843L-0.126,399.840L5.236,399.805L10.581,399.699L15.909,399.524L21.219,399.280L26.511,398.967L31.784,398.585L37.038,398.135L42.272,397.618L47.486,397.034L52.680,396.382L57.853,395.665L63.005,394.882L68.135,394.033L73.242,393.119L78.327,392.141L83.389,391.098L88.428,389.992L93.442,388.822L98.432,387.590L103.397,386.295L103.397,386.295L104.051,388.733L104.704,391.171L105.358,393.609L106.011,396.047L106.665,398.486L107.318,400.924L107.972,403.362L108.625,405.800L109.279,408.238L109.932,410.676L110.586,413.114L111.239,415.552L111.893,417.991L112.546,420.429L113.200,422.867L113.853,425.305L114.507,427.743L115.160,430.181L115.814,432.619Z","xitauri":"M-103.629,386.305L-104.897,391.035L-106.164,395.765L-107.432,400.495L-108.700,405.225L-109.968,409.955L-111.236,414.685L-112.503,419.415L-113.771,424.145L-115.039,428.875L-116.307,433.605L-117.575,438.335L-118.842,443.065L-120.110,447.795L-121.378,452.525L-122.646,457.255L-123.913,461.985L-125.181,466.715L-126.449,471.445L-127.717,476.175L-128.985,480.905L-142.998,476.938L-156.715,472.618L-170.135,467.962L-183.257,462.983L-196.079,457.698L-208.603,452.122L-220.825,446.269L-232.746,440.155L-244.366,433.796L-255.682,427.206L-266.695,420.400L-277.404,413.395L-287.807,406.205L-297.904,398.845L-307.695,391.331L-317.177,383.678L-326.352,375.901L-335.217,368.015L-343.773,360.035L-352.018,351.978L-352.018,351.978L-346.771,346.732L-341.525,341.487L-336.279,336.242L-331.032,330.996L-325.786,325.751L-320.540,320.506L-315.294,315.261L-310.047,310.016L-304.801,304.770L-299.555,299.525L-294.308,294.280L-289.062,289.034L-283.816,283.789L-278.569,278.544L-273.323,273.299L-268.077,268.054L-262.830,262.808L-257.584,257.563L-252.338,252.318L-247.091,247.072L-243.844,250.278L-240.555,253.441L-237.226,256.561L-233.856,259.638L-230.446,262.672L-226.996,265.661L-223.507,268.605L-219.979,271.505L-216.413,274.359L-212.809,277.166L-209.168,279.928L-205.489,282.643L-201.774,285.310L-198.023,287.930L-194.236,290.501L-190.413,293.024L-186.556,295.498L-182.664,297.922L-178.738,300.296L-174.779,302.620L-174.779,302.620L-176.041,304.806L-177.303,306.993L-178.565,309.179L-179.828,311.365L-181.090,313.552L-182.352,315.738L-183.615,317.925L-184.877,320.111L-186.139,322.297L-187.401,324.484L-188.664,326.670L-189.926,328.857L-191.188,331.043L-192.451,333.229L-193.713,335.416L-194.975,337.602L-196.237,339.788L-197.500,341.975L-198.762,344.161L-200.024,346.347L-195.521,348.914L-190.982,351.423L-186.407,353.874L-181.797,356.268L-177.151,358.604L-172.472,360.881L-167.758,363.098L-163.012,365.256L-158.232,367.353L-153.420,369.390L-148.576,371.365L-143.701,373.279L-138.795,375.130L-133.859,376.919L-128.892,378.644L-123.896,380.306L-118.872,381.903L-113.819,383.436L-108.737,384.903L-103.629,386.305Z","quintus":"M-247.091,247.070L-252.338,252.315L-257.584,257.560L-262.830,262.806L-268.077,268.051L-273.323,273.296L-278.569,278.542L-283.816,283.787L-289.062,289.032L-294.308,294.277L-299.555,299.522L-304.801,304.768L-310.047,310.013L-315.294,315.258L-320.540,320.503L-325.786,325.749L-331.032,330.994L-336.279,336.239L-341.525,341.485L-346.771,346.730L-352.018,351.975L-361.954,341.754L-371.496,331.368L-380.649,320.828L-389.416,310.145L-397.803,299.332L-405.813,288.397L-413.451,277.353L-420.721,266.211L-427.629,254.982L-434.178,243.677L-440.373,232.307L-446.218,220.883L-451.718,209.416L-456.877,197.918L-461.699,186.398L-466.190,174.870L-470.354,163.343L-474.194,151.829L-477.716,140.338L-480.924,128.882L-480.924,128.882L-478.633,128.269L-476.341,127.655L-474.049,127.041L-471.757,126.427L-469.466,125.814L-467.174,125.200L-464.882,124.586L-462.590,123.973L-460.299,123.359L-458.007,122.745L-455.715,122.131L-453.423,121.517L-451.132,120.904L-448.840,120.290L-446.548,119.676L-444.256,119.062L-441.964,118.449L-439.673,117.835L-437.381,117.221L-435.089,116.608L-433.511,122.364L-431.858,128.089L-430.133,133.784L-428.334,139.446L-426.463,145.075L-424.520,150.672L-422.506,156.235L-420.420,161.764L-418.265,167.257L-416.040,172.716L-413.746,178.138L-411.383,183.524L-408.952,188.873L-406.453,194.184L-403.888,199.457L-401.255,204.691L-398.557,209.886L-395.793,215.040L-392.965,220.154L-390.072,225.228L-390.072,225.228L-387.887,223.966L-385.702,222.704L-383.516,221.442L-381.331,220.181L-379.146,218.919L-376.960,217.657L-374.775,216.395L-372.590,215.134L-370.405,213.872L-368.219,212.610L-366.034,211.348L-363.849,210.087L-361.663,208.825L-359.478,207.563L-357.293,206.301L-355.108,205.040L-352.923,203.778L-350.737,202.516L-348.552,201.254L-346.367,199.992L-348.933,195.488L-351.443,190.947L-353.896,186.370L-356.290,181.758L-358.626,177.110L-360.903,172.428L-363.121,167.712L-365.279,162.963L-367.377,158.181L-369.413,153.366L-371.389,148.520L-373.303,143.642L-375.154,138.732L-376.943,133.793L-378.668,128.824L-380.330,123.825L-381.927,118.797L-383.460,113.741L-384.927,108.657L-386.329,103.545L-386.329,103.545L-383.891,102.892L-381.452,102.240L-379.014,101.588L-376.576,100.935L-374.138,100.282L-371.700,99.630L-369.262,98.978L-366.823,98.325L-364.385,97.672L-361.947,97.020L-359.509,96.368L-357.071,95.715L-354.633,95.062L-352.195,94.410L-349.757,93.758L-347.319,93.105L-344.880,92.453L-342.442,91.800L-340.004,91.147L-337.566,90.495L-334.691,100.640L-331.561,110.540L-328.189,120.196L-324.588,129.608L-320.774,138.776L-316.758,147.700L-312.555,156.380L-308.178,164.816L-303.642,173.009L-298.959,180.958L-294.143,188.663L-289.209,196.126L-284.169,203.344L-279.038,210.320L-273.829,217.052L-268.555,223.542L-263.231,229.788L-257.870,235.791L-252.485,241.552L-247.091,247.070Z","severin":"M-346.364,199.992L-348.549,201.254L-350.735,202.516L-352.920,203.778L-355.105,205.040L-357.290,206.301L-359.476,207.563L-361.661,208.825L-363.846,210.087L-366.032,211.348L-368.217,212.610L-370.402,213.872L-372.587,215.134L-374.773,216.395L-376.958,217.657L-379.143,218.919L-381.328,220.181L-383.514,221.442L-385.699,222.704L-387.884,223.966L-390.070,225.228L-392.963,220.154L-395.792,215.040L-398.556,209.886L-401.254,204.691L-403.886,199.457L-406.452,194.184L-408.951,188.873L-411.382,183.524L-413.744,178.138L-416.039,172.716L-418.263,167.257L-420.419,161.764L-422.504,156.235L-424.518,150.672L-426.461,145.075L-428.332,139.446L-430.130,133.784L-431.856,128.089L-433.508,122.364L-435.087,116.608L-435.087,116.608L-437.379,117.221L-439.670,117.835L-441.962,118.449L-444.254,119.062L-446.545,119.676L-448.837,120.290L-451.129,120.904L-453.421,121.517L-455.712,122.131L-458.004,122.745L-460.296,123.359L-462.588,123.973L-464.880,124.586L-467.171,125.200L-469.463,125.814L-471.755,126.427L-474.047,127.041L-476.339,127.655L-478.630,128.269L-480.922,128.882L-482.530,122.708L-484.060,116.501L-485.513,110.265L-486.887,103.998L-488.182,97.702L-489.397,91.378L-490.532,85.025L-491.587,78.644L-492.561,72.236L-493.452,65.802L-494.262,59.342L-494.988,52.856L-495.631,46.346L-496.191,39.811L-496.665,33.253L-497.055,26.671L-497.359,20.067L-497.576,13.441L-497.708,6.793L-497.751,0.125L-497.751,0.125L-492.856,0.125L-487.960,0.125L-483.065,0.125L-478.169,0.125L-473.274,0.125L-468.378,0.125L-463.483,0.125L-458.587,0.125L-453.692,0.125L-448.796,0.125L-443.900,0.125L-439.005,0.125L-434.109,0.125L-429.214,0.125L-424.318,0.125L-419.423,0.125L-414.527,0.125L-409.632,0.125L-404.736,0.125L-399.841,0.125L-399.659,12.332L-399.124,24.322L-398.250,36.093L-397.052,47.642L-395.548,58.966L-393.750,70.063L-391.674,80.929L-389.337,91.562L-386.752,101.960L-383.935,112.119L-380.902,122.037L-377.667,131.711L-374.246,141.138L-370.655,150.316L-366.907,159.241L-363.019,167.912L-359.005,176.326L-354.881,184.479L-350.662,192.369L-346.364,199.992Z","trigon":"M-302.626,-174.527L-304.870,-170.593L-307.063,-166.627L-309.207,-162.630L-311.299,-158.602L-313.341,-154.543L-315.331,-150.454L-317.269,-146.336L-319.155,-142.189L-320.988,-138.013L-322.767,-133.808L-324.493,-129.576L-326.165,-125.316L-327.783,-121.029L-329.345,-116.715L-330.853,-112.375L-332.304,-108.009L-333.699,-103.618L-335.037,-99.201L-336.318,-94.760L-337.542,-90.295L-337.542,-90.295L-339.980,-90.949L-342.418,-91.602L-344.857,-92.256L-347.295,-92.910L-349.733,-93.563L-352.171,-94.217L-354.609,-94.870L-357.047,-95.524L-359.486,-96.178L-361.924,-96.831L-364.362,-97.485L-366.800,-98.138L-369.238,-98.792L-371.676,-99.446L-374.114,-100.099L-376.552,-100.753L-378.991,-101.407L-381.429,-102.060L-383.867,-102.714L-386.305,-103.367L-387.599,-98.404L-388.830,-93.415L-389.999,-88.402L-391.104,-83.365L-392.146,-78.305L-393.124,-73.222L-394.037,-68.115L-394.885,-62.987L-395.668,-57.837L-396.385,-52.666L-397.036,-47.473L-397.620,-42.261L-398.137,-37.028L-398.586,-31.775L-398.968,-26.504L-399.281,-21.214L-399.525,-15.905L-399.700,-10.579L-399.805,-5.236L-399.841,0.125L-399.841,0.125L-404.736,0.125L-409.632,0.125L-414.527,0.125L-419.423,0.125L-424.318,0.125L-429.214,0.125L-434.109,0.125L-439.005,0.125L-443.900,0.125L-448.796,0.125L-453.692,0.125L-458.587,0.125L-463.483,0.125L-468.378,0.125L-473.274,0.125L-478.169,0.125L-483.065,0.125L-487.960,0.125L-492.856,0.125L-497.751,0.125L-497.707,-6.548L-497.576,-13.200L-497.358,-19.830L-497.054,-26.438L-496.664,-33.024L-496.190,-39.586L-495.630,-46.125L-494.986,-52.639L-494.259,-59.128L-493.449,-65.592L-492.557,-72.030L-491.582,-78.442L-490.527,-84.826L-489.390,-91.183L-488.173,-97.511L-486.876,-103.811L-485.501,-110.082L-484.046,-116.322L-482.513,-122.533L-480.903,-128.713L-480.903,-128.713L-478.611,-128.098L-476.319,-127.484L-474.028,-126.870L-471.736,-126.255L-469.444,-125.641L-467.152,-125.027L-464.861,-124.413L-462.569,-123.798L-460.277,-123.184L-457.985,-122.570L-455.693,-121.956L-453.402,-121.342L-451.110,-120.727L-448.818,-120.113L-446.527,-119.499L-444.235,-118.884L-441.943,-118.270L-439.651,-117.656L-437.359,-117.042L-435.068,-116.427L-433.489,-122.182L-431.836,-127.906L-430.110,-133.598L-428.311,-139.258L-426.440,-144.886L-424.496,-150.480L-422.482,-156.041L-420.396,-161.567L-418.240,-167.059L-416.015,-172.515L-413.721,-177.935L-411.358,-183.318L-408.928,-188.665L-406.430,-193.974L-403.865,-199.245L-401.234,-204.477L-398.537,-209.670L-395.776,-214.823L-392.949,-219.936L-390.059,-225.007L-390.059,-225.007L-385.687,-222.484L-381.316,-219.959L-376.944,-217.436L-372.573,-214.911L-368.201,-212.388L-363.829,-209.863L-359.458,-207.340L-355.086,-204.815L-350.714,-202.291L-346.343,-199.768L-341.971,-197.243L-337.599,-194.720L-333.228,-192.195L-328.856,-189.672L-324.485,-187.147L-320.113,-184.624L-315.741,-182.099L-311.370,-179.576L-306.998,-177.051Z","andromeda":"M-175.908,-175.660L-178.183,-173.344L-180.427,-170.998L-182.641,-168.624L-184.824,-166.221L-186.976,-163.789L-189.096,-161.329L-191.185,-158.841L-193.242,-156.326L-195.266,-153.784L-197.258,-151.214L-199.217,-148.619L-201.143,-145.996L-203.035,-143.348L-204.893,-140.674L-206.717,-137.975L-208.507,-135.251L-210.261,-132.502L-211.981,-129.729L-213.665,-126.931L-215.314,-124.110L-215.314,-124.110L-217.537,-125.394L-219.761,-126.678L-221.985,-127.962L-224.208,-129.245L-226.432,-130.529L-228.655,-131.813L-230.879,-133.097L-233.103,-134.381L-235.326,-135.665L-237.550,-136.949L-239.774,-138.233L-241.997,-139.517L-244.221,-140.800L-246.444,-142.084L-248.668,-143.368L-250.892,-144.652L-253.115,-145.936L-255.339,-147.220L-257.563,-148.504L-259.786,-149.787L-261.712,-146.411L-263.595,-143.007L-265.435,-139.577L-267.232,-136.119L-268.984,-132.635L-270.692,-129.126L-272.356,-125.591L-273.975,-122.031L-275.548,-118.446L-277.076,-114.837L-278.557,-111.205L-279.992,-107.548L-281.381,-103.869L-282.721,-100.166L-284.015,-96.441L-285.260,-92.695L-286.457,-88.926L-287.605,-85.137L-288.705,-81.326L-289.755,-77.495L-289.755,-77.495L-292.144,-78.135L-294.533,-78.775L-296.922,-79.415L-299.311,-80.055L-301.701,-80.695L-304.090,-81.335L-306.479,-81.975L-308.869,-82.615L-311.258,-83.255L-313.647,-83.895L-316.036,-84.535L-318.426,-85.175L-320.815,-85.815L-323.204,-86.455L-325.594,-87.095L-327.983,-87.735L-330.372,-88.375L-332.761,-89.015L-335.150,-89.655L-337.540,-90.295L-334.670,-100.432L-331.543,-110.326L-328.173,-119.977L-324.575,-129.384L-320.761,-138.549L-316.746,-147.470L-312.543,-156.148L-308.166,-164.583L-303.628,-172.775L-298.944,-180.724L-294.128,-188.429L-289.193,-195.891L-284.152,-203.110L-279.020,-210.086L-273.810,-216.818L-268.536,-223.307L-263.213,-229.553L-257.852,-235.555L-252.470,-241.314L-247.078,-246.830L-247.078,-246.830L-243.520,-243.272L-239.961,-239.713L-236.403,-236.155L-232.844,-232.596L-229.286,-229.037L-225.727,-225.479L-222.169,-221.921L-218.610,-218.362L-215.052,-214.803L-211.493,-211.245L-207.935,-207.687L-204.376,-204.128L-200.818,-200.569L-197.259,-197.011L-193.701,-193.453L-190.142,-189.894L-186.584,-186.336L-183.025,-182.777L-179.467,-179.218Z","ymir":"M-247.078,-246.830L-250.282,-243.583L-253.444,-240.294L-256.563,-236.964L-259.639,-233.594L-262.672,-230.184L-265.660,-226.735L-268.604,-223.246L-271.503,-219.719L-274.357,-216.153L-277.165,-212.549L-279.927,-208.908L-282.642,-205.230L-285.310,-201.515L-287.930,-197.765L-290.502,-193.979L-293.026,-190.157L-295.500,-186.301L-297.926,-182.410L-300.301,-178.486L-302.626,-174.527L-302.626,-174.527L-306.998,-177.051L-311.370,-179.576L-315.741,-182.099L-320.113,-184.624L-324.485,-187.147L-328.856,-189.672L-333.228,-192.195L-337.599,-194.720L-341.971,-197.243L-346.343,-199.768L-350.714,-202.291L-355.086,-204.815L-359.458,-207.340L-363.829,-209.863L-368.201,-212.388L-372.573,-214.911L-376.944,-217.436L-381.316,-219.959L-385.687,-222.484L-390.059,-225.007L-392.949,-219.936L-395.776,-214.823L-398.537,-209.671L-401.234,-204.478L-403.865,-199.246L-406.430,-193.975L-408.928,-188.666L-411.358,-183.319L-413.721,-177.936L-416.015,-172.516L-418.240,-167.060L-420.396,-161.568L-422.482,-156.042L-424.496,-150.481L-426.440,-144.886L-428.311,-139.259L-430.110,-133.599L-431.836,-127.906L-433.489,-122.182L-435.068,-116.427L-435.068,-116.427L-437.359,-117.042L-439.651,-117.656L-441.943,-118.270L-444.235,-118.884L-446.527,-119.499L-448.818,-120.113L-451.110,-120.727L-453.402,-121.342L-455.693,-121.956L-457.985,-122.570L-460.277,-123.184L-462.569,-123.798L-464.861,-124.413L-467.152,-125.027L-469.444,-125.641L-471.736,-126.255L-474.028,-126.870L-476.319,-127.484L-478.611,-128.098L-480.903,-128.713L-476.808,-143.162L-472.350,-157.263L-467.546,-171.017L-462.417,-184.424L-456.982,-197.484L-451.261,-210.196L-445.273,-222.561L-439.037,-234.579L-432.573,-246.250L-425.901,-257.574L-419.039,-268.551L-412.008,-279.182L-404.827,-289.465L-397.516,-299.402L-390.093,-308.992L-382.578,-318.236L-374.992,-327.133L-367.352,-335.683L-359.680,-343.887L-351.993,-351.745L-346.747,-346.499L-341.502,-341.254L-336.256,-336.008L-331.010,-330.762L-325.764,-325.516L-320.519,-320.270L-315.273,-315.025L-310.027,-309.779L-304.781,-304.533L-299.536,-299.288L-294.290,-294.042L-289.044,-288.796L-283.798,-283.550L-278.553,-278.304L-273.307,-273.059L-268.061,-267.813L-262.815,-262.567L-257.570,-257.321L-252.324,-252.076Z","valdis":"M-90.572,-337.280L-100.713,-334.407L-110.611,-331.279L-120.266,-327.907L-129.676,-324.307L-138.843,-320.491L-147.765,-316.475L-156.444,-312.271L-164.879,-307.893L-173.070,-303.356L-181.017,-298.672L-188.721,-293.856L-196.180,-288.921L-203.396,-283.882L-210.368,-278.751L-217.096,-273.544L-223.580,-268.273L-229.820,-262.952L-235.817,-257.596L-241.569,-252.217L-247.078,-246.830L-247.078,-246.830L-252.324,-252.076L-257.570,-257.321L-262.815,-262.567L-268.061,-267.813L-273.307,-273.059L-278.553,-278.304L-283.798,-283.550L-289.044,-288.796L-294.290,-294.042L-299.536,-299.288L-304.781,-304.533L-310.027,-309.779L-315.273,-315.025L-320.519,-320.270L-325.764,-325.516L-331.010,-330.762L-336.256,-336.008L-341.502,-341.254L-346.747,-346.499L-351.993,-351.745L-347.368,-356.310L-342.684,-360.815L-337.942,-365.259L-333.142,-369.642L-328.286,-373.962L-323.372,-378.220L-318.403,-382.414L-313.379,-386.544L-308.300,-390.610L-303.167,-394.610L-297.981,-398.544L-292.742,-402.411L-287.451,-406.212L-282.108,-409.944L-276.714,-413.608L-271.270,-417.203L-265.777,-420.729L-260.234,-424.184L-254.643,-427.568L-249.005,-430.880L-249.005,-430.880L-247.818,-428.825L-246.632,-426.771L-245.445,-424.716L-244.259,-422.662L-243.072,-420.607L-241.885,-418.552L-240.699,-416.498L-239.512,-414.443L-238.326,-412.388L-237.140,-410.334L-235.953,-408.279L-234.767,-406.224L-233.580,-404.170L-232.394,-402.115L-231.207,-400.061L-230.021,-398.006L-228.834,-395.951L-227.648,-393.897L-226.461,-391.842L-225.274,-389.788L-220.203,-392.679L-215.091,-395.507L-209.938,-398.270L-204.746,-400.967L-199.514,-403.599L-194.244,-406.164L-188.936,-408.663L-183.590,-411.094L-178.208,-413.457L-172.789,-415.752L-167.333,-417.977L-161.843,-420.133L-156.318,-422.219L-150.758,-424.234L-145.165,-426.177L-139.539,-428.049L-133.880,-429.848L-128.189,-431.574L-122.467,-433.227L-116.714,-434.805L-116.714,-434.805L-115.406,-429.929L-114.099,-425.052L-112.792,-420.176L-111.485,-415.300L-110.178,-410.424L-108.871,-405.547L-107.564,-400.671L-106.257,-395.795L-104.950,-390.919L-103.643,-386.042L-102.336,-381.166L-101.028,-376.290L-99.721,-371.414L-98.414,-366.537L-97.107,-361.661L-95.800,-356.785L-94.493,-351.909L-93.186,-347.032L-91.879,-342.156Z","gellert":"M116.453,-434.807L115.799,-432.370L115.145,-429.932L114.492,-427.495L113.838,-425.057L113.185,-422.619L112.531,-420.182L111.877,-417.744L111.224,-415.306L110.570,-412.869L109.916,-410.431L109.263,-407.994L108.609,-405.556L107.955,-403.118L107.302,-400.681L106.648,-398.243L105.994,-395.805L105.341,-393.368L104.687,-390.930L104.034,-388.493L103.380,-386.055L93.828,-388.482L84.149,-390.685L74.350,-392.656L64.439,-394.393L54.422,-395.889L44.306,-397.140L34.099,-398.140L23.808,-398.884L13.441,-399.368L3.003,-399.587L-7.498,-399.534L-18.054,-399.206L-28.658,-398.597L-39.304,-397.702L-49.984,-396.516L-60.691,-395.034L-71.418,-393.251L-82.157,-391.162L-92.903,-388.761L-103.646,-386.045L-103.646,-386.045L-104.300,-388.483L-104.954,-390.921L-105.607,-393.359L-106.261,-395.797L-106.914,-398.236L-107.568,-400.674L-108.222,-403.112L-108.875,-405.550L-109.529,-407.988L-110.183,-410.426L-110.836,-412.864L-111.490,-415.302L-112.143,-417.741L-112.797,-420.179L-113.451,-422.617L-114.104,-425.055L-114.758,-427.493L-115.411,-429.931L-116.065,-432.369L-116.719,-434.807L-122.472,-433.229L-128.194,-431.576L-133.885,-429.850L-139.544,-428.051L-145.170,-426.180L-150.763,-424.236L-156.322,-422.221L-161.847,-420.136L-167.338,-417.980L-172.792,-415.754L-178.212,-413.460L-183.594,-411.097L-188.940,-408.665L-194.248,-406.167L-199.518,-403.602L-204.750,-400.970L-209.942,-398.272L-215.095,-395.509L-220.208,-392.682L-225.279,-389.790L-225.279,-389.790L-226.466,-391.845L-227.652,-393.899L-228.839,-395.954L-230.026,-398.008L-231.212,-400.063L-232.399,-402.118L-233.585,-404.172L-234.772,-406.227L-235.958,-408.282L-237.145,-410.336L-238.331,-412.391L-239.517,-414.446L-240.704,-416.500L-241.890,-418.555L-243.077,-420.609L-244.263,-422.664L-245.450,-424.719L-246.637,-426.773L-247.823,-428.828L-249.010,-430.882L-239.558,-436.215L-229.771,-441.453L-219.652,-446.576L-209.205,-451.567L-198.433,-456.404L-187.339,-461.070L-175.927,-465.544L-164.199,-469.807L-152.160,-473.841L-139.812,-477.625L-127.160,-481.140L-114.206,-484.367L-100.953,-487.288L-87.406,-489.881L-73.568,-492.129L-59.441,-494.011L-45.030,-495.508L-30.336,-496.602L-15.366,-497.272L-0.120,-497.500L-0.120,-497.500L-0.120,-495.128L-0.120,-492.756L-0.120,-490.384L-0.120,-488.012L-0.120,-485.640L-0.120,-483.268L-0.120,-480.896L-0.120,-478.524L-0.120,-476.152L-0.120,-473.780L-0.120,-471.408L-0.120,-469.036L-0.120,-466.664L-0.120,-464.292L-0.120,-461.920L-0.120,-459.548L-0.120,-457.176L-0.120,-454.804L-0.120,-452.432L-0.120,-450.060L5.918,-450.020L11.936,-449.902L17.936,-449.705L23.915,-449.429L29.873,-449.076L35.810,-448.647L41.726,-448.140L47.620,-447.557L53.492,-446.899L59.340,-446.166L65.165,-445.358L70.966,-444.476L76.742,-443.520L82.494,-442.491L88.220,-441.390L93.920,-440.216L99.594,-438.970L105.241,-437.653L110.861,-436.265L116.453,-434.807Z","hawking":"M248.744,-430.890L246.295,-426.650L243.847,-422.410L241.399,-418.170L238.950,-413.930L236.502,-409.691L234.054,-405.451L231.606,-401.211L229.157,-396.971L226.709,-392.731L224.261,-388.491L221.812,-384.251L219.364,-380.011L216.916,-375.772L214.467,-371.532L212.019,-367.292L209.571,-363.052L207.123,-358.812L204.674,-354.572L202.226,-350.332L199.778,-346.092L195.275,-348.659L190.736,-351.169L186.161,-353.621L181.550,-356.016L176.905,-358.352L172.225,-360.629L167.512,-362.847L162.765,-365.005L157.986,-367.103L153.174,-369.139L148.330,-371.115L143.455,-373.029L138.549,-374.880L133.612,-376.669L128.646,-378.394L123.650,-380.056L118.625,-381.653L113.572,-383.186L108.491,-384.653L103.382,-386.055L103.382,-386.055L104.036,-388.493L104.690,-390.930L105.343,-393.368L105.997,-395.805L106.651,-398.243L107.304,-400.681L107.958,-403.118L108.612,-405.556L109.265,-407.994L109.919,-410.431L110.572,-412.869L111.226,-415.306L111.880,-417.744L112.533,-420.182L113.187,-422.619L113.841,-425.057L114.494,-427.495L115.148,-429.932L115.802,-432.370L116.455,-434.807L110.864,-436.265L105.244,-437.653L99.597,-438.970L93.923,-440.216L88.223,-441.390L82.496,-442.491L76.745,-443.520L70.968,-444.476L65.167,-445.358L59.342,-446.166L53.494,-446.899L47.623,-447.557L41.729,-448.140L35.813,-448.647L29.875,-449.076L23.917,-449.429L17.938,-449.705L11.939,-449.902L5.920,-450.020L-0.118,-450.060L-0.118,-450.060L-0.118,-452.432L-0.118,-454.804L-0.118,-457.176L-0.118,-459.548L-0.118,-461.920L-0.118,-464.292L-0.118,-466.664L-0.118,-469.036L-0.118,-471.408L-0.118,-473.780L-0.118,-476.152L-0.118,-478.524L-0.118,-480.896L-0.118,-483.268L-0.118,-485.640L-0.118,-488.012L-0.118,-490.384L-0.118,-492.756L-0.118,-495.128L-0.118,-497.500L15.093,-497.273L30.033,-496.605L44.698,-495.516L59.085,-494.023L73.191,-492.146L87.012,-489.905L100.546,-487.318L113.788,-484.404L126.735,-481.183L139.385,-477.673L151.732,-473.893L163.775,-469.863L175.511,-465.601L186.934,-461.127L198.042,-456.460L208.833,-451.618L219.301,-446.621L229.445,-441.489L239.260,-436.238L248.744,-430.890Z","lestrade":"M434.843,-116.358L432.404,-115.704L429.966,-115.051L427.528,-114.398L425.090,-113.745L422.652,-113.092L420.214,-112.439L417.776,-111.786L415.338,-111.133L412.900,-110.479L410.461,-109.826L408.023,-109.173L405.585,-108.520L403.147,-107.867L400.709,-107.214L398.271,-106.561L395.832,-105.907L393.394,-105.254L390.956,-104.601L388.518,-103.948L386.080,-103.295L384.407,-109.367L382.242,-116.700L379.533,-125.191L376.228,-134.736L372.274,-145.232L367.619,-156.573L362.213,-168.657L356.001,-181.380L348.934,-194.638L340.957,-208.327L332.020,-222.343L322.071,-236.583L311.057,-250.943L298.926,-265.318L285.626,-279.606L271.106,-293.702L255.313,-307.502L238.195,-320.903L219.701,-333.801L199.778,-346.092L199.778,-346.092L202.226,-350.332L204.674,-354.572L207.123,-358.812L209.571,-363.052L212.019,-367.292L214.467,-371.532L216.916,-375.772L219.364,-380.011L221.812,-384.251L224.261,-388.491L226.709,-392.731L229.157,-396.971L231.606,-401.211L234.054,-405.451L236.502,-409.691L238.950,-413.930L241.399,-418.170L243.847,-422.410L246.295,-426.650L248.744,-430.890L260.703,-423.747L272.366,-416.334L283.731,-408.660L294.798,-400.736L305.567,-392.574L316.036,-384.184L326.206,-375.575L336.076,-366.760L345.645,-357.748L354.913,-348.551L363.879,-339.178L372.543,-329.641L380.904,-319.950L388.962,-310.116L396.717,-300.149L404.167,-290.060L411.313,-279.860L418.153,-269.559L424.688,-259.168L430.916,-248.698L430.916,-248.698L428.862,-247.511L426.807,-246.325L424.752,-245.140L422.698,-243.953L420.643,-242.768L418.588,-241.581L416.534,-240.395L414.479,-239.210L412.424,-238.023L410.370,-236.838L408.315,-235.651L406.260,-234.465L404.206,-233.280L402.151,-232.093L400.096,-230.908L398.042,-229.721L395.987,-228.535L393.933,-227.350L391.878,-226.163L389.823,-224.978L392.716,-219.904L395.545,-214.790L398.309,-209.636L401.008,-204.441L403.640,-199.207L406.206,-193.934L408.705,-188.623L411.136,-183.274L413.499,-177.888L415.793,-172.466L418.018,-167.007L420.174,-161.514L422.259,-155.985L424.273,-150.422L426.216,-144.825L428.087,-139.196L429.886,-133.534L431.612,-127.839L433.264,-122.114L434.843,-116.358Z","sten":"M480.657,128.963L478.365,128.348L476.073,127.734L473.781,127.120L471.489,126.505L469.198,125.891L466.906,125.277L464.614,124.663L462.322,124.048L460.030,123.434L457.739,122.820L455.447,122.206L453.155,121.592L450.864,120.977L448.572,120.363L446.280,119.749L443.988,119.134L441.697,118.520L439.405,117.906L437.113,117.292L434.821,116.677L436.278,111.087L437.664,105.469L438.980,99.823L440.225,94.150L441.398,88.451L442.498,82.726L443.527,76.975L444.482,71.199L445.364,65.399L446.171,59.575L446.904,53.727L447.562,47.857L448.145,41.964L448.651,36.049L449.081,30.112L449.434,24.155L449.709,18.177L449.906,12.179L450.025,6.162L450.065,0.125L450.065,0.125L447.541,0.125L445.018,0.125L442.494,0.125L439.970,0.125L437.447,0.125L434.923,0.125L432.400,0.125L429.876,0.125L427.353,0.125L424.829,0.125L422.306,0.125L419.782,0.125L417.259,0.125L414.735,0.125L412.212,0.125L409.688,0.125L407.165,0.125L404.641,0.125L402.118,0.125L399.594,0.125L399.559,-5.231L399.454,-10.571L399.280,-15.892L399.036,-21.197L398.723,-26.483L398.343,-31.751L397.894,-37.000L397.378,-42.228L396.795,-47.438L396.145,-52.627L395.430,-57.794L394.648,-62.941L393.801,-68.066L392.890,-73.169L391.913,-78.249L390.873,-83.306L389.769,-88.340L388.602,-93.350L387.372,-98.335L386.080,-103.295L386.080,-103.295L388.518,-103.948L390.956,-104.601L393.394,-105.254L395.832,-105.907L398.271,-106.561L400.709,-107.214L403.147,-107.867L405.585,-108.520L408.023,-109.173L410.461,-109.826L412.900,-110.479L415.338,-111.133L417.776,-111.786L420.214,-112.439L422.652,-113.092L425.090,-113.745L427.528,-114.398L429.966,-115.051L432.404,-115.704L434.843,-116.358L433.264,-122.114L431.612,-127.839L429.886,-133.534L428.087,-139.196L426.216,-144.825L424.273,-150.422L422.259,-155.985L420.174,-161.514L418.019,-167.007L415.794,-172.466L413.499,-177.888L411.136,-183.274L408.705,-188.623L406.207,-193.934L403.641,-199.207L401.009,-204.441L398.311,-209.636L395.547,-214.790L392.719,-219.904L389.826,-224.978L389.826,-224.978L391.880,-226.163L393.935,-227.350L395.990,-228.535L398.044,-229.721L400.099,-230.908L402.154,-232.093L404.208,-233.280L406.263,-234.465L408.318,-235.651L410.372,-236.838L412.427,-238.023L414.482,-239.210L416.536,-240.395L418.591,-241.581L420.645,-242.768L422.700,-243.953L424.755,-245.140L426.809,-246.325L428.864,-247.511L430.919,-248.698L440.950,-230.496L450.127,-212.068L458.457,-193.438L465.952,-174.633L472.622,-155.678L478.478,-136.600L483.528,-117.424L487.785,-98.176L491.258,-78.883L493.957,-59.569L495.893,-40.262L497.076,-20.986L497.515,-1.768L497.222,17.366L496.207,36.390L494.480,55.279L492.051,74.007L488.931,92.547L485.129,110.874L480.657,128.963Z"};
    function sectorKey(name) { return clean(name).toLowerCase().replace(/[^a-z0-9]/g,''); }
    function buildSectorGeometry(points) {
        const names=new Map(points.map(p=>[sectorKey(p.raw.sector),clean(p.raw.sector)]));
        const signature=JSON.stringify([...names].sort());
        if(geometryCache?.signature===signature) return geometryCache.sectors;
        const sectors=new Map();
        Object.entries(SECTOR_OUTLINES).forEach(([key,path])=>{
            const name=names.get(key)||key;
            sectors.set(name,{name,paths:[path],edges:new Map([['outline',path]])});
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
            // Durante defesa, a posse ainda é humana; a invasão também colore o setor.
            if(raw.event) {
                const invading=factionKey(raw.event.faction);
                if(invading!=='human' && invading!=='unknown') owners.get(name).add(invading);
            }
        });
        buildSectorGeometry(points).forEach(sector=>{
            const enemies=[...(owners.get(sector.name)||[])].sort();
            let paint='#454b52';
            if(enemies.length) {
                paint=FACTION_COLORS[enemies[0]];
                if(enemies.length>1) {
                    const gradientId='sector-blend-'+enemies.join('-');
                    const defs=$('mapa-svg').querySelector('defs');
                    if(!defs.querySelector('#'+gradientId)) {
                        const gradient=svgEl('linearGradient',{id:gradientId,x1:'0%',y1:'0%',x2:'100%',y2:'100%'});
                        enemies.forEach((key,i)=>gradient.appendChild(svgEl('stop',{offset:`${i/(enemies.length-1)*100}%`,'stop-color':FACTION_COLORS[key]})));
                        defs.appendChild(gradient);
                    }
                    paint=`url(#${gradientId})`;
                }
                territories.appendChild(svgEl('path',{class:'mapa-sector-fill',d:sector.paths.join(' '),fill:paint,'fill-opacity':.20,'data-sector':sector.name}));
            }
            outlines.appendChild(svgEl('path',{
                class:'mapa-sector-border'+(enemies.length?' sector-enemy':''),
                d:[...sector.edges.values()].join(' '),
                style:`--sector-color:${paint}`,
                'vector-effect':'non-scaling-stroke','data-sector':sector.name
            }));
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
            rec.base?.classList.toggle('route-connected', connected);
            rec.line.classList.toggle('route-connected', connected);
            rec.base?.classList.toggle('route-muted', selectedIndex != null && !connected);
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
            human:{x:0,y:0,w:100,h:100},
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

    // Marcações editoriais, independentes dos efeitos ao vivo da API.
    const MAP_BOSS_MARKERS = {
        omicron: [
            {name:'Hive Lord',file:'hive-lord.svg'},
            {name:'Draco Barata',file:'draco-barata.svg'}
        ]
    };
    function drawOuterFactionNames(viewport, defs) {
        const group=svgEl('g',{class:'mapa-outer-factions','pointer-events':'none','aria-label':'Frentes das facções'});
        // Arcos fora do raio 500; margem do viewBox já comporta raio 535.
        const labels=[
            {key:'automaton',name:'AUTÔMATOS',a:215,b:260},
            {key:'terminid',name:'TERMINÍDEOS',a:280,b:325},
            {key:'illuminate',name:'ILUMINADOS',a:113,b:67}
        ];
        labels.forEach(({key,name,a,b})=>{
            const point=angle=>[535*Math.cos(angle*Math.PI/180),535*Math.sin(angle*Math.PI/180)];
            const start=point(a),end=point(b),id='mapa-faction-arc-'+key;
            defs.appendChild(svgEl('path',{id,d:`M ${start.join(' ')} A 535 535 0 0 ${b>a?1:0} ${end.join(' ')}`}));
            const label=svgEl('text',{fill:FACTION_COLORS[key],'text-anchor':'middle'});
            const text=svgEl('textPath',{href:'#'+id,startOffset:'50%'});text.textContent=name;
            label.appendChild(text);group.appendChild(label);
        });
        viewport.appendChild(group);
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

        bounds = computeBounds([...withPos.map(w => ({ x: w.x, y: w.y })), {x:-500,y:-500}, {x:500,y:500}]);
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
        const defs=buildDefs();
        const clip=svgEl('clipPath',{id:'mapa-galaxy-clip'});
        clip.appendChild(svgEl('circle',{cx:0,cy:0,r:500}));defs.appendChild(clip);
        const radial=svgEl('radialGradient',{id:'mapa-cyberstan-radial'});
        [[0,.32],[.45,.16],[1,0]].forEach(([offset,opacity])=>radial.appendChild(svgEl('stop',{offset, 'stop-color':'#ff5555','stop-opacity':opacity})));
        defs.appendChild(radial);
        // Esta imagem pertence ao mesmo grupo transformado dos planetas.
        const background=svgEl('image',{class:'mapa-galaxy-background',href:'imagens/mapa/plano-planeta.jpg',x:-500,y:-500,width:1000,height:1000,preserveAspectRatio:'xMidYMid slice','clip-path':'url(#mapa-galaxy-clip)','pointer-events':'none'});
        cartographyGroup.appendChild(background);
        svg.appendChild(defs);
        svg.appendChild(viewport);
        drawOuterFactionNames(viewport,defs);

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
                const base = isCoarseInput() ? null : svgEl('line', { ...common, class:`mapa-supply-line-base${isFront ? ' mapa-front-line-base' : ''}${activeRoute ? ' active-front-route' : ''}` });
                const line = svgEl('line', { ...common, class:`mapa-supply-line${isFront ? ' mapa-front-line' : ''}${activeRoute ? ' active-front-route' : ''}` });
                if(base) linesGroup.appendChild(base);
                linesGroup.appendChild(line);
                lineRecords.push({ a:raw.index, b:targetIndex, base, line, isFront });
            });
        });

        drawInvasions(planets,invasionGroup,mapSize);
        const normalRadius = mapSize / 260;

        withPos.forEach(({ raw, x, y }) => {
            const special=specialLocation(raw);
            const capital=isSuperEarth(raw);
            const baseRadius=normalRadius*(capital?1.9:1);
            const owner = raw.currentOwner || raw.owner;
            const fKey = factionKey(owner);
            const accent = factionColor(owner);
            const underAttack = !special && !!raw.event;
            const offensive = !special && !underAttack && campaignIndexes.has(String(raw.index)) && fKey!=='human' && fKey!=='unknown';
            const progress = underAttack ? campaignProgress(raw) : (offensive ? liberationProgress(raw) : null);
            const displayName = planetName(raw);
            const sectorName = clean(raw.sector) || 'Setor desconhecido';
            const group = svgEl('g', {
                class:'mapa-planet-group' + (special ? ' special-location' : '') + (fKey==='human' && !special && !capital && !underAttack && !campaignIndexes.has(String(raw.index)) ? ' peaceful-human' : '') + (capital ? ' super-earth' : '') + (campaignIndexes.has(String(raw.index)) ? ' campaign-active' : ' planet-inactive'), 'data-index': raw.index, 'data-faction': fKey,
                tabindex:'0', role:'button', 'aria-label':`${displayName}, ${sectorName}. Abrir informações táticas.`
            });

            if(clean(raw.name).toLowerCase()==='cyberstan') {
                const radial=svgEl('g',{class:'mapa-cyberstan-radial','pointer-events':'none'});
                // Névoa estática decorativa: sem aro, filtros SVG ou animação.
                [[-1.9,.4,3.5,2.0,-22],[1.5,-.6,3.3,1.8,18],[0,0,2.5,2.2,0]].forEach(([dx,dy,rx,ry,angle])=>{
                    const cx=x+dx*baseRadius,cy=y+dy*baseRadius;
                    radial.appendChild(svgEl('ellipse',{cx,cy,rx:rx*baseRadius,ry:ry*baseRadius,
                        fill:'url(#mapa-cyberstan-radial)',transform:`rotate(${angle} ${cx} ${cy})`}));
                });
                const title=svgEl('title');title.textContent='Névoa decorativa de Cyberstan — não indica efeito ativo da API';radial.appendChild(title);group.appendChild(radial);
            }
            const bosses=MAP_BOSS_MARKERS[clean(raw.name).toLowerCase()] || [];
            bosses.forEach((boss,index)=>{
                const size=baseRadius*2.5;
                const marker=svgEl('image',{class:'mapa-boss-marker',href:'imagens/ui/icons/'+boss.file,
                    x:x+baseRadius*(3.4+index*.7),y:y+baseRadius*(-4.5+index*3),width:size,height:size,
                    preserveAspectRatio:'xMidYMid meet',role:'img','aria-label':boss.name+' — marcação editorial'});
                const title=svgEl('title');title.textContent=boss.name+' · Marcação do portal, não confirmação ao vivo da API';
                marker.appendChild(title);group.appendChild(marker);
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
                const ringColor=underAttack?'#4da6ff':FACTION_COLORS.human;
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

            if(underAttack) {
                const enemyProgress=invasionProgress(raw),r=baseRadius*2.72,c=2*Math.PI*r;
                group.appendChild(svgEl('circle',{class:'mapa-enemy-track',cx:x,cy:y,r,fill:'none',stroke:'#303845','stroke-width':baseRadius*.32}));
                if(enemyProgress!=null) group.appendChild(svgEl('circle',{
                    class:'mapa-enemy-fill',cx:x,cy:y,r,fill:'none',stroke:factionColor(raw.event.faction),
                    'stroke-width':baseRadius*.32,'stroke-dasharray':`${c*enemyProgress/100} ${c*(1-enemyProgress/100)}`,
                    transform:`rotate(-90 ${x} ${y})`,role:'img','aria-label':`Invasão inimiga: ${formatPercentDetailed(enemyProgress)}`
                }));
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
            const iconSize = baseRadius * (fKey==='human' ? ((underAttack || offensive) ? 2.76 : 2) : ((underAttack || offensive) ? 2.05 : 1.55));
            const symbol = svgEl('use', {
                class:'mapa-planet-faction-icon',href:`#faction-icon-${fKey === 'unknown' ? 'human' : fKey}`,
                x:x-iconSize/2,y:y-iconSize/2,width:iconSize,height:iconSize,'aria-hidden':'true'
            });
            group.appendChild(symbol);
            if(special) {
                const size=baseRadius*5;
                // Símbolo de reserva se o PNG ainda não estiver instalado.
                const fallback=svgEl('text',{class:'mapa-special-fallback',x,y:y+baseRadius*.65,'text-anchor':'middle',fill:special.color,'font-size':baseRadius*3});
                fallback.textContent=special.file==='destrocos.png'?'◆':'◉';
                group.appendChild(fallback);
                const image=svgEl('image',{class:'mapa-special-icon',href:PLANET_IMG_PATH+special.file,x:x-size/2,y:y-size/2,width:size,height:size,preserveAspectRatio:'xMidYMid meet','pointer-events':'none'});
                image.addEventListener('load',()=>{fallback.style.display='none';});
                image.addEventListener('error',()=>{image.remove();fallback.style.display='';});
                group.appendChild(image);
            }
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

            if(underAttack || offensive) {
                const status=underAttack?'Defesa':'Libertação';
                const icon=svgEl('image',{class:'mapa-event-icon',href:'imagens/ui/icons/'+(underAttack?'defesa.png':'libertacao-v2.png'),
                    x:x-baseRadius*4.2,y:y-baseRadius*5,width:baseRadius*2.2,height:baseRadius*2.2,
                    preserveAspectRatio:'xMidYMid meet',role:'img','aria-label':status});
                const title=svgEl('title');title.textContent=status;icon.appendChild(title);group.appendChild(icon);
            }
            if (underAttack) {
                const attacker=factionKey(raw.event?.faction);
                if(attacker!=='human'&&attacker!=='unknown') {
                    const badge=svgEl('g',{class:'mapa-attacker-badge','aria-label':`Atacante: ${factionName(raw.event.faction)}`});
                    badge.appendChild(svgEl('circle',{cx:x+baseRadius*2.65,cy:y-baseRadius*2.65,r:baseRadius*1.05,fill:'#090d12',stroke:factionColor(raw.event.faction),'stroke-width':.6}));
                    badge.appendChild(svgEl('use',{href:`#faction-icon-${attacker}`,x:x+baseRadius*1.75,y:y-baseRadius*3.55,width:baseRadius*1.8,height:baseRadius*1.8}));
                    const title=svgEl('title');title.textContent='Atacante: '+factionName(raw.event.faction);badge.appendChild(title);group.appendChild(badge);
                }
                const eventLabel = svgEl('text', { class:'mapa-event-label', x, y:y-baseRadius*3.45, 'text-anchor':'middle', fill:factionColor(raw.event?.faction || owner) });
                eventLabel.textContent = formatPercentDetailed(progress);
                eventLabel.setAttribute('fill','#4da6ff');
                eventLabel.setAttribute('aria-label','Defesa: '+formatPercentDetailed(progress));
                group.appendChild(eventLabel);
                const enemyLabel=svgEl('text',{class:'mapa-event-label',x,y:y-baseRadius*6.2,'text-anchor':'middle',fill:factionColor(raw.event.faction)});
                enemyLabel.textContent=`INVASÃO ${formatPercentDetailed(invasionProgress(raw))}`;
                group.appendChild(enemyLabel);
            } else if(offensive) {
                const eventLabel=svgEl('text',{class:'mapa-event-label',x,y:y-baseRadius*3.45,'text-anchor':'middle',fill:FACTION_COLORS.human});
                eventLabel.textContent=formatPercentDetailed(progress);
                eventLabel.setAttribute('aria-label','Libertação: '+formatPercentDetailed(progress));
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
            const matchesFaction = activeFaction === 'all' || (!specialLocation(data) && factionKey(owner) === activeFaction);
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

        const host=$('mapa-pan-host'),surface=$('mapa-pan-surface');
        let state = svg._mapaPanZoomState;
        if (state) {
            state.viewport = viewport;
            state.requestApply(true);
            return;
        }

        state = {
            viewport,
            optimized:false,
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
            const width=host.clientWidth,height=host.clientHeight,vb=svg.viewBox.baseVal;
            const fit=Math.min(width/vb.width,height/vb.height);
            const originX=(width-vb.width*fit)/2-vb.x*fit;
            const originY=(height-vb.height*fit)/2-vb.y*fit;
            const tx=(1-state.scale)*originX+fit*state.tx;
            const ty=(1-state.scale)*originY+fit*state.ty;
            if(state.optimized) {
                vp.removeAttribute('transform');
                surface.style.transform=`translate3d(${tx}px,${ty}px,0) scale(${state.scale})`;
            } else {
                surface.style.transform='none';
                vp.setAttribute('transform',`translate(${state.tx},${state.ty}) scale(${state.scale})`);
            }
            // Tamanho final das setas independente do motor SVG/CSS.
            const arrowScale=fit*state.scale;
            const arrowKey=String(arrowScale);
            if(vp.dataset.arrowScale!==arrowKey && arrowScale>0) {
                vp.dataset.arrowScale=arrowKey;
                vp.style.setProperty('--mapa-arrow-width',String(1.4/arrowScale));
                for(const key of ['human','automaton','terminid','illuminate']) {
                    const marker=svg.querySelector('#invasion-arrow-'+key);
                    if(marker) {
                        marker.setAttribute('markerWidth',String(7/arrowScale));
                        marker.setAttribute('markerHeight',String(7/arrowScale));
                    }
                }
            }
            const detailKey=[state.scale>=LABEL_ZOOM_THRESHOLD,state.scale>=5,state.scale>=DETAIL_ZOOM_THRESHOLD,state.scale<LOW_DETAIL_THRESHOLD,state.scale>=4.2].join();
            if(!state.activePointers.size && vp.dataset.detailKey!==detailKey) {
            vp.dataset.detailKey=detailKey;
            vp.classList.toggle('mapa-labels-on', state.scale >= LABEL_ZOOM_THRESHOLD);
            vp.classList.toggle('mapa-human-details-on', state.scale >= 5);
            vp.classList.toggle('mapa-detail-on', state.scale >= DETAIL_ZOOM_THRESHOLD);
            vp.classList.toggle('mapa-low-detail', state.scale < LOW_DETAIL_THRESHOLD);
            vp.classList.toggle('mapa-sector-fade', state.scale >= 4.2);
            }
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
            const rect=host.getBoundingClientRect(),vb=svg.viewBox.baseVal;
            const x=(clientX-rect.left)*host.clientWidth/rect.width;
            const y=(clientY-rect.top)*host.clientHeight/rect.height;
            const fit=Math.min(host.clientWidth/vb.width,host.clientHeight/vb.height);
            return {x:(x-(host.clientWidth-vb.width*fit)/2)/fit+vb.x,
                    y:(y-(host.clientHeight-vb.height*fit)/2)/fit+vb.y};
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

        host.addEventListener('wheel', event => {
            event.preventDefault();
            state.zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.18 : 1 / 1.18);
        }, { passive:false });

        host.addEventListener('pointerdown', event => {
            state.activePointers.set(event.pointerId, event);
            state.viewport?.classList.add('mapa-is-moving');
            state.dragRect = host.getBoundingClientRect();
            const vb = svg.viewBox.baseVal;
            state.dragViewBox = { width:vb.width, height:vb.height };
            if (event.pointerType === 'touch' && state.activePointers.size > 1) {
                state.moved=true;
                for(const id of state.activePointers.keys()) {try{host.setPointerCapture(id);}catch{}}
                return;
            }
            state.isPanning = true; state.moved = false;
            state.lastX = event.clientX; state.lastY = event.clientY;
            // Captura só ao arrastar; o toque simples continua chegando ao planeta.
        });

        host.addEventListener('pointermove', event => {
            if (!state.activePointers.has(event.pointerId)) return;
            state.activePointers.set(event.pointerId, event);
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
            if (state.moved) { try { host.setPointerCapture(event.pointerId); } catch {} }
            const rect = state.dragRect || host.getBoundingClientRect();
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
                state.requestApply();
            }
            try { host.releasePointerCapture(event.pointerId); } catch {}
        };
        host.addEventListener('pointerup', clearPointer);
        host.addEventListener('pointercancel', clearPointer);
        host.addEventListener('pointerleave', event => {
            if (event.pointerType !== 'touch') clearPointer(event);
        });

        host.addEventListener('click', event => {
            if (state.moved) { event.stopPropagation(); state.moved = false; }
        }, true);

        const bindZoomButton = (id, fn) => {
            const btn = $(id);
            if (!btn || btn.dataset.mapaBound === '1') return;
            btn.dataset.mapaBound = '1';
            btn.addEventListener('click', fn);
        };
        bindZoomButton('mapa-zoom-in', () => {
            const r=host.getBoundingClientRect(); state.zoomAt(r.left+r.width/2,r.top+r.height/2,1.35);
        });
        bindZoomButton('mapa-zoom-out', () => {
            const r=host.getBoundingClientRect(); state.zoomAt(r.left+r.width/2,r.top+r.height/2,1/1.35);
        });
        bindZoomButton('mapa-zoom-reset', () => {
            state.scale=1; state.tx=0; state.ty=0; state.requestApply(true);
        });

        const modeButton=$('mapa-optimized-toggle');
        const updateModeButton=()=>{
            host.classList.toggle('optimized-mode',state.optimized);
            modeButton.disabled=false;
            modeButton.classList.toggle('active',state.optimized);
            modeButton.setAttribute('aria-pressed',String(state.optimized));
            modeButton.textContent='Versão otimizada: '+(state.optimized?'ligada':'desligada');
        };
        modeButton.addEventListener('click',()=>{
            // Mesmo estado de navegação e mesmo DOM; sem consulta extra à API.
            state.optimized=!state.optimized;
            updateModeButton();
            state.requestApply(true);
        });
        updateModeButton();
        new ResizeObserver(()=>state.requestApply()).observe(host);
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
        $('planet-dossier-source').textContent='Bioma, estatísticas e regiões: registro do planeta na API comunitária.'+(reading?.time?' Leitura: '+new Date(reading.time).toLocaleString('pt-BR')+(reading.stale?' (dados salvos).':'.'):'')+' Efeitos: API e catálogo comunitário. Os marcados como possíveis não estão confirmados nesta leitura; condições de calor e frio podem variar.';

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

        const special=specialLocation(p);
        if(special) {
            modal.querySelector('.tactical-modal-card').style.setProperty('--accent',special.color);
            modal.querySelector('.tactical-modal-sector').textContent=special.label.toUpperCase()+' · INACESSÍVEL';
            $('planet-dossier-source').textContent='Classificação e ícone: cadastro editorial do portal. Histórico abaixo: totais acumulados retornados pela API para este planeta, quando disponíveis.';
            $('planet-dossier-advice').innerHTML='<p>Local inacessível. Não há preparação de missão aplicável.</p>';
            $('planet-dossier-regions').innerHTML='<p>Local indisponível para operações.</p>';
        }
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

            await loadDSS();
            // Une requête déjà lancée peut terminer pendant un geste.
            // Conserver le DOM affiché jusqu'au relâchement du dernier doigt.
            while($('mapa-svg')?._mapaPanZoomState?.activePointers.size) {
                await new Promise(resolve=>setTimeout(resolve,100));
            }
            const selected=selectedIndex;
            const inspector=quickIntelIndex;
            const sticky=$('mapa-intel-card')?.dataset.sticky==='1';
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