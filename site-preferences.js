/* Apenas apresentação: move os controles existentes, conservando seus eventos. */
(() => {
    'use strict';
    function mount() {
        const sidebar = document.querySelector('.sidebar');
        const main = document.querySelector('main');
        if (!sidebar || !main || document.body.classList.contains('mapa-immersive') || document.getElementById('site-preferences')) return;
        const controls = sidebar.querySelectorAll('.site-theme-wrap, .site-zoom-wrap, .site-audio-wrap');
        if (!controls.length) return;
        const bar = document.createElement('div');
        bar.className = 'site-preferences-bar';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'site-preferences-toggle';
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', 'site-preferences');
        button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/><path d="M8 3v6M16 9v6M10 15v6"/></svg><span>Preferências</span><span class="preferences-chevron" aria-hidden="true">⌄</span>';
        const panel = document.createElement('section');
        panel.id = 'site-preferences';
        panel.className = 'site-preferences-panel';
        panel.setAttribute('aria-label', 'Tema, zoom e música');
        panel.hidden = true;
        controls.forEach(control => panel.append(control));
        bar.append(button, panel);
        const search = sidebar.querySelector('[data-hd-global-search]');
        if (search) search.before(bar);
        else (sidebar.querySelector('.logo-container') || sidebar.firstElementChild).after(bar);
        // A busca carrega separadamente; conserva a ordem também quando chega depois.
        const observer = new MutationObserver(() => {
            const search = sidebar.querySelector('[data-hd-global-search]');
            if (search && search.previousElementSibling !== bar) search.before(bar);
        });
        observer.observe(sidebar, {childList:true});
        document.body.classList.add('has-site-preferences');
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'preferences-close';
        dismiss.textContent = '×';
        dismiss.setAttribute('aria-label', 'Fechar preferências');
        panel.prepend(dismiss);
        function close() {
            panel.hidden = true;
            button.setAttribute('aria-expanded', 'false');
        }
        function position() {
            if (panel.hidden) return;
            const zoom = Number(document.documentElement.dataset.hdZoom || 100) / 100;
            const width = document.documentElement.clientWidth / zoom;
            const height = window.innerHeight / zoom;
            const edge = sidebar.getBoundingClientRect().right / zoom;
            const top = button.getBoundingClientRect().top / zoom;
            const panelWidth = Math.min(360, width - 24);
            const left = edge + 12 + panelWidth <= width - 12 ? edge + 12 : Math.max(12, width - panelWidth - 12);
            panel.style.width = panelWidth + 'px';
            panel.style.left = left + 'px';
            panel.style.maxHeight = Math.max(100, height - 24) + 'px';
            panel.style.top = Math.max(12, Math.min(top, height - panel.offsetHeight - 12)) + 'px';
        }
        // Os controles atualizam o próprio conteúdo; o menu móvel não deve interpretar isso como clique externo.
        panel.addEventListener('click', event => event.stopPropagation());
        dismiss.addEventListener('click', () => { close(); button.focus(); });
        window.addEventListener('resize', position);
        sidebar.addEventListener('scroll', position, {passive:true});
        button.addEventListener('click', () => {
            panel.hidden = !panel.hidden;
            button.setAttribute('aria-expanded', String(!panel.hidden));
            position();
        });
        document.addEventListener('click', event => { if (!event.composedPath().includes(bar)) close(); });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !panel.hidden) { close(); button.focus(); }
        });
        bar.addEventListener('focusout', event => { if (!bar.contains(event.relatedTarget)) close(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
    else mount();
})();
