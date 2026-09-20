/* HELLDIVERS-BR — tema global compartilhado do site */
(() => {
    'use strict';

    const STORAGE_KEY = 'hdbr-site-theme-v1';
    const DEFAULT_THEME = 'default';
    const MERIDIAN_THEME = 'meridian';

    /* Zoom interno do Helldivers-BR.
       A preferência é salva no navegador e reaplicada em todas as páginas. */
    const ZOOM_STORAGE_KEY = 'hdbr-site-zoom-v1';
    const ZOOM_STEPS = [80, 90, 100, 110, 120, 125, 133, 150, 175, 200];
    const DEFAULT_ZOOM = 100;

    /* Hino da Super Terra: coloque o arquivo em /audio/hino-super-terra.mp3.
       O player só aparece quando o navegador consegue carregar o MP3. */
    const AUDIO_STATE_KEY = 'hdbr-super-earth-anthem-v1';
    const THEME_SCRIPT = document.currentScript || document.querySelector('script[src$="theme.js"], script[src*="/theme.js"]');
    const SITE_BASE_URL = THEME_SCRIPT && THEME_SCRIPT.src
        ? new URL('.', THEME_SCRIPT.src)
        : new URL('.', window.location.href);
    const ANTHEM_URL = new URL('audio/hino-super-terra.mp3', SITE_BASE_URL).href;

    function readTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY) === MERIDIAN_THEME
                ? MERIDIAN_THEME
                : DEFAULT_THEME;
        } catch {
            return DEFAULT_THEME;
        }
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {}
    }

    function setDocumentThemeMarker(theme) {
        document.documentElement.dataset.hdTheme =
            theme === MERIDIAN_THEME ? MERIDIAN_THEME : DEFAULT_THEME;
    }

    function updateThemeButton(button, isMeridian) {
        button.setAttribute('aria-pressed', isMeridian ? 'true' : 'false');
        button.innerHTML = isMeridian
            ? '<span class="theme-toggle-icon">◉</span><span><small>TEMA</small>MERIDIAN</span>'
            : '<span class="theme-toggle-icon">◐</span><span><small>TEMA</small>PADRÃO</span>';
        button.title = isMeridian
            ? 'Voltar ao tema padrão'
            : 'Ativar tema Meridian';
    }

    function applyTheme(theme) {
        const normalizedTheme = theme === MERIDIAN_THEME
            ? MERIDIAN_THEME
            : DEFAULT_THEME;
        const isMeridian = normalizedTheme === MERIDIAN_THEME;

        setDocumentThemeMarker(normalizedTheme);

        if (document.body) {
            document.body.classList.toggle('theme-meridian', isMeridian);
        }

        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', isMeridian ? '#8f7cff' : '#ffe800');
        }

        document.querySelectorAll('[data-hd-theme-toggle]').forEach(button => {
            updateThemeButton(button, isMeridian);
        });

        document.dispatchEvent(new CustomEvent('hdbr:themechange', {
            detail: { theme: normalizedTheme }
        }));
    }

    function toggleTheme() {
        const nextTheme = readTheme() === MERIDIAN_THEME
            ? DEFAULT_THEME
            : MERIDIAN_THEME;

        saveTheme(nextTheme);
        applyTheme(nextTheme);
    }

    function ensureGlobalSearchScript() {
        const target = new URL('busca.js', SITE_BASE_URL).href;
        const existing = [...document.scripts].find(script => {
            if (!script.src) return false;
            try { return new URL(script.src, window.location.href).href === target; }
            catch { return false; }
        });
        if (existing) return true;

        const script = document.createElement('script');
        script.src = target;
        script.defer = true;
        script.dataset.hdGlobalSearchScript = '';
        document.head.appendChild(script);
        return true;
    }

    function ensureThemeButton() {
        if (document.querySelector('[data-hd-theme-toggle]')) {
            return true;
        }

        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) {
            return false;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'site-theme-wrap';
        wrapper.innerHTML = '<button class="site-theme-toggle" type="button" data-hd-theme-toggle aria-label="Trocar tema do site"></button>';

        const logo = sidebar.querySelector('.logo-container');
        if (logo) {
            logo.insertAdjacentElement('afterend', wrapper);
        } else {
            sidebar.prepend(wrapper);
        }

        wrapper.querySelector('[data-hd-theme-toggle]').addEventListener('click', toggleTheme);
        return true;
    }


    function normalizeZoom(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return DEFAULT_ZOOM;

        return ZOOM_STEPS.reduce((closest, step) => {
            return Math.abs(step - numeric) < Math.abs(closest - numeric)
                ? step
                : closest;
        }, DEFAULT_ZOOM);
    }

    function readZoom() {
        try {
            return normalizeZoom(localStorage.getItem(ZOOM_STORAGE_KEY) || DEFAULT_ZOOM);
        } catch {
            return DEFAULT_ZOOM;
        }
    }

    function saveZoom(value) {
        try {
            localStorage.setItem(ZOOM_STORAGE_KEY, String(normalizeZoom(value)));
        } catch {}
    }

    function updateZoomUI(value) {
        const normalized = normalizeZoom(value);

        document.querySelectorAll('[data-hd-zoom-value]').forEach(label => {
            label.textContent = `${normalized}%`;
        });

        document.querySelectorAll('[data-hd-zoom-minus]').forEach(button => {
            button.disabled = normalized <= ZOOM_STEPS[0];
        });

        document.querySelectorAll('[data-hd-zoom-plus]').forEach(button => {
            button.disabled = normalized >= ZOOM_STEPS[ZOOM_STEPS.length - 1];
        });
    }

    function applyZoom(value, save = false) {
        const normalized = normalizeZoom(value);

        /* CSS zoom altera o layout inteiro, inclusive sidebar e grids,
           sem exigir mudanças em cada index.html. */
        document.documentElement.style.zoom = String(normalized / 100);
        document.documentElement.dataset.hdZoom = String(normalized);

        if (save) saveZoom(normalized);
        updateZoomUI(normalized);

        document.dispatchEvent(new CustomEvent('hdbr:zoomchange', {
            detail: { zoom: normalized }
        }));

        /* Componentes que calculam largura via JS recebem um resize. */
        requestAnimationFrame(() => {
            window.dispatchEvent(new Event('resize'));
        });
    }

    function changeZoom(direction) {
        const current = readZoom();
        const index = Math.max(0, ZOOM_STEPS.indexOf(current));
        const nextIndex = Math.min(
            ZOOM_STEPS.length - 1,
            Math.max(0, index + direction)
        );
        applyZoom(ZOOM_STEPS[nextIndex], true);
    }

    function ensureZoomControl() {
        if (document.querySelector('[data-hd-zoom-control]')) {
            updateZoomUI(readZoom());
            return true;
        }

        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return false;

        const wrapper = document.createElement('div');
        wrapper.className = 'site-zoom-wrap';
        wrapper.setAttribute('data-hd-zoom-control', '');
        wrapper.innerHTML = `
            <div class="site-zoom-panel">
                <div class="site-zoom-head">
                    <span>ZOOM DO SITE<small>PREFERÊNCIA GLOBAL</small></span>
                    <span class="site-zoom-value" data-hd-zoom-value>100%</span>
                </div>
                <div class="site-zoom-controls">
                    <button type="button" class="site-zoom-btn" data-hd-zoom-minus aria-label="Diminuir zoom do site" title="Diminuir zoom">−</button>
                    <button type="button" class="site-zoom-reset" data-hd-zoom-reset aria-label="Restaurar zoom para 100%" title="Restaurar para 100%">
                        <span data-hd-zoom-value>100%</span>
                        <small>CLIQUE PARA 100%</small>
                    </button>
                    <button type="button" class="site-zoom-btn" data-hd-zoom-plus aria-label="Aumentar zoom do site" title="Aumentar zoom">+</button>
                </div>
            </div>`;

        const themeWrap = sidebar.querySelector('.site-theme-wrap');
        if (themeWrap) {
            themeWrap.insertAdjacentElement('afterend', wrapper);
        } else {
            const logo = sidebar.querySelector('.logo-container');
            if (logo) logo.insertAdjacentElement('afterend', wrapper);
            else sidebar.prepend(wrapper);
        }

        wrapper.querySelector('[data-hd-zoom-minus]').addEventListener('click', () => changeZoom(-1));
        wrapper.querySelector('[data-hd-zoom-plus]').addEventListener('click', () => changeZoom(1));
        wrapper.querySelector('[data-hd-zoom-reset]').addEventListener('click', () => applyZoom(DEFAULT_ZOOM, true));

        updateZoomUI(readZoom());
        return true;
    }



    function readAudioState() {
        try {
            const raw = sessionStorage.getItem(AUDIO_STATE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return {
                time: Number.isFinite(Number(parsed.time)) ? Math.max(0, Number(parsed.time)) : 0,
                playing: parsed.playing === true,
                volume: Number.isFinite(Number(parsed.volume)) ? Math.min(1, Math.max(0, Number(parsed.volume))) : 0.35
            };
        } catch {
            return { time: 0, playing: false, volume: 0.35 };
        }
    }

    function saveAudioState(audio, playingOverride) {
        if (!audio) return;
        try {
            const playing = typeof playingOverride === 'boolean'
                ? playingOverride
                : !audio.paused;
            sessionStorage.setItem(AUDIO_STATE_KEY, JSON.stringify({
                time: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
                playing,
                volume: audio.volume
            }));
        } catch {}
    }

    function updateAudioUI(wrapper, audio, blocked = false) {
        if (!wrapper || !audio) return;
        const button = wrapper.querySelector('[data-hd-audio-toggle]');
        const status = wrapper.querySelector('[data-hd-audio-status]');
        if (!button || !status) return;

        const playing = !audio.paused;
        button.textContent = playing ? '❚❚' : '▶';
        button.setAttribute('aria-label', playing ? 'Pausar Hino da Super Terra' : 'Tocar Hino da Super Terra');
        button.title = playing ? 'Pausar' : 'Tocar';

        status.classList.toggle('is-playing', playing);
        status.classList.toggle('is-blocked', blocked && !playing);
        status.textContent = playing
            ? 'TRANSMISSÃO ATIVA'
            : (blocked ? 'CLIQUE PARA RETOMAR' : 'TRANSMISSÃO PAUSADA');
    }

    function ensureAnthemPlayer() {
        if (document.querySelector('[data-hd-anthem-player]')) return;

        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        const state = readAudioState();
        const audio = document.createElement('audio');
        audio.src = ANTHEM_URL;
        audio.preload = 'metadata';
        audio.loop = true;
        audio.volume = state.volume;
        audio.setAttribute('data-hd-anthem-audio', '');

        const wrapper = document.createElement('div');
        wrapper.className = 'site-audio-wrap';
        wrapper.hidden = true;
        wrapper.setAttribute('data-hd-anthem-player', '');
        wrapper.innerHTML = `
            <div class="site-audio-panel">
                <div class="site-audio-head">
                    <span>HINO DA SUPER TERRA<small>TRANSMISSÃO OFICIAL</small></span>
                    <span>♫</span>
                </div>
                <div class="site-audio-controls">
                    <button class="site-audio-toggle" type="button" data-hd-audio-toggle aria-label="Tocar Hino da Super Terra">▶</button>
                    <input class="site-audio-volume" data-hd-audio-volume type="range" min="0" max="1" step="0.05" value="${state.volume}" aria-label="Volume do Hino da Super Terra">
                </div>
                <div class="site-audio-status" data-hd-audio-status>TRANSMISSÃO PAUSADA</div>
            </div>`;

        const zoomWrap = sidebar.querySelector('.site-zoom-wrap');
        const themeWrap = sidebar.querySelector('.site-theme-wrap');
        if (zoomWrap) {
            zoomWrap.insertAdjacentElement('afterend', wrapper);
        } else if (themeWrap) {
            themeWrap.insertAdjacentElement('afterend', wrapper);
        } else {
            const logo = sidebar.querySelector('.logo-container');
            if (logo) logo.insertAdjacentElement('afterend', wrapper);
            else sidebar.prepend(wrapper);
        }
        document.body.appendChild(audio);

        const toggle = wrapper.querySelector('[data-hd-audio-toggle]');
        const volume = wrapper.querySelector('[data-hd-audio-volume]');
        let navigating = false;
        let lastSave = 0;

        audio.addEventListener('loadedmetadata', async () => {
            wrapper.hidden = false;
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
                const safeTime = state.time >= audio.duration ? state.time % audio.duration : state.time;
                try { audio.currentTime = safeTime; } catch {}
            }

            if (state.playing) {
                try {
                    await audio.play();
                    updateAudioUI(wrapper, audio, false);
                } catch {
                    updateAudioUI(wrapper, audio, true);
                }
            } else {
                updateAudioUI(wrapper, audio, false);
            }
        }, { once: true });

        /* Se o arquivo não existir, o player simplesmente não aparece. */
        audio.addEventListener('error', () => {
            wrapper.hidden = true;
        });

        toggle.addEventListener('click', async () => {
            if (audio.paused) {
                try {
                    await audio.play();
                    saveAudioState(audio, true);
                    updateAudioUI(wrapper, audio, false);
                } catch {
                    updateAudioUI(wrapper, audio, true);
                }
            } else {
                audio.pause();
                saveAudioState(audio, false);
                updateAudioUI(wrapper, audio, false);
            }
        });

        volume.addEventListener('input', () => {
            audio.volume = Math.min(1, Math.max(0, Number(volume.value)));
            saveAudioState(audio);
        });

        audio.addEventListener('play', () => {
            saveAudioState(audio, true);
            updateAudioUI(wrapper, audio, false);
        });
        audio.addEventListener('pause', () => {
            if (!navigating) saveAudioState(audio, false);
            updateAudioUI(wrapper, audio, false);
        });
        audio.addEventListener('timeupdate', () => {
            const now = Date.now();
            if (now - lastSave >= 750) {
                lastSave = now;
                saveAudioState(audio);
            }
        });

        window.addEventListener('pagehide', () => {
            navigating = true;
            saveAudioState(audio, !audio.paused);
        });
    }

    function initializeThemeUI() {
        ensureThemeButton();
        ensureZoomControl();
        ensureAnthemPlayer();
        ensureGlobalSearchScript();
        applyTheme(readTheme());
        applyZoom(readZoom());
    }

    /* Marca o tema imediatamente. Assim, ao trocar de página, o site já
       sabe qual tema usar antes de criar o botão da sidebar. */
    setDocumentThemeMarker(readTheme());
    applyZoom(readZoom());

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeThemeUI, { once: true });
    } else {
        initializeThemeUI();
    }

    /* Se o tema mudar em outra aba/janela, esta página acompanha. */
    window.addEventListener('storage', event => {
        if (event.key === STORAGE_KEY) {
            applyTheme(readTheme());
        }
        if (event.key === ZOOM_STORAGE_KEY) {
            applyZoom(readZoom());
        }
    });

    /* Ao voltar pelo histórico do navegador, reaplica as preferências globais. */
    window.addEventListener('pageshow', () => {
        applyTheme(readTheme());
        applyZoom(readZoom());
    });
})();

// PWA shared with pages in subfolders: resolve paths from this script.
(() => {
 const base = new URL('.', document.currentScript.src);
 const boot = () => {
  if (!document.querySelector('link[rel="manifest"]')) {
   const link = document.createElement('link'); link.rel = 'manifest';
   link.href = new URL('manifest.webmanifest', base); document.head.append(link);
  }
  if (!document.querySelector('script[data-hd-pwa], script[src$="pwa.js"]')) {
   const script = document.createElement('script'); script.dataset.hdPwa = '';
   script.src = new URL('pwa.js', base); document.head.append(script);
  }
 };
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();

// Shared fixed mobile navigation, resolved relative to the site root.
(() => {
 const base=new URL('.',document.currentScript.src);
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('mobile-nav.css',base);document.head.append(css);
 const script=document.createElement('script');script.src=new URL('mobile-nav.js',base);script.async=false;document.head.append(script);
})();
