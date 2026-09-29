(() => {
 'use strict';
 const base = new URL('.', document.currentScript.src);
 const toggle = document.getElementById('menu-toggle'), menu = document.querySelector('.sidebar');
 toggle?.addEventListener('click', () => {
  const open = menu.classList.toggle('active');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.textContent = open ? '✕ FECHAR MENU' : '☰ MENU DE NAVEGAÇÃO';
 });
 fetch(new URL('aplicativos-downloads.json', base), {cache:'no-store'})
 .then(response => { if(!response.ok) throw new Error('Downloads indisponíveis'); return response.json(); })
 .then(config => {
  document.querySelectorAll('[data-app]').forEach(card => {
   const entry = config[card.dataset.app];
   if(!entry || typeof entry.url !== 'string' || !entry.url.trim()) return;
   let url; try { url = new URL(entry.url); } catch { return; }
   if(url.protocol !== 'https:') return;
   const link = card.querySelector('a'); link.href = url.href; link.hidden = false;
   card.querySelector('.app-status').hidden = true;
   if(typeof entry.version === 'string' && entry.version.trim()) card.querySelector('.app-release').append(document.createTextNode(' · Versão '+entry.version));
  });
 }).catch(() => { /* Preserve the honest unavailable state without a broken download. */ });
})();
