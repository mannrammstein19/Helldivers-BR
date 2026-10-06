/* Ordem Pessoal: publicação confirmada, sem acesso ao progresso do jogador. */
(function (global) {
 'use strict';
 const MAX_AGE = 48 * 60 * 60 * 1000;
 function validate(payload, now = Date.now()) {
  const o = payload && payload.schema === 1 && payload.order;
  if (!o || typeof o.id !== 'string' || !o.id.trim() || typeof o.objective !== 'string' || !o.objective.trim() || o.objective.length > 1000) return null;
  if (typeof o.confirmedAt !== 'string' || typeof o.expiresAt !== 'string') return null;
  const confirmed = Date.parse(o.confirmedAt), end = Date.parse(o.expiresAt);
  if (!Number.isFinite(confirmed) || !Number.isFinite(end) || confirmed > now || now - confirmed > MAX_AGE || end <= now || end <= confirmed) return null;
  if (!Number.isSafeInteger(o.medals) || o.medals < 0 || typeof o.source !== 'string') return null;
  try { const u = new URL(o.source); if (u.protocol !== 'https:') return null; } catch (_) { return null; }
  return { id: o.id, objective: o.objective.trim(), medals: o.medals, confirmedAt: confirmed, expiresAt: end, source: o.source };
 }
 function duration(end, now = Date.now()) {
  const minutes = Math.max(0, Math.ceil((end - now) / 60000));
  return `${Math.floor(minutes / 60)}H ${minutes % 60}M`;
 }
 global.HDBRPersonalOrder = Object.freeze({ validate, duration });
 const doc = global.document;
 if (!doc) return;
 const cards = Array.from(doc.querySelectorAll('[data-personal-order]'));
 if (!cards.length) return;
 let order = null, timer = null, controller = null, busy = false;
 function render() {
  const now = Date.now();
  const active = order && now < order.expiresAt && now - order.confirmedAt <= MAX_AGE;
  cards.forEach(card => {
   const objective = card.querySelector('[data-personal-objective]');
   card.querySelector('[data-personal-deadline]').hidden = !active;
   card.querySelector('[data-personal-reward]').hidden = !active;
   card.querySelector('[data-personal-status]').hidden = !!active;
   if (active) {
    objective.textContent = order.objective;
    card.querySelector('[data-personal-time]').textContent = duration(order.expiresAt, now);
    card.querySelector('[data-personal-medals]').textContent = String(order.medals);
    objective.title = `Informação confirmada em ${new Date(order.confirmedAt).toLocaleString('pt-BR')}`;
   } else {
    objective.textContent = 'Aguardando informação confirmada.';
    objective.removeAttribute('title');
   }
  });
 }
 async function refresh() {
  if (busy || doc.hidden) return;
  busy = true;
  controller = new AbortController();
  const timeout = global.setTimeout(() => controller.abort(), 8000);
  try {
   // Arquivo do próprio site. Nenhuma consulta direta às APIs da guerra.
   const response = await global.fetch('dados/personal-order.json', { cache: 'no-store', signal: controller.signal });
   if (!response.ok) throw Error('Publicação indisponível');
   const payload = await response.json();
   if (payload?.schema !== 1) throw Error('Publicação inválida');
   if (payload.order === null) order = null;
   else {
    const checked = validate(payload);
    if (!checked) throw Error('Ordem sem confirmação válida');
    order = checked;
   }
  } catch (_) { /* Conserva apenas a leitura já validada até seu prazo. */ }
  finally { global.clearTimeout(timeout); controller = null; busy = false; render(); }
 }
 function start() {
  if (timer !== null || doc.hidden) return;
  refresh();
  timer = global.setInterval(() => { render(); refresh(); }, 60000);
 }
 function stop() { if (timer !== null) global.clearInterval(timer); timer = null; controller?.abort(); }
 doc.addEventListener('visibilitychange', () => { if (doc.hidden) stop(); else start(); });
 global.addEventListener('pagehide', stop);
 global.addEventListener('pageshow', start);
 render(); start();
})(typeof window !== 'undefined' ? window : globalThis);
