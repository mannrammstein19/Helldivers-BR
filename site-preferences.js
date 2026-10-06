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
        main.prepend(bar);
        function close() { panel.hidden = true; button.setAttribute('aria-expanded', 'false'); }
        button.addEventListener('click', () => {
            panel.hidden = !panel.hidden;
            button.setAttribute('aria-expanded', String(!panel.hidden));
        });
        document.addEventListener('click', event => { if (!bar.contains(event.target)) close(); });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !panel.hidden) { close(); button.focus(); }
        });
        bar.addEventListener('focusout', event => { if (!bar.contains(event.relatedTarget)) close(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
    else mount();
})();
