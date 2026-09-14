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

    const SVG_NS = 'http://www.w3.org/2000/svg';
    function svgEl(tag, attrs = {}) {
        const el = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        return el;
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
        const blur = svgEl('filter', { id: 'mapa-halo-blur', x: '-60%', y: '-60%', width: '220%', height: '220%' });
        blur.appendChild(svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: blurAmount }));
        defs.appendChild(blur);
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

        const withPos = planets
            .map(p => {
                const pos = getPosition(p);
                if (!pos) return null;
                return { raw: p, x: pos.x * SCALE, y: -pos.y * SCALE }; // eixo Y invertido para "cima = norte"
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
        svg.setAttribute('viewBox', `${bounds.minX} ${bounds.minY} ${w} ${h}`);

        const viewport = svgEl('g', { id: 'mapa-viewport' });
        const haloGroup = svgEl('g', { class: 'mapa-halos' });
        const linesGroup = svgEl('g', { class: 'mapa-lines' });
        const dotsGroup = svgEl('g', { class: 'mapa-dots' });
        viewport.appendChild(haloGroup);
        viewport.appendChild(linesGroup);
        viewport.appendChild(dotsGroup);
        svg.appendChild(buildDefs(Math.max(w, h) / 35));
        svg.appendChild(viewport);

        buildFactionHalos(withPos).forEach(({ key, cx, cy, radius }) => {
            haloGroup.appendChild(svgEl('circle', {
                class: 'mapa-faction-halo',
                cx, cy, r: radius,
                fill: FACTION_COLORS[key],
                filter: 'url(#mapa-halo-blur)'
            }));
        });

        const posByIndex = new Map(withPos.map(w => [w.raw.index, w]));

        // Linhas de suprimento (dedupe por par ordenado, pra não desenhar 2x a mesma linha)
        const drawn = new Set();
        withPos.forEach(({ raw, x, y }) => {
            getWaypoints(raw).forEach(targetIndex => {
                const target = posByIndex.get(targetIndex);
                if (!target) return;
                const key = [raw.index, targetIndex].sort((a, b) => a - b).join('-');
                if (drawn.has(key)) return;
                drawn.add(key);
                linesGroup.appendChild(svgEl('line', {
                    class: 'mapa-supply-line',
                    x1: x, y1: y, x2: target.x, y2: target.y
                }));
            });
        });

        // Raio proporcional ao espaço do mapa, pra ficar legível em qualquer galáxia
        const baseRadius = Math.max(w, h) / 260;

        withPos.forEach(({ raw, x, y }) => {
            const owner = raw.currentOwner || raw.owner;
            const fKey = factionKey(owner);
            const underAttack = !!raw.event;
            const group = svgEl('g', { 'data-index': raw.index, 'data-faction': fKey });

            if (underAttack) {
                const ringColor = factionColor(raw.event?.faction || owner);
                const ringRadius = baseRadius * 2.3;
                const ring = svgEl('circle', {
                    class: 'mapa-planet-ring',
                    cx: x, cy: y, r: ringRadius,
                    stroke: ringColor
                });
                group.appendChild(ring);
                // Tiquinhos ao redor do anel, tipo retículo de alvo (igual ao mapa oficial).
                const tickLen = baseRadius * 0.9, tickGap = baseRadius * 0.4;
                [0, 90, 180, 270].forEach(deg => {
                    const rad = deg * Math.PI / 180;
                    const dx = Math.cos(rad), dy = Math.sin(rad);
                    group.appendChild(svgEl('line', {
                        class: 'mapa-planet-tick',
                        x1: x + dx * (ringRadius + tickGap), y1: y + dy * (ringRadius + tickGap),
                        x2: x + dx * (ringRadius + tickGap + tickLen), y2: y + dy * (ringRadius + tickGap + tickLen),
                        stroke: ringColor
                    }));
                });
            }

            const circle = svgEl('circle', {
                class: 'mapa-planet-dot',
                cx: x, cy: y, r: underAttack ? baseRadius * 1.35 : baseRadius,
                fill: `url(#planet-grad-${fKey})`
            });
            const title = svgEl('title', {});
            title.textContent = `${clean(raw.name) || 'Planeta desconhecido'} — ${clean(raw.sector) || 'Setor desconhecido'}`;
            circle.appendChild(title);
            group.appendChild(circle);

            if (dssHostIndex != null && String(dssHostIndex) === String(raw.index)) {
                const size = baseRadius * 0.85;
                const cy2 = y - baseRadius * 2.8;
                const diamond = svgEl('path', {
                    class: 'mapa-dss-marker',
                    d: `M ${x} ${cy2 - size} L ${x + size} ${cy2} L ${x} ${cy2 + size} L ${x - size} ${cy2} Z`,
                    fill: 'url(#planet-grad-dss)', stroke: '#000', 'stroke-width': 0.25
                });
                group.appendChild(diamond);
                const dssLabel = svgEl('text', {
                    class: 'mapa-dss-label', x, y: cy2 - size * 1.9, 'text-anchor': 'middle'
                });
                dssLabel.textContent = 'DSS';
                group.appendChild(dssLabel);
            }

            const label = svgEl('text', {
                class: 'mapa-planet-label',
                x, y: y + baseRadius * 2.4,
                'text-anchor': 'middle'
            });
            label.textContent = clean(raw.name) || 'Planeta desconhecido';
            group.appendChild(label);

            group.addEventListener('click', () => openPlanetModal(raw));
            dotsGroup.appendChild(group);

            nodeByIndex.set(String(raw.index), { data: raw, group, circle });
        });

        applyFilters();
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
            group.querySelectorAll('.mapa-planet-dot, .mapa-planet-ring, .mapa-planet-label').forEach(el => el.classList.toggle('dimmed', !show));
        });
    }

    // ================================================================
    // PAN & ZOOM
    // ================================================================
    function setupPanZoom(svg, viewport) {
        let scale = 1, tx = 0, ty = 0;
        let isPanning = false, lastX = 0, lastY = 0, moved = false;
        let pinchStartDist = null, pinchStartScale = 1;

        const LABEL_ZOOM_THRESHOLD = 2.2;
        function apply() {
            viewport.setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`);
            viewport.classList.toggle('mapa-labels-on', scale >= LABEL_ZOOM_THRESHOLD);
        }

        function clientToSvgPoint(clientX, clientY) {
            const rect = svg.getBoundingClientRect();
            const vb = svg.viewBox.baseVal;
            const px = (clientX - rect.left) / rect.width * vb.width + vb.x;
            const py = (clientY - rect.top) / rect.height * vb.height + vb.y;
            return { x: px, y: py };
        }

        function zoomAt(clientX, clientY, factor) {
            const before = clientToSvgPoint(clientX, clientY);
            const newScale = Math.max(0.5, Math.min(12, scale * factor));
            if (newScale === scale) return;
            // Mantém o ponto sob o cursor fixo enquanto aplica o zoom.
            tx = before.x - (before.x - tx) * (newScale / scale);
            ty = before.y - (before.y - ty) * (newScale / scale);
            scale = newScale;
            apply();
        }

        svg.addEventListener('wheel', event => {
            event.preventDefault();
            const factor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
            zoomAt(event.clientX, event.clientY, factor);
        }, { passive: false });

        svg.addEventListener('pointerdown', event => {
            if (event.pointerType === 'touch' && svg._activePointers?.size > 1) return;
            isPanning = true; moved = false;
            lastX = event.clientX; lastY = event.clientY;
            svg.setPointerCapture(event.pointerId);
        });
        svg.addEventListener('pointermove', event => {
            if (!isPanning) return;
            const dx = event.clientX - lastX, dy = event.clientY - lastY;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
            const rect = svg.getBoundingClientRect();
            const vb = svg.viewBox.baseVal;
            tx += dx / rect.width * vb.width;
            ty += dy / rect.height * vb.height;
            lastX = event.clientX; lastY = event.clientY;
            apply();
        });
        function endPan(event) { isPanning = false; try { svg.releasePointerCapture(event.pointerId); } catch {} }
        svg.addEventListener('pointerup', endPan);
        svg.addEventListener('pointercancel', endPan);
        svg.addEventListener('pointerleave', endPan);

        // Evita que um arraste vire "clique" acidental num planeta.
        svg.addEventListener('click', event => {
            if (moved) { event.stopPropagation(); moved = false; }
        }, true);

        // Pinça (dois dedos) para zoom no celular.
        const activePointers = new Map();
        svg._activePointers = activePointers;
        svg.addEventListener('pointerdown', e => activePointers.set(e.pointerId, e));
        svg.addEventListener('pointermove', e => {
            if (!activePointers.has(e.pointerId)) return;
            activePointers.set(e.pointerId, e);
            if (activePointers.size === 2) {
                const pts = [...activePointers.values()];
                const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
                const midX = (pts[0].clientX + pts[1].clientX) / 2;
                const midY = (pts[0].clientY + pts[1].clientY) / 2;
                if (pinchStartDist == null) { pinchStartDist = dist; pinchStartScale = scale; }
                else zoomAt(midX, midY, (dist / pinchStartDist) * (pinchStartScale / scale));
            }
        });
        function clearPointer(e) { activePointers.delete(e.pointerId); if (activePointers.size < 2) pinchStartDist = null; }
        svg.addEventListener('pointerup', clearPointer);
        svg.addEventListener('pointercancel', clearPointer);

        $('mapa-zoom-in')?.addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.35); });
        $('mapa-zoom-out')?.addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.35); });
        $('mapa-zoom-reset')?.addEventListener('click', () => { scale = 1; tx = 0; ty = 0; apply(); });

        apply();
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