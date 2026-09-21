// Atualização rápida da guerra: 30 segundos.
/* ================================================================
   HELLDIVERS-BR — CENTRAL DE GUERRA
   Frontend puro: GitHub Pages + API comunitária Helldivers 2.
   Cache local para reduzir chamadas e tratamento básico de rate-limit.
   ================================================================ */
(() => {
    'use strict';

    const API = 'https://api.helldivers2.dev/api';
    const V1 = `${API}/v1`;
    const V2 = `${API}/v2`;
    const REFRESH = 30 * 1000;
    const CACHE_KEY = 'hdbr_guerra_cache_v2';
    const ORDER_SNAPSHOT_LOCAL = 'dados/major-order.json';
    const ORDER_SNAPSHOT_RAW = 'https://raw.githubusercontent.com/mannrammstein19/Helldivers-BR/main/dados/major-order.json';
    const ORDER_SNAPSHOT_CACHE = 'hdbr_guerra_major_order_snapshot_v1';
    const ORDER_HISTORY_KEY = 'hdbr_guerra_major_order_history_v1';
    const ORDER_TASK_HISTORY_KEY = 'hdbr_guerra_major_order_task_history_v2';
    const ORDER_IMAGES = {
        active: 'imagens/fundos/major-order/major-order-ativa.png',
        completed: 'imagens/fundos/major-order/major-order-vitoria.png',
        failed: 'imagens/fundos/major-order/major-order-derrota.png',
        pending: 'imagens/fundos/major-order/major-order-ativa.png'
    };
    const CACHE_TTL = {
        campaigns: 30 * 1000,
        assignments: 60 * 1000,
        dispatches: 5 * 60 * 1000,
        dss: 2 * 60 * 1000,
        steam: 15 * 60 * 1000
    };

    const HEADERS = {
        'X-Super-Client': 'mannrammstein19.github.io/Helldivers-BR',
        'X-Super-Contact': 'https://github.com/mannrammstein19/Helldivers-BR',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.5'
    };

    let campaigns = [];
    let activeFilter = 'all';
    let dssPlanetKey = '';
    let dssPlanetName = '';

    const HISTORY_KEY = 'hdbr_planet_history_v3';
    const HISTORY_MAX_AGE = 7 * 24 * 60 * 60 * 1000;


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

    function factionName(name) {
        const n = (name || '').toLowerCase();
        if (n.includes('terminid')) return 'Terminídeos';
        if (n.includes('automaton')) return 'Autômatos';
        if (n.includes('illuminate')) return 'Iluminados';
        if (n.includes('human')) return 'Super Terra';
        return name || 'Desconhecida';
    }

    function factionClass(name) {
        const n = (name || '').toLowerCase();
        if (n.includes('terminid')) return 'terminid';
        if (n.includes('automaton')) return 'automaton';
        if (n.includes('illuminate')) return 'illuminate';
        return 'human';
    }

    function factionColor(name, defense) {
        if (defense) return '#3d9dff';
        const n = (name || '').toLowerCase();
        if (n.includes('terminid')) return '#ff9900';
        if (n.includes('automaton')) return '#ff4242';
        if (n.includes('illuminate')) return '#8b3fd6';
        return '#3d9dff';
    }

    const FACTION_LOGOS = {
        terminid: 'imagens/guerra/faccoes/logo terminids.png',
        automaton: 'imagens/guerra/faccoes/logo automatons.png',
        illuminate: 'imagens/guerra/faccoes/logo illuminats.png',
        human: 'imagens/ui/icons/logo super terra.svg'
    };
    const DEFENSE_ICON = 'imagens/ui/federacao.png';

    function factionIcon(name, defense) {
        const src = defense ? DEFENSE_ICON : (FACTION_LOGOS[factionClass(name)] || FACTION_LOGOS.human);
        const fallback = defense ? FACTION_LOGOS.human : '';
        return `<img src="${src}" alt="" class="faction-icon-img ${defense ? 'defense-faction-icon' : ''}" ${fallback ? `data-fallback="${fallback}"` : ''} onerror="if(this.dataset.fallback && this.src!==this.dataset.fallback){this.src=this.dataset.fallback}else{this.style.display='none'}">`;
    }

    // Mapeamento oficial bioma (API) -> imagem de paisagem (helldivers.wiki.gg)
    const BIOME_IMAGES = {
        'desert dunes': 'Sandy_base_Landscape.png',
        'desert cliffs': 'Sandy_spiky_Landscape.png',
        'acidic badlands': 'Sandy_acid_Landscape.png',
        'rocky canyons': 'Sandy_mineral_Landscape.png',
        'moon': 'Sandy_moon_Landscape.png',
        'volcanic jungle': 'Primordial_base_Landscape.png',
        'deadlands': 'Primordial_dead_Landscape.png',
        'ethereal jungle': 'Primordial_purple_Landscape.png',
        'ionic jungle': 'Primordial_blue_Landscape.png',
        'icy glaciers': 'Arctic_glacier_base_Landscape.png',
        'boneyard': 'Arctic_glacier_coldrocky_Landscape.png',
        'plains': 'Moor_baseplanet_Landscape.png',
        'tundra': 'Moor_tundra_Landscape.png',
        'scorched moor': 'Moor_arid_Landscape.png',
        'ionic crimson': 'Moor_red_Landscape.png',
        'basic swamp': 'Swamp_base_Landscape.png',
        'haunted swamp': 'Swamp_haunted_Landscape.png',
        'hive world': 'Bug_hiveworld_Landscape.png',
        'supercolony': 'Supercolony_Landscape.png',
        'magma desert': 'Magma_Base_Landscape.png',
        'cyberstan megafactory': 'Cyberstan_landscape.png',
        'super earth metropolis': 'Super_Earth_landscape.png',
        'void source forest': 'Void_Source_Planet_Landscape_Void_Header.png'
    };
    const BIOME_IMG_PATH = 'imagens/planetas/';
    const BIOME_FALLBACK = 'Sandy_base_Landscape.png';

    // Exceções visuais por planeta.
    // A imagem específica do planeta tem prioridade sobre o bioma.
    // Os índices 262 (K) e 269 (Brilliance) são os índices oficiais dos planetas.
    // Assim, mesmo que a API altere/normalize o nome do bioma, a arte correta permanece.
    const PLANET_IMAGES = {
        '262': 'Magma_Base_Landscape.png',
        '269': 'Brilliance_Planet_Landscape_Header.jpg'
    };
    const PLANET_IMAGES_BY_NAME = {
        'k': 'Magma_Base_Landscape.png',
        'brilliance': 'Brilliance_Planet_Landscape_Header.jpg'
    };
    const PLANET_CATALOG_URL = 'https://raw.githubusercontent.com/helldivers-2/json/master/planets/planets.json';
    let planetCatalog = {};
    let planetCatalogPromise = null;

    async function loadPlanetCatalog() {
        if (planetCatalogPromise) return planetCatalogPromise;
        planetCatalogPromise = fetch(PLANET_CATALOG_URL, { cache:'force-cache' })
            .then(r => r.ok ? r.json() : {})
            .then(data => { planetCatalog = data && typeof data === 'object' ? data : {}; if (campaigns.length) renderFrontCards(); return planetCatalog; })
            .catch(() => (planetCatalog = {}));
        return planetCatalogPromise;
    }

    function catalogPlanet(p) {
        return planetCatalog[String(p?.index)] || {};
    }

    function biomeImageUrl(biomeName) {
        const key = (biomeName || '').toLowerCase().trim();
        const file = BIOME_IMAGES[key] || BIOME_FALLBACK;
        return BIOME_IMG_PATH + file;
    }

    function planetImageUrl(planet) {
        const index = String(planet?.index ?? '').trim();
        const name = clean(planet?.name).toLowerCase().trim();
        const specific = PLANET_IMAGES[index] || PLANET_IMAGES_BY_NAME[name];
        return BIOME_IMG_PATH + (specific || BIOME_IMAGES[(clean(planet?.biome?.name) || '').toLowerCase().trim()] || BIOME_FALLBACK);
    }

    const HAZARD_INFO = {
        'extreme cold': { name:'Frio Extremo', icon:'❄', file:'Extreme Cold.png', wikiFile:'Extreme Cold Environmental Condition Icon.svg', description:'Temperaturas extremamente baixas alteram as condições térmicas do combate.', recommendation:'Armas que dependem de calor podem se beneficiar de um resfriamento mais rápido.' },
        'blizzards': { name:'Tempestades de Neve', icon:'❄', file:'Blizzards.png', wikiFile:'Blizzards Environmental Condition Icon.svg', description:'Tempestades de neve reduzem a visibilidade e tornam a operação mais difícil.', recommendation:'Avance com atenção e mantenha a equipe próxima quando a visibilidade cair.' },
        'meteor storms': { name:'Tempestades de Meteoros', icon:'☄', file:'Meteor Storms.png', wikiFile:'Meteor Storms Environmental Condition Icon.svg', description:'Impactos de meteoros podem atingir a superfície durante a operação.', recommendation:'Evite permanecer parado em áreas abertas e observe o terreno durante a tempestade.' },
        'rainstorms': { name:'Tempestades de Chuva', icon:'☔', file:'Rainstorms.png', wikiFile:'Rainstorms Environmental Condition Icon.svg', description:'Chuvas intensas alteram a visibilidade e as condições de combate.', recommendation:'Priorize posicionamento seguro e mantenha referências visuais do terreno.' },
        'sandstorms': { name:'Tempestades de Areia', icon:'≋', file:'Sandstorms.png', wikiFile:'Sandstorms Environmental Condition Icon.svg', description:'Areia em suspensão reduz a visibilidade e pode dificultar a identificação de ameaças.', recommendation:'Mantenha a formação próxima e evite depender apenas de combate a longa distância.' },
        'thick fog': { name:'Névoa Densa', icon:'◌', file:'Thick Fog .png', wikiFile:'Thick Fog Environmental Condition Icon.svg', description:'Uma camada espessa de neblina reduz drasticamente a visibilidade.', recommendation:'Combate próximo e atenção ao minimapa ajudam a compensar a baixa visibilidade.' },
        'tremors': { name:'Tremores', icon:'≋', file:'Tremors .png', wikiFile:'Tremors Environmental Condition Icon.svg', description:'Abalos sísmicos podem interferir na movimentação durante a missão.', recommendation:'Evite avançar de forma desordenada e esteja pronto para ajustar seu posicionamento.' },
        'volcanic activity': { name:'Atividade Vulcânica', icon:'🌋', file:'Volcanic Activity.png', wikiFile:'Volcanic Activity Environmental Condition Icon.svg', description:'Atividade vulcânica torna o ambiente mais hostil e imprevisível.', recommendation:'Use cobertura e mantenha uma rota de retirada quando o terreno ficar perigoso.' },
        'intense heat': { name:'Calor Intenso', icon:'🔥', file:'Intense Heat.png', wikiFile:'Intense Heat Environmental Condition Icon.svg', description:'Temperaturas elevadas aumentam a pressão sobre equipamentos sensíveis ao calor.', recommendation:'Gerencie o superaquecimento e evite depender excessivamente de armas que acumulam calor.' },
        'fire tornadoes': { name:'Tornados de Fogo', icon:'🌪', file:'Fire Tornados.png', wikiFile:'Fire Tornados Environmental Condition Icon.svg', description:'Tornados de fogo atravessam a superfície e criam zonas de alto risco.', recommendation:'Não atravesse as áreas em chamas; espere uma abertura segura ou contorne o perigo.' },
        'acid storms': { name:'Tempestades Ácidas', icon:'☣', file:'Acid Storms.png', wikiFile:'Acid Storms Environmental Condition Icon.svg', description:'Precipitações corrosivas tornam a operação ainda mais perigosa.', recommendation:'Redobre a atenção ao terreno e evite permanecer exposto desnecessariamente.' },
        'heavy gloom shroud': { name:'Manto de Escuridão Intensa', icon:'◐', file:'Heavy Gloom Shroud .png', wikiFile:'Heavy Gloom Shroud Environmental Condition Icon.svg', description:'Uma escuridão intensa reduz a leitura do campo de batalha.', recommendation:'Mantenha a equipe coordenada e use ferramentas de reconhecimento sempre que possível.' },
        'ion storms': { name:'Tempestades de Íons', icon:'⚡', file:'Ion Storms.png', wikiFile:'Ion Storms Environmental Condition Icon.svg', description:'Tempestades de íons interferem nas condições eletrônicas da operação.', recommendation:'Planeje o uso de equipamentos dependentes de suporte e esteja preparado para interrupções.' }
    };
    const HAZARD_ICON_PATH = 'imagens/ui/efeito-planeta/';
    const WIKI_FILE = name => `https://helldivers.wiki.gg/wiki/Special:Redirect/file/${encodeURIComponent(name)}`;

    function hazardIconSources(info) {
        if (!info || !info.file) return [];
        const local = HAZARD_ICON_PATH + info.file;
        const wikiName = info.wikiFile || `${info.name} Environmental Condition Icon.svg`;
        return [local, WIKI_FILE(wikiName)];
    }

    function iconHTML(info, cls='hazard-img') {
        const sources = hazardIconSources(info);
        if (!sources.length) return `<span class=\"hazard-fallback\">${info?.icon || '⚠'}</span>`;
        const encoded = sources.map(s => escapeHTML(s.replace(/\\/g, '\\')));
        return `<img src=\"${encoded[0]}\" alt=\"\" class=\"${cls}\" data-fallback=\"${encoded[1] || ''}\" onerror=\"if(this.dataset.fallback && this.src!==this.dataset.fallback){this.src=this.dataset.fallback}else{this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='inline'}\">`;
    }

    function hazardInfo(name) {
        const n = (name || '').toLowerCase();
        const key = Object.keys(HAZARD_INFO).find(k => n.includes(k));
        return key ? { ...HAZARD_INFO[key], key } : {
            name: clean(name) || 'Efeito desconhecido', icon:'⚠', file:'',
            description:'Condição ambiental detectada pela telemetria do planeta.',
            recommendation:'Adapte o equipamento e o posicionamento às condições da missão.', key:''
        };
    }

    function hazardIcon(name) { return hazardInfo(name).icon; }

    const EXTRA_EFFECT_INFO = {
        'normal temp': { name:'Temperatura Normal', icon:'◉', file:'', description:'Condição térmica estável para operações regulares.', recommendation:'Nenhuma adaptação térmica especial necessária.' },
        'normal_temp': { name:'Temperatura Normal', icon:'◉', file:'', description:'Condição térmica estável para operações regulares.', recommendation:'Nenhuma adaptação térmica especial necessária.' },
        'none': { name:'Sem efeitos ambientais adicionais', icon:'○', file:'', description:'Nenhuma condição ambiental adicional foi registrada.', recommendation:'Equipamento padrão recomendado.' }
    };

    function effectInfo(name) {
        const raw = clean(name);
        const key = raw.toLowerCase().replace(/[_-]+/g,' ');
        if (HAZARD_INFO[key]) return { ...HAZARD_INFO[key], key };
        const hazardKey = Object.keys(HAZARD_INFO).find(k => key.includes(k));
        if (hazardKey) return { ...HAZARD_INFO[hazardKey], key:hazardKey };
        if (EXTRA_EFFECT_INFO[key]) return { ...EXTRA_EFFECT_INFO[key], key };
        // Cepas e subfacções específicas: sempre que a API entregar o nome exato
        // da cepa/subfação, mantemos essa informação em vez de generalizar para
        // "Presença de Autômatos/Terminídeos/Iluminados".
        const SUBFACTIONS = {
            'jet brigade': { name:'Brigada a Jato', desc:'Divisão de Autômatos equipada com mochilas propulsoras, capaz de flanquear e perseguir Helldivers por cima do terreno.', rec:'Mantenha distância vertical e cuidado com ataques vindos de cima; armas de área ajudam contra grupos aéreos.' },
            'incineration corps': { name:'Corpo de Incineração', desc:'Divisão de Autômatos especializada em unidades incendiárias e lança-chamas.', rec:'Leve resistência a fogo/armadura térmica e evite ficar preso em corredores estreitos com inimigos incendiários.' },
            'cyborg': { name:'Ciborgues', desc:'Unidades Autômatos com blindagem orgânico-mecânica reforçada, mais resistentes que os modelos padrão.', rec:'Priorize armas com penetração mais alta; combate corpo a corpo é mais arriscado contra essas unidades.' },
            'cyborgs': { name:'Ciborgues', desc:'Unidades Autômatos com blindagem orgânico-mecânica reforçada, mais resistentes que os modelos padrão.', rec:'Priorize armas com penetração mais alta; combate corpo a corpo é mais arriscado contra essas unidades.' },
            'predator strain': { name:'Cepa Predadora', desc:'Cepa de Terminídeos voltada para caça e emboscada, com unidades mais agressivas e rápidas.', rec:'Evite avançar sozinho e mantenha rotas de fuga claras contra emboscadas.' },
            'spore burst strain': { name:'Cepa de Esporos', desc:'Cepa de Terminídeos que libera nuvens de esporos, reduzindo visibilidade e causando dano contínuo.', rec:'Máscaras e proteção contra gás/esporos ajudam a mitigar o dano ambiental dessa cepa.' },
            'spore': { name:'Cepa de Esporos', desc:'Cepa de Terminídeos que libera nuvens de esporos, reduzindo visibilidade e causando dano contínuo.', rec:'Máscaras e proteção contra gás/esporos ajudam a mitigar o dano ambiental dessa cepa.' },
            'rupture strain': { name:'Cepa Rompedora', desc:'Cepa de Terminídeos com unidades que explodem ou se rompem ao morrer, causando dano em área.', rec:'Mantenha distância ao abater unidades dessa cepa para evitar dano por explosão.' },
            'dragonroaches': { name:'Dracobaratas', desc:'Enxame de Terminídeos voadores que atacam em grande número.', rec:'Armas de disparo rápido e cobertura aérea ajudam a lidar com esses enxames.' },
            'hive lords': { name:'Senhores da Colmeia', desc:'Unidades Terminídeos de elite associadas à liderança da colmeia, geralmente mais resistentes.', rec:'Reserve armamento anti-blindagem para essas unidades.' },
            'great host': { name:'A Grande Horda', desc:'Subfação Iluminada associada a grandes contingentes de tropas em uma mesma frente.', rec:'Espere maior volume de inimigos simultâneos; priorize controle de área.' },
            'mindless masses': { name:'Massas Inconscientes', desc:'Subfação Iluminada composta por unidades controladas em massa, numerosas porém previsíveis.', rec:'Armas de área são eficientes contra o grande número de unidades.' },
            'appropriators': { name:'Apropriadores', desc:'Subfação Iluminada especializada em capturar recursos e equipamentos em campo.', rec:'Proteja objetivos de extração e suprimento com prioridade.' },
            'invasion fleet': { name:'Frota de Invasão', desc:'Subfação Iluminada ligada a operações de invasão em maior escala no setor.', rec:'Espere reforços orbitais frequentes; mantenha o esquadrão coordenado.' },
            'vote snatchers': { name:'Sequestradores de Votos', desc:'Subfação Iluminada voltada à interferência em processos da Super Terra no planeta.', rec:'Priorize a conclusão rápida dos objetivos para limitar a interferência inimiga.' },
            'seaf': { name:'Forte Presença da SEAF', desc:'Forças de Defesa Auxiliar da Super Terra (SEAF) reforçadas atuando no planeta.', rec:'Aproveite o apoio da SEAF disponível na região para facilitar a operação.' }
        };
        const subKey = Object.keys(SUBFACTIONS).find(k => key.includes(k));
        if (subKey) {
            const sf = SUBFACTIONS[subKey];
            return { name: sf.name, icon:'◆', file:'', description: sf.desc, recommendation: sf.rec, key };
        }

        // "Presença de Autômatos/Terminídeos/Iluminados" foi removida.
        // A facção já é exibida separadamente no card e não é uma condição ambiental.
        const labels = {
            'support':'Suporte Operacional', 'operational support':'Suporte Operacional'
        };
        const labelKey = Object.keys(labels).find(k => key.includes(k));
        if (labelKey) return { name:labels[labelKey], icon:'◆', file:'', description:'Efeito operacional associado à situação atual do planeta.', recommendation:'Ajuste o equipamento e a composição do esquadrão à ameaça detectada.', key };
        return { name:raw || 'Efeito desconhecido', icon:'◆', file:'◆', description:'Efeito planetário ou modificador operacional detectado.', recommendation:'Consulte o estado da frente antes de iniciar a operação.', key };
    }

    function uniqueEffectNames(p, enemy, defense) {
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
            const cat = catalogPlanet(p);
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

    function effectDetails(p, enemy, defense) {
        const resolved = uniqueEffectNames(p, enemy, defense).map(effectInfo);
        // A mesma condição pode chegar da API com grafias diferentes (ex.: "Fire
        // Tornados" vindo dos hazards e "fire tornadoes" vindo do catálogo local).
        // O dedup acima é feito no texto bruto; aqui removemos duplicatas que só
        // se revelam DEPOIS de resolver para o efeito final (mesmo nome/ícone).
        const seen = new Set();
        return resolved.filter(effect => {
            const dedupeKey = (effect.key || effect.name || '').toLowerCase();
            if (seen.has(dedupeKey)) return false;
            seen.add(dedupeKey);
            return true;
        });
    }

    const DISPATCH_EXACT_PTBR = {
        'SUPER EARTH HAS LOST CONTACT WITH THE PLANET.': 'A SUPER TERRA PERDEU CONTATO COM O PLANETA.',
        'SUPER EARTH HAS REGAINED CONTACT WITH THE PLANET.': 'A SUPER TERRA RESTABELECEU O CONTATO COM O PLANETA.',
        'A NEW MAJOR ORDER HAS BEEN ISSUED.': 'UMA NOVA ORDEM MAIOR FOI EMITIDA.',
        'THE MAJOR ORDER HAS BEEN COMPLETED.': 'A ORDEM MAIOR FOI CONCLUÍDA.',
        'THE MAJOR ORDER HAS FAILED.': 'A ORDEM MAIOR FALHOU.'
    };

    const DISPATCH_WORDS_PTBR = [
        [/\bMajor Order\b/gi, 'Ordem Maior'],
        [/\bHelldivers\b/gi, 'Helldivers'],
        [/\bSuper Earth\b/gi, 'Super Terra'],
        [/\bAutomatons\b/gi, 'Autômatos'],
        [/\bAutomaton\b/gi, 'Autômato'],
        [/\bTerminids\b/gi, 'Terminídeos'],
        [/\bTerminid\b/gi, 'Terminídeo'],
        [/\bIlluminate\b/gi, 'Iluminados'],
        [/\bIlluminates\b/gi, 'Iluminados'],
        [/\bLiberation\b/gi, 'Libertação'],
        [/\bLiberate\b/gi, 'Libertar'],
        [/\bDefense\b/gi, 'Defesa'],
        [/\bDefend\b/gi, 'Defender'],
        [/\bplanet\b/gi, 'planeta'],
        [/\bsector\b/gi, 'setor'],
        [/\bgalactic war\b/gi, 'guerra galáctica'],
        [/\bfreedom\b/gi, 'liberdade'],
        [/\bmanaged democracy\b/gi, 'democracia administrada'],
        [/\bSuper Earth Armed Forces\b/gi, 'Forças Armadas da Super Terra'],
        [/\bSEAF\b/g, 'SEAF']
    ];

    function translateDispatch(value) {
        const raw = clean(value);
        if (!raw) return 'Transmissão sem conteúdo.';
        const exact = DISPATCH_EXACT_PTBR[raw.toUpperCase()];
        if (exact) return exact;
        return DISPATCH_WORDS_PTBR.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), raw);
    }

    // ================================================================
    // TRADUÇÃO AUTOMÁTICA (Ordem Maior + Despachos)
    // Usa a API gratuita MyMemory para traduzir o texto em inglês vindo
    // da API comunitária. O resultado fica guardado no localStorage,
    // então o mesmo texto nunca é traduzido duas vezes. Se a tradução
    // automática falhar (offline, fora do ar, limite atingido), caímos
    // de volta no dicionário local (translateDispatch) para não deixar
    // a tela sem nada.
    // ================================================================
    const TRANSLATE_CACHE_KEY = 'hdbr-auto-translate-v1';
    const TRANSLATE_ENDPOINT = 'https://api.mymemory.translated.net/get';

    function readTranslateCache() {
        try { return JSON.parse(localStorage.getItem(TRANSLATE_CACHE_KEY) || '{}'); } catch { return {}; }
    }
    function writeTranslateCache(cache) {
        try { localStorage.setItem(TRANSLATE_CACHE_KEY, JSON.stringify(cache)); } catch {}
    }

    async function autoTranslate(value) {
        const raw = clean(value);
        if (!raw) return '';
        if (/^(major order|pedido principal|ordem maior)$/i.test(raw)) return 'ORDEM MAIOR';

        const cache = readTranslateCache();
        if (cache[raw]) return cache[raw];

        try {
            const url = `${TRANSLATE_ENDPOINT}?q=${encodeURIComponent(raw)}&langpair=en|pt-br`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`tradução HTTP ${response.status}`);
            const data = await response.json();
            const translated = clean(data?.responseData?.translatedText);
            if (!translated || data.responseStatus !== 200) throw new Error('resposta de tradução inválida');

            cache[raw] = translated;
            writeTranslateCache(cache);
            return translated;
        } catch (err) {
            console.warn('[Helldivers-BR] tradução automática indisponível, usando dicionário local:', err);
            return translateDispatch(raw);
        }
    }

    function relativeDate(iso) {
        if (!iso) return '';
        const diff = Date.now() - new Date(iso).getTime();
        if (!Number.isFinite(diff)) return '';
        const min = Math.floor(diff / 60000);
        if (min < 1) return 'agora';
        if (min < 60) return `há ${min}min`;
        const h = Math.floor(min / 60);
        if (h < 24) return `há ${h}h`;
        return `há ${Math.floor(h / 24)}d`;
    }

    function remaining(iso) {
        if (!iso) return 'prazo indisponível';
        const sec = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
        if (sec <= 0) return 'prazo esgotado';
        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        const m = Math.floor((sec % 3600) / 60);
        if (d) return `${d}d ${h}h restantes`;
        if (h) return `${h}h ${m}min restantes`;
        return `${m}min restantes`;
    }

    function readCache() {
        try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
    }
    function writeCache(cache) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
    }

    async function fetchJSON(url, cacheName, force = false) {
        const cache = readCache();
        const now = Date.now();
        const saved = cache[cacheName];
        if (!force && saved && (now - saved.time) < CACHE_TTL[cacheName]) return saved.data;

        const response = await fetch(url, { headers: HEADERS, cache: 'no-store' });
        if (response.status === 429) {
            const wait = Number(response.headers.get('Retry-After') || 10);
            throw new Error(`Limite da API atingido. Aguarde ${wait}s.`);
        }
        if (!response.ok) throw new Error(`API respondeu HTTP ${response.status}`);
        const data = await response.json();
        cache[cacheName] = { time: now, data };
        writeCache(cache);
        return data;
    }

    async function fetchWithFallback(url, cacheName, renderer, validator = () => true) {
        try {
            const data = await fetchJSON(url, cacheName);
            if (!validator(data)) throw new Error('Formato inesperado recebido da API.');
            renderer(data);
            return data;
        } catch (err) {
            console.error(`[Helldivers-BR] ${cacheName}:`, err);
            renderer(null, err);
            return null;
        }
    }

    function setText(id, value) { const el = $(id); if (el) el.textContent = value; }
    function errorHTML(message) { return `<div class="error-state">⚠ ${escapeHTML(message)}</div>`; }


    function majorOrderArray(data) {
        return Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
    }

    function majorOrderPick(data) {
        return majorOrderArray(data).find(item => item && (item.title || item.briefing || item.tasks || item.progress || item.setting)) || null;
    }

    function majorOrderTitle(order) {
        const title = clean(order?.title || order?.setting?.overrideTitle);
        return !title || /^(major order|pedido principal|ordem maior)$/i.test(title) ? 'ORDEM MAIOR' : title;
    }

    function majorOrderBrief(order) {
        return clean(order?.briefing || order?.setting?.overrideBrief || order?.description || order?.setting?.taskDescription)
            || 'Detalhes da missão indisponíveis.';
    }

    function majorOrderTasks(order) {
        const tasks = Array.isArray(order?.tasks)
            ? order.tasks
            : (Array.isArray(order?.setting?.tasks) ? order.setting.tasks : []);
        if (tasks.length) return tasks.filter(Boolean);

        const goal = Number(order?.goal);
        const progress = Array.isArray(order?.progress) ? Number(order.progress[0]) : Number(order?.progress);
        return [{
            _direct:true,
            type:Number(order?.type || order?.setting?.type || 0),
            title:clean(order?.description || order?.setting?.taskDescription),
            _goal:Number.isFinite(goal) ? goal : null,
            _progress:Number.isFinite(progress) ? progress : 0,
            _faction:order?.targetFaction || order?.target || ''
        }];
    }

    function majorOrderTaskValue(task, valueType) {
        const types = Array.isArray(task?.valueTypes) ? task.valueTypes : [];
        const values = Array.isArray(task?.values) ? task.values : [];
        const index = types.indexOf(valueType);
        return index >= 0 ? values[index] : null;
    }

    function majorOrderTaskGoal(task) {
        const goal = task?._direct ? Number(task._goal) : Number(majorOrderTaskValue(task, 3));
        return Number.isFinite(goal) && goal > 0 ? goal : null;
    }

    function majorOrderTaskProgress(order, task, index) {
        if (task?._direct) return Math.max(0, Number(task._progress) || 0);
        const direct = Array.isArray(order?.progress) ? Number(order.progress[index]) : Number(task?.progress?.[0] ?? task?.progress);
        return Number.isFinite(direct) ? Math.max(0, direct) : 0;
    }

    function majorOrderTaskFactionId(task) {
        if (task?._direct) {
            if (Number.isFinite(Number(task._faction))) return Number(task._faction);
            const name = String(task._faction || '').toLowerCase();
            if (name.includes('terminid')) return 2;
            if (name.includes('automaton')) return 3;
            if (name.includes('illuminate')) return 4;
            if (name.includes('human') || name.includes('super')) return 1;
            return 0;
        }
        const id = Number(majorOrderTaskValue(task, 1));
        return Number.isFinite(id) ? id : 0;
    }

    function majorOrderTaskFactionName(task) {
        return ({1:'Super Terra',2:'Terminídeos',3:'Autômatos',4:'Iluminados'})[majorOrderTaskFactionId(task)] || '';
    }

    function majorOrderTaskFactionClass(task) {
        return ({1:'human',2:'terminid',3:'automaton',4:'illuminate'})[majorOrderTaskFactionId(task)] || 'neutral';
    }

    function majorOrderTaskPlanetIndex(task) {
        const id = Number(majorOrderTaskValue(task, 12));
        return Number.isFinite(id) && id > 0 ? id : 0;
    }

    function majorOrderPlanetName(id) {
        if (!id) return '';
        const item = planetCatalog[String(id)] || {};
        return clean(item?.name || item?.names || item?.planetName) || `PLANETA #${id}`;
    }

    function majorOrderTaskTypeName(task) {
        const map = {2:'OBJETIVO ESPECIAL',3:'ERRADICAÇÃO',9:'OBJETIVO ESPECIAL',11:'LIBERTAÇÃO',12:'DEFESA',13:'CONTROLE'};
        const type = Number(task?.type || 0);
        return map[type] || `OBJETIVO${type ? ' TIPO ' + type : ''}`;
    }

    function majorOrderTaskTitle(task, index) {
        const direct = clean(task?.title || task?.description || task?.name);
        if (direct) return direct;

        const type = Number(task?.type || 0);
        const goal = majorOrderTaskGoal(task);
        const faction = majorOrderTaskFactionName(task);
        const planet = majorOrderPlanetName(majorOrderTaskPlanetIndex(task));

        if (type === 3) return `Eliminar ${goal ? goal.toLocaleString('pt-BR') + ' ' : ''}${faction || 'inimigos'}`;
        if (type === 11) return planet ? `Liberar ${planet}` : 'Cumprir objetivo de libertação';
        if (type === 12) {
            if (planet) return `Defender ${planet}`;
            if (goal && faction) return `Defender ${goal.toLocaleString('pt-BR')} ${goal === 1 ? 'planeta' : 'planetas'} contra ${faction}`;
            if (goal) return `Concluir ${goal.toLocaleString('pt-BR')} ${goal === 1 ? 'defesa' : 'defesas'}`;
            return faction ? `Defender território contra ${faction}` : 'Defender território da Super Terra';
        }
        if (type === 13) return planet ? `Manter controle de ${planet}` : 'Manter controle do objetivo designado';
        if (planet && faction) return `${majorOrderTaskTypeName(task)} em ${planet} // ${faction}`;
        if (planet) return `${majorOrderTaskTypeName(task)} em ${planet}`;
        if (goal && faction) return `${majorOrderTaskTypeName(task)} // ${goal.toLocaleString('pt-BR')} // ${faction}`;
        if (faction) return `${majorOrderTaskTypeName(task)} // ${faction}`;
        if (goal) return `${majorOrderTaskTypeName(task)} // alvo ${goal.toLocaleString('pt-BR')}`;
        return `Objetivo ${index + 1} do Alto Comando`;
    }

    function majorOrderTaskRate(order, index, progress, goal) {
        if (!goal || goal <= 1) return null;
        const now = Date.now();
        const all = readMajorOrderStorage(ORDER_TASK_HISTORY_KEY, {});
        const orderKey = String(order?.id ?? order?.index ?? order?.id32 ?? 'ordem');
        const key = `${orderKey}:${index}:${goal}`;
        const old = all[key];

        let rate = null;
        if (old && Number(old.goal) === Number(goal)) {
            const elapsed = now - Number(old.time || 0);
            const hours = elapsed / 3600000;
            if (elapsed >= 30000 && hours > 0 && progress >= Number(old.progress || 0)) {
                rate = (progress - Number(old.progress || 0)) / hours;
            } else if (elapsed < 30000 && Number.isFinite(Number(old.rate))) {
                rate = Number(old.rate);
            }
        }

        if (!old || now - Number(old.time || 0) >= 30000) {
            all[key] = {time:now, progress, goal, rate:Number.isFinite(rate) ? rate : null};
            const keys = Object.keys(all);
            if (keys.length > 80) {
                keys.sort((a,b)=>Number(all[b]?.time||0)-Number(all[a]?.time||0))
                    .slice(80).forEach(k=>delete all[k]);
            }
            writeMajorOrderStorage(ORDER_TASK_HISTORY_KEY, all);
        }
        return Number.isFinite(rate) ? rate : null;
    }

    function majorOrderTaskPercent(progress, goal, state) {
        if (state === 'completed') return 100;
        if (!goal) return 0;
        return Math.max(0, Math.min(100, progress / goal * 100));
    }

    function majorOrderTaskDone(progress, goal, state) {
        return state === 'completed' || Boolean(goal && progress >= goal);
    }

    function majorOrderExpiration(order) {
        if (order?.expiration || order?.expiresAt || order?.expireTime) {
            return order.expiration || order.expiresAt || order.expireTime;
        }
        const seconds = Number(order?.expiresIn);
        return Number.isFinite(seconds) && seconds > 0
            ? new Date(Date.now() + seconds * 1000).toISOString()
            : null;
    }

    function majorOrderReward(order) {
        return window.HDBRRewards.render(order);
    }

    function majorOrderState(value) {
        return ['active','completed','failed','pending','unknown'].includes(value) ? value : 'active';
    }

    function readMajorOrderStorage(key, fallback=null) {
        try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
        catch { return fallback; }
    }

    function writeMajorOrderStorage(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    }

    async function loadMajorOrderSnapshot() {
        const now = Date.now();
        const cached = readMajorOrderStorage(ORDER_SNAPSHOT_CACHE, null);
        if (cached?.data && now - Number(cached.time || 0) < 300000) return cached.data;
        const stamp = Math.floor(now / 300000);
        for (const base of [ORDER_SNAPSHOT_RAW, ORDER_SNAPSHOT_LOCAL]) {
            try {
                const response = await fetch(`${base}?v=${stamp}`, {cache:'no-store'});
                if (!response.ok) continue;
                const data = await response.json();
                if (data?.order) {
                    writeMajorOrderStorage(ORDER_SNAPSHOT_CACHE, {time:now, data});
                    return data;
                }
            } catch {}
        }
        return cached?.data || null;
    }

    function majorOrderRate(progress, goal) {
        const now = Date.now();
        const old = readMajorOrderStorage(ORDER_HISTORY_KEY, null);
        writeMajorOrderStorage(ORDER_HISTORY_KEY, {time:now, progress, goal});
        if (!old || old.goal !== goal) return null;
        const hours = (now - old.time) / 3600000;
        return hours > 0 ? (progress - old.progress) / hours : null;
    }

    function majorOrderEta(progress, goal, rate) {
        if (rate == null || rate <= 0 || !goal || progress >= goal) return null;
        const hours = (goal - progress) / rate;
        if (!Number.isFinite(hours) || hours > 720) return null;
        const minutes = Math.max(1, Math.round(hours * 60));
        const days = Math.floor(minutes / 1440);
        const hrs = Math.floor((minutes % 1440) / 60);
        const mins = minutes % 60;
        return days ? `${days}d ${hrs}h` : (hrs ? `${hrs}h ${mins}min` : `${mins}min`);
    }

    function majorOrderVisual(article, state) {
        state = majorOrderState(state);
        article.classList.remove('order-active','order-completed','order-failed','order-pending','order-unknown');
        article.classList.add(`order-${state}`);
        article.style.setProperty('--major-order-image', `url("${ORDER_IMAGES[state] || ORDER_IMAGES.active}")`);
    }

    async function renderOrder(assignments) {
        const box = $('ordem-maior');
        if (!box) return;

        await loadPlanetCatalog();

        const snapshot = await loadMajorOrderSnapshot();
        const {order, state} = window.HDBROrderState.resolve(majorOrderPick(assignments), snapshot);

        if (!order) {
            box.innerHTML = '<div class="empty-state">Nenhuma Ordem Maior registrada no momento.</div>';
            return;
        }

        const tasks = majorOrderTasks(order);
        const taskData = tasks.map((task,index)=>({
            task,
            index,
            goal:majorOrderTaskGoal(task),
            progress:majorOrderTaskProgress(order, task, index)
        }));

        const completed = state === 'completed';
        const failed = state === 'failed';
        const pending = state === 'pending' || state === 'unknown';
        const doneCount = completed
            ? taskData.length
            : taskData.filter(item=>majorOrderTaskDone(item.progress,item.goal,state)).length;

        const reward = majorOrderReward(order);
        const expiration = majorOrderExpiration(order);
        const rawTitle = majorOrderTitle(order);
        const rawBriefing = majorOrderBrief(order);
        const count = taskData.length;

        const kicker = state === 'active'
            ? `ORDEM MAIOR ATIVA // ${count} ${count === 1 ? 'OBJETIVO' : 'OBJETIVOS'}`
            : completed
                ? `✓ ORDEM MAIOR CONCLUÍDA // VITÓRIA DA SUPER TERRA`
                : failed
                    ? `✕ ORDEM MAIOR PERDIDA // AGUARDANDO NOVAS ORDENS`
                    : state === 'unknown' ? 'ORDEM ENCERRADA // RESULTADO INDISPONÍVEL — AGUARDANDO NOVAS ORDENS'
                    : `◉ ORDEM SEM ATUALIZAÇÃO // AGUARDANDO CONFIRMAÇÃO DO RESULTADO`;

        const statusMain = state === 'active'
            ? 'EM ANDAMENTO'
            : completed ? 'VITÓRIA' : failed ? 'FALHA' : state === 'unknown' ? 'RESULTADO INDISPONÍVEL' : 'AGUARDANDO';

        const taskCards = taskData.map(({task,index,goal,progress})=>{
            const done = majorOrderTaskDone(progress, goal, state);
            const percent = majorOrderTaskPercent(progress, goal, state);
            const factionName = majorOrderTaskFactionName(task);
            const factionClassName = majorOrderTaskFactionClass(task);
            const planet = majorOrderPlanetName(majorOrderTaskPlanetIndex(task));
            const type = majorOrderTaskTypeName(task);
            const title = majorOrderTaskTitle(task,index);

            const rate = state === 'active' && goal && goal > 1 && !done
                ? majorOrderTaskRate(order,index,progress,goal)
                : null;
            const eta = state === 'active' && !done
                ? majorOrderEta(progress,goal,rate)
                : null;

            const progressText = goal
                ? `${(completed ? goal : progress).toLocaleString('pt-BR')} / ${goal.toLocaleString('pt-BR')}`
                : (done ? 'OBJETIVO CUMPRIDO' : 'TELEMETRIA EM ACOMPANHAMENTO');

            const meta = factionName || planet || type;
            const status = done
                ? 'CUMPRIDO'
                : failed ? 'ENCERRADO' : pending ? 'AGUARDANDO' : 'EM ANDAMENTO';
            const rateText = done
                ? 'FINALIZADO'
                : state !== 'active' ? 'ÚLTIMO REGISTRO'
                : rate != null
                    ? `${rate >= 0 ? '+' : ''}${Math.round(rate).toLocaleString('pt-BR')}/h`
                    : 'COLETANDO';
            const etaText = done
                ? 'CONCLUÍDO'
                : state !== 'active' ? '—'
                : (eta || ((goal && goal <= 1) ? 'ACOMPANHANDO' : 'CALCULANDO'));

            return `
                <article class="guerra-mo-task ${factionClassName}${done ? ' is-complete' : ''}">
                    <div class="guerra-mo-task-kicker">
                        <span>OBJETIVO ${String(index+1).padStart(2,'0')} // ${escapeHTML(type)}</span>
                        <strong>${escapeHTML(meta)}</strong>
                    </div>
                    <h4>${escapeHTML(title)}</h4>
                    <div class="guerra-mo-progress"><i style="width:${percent.toFixed(2)}%"></i></div>
                    <div class="guerra-mo-progress-label">
                        <span>${escapeHTML(progressText)}</span>
                        <strong>${goal ? percent.toFixed(1)+'%' : '—'}</strong>
                    </div>
                    <div class="guerra-mo-meta">
                        <div><small>Ritmo observado</small><strong>${escapeHTML(rateText)}</strong></div>
                        <div><small>Conclusão estimada</small><strong>${escapeHTML(etaText)}</strong></div>
                    </div>
                    <div class="guerra-mo-status">${done ? '✓ ' : ''}${escapeHTML(status)}</div>
                </article>`;
        }).join('');

        box.innerHTML = `
            <article class="guerra-order">
                <div class="guerra-order-kicker">${escapeHTML(kicker)}</div>
                <h3>${escapeHTML(rawTitle)}</h3>
                <p class="guerra-order-brief">${escapeHTML(rawBriefing)}</p>

                <div class="guerra-mo-summary">
                    <div class="guerra-order-stat"><small>Tempo restante</small><strong>${escapeHTML(state === 'active' ? remaining(expiration).replace(' restantes','') : 'ENCERRADA')}</strong></div>
                    <div class="guerra-order-stat"><small>Objetivos concluídos</small><strong class="order-accent">${doneCount} / ${count}</strong></div>
                    <div class="guerra-order-stat"><small>Recompensa</small><strong class="order-accent">${reward}</strong></div>
                </div>

                <div class="guerra-mo-head">
                    <span>◆ OBJETIVOS DA ORDEM</span>
                    <small>${count} ${count === 1 ? 'FRENTE / OBJETIVO' : 'FRENTES / OBJETIVOS'} // ${escapeHTML(statusMain)}</small>
                </div>

                <div class="guerra-mo-grid">${taskCards}</div>

                <div class="guerra-order-foot">
                    <span>${escapeHTML(state === 'active' ? 'ORDEM EM EXECUÇÃO' : completed ? 'ORDEM CONCLUÍDA' : failed ? 'ORDEM ENCERRADA' : state === 'unknown' ? 'AGUARDANDO NOVAS ORDENS' : 'AGUARDANDO RESULTADO')} // ${count} ${count === 1 ? 'OBJETIVO' : 'OBJETIVOS'} REGISTRADOS</span>
                    <span>ALTO COMANDO</span>
                </div>
            </article>`;

        const article = box.querySelector('.guerra-order');
        if (article) majorOrderVisual(article, state);

        const [title, briefing] = await Promise.all([
            autoTranslate(rawTitle),
            autoTranslate(rawBriefing)
        ]);

        if ($('ordem-maior') !== box || !box.contains(article)) return;
        const h3 = article?.querySelector('h3');
        const p = article?.querySelector('.guerra-order-brief');
        if (h3 && title) h3.textContent = title;
        if (p && briefing) p.textContent = briefing;
    }

    function readPlanetHistory() {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}'); } catch { return {}; }
    }

    function writePlanetHistory(history) {
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
    }

    function planetProgress(planet) {
        const event = planet?.event;
        const value = event
            ? (event.health != null && event.maxHealth ? (1 - event.health / event.maxHealth) * 100 : 0)
            : (planet?.health != null && planet?.maxHealth ? (1 - planet.health / planet.maxHealth) * 100 : 0);
        return Math.max(0, Math.min(100, Number(value) || 0));
    }

    // Registra um snapshot SOMENTE quando chega uma nova coleta da API.
    // Isso evita que filtros/pesquisa redesenhem o card e zerem o relógio da tendência.
    function recordPlanetSnapshots(data) {
        if (!Array.isArray(data)) return;
        const history = readPlanetHistory();
        const now = Date.now();

        data.forEach(campaign => {
            const p = campaign?.planet;
            if (!p) return;

            const mode = p.event ? 'defense' : 'attack';
            const key = `${p.index ?? clean(p.name)}:${mode}`;
            const progress = planetProgress(p);
            const previous = history[key];

            if (previous && now > previous.time && now - previous.time >= 30 * 1000) {
                const hours = (now - previous.time) / 3600000;
                previous.rate = (progress - previous.progress) / hours;
                previous.rateTime = now;
            }

            // O snapshot atual substitui o anterior somente aqui, durante a coleta.
            history[key] = {
                time: now,
                progress,
                rate: previous?.rate ?? null,
                rateTime: previous?.rateTime ?? null,
                playerCount: Number(p.statistics?.playerCount || 0)
            };
        });

        Object.keys(history).forEach(k => {
            if (!history[k]?.time || now - history[k].time > HISTORY_MAX_AGE) delete history[k];
        });

        writePlanetHistory(history);
    }

    function getPlanetRate(index, mode) {
        const history = readPlanetHistory();
        const item = history[`${index}:${mode}`];
        return item && Number.isFinite(item.rate) ? item.rate : null;
    }

    function formatRate(rate) {
        if (rate == null || !Number.isFinite(rate) || Math.abs(rate) < 0.005) return '—';
        const sign = rate > 0 ? '+' : '';
        return `${sign}${rate.toFixed(2)}%/h`;
    }

    // Em uma DEFESA, a barra vermelha não é uma "regeneração" do inimigo.
    // Ela é o relógio da invasão: cresce de 0 a 100% entre o início e o fim
    // do evento. A barra azul é o progresso real obtido pelos Helldivers.
    function defenseEnemyProgress(event) {
        if (!event) return null;
        const start = Date.parse(event.startTime || event.start_time || event.startedAt || event.started_at || '');
        const end = Date.parse(event.endTime || event.end_time || event.expireTime || event.expire_time || event.expiresAt || event.expires_at || '');
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
        return Math.max(0, Math.min(100, ((Date.now() - start) / (end - start)) * 100));
    }

    function defenseEnemyRate(event) {
        if (!event) return null;
        const start = Date.parse(event.startTime || event.start_time || event.startedAt || event.started_at || '');
        const end = Date.parse(event.endTime || event.end_time || event.expireTime || event.expire_time || event.expiresAt || event.expires_at || '');
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
        return 100 / ((end - start) / 3600000);
    }

    function defenseStatus(blue, red) {
        if (blue == null || red == null) return { label:'COLETANDO DADOS', cls:'status-neutral' };
        if (blue > red + 0.15) return { label:'▲ VENCENDO', cls:'status-up' };
        if (red > blue + 0.15) return { label:'▼ PERDENDO', cls:'status-down' };
        return { label:'◆ EQUILIBRADO', cls:'status-neutral' };
    }

    function formatEtaFromRate(progress, rate) {
        if (rate == null || !Number.isFinite(rate) || rate <= 0 || progress >= 99.99) return null;
        const hours = (100 - progress) / rate;
        if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 30) return null;
        const totalMinutes = Math.max(1, Math.round(hours * 60));
        const days = Math.floor(totalMinutes / 1440);
        const h = Math.floor((totalMinutes % 1440) / 60);
        const m = totalMinutes % 60;
        if (days) return `~${days}d ${h}h`;
        if (h) return `~${h}h ${m}min`;
        return `~${m}min`;
    }

    function liberationEnemyPressure(planet) {
        const regen = Number(planet?.regenPerSecond);
        const maxHealth = Number(planet?.maxHealth);
        if (!Number.isFinite(regen) || !Number.isFinite(maxHealth) || maxHealth <= 0 || regen < 0) return null;
        return (regen * 3600 / maxHealth) * 100;
    }

    function isDssPlanet(planet) {
        if (!planet) return false;
        const key = String(planet.index ?? '').trim();
        const name = clean(planet.name).toLowerCase().trim();
        return (dssPlanetKey && key === dssPlanetKey) || (dssPlanetName && name === dssPlanetName);
    }

    function factionImpactLabel(enemy, rate, defense) {
        const faction = defense ? 'Inimigo' : factionName(enemy);
        if (rate == null) return `${faction}: aguardando histórico`;
        if (rate >= 0) return `${faction}: pressão <b>0,00%/h</b>`;
        return `${faction}: pressão <b>${Math.abs(rate).toFixed(2)}%/h</b>`;
    }

    function renderCampaigns(data) {
        const box = $('frentes');
        if (!box) return;
        if (!Array.isArray(data) || !data.length) { box.innerHTML = '<div class="empty-state">Nenhuma frente de batalha ativa foi encontrada.</div>'; return; }
        campaigns = data;
        recordPlanetSnapshots(data);
        const totalPlayers = data.reduce((sum, c) => sum + Number(c?.planet?.statistics?.playerCount || 0), 0);
        const attacks = data.filter(c => !c?.planet?.event && c?.planet?.currentOwner && c.planet.currentOwner !== 'Humans').length;
        const defenses = data.filter(c => !!c?.planet?.event).length;
        setText('stat-players', totalPlayers.toLocaleString('pt-BR'));
        setText('stat-attack', attacks);
        setText('stat-defense', defenses);
        setText('stat-fronts', data.length);
        setText('stat-attack-detail', `${attacks} frentes ofensivas`);
        setText('stat-defense-detail', `${defenses} frentes em defesa`);
        setText('frentes-count', `${data.length} campanhas detectadas`);
        renderFrontCards();
    }

    function renderFrontCards() {
        const box = $('frentes');
        if (!box) return;
        const q = ($('planeta-busca')?.value || '').trim().toLowerCase();
        const filtered = campaigns.filter(c => {
            const p = c?.planet || {};
            const event = p.event;
            const enemy = event?.faction || p.currentOwner || '';
            const mode = event ? 'defense' : 'attack';
            const faction = factionClass(enemy);
            const name = clean(p.name).toLowerCase();
            const sector = clean(p.sector).toLowerCase();
            const okFilter = activeFilter === 'all' || activeFilter === mode || activeFilter === faction;
            return okFilter && (!q || name.includes(q) || sector.includes(q));
        }).sort((a,b) => Number(b?.planet?.statistics?.playerCount || 0) - Number(a?.planet?.statistics?.playerCount || 0));

        if (!filtered.length) { box.innerHTML = '<div class="empty-state">Nenhuma frente corresponde ao filtro atual.</div>'; return; }

        const totalPlayers = campaigns.reduce((sum,c)=>sum+Number(c?.planet?.statistics?.playerCount||0),0) || 1;
        box.innerHTML = filtered.map((c, index) => {
            const p = c?.planet || {};
            const event = p.event;
            const defense = !!event;
            const enemy = event?.faction || p.currentOwner || 'Humans';
            const color = factionColor(enemy, defense);
            const name = clean(p.name) || 'Planeta desconhecido';
            const sector = clean(p.sector) || 'Setor desconhecido';
            const players = Number(p.statistics?.playerCount || 0);
            let pct = planetProgress(p);
            const playerShare = ((players / totalPlayers) * 100).toFixed(1);
            const hazardDetails = effectDetails(p, enemy, defense);
            const hazards = hazardDetails.map(h => h.name);
            const biome = clean(p.biome?.name) || 'Bioma desconhecido';
            const bgImg = planetImageUrl(p);
            const rate = getPlanetRate(p.index ?? name, defense ? 'defense' : 'attack');
            const defenseRed = defense ? defenseEnemyProgress(event) : null;
            const defenseRedRate = defense ? defenseEnemyRate(event) : null;
        const liberationPressure = !defense ? liberationEnemyPressure(p) : null;
            const defenseState = defense ? defenseStatus(pct, defenseRed) : null;
            const defenseWinEta = defense ? formatEtaFromRate(pct, rate) : null;
            const defenseLoseEta = defense ? remaining(event?.endTime || event?.expireTime) : null;
            const eta = defense ? defenseLoseEta : formatEtaFromRate(pct, rate);
            const etaLabel = defense
                ? `⏱ ${eta || 'prazo indisponível'}`
                : eta ? `🏁 ${eta}` : (rate == null ? '⏳ calculando ritmo' : '🏁 sem ETA confiável');
            const defenseAlertClass = defense && defenseState?.cls === 'status-down' ? ' defesa-perdendo' : '';
            const rateClass = rate == null ? '' : rate >= 0 ? 'rate-positive' : 'rate-negative';
            const trend = defense
                ? `<span class="${defenseState.cls}">${defenseState.label}</span>`
                : rate == null
                    ? '<span class="status-neutral">◌ COLETANDO DADOS</span>'
                    : rate > 0.005 ? '<span class="status-up">▲ AVANÇO</span>'
                    : rate < -0.005 ? '<span class="status-down">▼ RECÚO</span>'
                    : '<span class="status-neutral">◆ ESTÁVEL</span>';
            const enemyPressure = defense ? defenseRedRate : liberationEnemyPressure(p);
            const factionPressureHtml = defense
                ? `<strong class="defense-rate-red">${formatRate(enemyPressure)}</strong>`
                : enemyPressure == null
                    ? '<span class="metric-muted">aguardando dados</span>'
                    : `<strong class="enemy-rate" style="color:${factionColor(enemy, false)} !important">${enemyPressure.toFixed(2)}%/h</strong>`;
            const factionLabel = defense ? 'Impacto inimigo / hora' : `Pressão ${factionName(enemy)}`;
            const dssHere = isDssPlanet(p);
            return `<article class="frente-card ${defense ? 'defesa' : ''}${defenseAlertClass}" style="--accent:${color}" data-planet-key="${escapeHTML(String(p.index ?? name))}" tabindex="0" role="button" aria-haspopup="dialog" aria-expanded="false">
                <div class="frente-strip"><span class="frente-evento"><img class="frente-evento-icone" src="${defense ? 'imagens/guerra/operacoes/defesa.png' : 'imagens/guerra/operacoes/libertacao.png'}" alt="">${defense ? 'DEFESA' : 'LIBERTAÇÃO'}</span><span class="frente-status-mini">${trend}</span><span class="frente-tempo">${escapeHTML(etaLabel)}</span></div>
                <div class="frente-head">
                    <div class="frente-head-row">
                        <div class="frente-title-block"><div class="frente-title">${escapeHTML(name)}</div><div class="frente-sector">${escapeHTML(sector)}</div></div>
                        <span class="frente-enemy">${factionIcon(enemy, defense)} ${escapeHTML(defense ? 'Super Terra' : factionName(enemy))}</span>
                    </div>
                </div>
                <div class="frente-photo" style="background-image:url('${bgImg}')">
                    ${dssHere ? `<div class="frente-dss-badge" title="Estação Democracia (DSS) atualmente neste planeta"><img src="${DSS_ICON}" alt="DSS"><span>DSS</span></div>` : ''}
                    ${hazards.length ? `<div class="frente-hazards-overlay" aria-label="Condições planetárias">${hazardDetails.map(h=>`<span class="frente-hazard-chip" title="${escapeHTML(h.name)}">${iconHTML(h)}<span class="hazard-fallback">${h.icon}</span></span>`).join('')}</div>` : ''}
                </div>
                <div class="frente-content">
                    ${defense ? `
                    <div class="frente-row defesa-bar-label"><span>Defesa Helldivers</span><strong>${pct.toFixed(2)}%</strong></div>
                    <div class="progress defesa-progress-blue"><i style="width:${pct}%;--accent:#3d9dff"></i></div>
                    <div class="frente-row defesa-bar-label"><span>Invasão inimiga</span><strong>${defenseRed == null ? '—' : defenseRed.toFixed(2) + '%'}</strong></div>
                    <div class="progress defesa-progress-red"><i style="width:${defenseRed == null ? 0 : defenseRed}%;--accent:#ff4242"></i></div>
                    ` : `
                    <div class="frente-row"><span>Controle planetário</span><strong>${pct.toFixed(2)}%</strong></div>
                    <div class="progress"><i style="width:${pct}%"></i></div>
                    `}

                    <div class="tatico-metricas">
                        <div class="tatico-metrica metric-helldivers">
                            <span class="metric-label">👥 Helldivers operando</span>
                            <strong>${players.toLocaleString('pt-BR')}</strong>
                            <small>${playerShare}% do efetivo ativo</small>
                        </div>
                        <div class="tatico-metrica metric-impacto">
                            <span class="metric-label">🟦 Impacto Helldiver / hora</span>
                            <strong class="${defense ? 'rate-positive' : rateClass}">${defense ? formatRate(rate) : formatRate(rate)}</strong>
                            <small>${defense ? 'variação observada' : 'variação observada'}</small>
                        </div>
                        <div class="tatico-metrica metric-faccao">
                            <span class="metric-label">${escapeHTML(factionLabel)}</span>
                            ${factionPressureHtml}
                            <small>${defense ? 'ritmo do relógio da invasão' : 'estimativa pela tendência'}</small>
                        </div>
                        <div class="tatico-metrica metric-eta ${defense && defenseState?.cls === 'status-down' ? 'metric-eta-alert' : ''}">
                            <span class="metric-label">🏁 ${defense ? 'Tempo da Defesa' : 'Vitória estimada'}</span>
                            ${defense ? `
                                <strong class="defesa-eta-vitoria">${escapeHTML(defenseWinEta || 'calculando ritmo')}</strong>
                                <small>vitória estimada dos Helldivers</small>
                                <strong class="defesa-eta-inimigo">${escapeHTML(defenseLoseEta || 'prazo indisponível')}</strong>
                                <small>tempo até perder o planeta</small>
                            ` : `
                                <strong>${escapeHTML(eta || 'coletando dados')}</strong>
                                <small>a partir do ritmo atual</small>
                            `}
                        </div>
                    </div>

                    <div class="frente-foot"><span>Bioma: ${escapeHTML(biome)}</span><span>${trend}</span></div>
                    <div class="frente-expand-hint">↗ CLIQUE PARA ABRIR DOSSIÊ TÁTICO</div>
                </div>
            </article>`;
        }).join('');
    }

    async function renderDispatches(data, err) {
        const box = $('despachos');
        if (!box) return;
        if (!data) { box.innerHTML = errorHTML(err?.message || 'Falha ao carregar despachos.'); return; }
        const items = Array.isArray(data) ? data.slice(0,5) : [];
        if (!items.length) { box.innerHTML = '<div class="empty-state">Nenhum despacho recente.</div>'; return; }

        // Mostra os despachos com a tradução "rápida" do dicionário local
        // primeiro (não faz o usuário esperar) e troca pelo texto traduzido
        // automaticamente assim que ele chegar.
        box.innerHTML = items.map((d, i)=>{
            const quick = translateDispatch(d.message);
            return `<div class="feed-item" data-feed-index="${i}"><div class="feed-time">${escapeHTML(relativeDate(d.published))}</div><div class="feed-text">${escapeHTML(quick)}</div></div>`;
        }).join('');

        const translations = await Promise.all(items.map(d => autoTranslate(d.message)));
        if ($('despachos') !== box) return; // painel já foi trocado/recarregado nesse meio tempo
        translations.forEach((text, i) => {
            if (!text) return;
            const el = box.querySelector(`[data-feed-index="${i}"] .feed-text`);
            if (el) el.textContent = text;
        });
    }

    const DSS_INFO = {
        'eagle storm': { name:'Águia Tempestiva', icon:'EAGLE STORM.png', desc:'A DSS emprega ataques periódicos de Águia para apoiar as operações no planeta.' },
        'orbital blockade': { name:'Bloqueio Orbital', icon:'ORBITAL BLOCKADE.png', desc:'Impede o início de novas campanhas de Defesa no planeta e fornece suporte adicional às operações.' },
        'heavy ordnance distribution': { name:'Distribuição de Artilharia Pesada', icon:'HEAVY ORDNANCE DISTRIBUTION.png', desc:'Fornece suporte de artilharia orbital e acelera os esforços de libertação.' }
    };
    const DSS_ICON_PATH = 'imagens/guerra/dss/';
    const DSS_ICON = `${DSS_ICON_PATH}DSS_Summary_Model.png`;
    const DSS_ICON_FALLBACK = 'https://helldivers.wiki.gg/wiki/Special:Redirect/file/DSS%20Icon.svg';
    function dssInfo(name) {
        const raw=clean(name);
        const key=raw.toLowerCase();
        const match=Object.keys(DSS_INFO).find(k=>key.includes(k));
        return match ? DSS_INFO[match] : { name:raw||'Ação Tática', icon:'DSS Action Fallback Icon.svg', desc:'Ação tática da Estação Democracia.' };
    }
    function dssIcon(info, cls='dss-action-img') {
        const local = DSS_ICON_PATH + info.icon;
        const wikiName = info.icon.endsWith('.png') ? '' : info.icon;
        const fallback = wikiName ? WIKI_FILE(wikiName) : '';
        return `<img src=\"${escapeHTML(local)}\" alt=\"\" class=\"${cls}\" ${fallback ? `data-fallback=\"${escapeHTML(fallback)}\"` : ''} onerror=\"if(this.dataset.fallback && this.src!==this.dataset.fallback){this.src=this.dataset.fallback}else{this.style.display='none'}\">`;
    }


    /* V19 — status visual das Ações Táticas da DSS.
       Verde = ativa, amarelo = preparando/ativando, vermelho = recarregando/desativada. */
    function dssDateValue(value) {
        if (value == null || value === '') return null;
        if (typeof value === 'number' && Number.isFinite(value)) {
            const ms = value < 1e12 ? value * 1000 : value;
            const d = new Date(ms);
            return Number.isFinite(d.getTime()) ? d : null;
        }
        const d = new Date(value);
        return Number.isFinite(d.getTime()) ? d : null;
    }

    function dssFutureDate(action) {
        const keys = [
            'statusExpiresAt','statusExpiration','statusExpireTime','statusEndTime',
            'cooldownEndsAt','cooldownEnd','cooldownExpiration','availableAt','availableTime',
            'expiresAt','expiration','expireTime','endTime'
        ];
        for (const key of keys) {
            const d = dssDateValue(action?.[key]);
            if (d && d.getTime() > Date.now()) return d;
        }
        return null;
    }

    function dssTimeLabel(date) {
        if (!date) return '';
        let sec = Math.floor((date.getTime() - Date.now()) / 1000);
        if (!Number.isFinite(sec) || sec <= 0) return '';
        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        const m = Math.floor((sec % 3600) / 60);
        if (d) return `${d}d ${h}h`;
        if (h) return `${h}h ${m}min`;
        return `${Math.max(1,m)}min`;
    }

    function dssActionState(action, pct) {
        const raw = clean(action?.statusName || action?.state || action?.statusText || action?.status).toLowerCase();
        const numeric = Number(action?.status);
        const active = numeric === 2 || /(^|\b)(active|ativa|activated|ativada)(\b|$)/i.test(raw);
        const future = dssFutureDate(action);

        if (active) {
            return {
                cls:'active',
                label:'ATIVA',
                detail: future ? `Termina em ${dssTimeLabel(future)}` : ''
            };
        }

        if (/cooldown|recharg|recarreg|unavailable|indispon/i.test(raw)) {
            return {
                cls:'recharging',
                label:'RECARREGANDO',
                detail: future ? `Disponível novamente em ${dssTimeLabel(future)}` : ''
            };
        }

        if (pct != null && pct < 100) {
            return {
                cls:'preparing',
                label:'PREPARANDO',
                detail:`${pct.toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1')}% FINANCIADO`
            };
        }

        if (pct != null && pct >= 100) {
            return {
                cls:'preparing',
                label:'ATIVANDO',
                detail:'FINANCIAMENTO CONCLUÍDO'
            };
        }

        if (future) {
            return {
                cls:'recharging',
                label:'RECARREGANDO',
                detail:`Disponível novamente em ${dssTimeLabel(future)}`
            };
        }

        return { cls:'offline', label:'DESATIVADA', detail:'' };
    }

    function renderDSS(data, err) {
        const box = $('dss');
        if (!box) return;
        if (!data) { dssPlanetKey=''; dssPlanetName=''; box.innerHTML = errorHTML(err?.message || 'Falha ao carregar a DSS.'); if(campaigns.length) renderFrontCards(); return; }
        const station = Array.isArray(data) ? data[0] : null;
        if (!station) { dssPlanetKey=''; dssPlanetName=''; box.innerHTML = '<div class="empty-state">Nenhuma Estação Democracia ativa.</div>'; if(campaigns.length) renderFrontCards(); return; }
        const stationPlanetIndex = String(station.planet?.index ?? station.planet?.planetIndex ?? station.planetIndex ?? '').trim();
        const resolvedDssPlanet = station.planet?.name
            ? station.planet
            : (planetCatalog[stationPlanetIndex] || campaigns.find(c => String(c?.planet?.index ?? '') === stationPlanetIndex)?.planet || {});
        const planet = clean(resolvedDssPlanet?.name || station.planet?.name) || 'desconhecido';
        dssPlanetKey = stationPlanetIndex;
        dssPlanetName = planet.toLowerCase().trim();
        const actions = Array.isArray(station.tacticalActions) ? station.tacticalActions : [];
        const dssBg = Object.keys(resolvedDssPlanet).length ? planetImageUrl(resolvedDssPlanet) : '';
        const dssStyle = dssBg ? ` style="--dss-bg:url('${dssBg.replace(/'/g, '%27')}')"` : '';
        box.innerHTML = `<div class="dss-card">
            <div class="dss-heading dss-planet-header-bg"${dssStyle}><img src="${DSS_ICON}" alt="DSS" class="dss-main-icon" data-fallback="${DSS_ICON_FALLBACK}" onerror="if(this.dataset.fallback && this.src!==this.dataset.fallback){this.src=this.dataset.fallback}else{this.style.display='none'}"><div><div class="dss-planet">${escapeHTML(planet)}</div><small>ESTAÇÃO DEMOCRACIA</small></div></div>
            ${actions.length ? actions.map(a=>{
                const info=dssInfo(a.name);
                const cost=(a.costs||[])[0];
                const pct=cost?.targetValue ? Math.max(0,Math.min(100,(Number(cost.currentValue||0)/Number(cost.targetValue))*100)) : null;
                const state=dssActionState(a,pct);
                const showProgress=state.cls==='preparing' && pct!=null && pct<100;
                return `<div class="dss-action dss-state-${state.cls}">
                    <div class="dss-action-head">${dssIcon(info)}<div class="dss-action-copy"><strong>${escapeHTML(info.name)}</strong><div class="dss-status-line ${state.cls}"><span class="dss-status-dot" aria-hidden="true"></span><span class="dss-status-text">${escapeHTML(state.label)}</span></div>${state.detail?`<small class="dss-status-detail">${escapeHTML(state.detail)}</small>`:''}</div></div>
                    <p>${escapeHTML(info.desc)}</p>
                    ${showProgress?`<div class="progress dss-progress"><i style="width:${pct.toFixed(2)}%;--accent:#ffe800"></i></div>`:''}
                </div>`;
            }).join('') : '<small class="feed-time">Nenhuma ação tática ativa no momento.</small>'}
        </div>`;
        if (campaigns.length) renderFrontCards();
    }

    function renderSteam(data, err) {
        const box=$('patch-notes'); if(!box)return;
        if(!data){box.innerHTML=errorHTML(err?.message||'Falha ao carregar notícias.');return;}
        const items=Array.isArray(data)?data.slice(0,3):[];
        if(!items.length){box.innerHTML='<div class="empty-state">Nenhuma notícia recente.</div>';return;}
        box.innerHTML=items.map(n=>{
            const url=typeof n.url==='string' && /^https:\/\//i.test(n.url)?n.url:'#';
            return `<a class="patch-link" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer"><span>${escapeHTML(clean(n.title)||'Sem título')}</span><time>${escapeHTML(relativeDate(n.publishedAt||n.date))}</time></a>`;
        }).join('');
    }

    function findCampaignByKey(key) {
        return campaigns.find(c => String(c?.planet?.index ?? clean(c?.planet?.name)) === String(key));
    }

    function renderTacticalModal(campaign) {
        const modal = $('tactical-modal');
        if (!modal || !campaign?.planet) return;
        const p = campaign.planet;
        const event = p.event;
        const defense = !!event;
        const enemy = event?.faction || p.currentOwner || 'Humans';
        const color = factionColor(enemy, defense);
        const name = clean(p.name) || 'Planeta desconhecido';
        const sector = clean(p.sector) || 'Setor desconhecido';
        const biome = clean(p.biome?.name) || 'Bioma desconhecido';
        const players = Number(p.statistics?.playerCount || 0);
        const totalPlayers = campaigns.reduce((sum,c)=>sum+Number(c?.planet?.statistics?.playerCount||0),0) || 1;
        const pct = planetProgress(p);
        const hazards = effectDetails(p, enemy, defense);
        const rate = getPlanetRate(p.index ?? name, defense ? 'defense' : 'attack');
        const defenseRed = defense ? defenseEnemyProgress(event) : null;
        const defenseRedRate = defense ? defenseEnemyRate(event) : null;
        const liberationPressure = !defense ? liberationEnemyPressure(p) : null;
        const defenseState = defense ? defenseStatus(pct, defenseRed) : null;
        const eta = defense ? remaining(event?.endTime || event?.expireTime) : formatEtaFromRate(pct, rate);
        const trend = defense ? defenseState.label : (rate == null ? 'COLETANDO DADOS' : rate > 0.005 ? '▲ AVANÇO' : rate < -0.005 ? '▼ RECÚO' : '◆ ESTÁVEL');
        const bgImg = planetImageUrl(p);
        modal.querySelector('.tactical-modal-card').style.setProperty('--accent', color);
        modal.querySelector('.tactical-modal-title').textContent = name;
        modal.querySelector('.tactical-modal-sector').textContent = `${defense ? 'DEFESA' : 'LIBERAÇÃO'} · ${sector}`;
        modal.querySelector('.tactical-modal-photo').style.backgroundImage = `url(\"${bgImg.replace(/\"/g,'') }\")`;
        modal.querySelector('.tactical-modal-meta').innerHTML = `
            <span>${escapeHTML(defense ? '🛡 DEFESA' : '⚔ LIBERAÇÃO')}</span>
            <span style="color:${color}">${escapeHTML(factionName(enemy))}</span>
            <span>${escapeHTML(biome)}</span>`;
        modal.querySelector('.tactical-modal-progress-label').innerHTML = defense
            ? `<span>DEFESA HELLDIVERS</span><strong>${pct.toFixed(2)}%</strong>`
            : `<span>CONTROLE PLANETÁRIO</span><strong>${pct.toFixed(2)}%</strong>`;
        modal.querySelector('.tactical-modal-progress i').style.width = `${pct}%`;
        modal.querySelector('.tactical-modal-metrics').innerHTML = defense
            ? `
            <div><small>HELldivers OPERANDO</small><strong>${players.toLocaleString('pt-BR')}</strong><span>${((players/totalPlayers)*100).toFixed(1)}% do efetivo ativo</span></div>
            <div><small>IMPACTO HELLDIVER / HORA</small><strong class="rate-positive">${formatRate(rate)}</strong><span>ritmo observado</span></div>
            <div><small>IMPACTO INIMIGO / HORA</small><strong class="rate-negative">${formatRate(defenseRedRate)}</strong><span>ritmo do relógio da invasão</span></div>
            <div><small>INVASÃO / TEMPO</small><strong class="rate-negative">${defenseRed == null ? '—' : defenseRed.toFixed(2) + '%'}</strong><span>${escapeHTML(trend)} · ${escapeHTML(eta || 'prazo indisponível')}</span></div>`
            : `
            <div><small>HELldivers OPERANDO</small><strong>${players.toLocaleString('pt-BR')}</strong><span>${((players/totalPlayers)*100).toFixed(1)}% do efetivo ativo</span></div>
            <div><small>IMPACTO HELLDIVER / HORA</small><strong class="${rate == null ? '' : rate >= 0 ? 'rate-positive' : 'rate-negative'}">${formatRate(rate)}</strong><span>variação observada</span></div>
            <div><small>PRESSÃO ${escapeHTML(factionName(enemy))} / HORA</small><strong class="enemy-rate" style="color:${factionColor(enemy, false)} !important">${liberationPressure == null ? '—' : liberationPressure.toFixed(2)+'%/h'}</strong><span>regeneração planetária registrada</span></div>
            <div><small>VITÓRIA ESTIMADA</small><strong>${escapeHTML(eta || 'coletando dados')}</strong><span>${escapeHTML(trend)}</span></div>`;
        const climateRaw = clean(p.weather?.name || p.weather?.description || p.climate || p.weatherName || p.weather) || 'não informado pela telemetria';
        const ownerLabel = defense ? 'Super Terra (em defesa)' : factionName(enemy);
        const intelEta = defense
            ? `${escapeHTML(defenseState.label)} · vitória estimada ${escapeHTML(formatEtaFromRate(pct, rate) || 'calculando')} · perda em ${escapeHTML(eta || 'prazo indisponível')}`
            : `${escapeHTML(trend)} · vitória estimada ${escapeHTML(eta || 'coletando dados')}`;
        modal.querySelector('.tactical-modal-intel').innerHTML = `
            <div class="tactical-intel-grid">
                <div><small>SETOR</small><strong>${escapeHTML(sector)}</strong></div>
                <div><small>CONTROLE / PROPRIETÁRIO</small><strong>${escapeHTML(ownerLabel)}</strong></div>
                <div><small>BIOMA</small><strong>${escapeHTML(biome)}</strong></div>
                <div><small>CLIMA / TELEMETRIA</small><strong>${escapeHTML(climateRaw)}</strong></div>
                <div><small>HELldivers OPERANDO</small><strong>${players.toLocaleString('pt-BR')}</strong></div>
                <div><small>SITUAÇÃO</small><strong>${intelEta}</strong></div>
            </div>`;
        modal.querySelector('.tactical-modal-hazards').innerHTML = hazards.length ? hazards.map(h=>`<div class="tactical-hazard">
            <div class="tactical-hazard-head">${iconHTML(h,'hazard-detail-img')}<strong>${escapeHTML(h.name)}</strong></div>
            <p>${escapeHTML(h.description)}</p>
            <small><b>RECOMENDAÇÃO:</b> ${escapeHTML(h.recommendation)}</small>
        </div>`).join('') : '<div class="empty-state">Nenhuma condição ou efeito planetário registrado para este planeta.</div>';
        modal.classList.add('open');
        modal.setAttribute('aria-hidden','false');
        document.body.classList.add('tactical-modal-open');
        modal.querySelector('.tactical-modal-close')?.focus();
    }

    function closeTacticalModal() {
        const modal = $('tactical-modal');
        if (!modal) return;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden','true');
        document.body.classList.remove('tactical-modal-open');
    }

    function bindFilters() {
        document.querySelectorAll('.guerra-filter').forEach(btn=>btn.addEventListener('click',()=>{
            document.querySelectorAll('.guerra-filter').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active'); activeFilter=btn.dataset.filter||'all'; renderFrontCards();
        }));
        $('planeta-busca')?.addEventListener('input',renderFrontCards);

        // Cards permanecem compactos; os detalhes abrem em um dossiê modal sobre a mesma página.
        $('frentes')?.addEventListener('click', event => {
            const card = event.target.closest('.frente-card');
            if (!card || !$('frentes').contains(card)) return;
            renderTacticalModal(findCampaignByKey(card.dataset.planetKey));
        });
        $('frentes')?.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const card = event.target.closest('.frente-card');
            if (!card) return;
            event.preventDefault();
            renderTacticalModal(findCampaignByKey(card.dataset.planetKey));
        });
        $('tactical-modal')?.addEventListener('click', event => {
            if (event.target.matches('[data-close-tactical]') || event.target.closest('[data-close-tactical]')) closeTacticalModal();
        });
        document.addEventListener('keydown', event => { if (event.key === 'Escape') closeTacticalModal(); });
    }

    async function updateAll(force=false) {
        setText('stat-updated','ATUALIZANDO');
        // Sequencial de propósito: respeita o limite atual de 5 req/10s e evita rajadas.
        const tasks = [
            () => fetchWithFallback(`${V1}/assignments`, 'assignments', d=>renderOrder(d)),
            () => fetchWithFallback(`${V1}/campaigns`, 'campaigns', (d,e)=>d?renderCampaigns(d):$('frentes').innerHTML=errorHTML(e?.message||'Falha ao carregar campanhas.'), Array.isArray),
            () => fetchWithFallback(`${V1}/dispatches`, 'dispatches', renderDispatches, Array.isArray),
            () => fetchWithFallback(`${V2}/space-stations`, 'dss', renderDSS, Array.isArray),
            () => fetchWithFallback(`${V1}/steam`, 'steam', renderSteam, Array.isArray)
        ];
        for (const task of tasks) {
            await task();
            await new Promise(r=>setTimeout(r,220));
        }
        setText('stat-updated','AGORA');
    }

    document.addEventListener('DOMContentLoaded',()=>{
        bindFilters();
        loadPlanetCatalog();
        updateAll();
        setInterval(()=>updateAll(),REFRESH);
    });
})();