/* HELLDIVERS-BR — Busca Global HDBR
   - Interface criada automaticamente na sidebar.
   - Funciona em qualquer profundidade porque usa a URL do próprio busca.js.
   - Pesquisa dados.js + warbonds.js + páginas principais/facções.
*/
(() => {
    'use strict';

    const SEARCH_SCRIPT = document.currentScript || document.querySelector('script[src$="busca.js"], script[src*="/busca.js"]');
    const SITE_BASE_URL = SEARCH_SCRIPT && SEARCH_SCRIPT.src
        ? new URL('.', SEARCH_SCRIPT.src)
        : new URL('.', window.location.href);

    const DATA_URL = new URL('dados.js', SITE_BASE_URL).href;
    const WARBONDS_URL = new URL('warbonds.js', SITE_BASE_URL).href;
    const FALLBACK_ICON = new URL('imagens/fundos/site/logo.jpg', SITE_BASE_URL).href;
    const RESULT_LIMIT = 18;

    const CORE_PAGES = [
        { title:'Página Principal', category:'Portal HDBR', url:'index.html', icon:'imagens/fundos/site/logo.jpg', keywords:'home inicio início helldivers br portal' },
        { title:'Central de Guerra', category:'Guerra Galáctica', url:'guerra.html', icon:'imagens/fundos/site/central/central-horizontal.jpg', keywords:'guerra ordem maior major order frente defesa libertacao libertação campanha' },
        { title:'Estratagemas', category:'Arsenal', url:'estratagemas.html', icon:'imagens/fundos/site/wallpaper_principal_estratagema.png', keywords:'estratagema orbital eagle aguia águia sentinela arma apoio plataforma' },
        { title:'Facções', category:'Inimigos & Facções', url:'faccoes.html', icon:'imagens/fundos/site/wallpaper_principal_page.png', keywords:'faccao facção faccoes facções inimigos super terra' },
        { title:'Autômatos — Lore', category:'Facção', url:'inimigos/automatos.html', icon:'imagens/inimigos/automatons/automatons-horizontal.png', keywords:'automatos autômatos automatons robos robôs bots lore' },
        { title:'Terminídeos — Lore', category:'Facção', url:'inimigos/terminideos.html', icon:'imagens/inimigos/terminids/terminideos-horizontal.jpg', keywords:'terminideos terminídeos terminids insetos bugs lore' },
        { title:'Iluminados — Lore', category:'Facção', url:'inimigos/iluminados.html', icon:'imagens/inimigos/illuminates/iluminados-horizontal.jpg', keywords:'iluminados illuminate illuminates squid molusco lore' },
        { title:'Mapa Galáctico Tático', category:'Mapa', url:'mapa-classico.html', icon:'imagens/fundos/mapa/universo-fundo.jpg', keywords:'mapa galaxia galáxia planetas setores rotas suprimento' },
        { title:'Mapa Galáctico 3D', category:'Mapa', url:'mapa-galatico.html', icon:'imagens/fundos/mapa/universo-fundo.jpg', keywords:'mapa 3d galaxia galáxia planetas' },
        { title:'Passes de Guerra', category:'Warbonds', url:'warbonds/warbonds-wiki.html', icon:'imagens/fundos/site/warbonds.png', keywords:'warbond warbonds passe passes guerra medalhas' }
    ];

    function normalize(value) {
        return String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
        })[char]);
    }

    function isAbsoluteURL(value) {
        return /^(?:https?:)?\/\//i.test(String(value || '')) || /^(?:data|blob):/i.test(String(value || ''));
    }

    function siteURL(path) {
        if (!path) return SITE_BASE_URL.href;
        return isAbsoluteURL(path) ? String(path) : new URL(String(path).replace(/^\.\//, ''), SITE_BASE_URL).href;
    }

    function getSearchData() {
        try {
            return typeof searchData !== 'undefined' && Array.isArray(searchData) ? searchData : [];
        } catch {
            return [];
        }
    }

    function getWarbondsData() {
        try {
            return typeof warbondsData !== 'undefined' && Array.isArray(warbondsData) ? warbondsData : [];
        } catch {
            return [];
        }
    }

    function hasGlobal(name) {
        if (name === 'searchData') return getSearchData().length > 0;
        if (name === 'warbondsData') return getWarbondsData().length > 0;
        return false;
    }

    function loadClassicScript(src, globalName) {
        if (hasGlobal(globalName)) return Promise.resolve();

        const existing = [...document.scripts].find(script => {
            try { return new URL(script.src, location.href).href === src; }
            catch { return false; }
        });

        if (existing) {
            if (existing.dataset.hdSearchLoaded === '1' || hasGlobal(globalName)) return Promise.resolve();
            return new Promise(resolve => {
                existing.addEventListener('load', resolve, { once:true });
                existing.addEventListener('error', resolve, { once:true });
                setTimeout(resolve, 1200);
            });
        }

        return new Promise(resolve => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.dataset.hdGlobalSearchData = globalName;
            script.addEventListener('load', () => { script.dataset.hdSearchLoaded = '1'; resolve(); }, { once:true });
            script.addEventListener('error', resolve, { once:true });
            document.head.appendChild(script);
        });
    }

    async function ensureDatabases() {
        await Promise.all([
            loadClassicScript(DATA_URL, 'searchData'),
            loadClassicScript(WARBONDS_URL, 'warbondsData')
        ]);
    }

    function uniqueDatabase() {
        const seen = new Set();
        const combined = [...CORE_PAGES, ...getSearchData(), ...getWarbondsData()];
        return combined.filter(item => {
            if (!item || !item.title || !item.url) return false;
            const key = `${normalize(item.title)}|${item.url}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function scoreItem(item, query) {
        const q = normalize(query);
        if (!q) return -1;
        const title = normalize(item.title);
        const category = normalize(item.category);
        const keywords = normalize(item.keywords);
        const haystack = `${title} ${category} ${keywords}`;

        if (title === q) return 1000;
        if (title.startsWith(q)) return 700;
        if (title.includes(q)) return 500;
        if (category.startsWith(q)) return 300;
        if (category.includes(q)) return 220;
        if (keywords.includes(q)) return 180;
        if (haystack.split(/\s+/).some(word => word.startsWith(q))) return 120;
        return -1;
    }

    function findResults(query) {
        return uniqueDatabase()
            .map(item => ({ item, score:scoreItem(item, query) }))
            .filter(entry => entry.score >= 0)
            .sort((a,b) => b.score - a.score || String(a.item.title).localeCompare(String(b.item.title), 'pt-BR'))
            .slice(0, RESULT_LIMIT)
            .map(entry => entry.item);
    }

    function resultIcon(item) {
        return item.icon ? siteURL(item.icon) : FALLBACK_ICON;
    }

    function renderResults(wrapper, query) {
        const dropdown = wrapper.querySelector('[data-hd-search-results]');
        if (!dropdown) return;
        const q = String(query || '').trim();
        if (!q) {
            dropdown.hidden = true;
            dropdown.innerHTML = '';
            return;
        }

        const results = findResults(q);
        if (!results.length) {
            dropdown.innerHTML = '<div class="site-search-empty">⚠ NENHUM REGISTRO LOCALIZADO</div>';
            dropdown.hidden = false;
            return;
        }

        dropdown.innerHTML = results.map(item => `
            <a class="site-search-result" href="${escapeHTML(siteURL(item.url))}">
                <span class="site-search-result-icon">
                    <img src="${escapeHTML(resultIcon(item))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${escapeHTML(FALLBACK_ICON)}'">
                </span>
                <span class="site-search-result-copy">
                    <strong>${escapeHTML(item.title)}</strong>
                    <small>${escapeHTML(item.category || 'HDBR')}</small>
                </span>
                <span class="site-search-result-arrow">›</span>
            </a>`).join('');
        dropdown.hidden = false;
    }

    function ensureSearchUI() {
        if (document.querySelector('[data-hd-global-search]')) return true;
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return false;

        const wrapper = document.createElement('div');
        wrapper.className = 'site-search-wrap';
        wrapper.setAttribute('data-hd-global-search', '');
        wrapper.innerHTML = `
            <div class="site-search-panel">
                <label class="site-search-label" for="hd-global-search-input">
                    <span>BUSCA GLOBAL HDBR</span><small>ARQUIVOS DA SUPER TERRA</small>
                </label>
                <div class="site-search-input-row">
                    <span class="site-search-icon" aria-hidden="true">⌕</span>
                    <input id="hd-global-search-input" data-hd-search-input type="search" autocomplete="off" spellcheck="false" placeholder="Pesquisar no site..." aria-label="Pesquisar no site inteiro">
                    <button type="button" class="site-search-clear" data-hd-search-clear aria-label="Limpar pesquisa" title="Limpar">×</button>
                </div>
                <div class="site-search-results" data-hd-search-results hidden></div>
            </div>`;

        const logo = sidebar.querySelector('.logo-container');
        const theme = sidebar.querySelector('.site-theme-wrap');
        if (logo) logo.insertAdjacentElement('afterend', wrapper);
        else if (theme) theme.insertAdjacentElement('beforebegin', wrapper);
        else sidebar.prepend(wrapper);

        const input = wrapper.querySelector('[data-hd-search-input]');
        const clear = wrapper.querySelector('[data-hd-search-clear]');
        const results = wrapper.querySelector('[data-hd-search-results]');

        let databaseReady = false;
        let loadingPromise = null;
        const prepare = () => {
            if (databaseReady) return Promise.resolve();
            if (!loadingPromise) {
                wrapper.classList.add('is-loading');
                loadingPromise = ensureDatabases().finally(() => {
                    databaseReady = true;
                    wrapper.classList.remove('is-loading');
                });
            }
            return loadingPromise;
        };

        input.addEventListener('focus', async () => {
            await prepare();
            if (input.value.trim()) renderResults(wrapper, input.value);
        });

        input.addEventListener('input', async () => {
            await prepare();
            renderResults(wrapper, input.value);
        });

        clear.addEventListener('click', () => {
            input.value = '';
            renderResults(wrapper, '');
            input.focus();
        });

        input.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                results.hidden = true;
                input.blur();
            }
            if (event.key === 'Enter') {
                const first = results.querySelector('.site-search-result');
                if (first) {
                    event.preventDefault();
                    first.click();
                }
            }
        });

        document.addEventListener('click', event => {
            if (!wrapper.contains(event.target)) results.hidden = true;
        });

        prepare();
        return true;
    }

    function init() {
        if (!ensureSearchUI()) {
            let attempts = 0;
            const timer = setInterval(() => {
                attempts += 1;
                if (ensureSearchUI() || attempts > 30) clearInterval(timer);
            }, 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once:true });
    } else {
        init();
    }
})();
