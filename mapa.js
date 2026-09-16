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
    const CACHE_TTL = { planets: 3 * 60 * 1000, dss: 2 * 60 * 1000 };

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
        const n = (owner || '').toLowerCase();
        if (n.includes('terminid')) return 'terminid';
        if (n.includes('automaton')) return 'automaton';
        if (n.includes('illuminate')) return 'illuminate';
        return 'human';
    }
    function factionName(owner) {
        const n = (owner || '').toLowerCase();
        if (n.includes('terminid')) return 'Terminídeos';
        if (n.includes('automaton')) return 'Autômatos';
        if (n.includes('illuminate')) return 'Iluminados';
        if (n.includes('human')) return 'Super Terra';
        return owner || 'Desconhecida';
    }
    const FACTION_COLORS = { human:'#d7d52c', terminid:'#ff9900', automaton:'#ff4242', illuminate:'#8b3fd6' };
    function factionColor(owner) { return FACTION_COLORS[factionKey(owner)] || FACTION_COLORS.human; }

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
        'heavy gloom shroud': { name:'Manto de Escuridão Intensa', icon:'◐', file:'Heavy Gloom Shroud.png', wikiFile:'Heavy Gloom Shroud Environmental Condition Icon.svg' },
        'ion storms': { name:'Tempestades de Íons', icon:'⚡', file:'Ion Storms.png', wikiFile:'Ion Storms Environmental Condition Icon.svg' },
        'flooding': { name:'Inundações', icon:'≋', file:'', wikiFile:'' }
    };
    const HAZARD_ICON_PATH = 'imagens/icones/efeito-dss/';
    const WIKI_FILE = name => `https://helldivers.wiki.gg/wiki/Special:Redirect/file/${encodeURIComponent(name)}`;

    function hazardInfo(raw) {
        const n = clean(raw).toLowerCase();
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
        const cache = readCache();
        const now = Date.now();
        const saved = cache[cacheName];
        if (saved && (now - saved.time) < CACHE_TTL[cacheName]) return saved.data;
        const response = await fetch(url, { headers: HEADERS, cache: 'no-store' });
        if (!response.ok) throw new Error(`API respondeu HTTP ${response.status}`);
        const data = await response.json();
        cache[cacheName] = { time: now, data };
        writeCache(cache);
        return data;
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
    let allPlanets = [];               // lista crua vinda da API
    const nodeByIndex = new Map();     // index -> { data, circle, ring, group }
    let dssHostIndex = null;
    let activeFaction = 'all';
    let searchQuery = '';
    let selectedIndex = null;
    let lineRecords = [];
    const layerVisibility = { routes:true, territories:true, sectors:true };

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
        const event = p?.event;
        if (!event) return null;
        const health = Number(event.health || 0);
        const maxHealth = Number(event.maxHealth || 0);
        if (!maxHealth) return null;
        return Math.max(0, Math.min(100, (1 - health / maxHealth) * 100));
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

    function buildFactionTerritories(withPos, mapSize) {
        const groups = { terminid: [], automaton: [], illuminate: [] };
        withPos.forEach(({ raw, x, y }) => {
            const key = factionKey(raw.currentOwner || raw.owner);
            if (groups[key]) groups[key].push({ x, y });
        });
        const out = [];
        const pad = mapSize / 34;
        Object.entries(groups).forEach(([key, pts]) => {
            if (!pts.length) return;
            const cx = pts.reduce((s,p)=>s+p.x,0) / pts.length;
            const cy = pts.reduce((s,p)=>s+p.y,0) / pts.length;
            if (pts.length >= 3) {
                const hull = convexHull(pts);
                const expanded = expandPolygon(hull, 1.10, pad * .42);
                out.push({ key, type:'path', d:polygonPath(expanded), cx, cy });
            } else {
                const radius = pts.length === 1 ? pad * 1.8 : Math.max(pad * 1.6, Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y) * .62);
                out.push({ key, type:'circle', cx, cy, radius });
            }
        });
        return out;
    }

    function updateHUD(planets, routeCount) {
        const players = planets.reduce((sum,p)=>sum + Number(p?.statistics?.playerCount || 0), 0);
        const fronts = planets.filter(p => !!p?.event).length;
        const sectors = new Set(planets.map(p => clean(p?.sector)).filter(Boolean)).size;
        const set = (id,val) => { const el=$(id); if (el) el.textContent=val; };
        set('mapa-hud-players', players.toLocaleString('pt-BR'));
        set('mapa-hud-fronts', fronts.toLocaleString('pt-BR'));
        set('mapa-hud-sectors', sectors.toLocaleString('pt-BR'));
        set('mapa-hud-routes', Number(routeCount || 0).toLocaleString('pt-BR'));
    }

    function applyLayerVisibility() {
        const viewport = $('mapa-viewport');
        if (!viewport) return;
        viewport.classList.toggle('hide-routes', !layerVisibility.routes);
        viewport.classList.toggle('hide-territories', !layerVisibility.territories);
        viewport.classList.toggle('hide-sectors', !layerVisibility.sectors);
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

    function buildDefs(blurAmount) {
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

        const blur = svgEl('filter', { id: 'mapa-halo-blur', x: '-80%', y: '-80%', width: '260%', height: '260%' });
        blur.appendChild(svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: blurAmount }));
        defs.appendChild(blur);

        const glow = svgEl('filter', { id:'mapa-soft-glow', x:'-100%', y:'-100%', width:'300%', height:'300%' });
        glow.appendChild(svgEl('feGaussianBlur', { stdDeviation: Math.max(.7, blurAmount / 16), result:'blur' }));
        const merge = svgEl('feMerge', {});
        merge.appendChild(svgEl('feMergeNode', { in:'blur' }));
        merge.appendChild(svgEl('feMergeNode', { in:'SourceGraphic' }));
        glow.appendChild(merge);
        defs.appendChild(glow);
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

        const withPos = planets
            .map(p => {
                const pos = getPosition(p);
                if (!pos) return null;
                return { raw: p, x: pos.x * SCALE, y: -pos.y * SCALE };
            })
            .filter(Boolean);

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
        const linesGroup = svgEl('g', { class:'mapa-lines' });
        const dotsGroup = svgEl('g', { class:'mapa-dots' });
        viewport.appendChild(cartographyGroup);
        viewport.appendChild(territoryGroup);
        viewport.appendChild(sectorGroup);
        viewport.appendChild(linesGroup);
        viewport.appendChild(dotsGroup);
        svg.appendChild(buildDefs(mapSize / 45));
        svg.appendChild(viewport);

        // Cartografia de fundo: anéis e eixos sutis, como uma mesa de comando orbital.
        [0.17,0.31,0.45].forEach(f => {
            cartographyGroup.appendChild(svgEl('circle', {
                class:'mapa-orbit-guide', cx:cxMap, cy:cyMap, r:mapSize*f,
                'vector-effect':'non-scaling-stroke'
            }));
        });
        cartographyGroup.appendChild(svgEl('line', { class:'mapa-axis-guide', x1:bounds.minX, y1:cyMap, x2:bounds.maxX, y2:cyMap, 'vector-effect':'non-scaling-stroke' }));
        cartographyGroup.appendChild(svgEl('line', { class:'mapa-axis-guide', x1:cxMap, y1:bounds.minY, x2:cxMap, y2:bounds.maxY, 'vector-effect':'non-scaling-stroke' }));

        // Territórios táticos aproximados a partir da distribuição dos planetas de cada facção.
        buildFactionTerritories(withPos, mapSize).forEach(t => {
            let shape;
            if (t.type === 'path') shape = svgEl('path', { d:t.d });
            else shape = svgEl('circle', { cx:t.cx, cy:t.cy, r:t.radius });
            shape.setAttribute('class', `mapa-territory mapa-territory-${t.key}`);
            shape.setAttribute('fill', FACTION_COLORS[t.key]);
            shape.setAttribute('stroke', FACTION_COLORS[t.key]);
            shape.setAttribute('vector-effect','non-scaling-stroke');
            territoryGroup.appendChild(shape);
        });

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
                const common = { x1:x, y1:y, x2:target.x, y2:target.y, 'data-a':raw.index, 'data-b':targetIndex, 'vector-effect':'non-scaling-stroke' };
                const base = svgEl('line', { ...common, class:`mapa-supply-line-base${isFront ? ' mapa-front-line-base' : ''}` });
                const line = svgEl('line', { ...common, class:`mapa-supply-line${isFront ? ' mapa-front-line' : ''}` });
                linesGroup.appendChild(base);
                linesGroup.appendChild(line);
                lineRecords.push({ a:raw.index, b:targetIndex, base, line, isFront });
            });
        });

        const baseRadius = mapSize / 260;

        withPos.forEach(({ raw, x, y }) => {
            const owner = raw.currentOwner || raw.owner;
            const fKey = factionKey(owner);
            const accent = factionColor(owner);
            const underAttack = !!raw.event;
            const progress = campaignProgress(raw);
            const group = svgEl('g', { class:'mapa-planet-group', 'data-index': raw.index, 'data-faction': fKey });

            const halo = svgEl('circle', {
                class:'mapa-planet-halo', cx:x, cy:y, r:baseRadius * (underAttack ? 2.7 : 2.1),
                fill:accent, filter:'url(#mapa-soft-glow)'
            });
            group.appendChild(halo);

            if (underAttack) {
                const ringColor = factionColor(raw.event?.faction || owner);
                const ringRadius = baseRadius * 2.35;
                const ring = svgEl('circle', {
                    class: 'mapa-planet-ring', cx:x, cy:y, r:ringRadius,
                    stroke:ringColor, 'vector-effect':'non-scaling-stroke'
                });
                group.appendChild(ring);

                if (progress != null) {
                    const progressRing = svgEl('circle', {
                        class:'mapa-progress-ring', cx:x, cy:y, r:baseRadius*1.78,
                        pathLength:100, 'stroke-dasharray':`${progress.toFixed(2)} ${(100-progress).toFixed(2)}`,
                        stroke:ringColor, transform:`rotate(-90 ${x} ${y})`, 'vector-effect':'non-scaling-stroke'
                    });
                    group.appendChild(progressRing);
                }

                const tickLen = baseRadius * 0.9, tickGap = baseRadius * 0.45;
                [0, 90, 180, 270].forEach(deg => {
                    const rad = deg * Math.PI / 180;
                    const dx = Math.cos(rad), dy = Math.sin(rad);
                    group.appendChild(svgEl('line', {
                        class:'mapa-planet-tick',
                        x1:x + dx*(ringRadius+tickGap), y1:y + dy*(ringRadius+tickGap),
                        x2:x + dx*(ringRadius+tickGap+tickLen), y2:y + dy*(ringRadius+tickGap+tickLen),
                        stroke:ringColor, 'vector-effect':'non-scaling-stroke'
                    }));
                });
            }

            const circle = svgEl('circle', {
                class:'mapa-planet-dot', cx:x, cy:y,
                r:underAttack ? baseRadius * 1.38 : baseRadius,
                fill:`url(#planet-grad-${fKey})`
            });
            const title = svgEl('title', {});
            title.textContent = `${clean(raw.name) || 'Planeta desconhecido'} — ${clean(raw.sector) || 'Setor desconhecido'}`;
            circle.appendChild(title);
            group.appendChild(circle);

            if (dssHostIndex != null && String(dssHostIndex) === String(raw.index)) {
                const size = baseRadius * .95;
                const cy2 = y - baseRadius * 3.2;
                const dssHalo = svgEl('circle', { class:'mapa-dss-halo', cx:x, cy:cy2, r:size*1.6, fill:'#ffd23f', filter:'url(#mapa-soft-glow)' });
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
            label.textContent = clean(raw.name) || 'Planeta desconhecido';
            group.appendChild(label);

            const players = Number(raw.statistics?.playerCount || 0);
            const playerLabel = svgEl('text', { class:'mapa-player-label', x, y:y+baseRadius*3.75, 'text-anchor':'middle' });
            playerLabel.textContent = `${formatCompactNumber(players)} HD`;
            group.appendChild(playerLabel);

            if (underAttack) {
                const eventLabel = svgEl('text', { class:'mapa-event-label', x, y:y-baseRadius*3.45, 'text-anchor':'middle', fill:factionColor(raw.event?.faction || owner) });
                eventLabel.textContent = progress == null ? 'SOB ATAQUE' : `FRENTE ${progress.toFixed(0)}%`;
                group.appendChild(eventLabel);
            }

            group.addEventListener('click', () => {
                setSelectedPlanet(raw.index);
                openPlanetModal(raw);
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
            const matchesSearch = !q || clean(data.name).toLowerCase().includes(q) || clean(data.sector).toLowerCase().includes(q);
            const show = matchesFaction && matchesSearch;
            group.classList.toggle('filtered-out', !show);
        });
    }

    // ================================================================
    // PAN & ZOOM
    // ================================================================
    function setupPanZoom(svg, viewport) {
        const LABEL_ZOOM_THRESHOLD = 1.75;
        const DETAIL_ZOOM_THRESHOLD = 3.0;

        let state = svg._mapaPanZoomState;
        if (state) {
            state.viewport = viewport;
            state.scale = 1; state.tx = 0; state.ty = 0;
            state.apply();
            return;
        }

        state = {
            viewport,
            scale:1, tx:0, ty:0,
            isPanning:false, lastX:0, lastY:0, moved:false,
            pinchStartDist:null, pinchStartScale:1,
            activePointers:new Map()
        };
        svg._mapaPanZoomState = state;
        svg._activePointers = state.activePointers;

        state.apply = () => {
            const vp = state.viewport;
            if (!vp) return;
            vp.setAttribute('transform', `translate(${state.tx},${state.ty}) scale(${state.scale})`);
            vp.classList.toggle('mapa-labels-on', state.scale >= LABEL_ZOOM_THRESHOLD);
            vp.classList.toggle('mapa-detail-on', state.scale >= DETAIL_ZOOM_THRESHOLD);
            vp.classList.toggle('mapa-sector-fade', state.scale >= 4.2);
            applyLayerVisibility();
        };

        const clientToSvgPoint = (clientX, clientY) => {
            const rect = svg.getBoundingClientRect();
            const vb = svg.viewBox.baseVal;
            const px = (clientX - rect.left) / rect.width * vb.width + vb.x;
            const py = (clientY - rect.top) / rect.height * vb.height + vb.y;
            return { x:px, y:py };
        };

        state.zoomAt = (clientX, clientY, factor) => {
            const before = clientToSvgPoint(clientX, clientY);
            const newScale = Math.max(.5, Math.min(12, state.scale * factor));
            if (newScale === state.scale) return;
            state.tx = before.x - (before.x - state.tx) * (newScale / state.scale);
            state.ty = before.y - (before.y - state.ty) * (newScale / state.scale);
            state.scale = newScale;
            state.apply();
        };

        svg.addEventListener('wheel', event => {
            event.preventDefault();
            state.zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.18 : 1 / 1.18);
        }, { passive:false });

        svg.addEventListener('pointerdown', event => {
            state.activePointers.set(event.pointerId, event);
            if (event.pointerType === 'touch' && state.activePointers.size > 1) return;
            state.isPanning = true; state.moved = false;
            state.lastX = event.clientX; state.lastY = event.clientY;
            try { svg.setPointerCapture(event.pointerId); } catch {}
        });

        svg.addEventListener('pointermove', event => {
            if (state.activePointers.has(event.pointerId)) state.activePointers.set(event.pointerId, event);
            if (state.activePointers.size === 2) {
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
            const rect = svg.getBoundingClientRect();
            const vb = svg.viewBox.baseVal;
            state.tx += dx/rect.width*vb.width;
            state.ty += dy/rect.height*vb.height;
            state.lastX = event.clientX; state.lastY = event.clientY;
            state.apply();
        });

        const clearPointer = event => {
            state.activePointers.delete(event.pointerId);
            if (state.activePointers.size < 2) state.pinchStartDist = null;
            state.isPanning = false;
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
            state.scale=1; state.tx=0; state.ty=0; state.apply();
        });

        state.apply();
    }

    // ================================================================
    // DOSSIÊ TÁTICO (modal ao clicar no planeta)
    // ================================================================
    function openPlanetModal(p) {
        const modal = $('planet-modal');
        if (!modal) return;
        const owner = p.currentOwner || p.owner;
        const event = p.event;
        const name = clean(p.name) || 'Planeta desconhecido';
        const sector = clean(p.sector) || 'Setor desconhecido';
        const biome = clean(p.biome?.name) || 'Bioma desconhecido';
        const players = Number(p.statistics?.playerCount || 0);
        const health = event ? Number(event.health || 0) : Number(p.health || 0);
        const maxHealth = event ? Number(event.maxHealth || 1) : Number(p.maxHealth || 1);
        const pct = maxHealth ? Math.max(0, Math.min(100, Math.round((1 - health / maxHealth) * 100))) : 0;
        const accent = factionColor(event ? (event.faction || owner) : owner);

        modal.querySelector('.tactical-modal-card').style.setProperty('--accent', accent);
        modal.querySelector('#planet-modal-title').textContent = name;
        modal.querySelector('.tactical-modal-sector').textContent = sector;
        modal.querySelector('.tactical-modal-meta').innerHTML = `
            <span>${event ? 'SOB ATAQUE' : 'CONTROLADO POR'} · ${escapeHTML(factionName(event ? event.faction : owner))}</span>
            <span>Bioma: ${escapeHTML(biome)}</span>
            ${dssHostIndex != null && String(dssHostIndex) === String(p.index) ? '<span>🛰 Sede da DSS</span>' : ''}
        `;

        if (event) {
            modal.querySelector('.tactical-modal-progress-label').innerHTML = `<span>LIBERAÇÃO</span><span>${pct}%</span>`;
            modal.querySelector('.tactical-modal-progress').style.display = '';
            modal.querySelector('.tactical-modal-progress > i').style.width = `${pct}%`;
            modal.querySelector('.tactical-modal-progress > i').style.setProperty('--accent', accent);
        } else {
            modal.querySelector('.tactical-modal-progress-label').innerHTML = '';
            modal.querySelector('.tactical-modal-progress').style.display = 'none';
        }

        modal.querySelector('.tactical-modal-metrics').innerHTML = `
            <div><small>HELLDIVERS EM CAMPO</small><strong>${players.toLocaleString('pt-BR')}</strong></div>
            <div><small>SETOR</small><strong style="font-size:13px">${escapeHTML(sector)}</strong></div>
            <div><small>ÍNDICE</small><strong>${escapeHTML(String(p.index))}</strong></div>
        `;

        const hazards = Array.isArray(p.hazards) ? p.hazards : [];
        const hazardBox = modal.querySelector('.tactical-modal-hazards');
        hazardBox.innerHTML = hazards.length
            ? `<div class="hazard-list">${hazards.map(h => {
                const info = hazardInfo(h?.name || h);
                return `<span class="hazard" title="${escapeHTML(info.name)}">${hazardIconHTML(info)}</span>`;
            }).join('')}</div>`
            : '<div class="empty-state">Nenhuma condição ambiental registrada.</div>';

        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('tactical-modal-open');
    }
    function closePlanetModal() {
        const modal = $('planet-modal');
        if (!modal) return;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('tactical-modal-open');
        setSelectedPlanet(null);
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
        try {
            if (force) { const c = readCache(); delete c.planets; writeCache(c); }
            const data = await fetchJSON(`${V1}/planets`, 'planets');
            allPlanets = Array.isArray(data) ? data : (Array.isArray(data?.planets) ? data.planets : []);
            await loadDSS();
            buildMap(allPlanets);
            $('mapa-loading')?.classList.add('hidden');
        } catch (err) {
            console.error('[Helldivers-BR/Mapa]', err);
            const loading = $('mapa-loading');
            if (loading) loading.innerHTML = `<div class="error-state">⚠ ${escapeHTML(err.message || 'Falha ao carregar o mapa galáctico.')}</div>`;
        }
    }

    function bindUI() {
        $('mapa-busca')?.addEventListener('input', event => { searchQuery = event.target.value; applyFilters(); });
        $('mapa-filtros')?.addEventListener('click', event => {
            const btn = event.target.closest('.mapa-filter');
            if (!btn) return;
            document.querySelectorAll('.mapa-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
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
            applyLayerVisibility();
        });
        $('planet-modal')?.addEventListener('click', event => {
            if (event.target.matches('[data-close-planet]') || event.target.closest('[data-close-planet]')) closePlanetModal();
        });
        document.addEventListener('keydown', event => { if (event.key === 'Escape') closePlanetModal(); });
    }

    document.addEventListener('DOMContentLoaded', () => {
        bindUI();
        loadPlanets();
        setInterval(() => loadPlanets(true), REFRESH);
    });
})();