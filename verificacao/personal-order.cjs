const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'personal-order.js'), 'utf8');
const ctx = { URL }; vm.createContext(ctx); vm.runInContext(code, ctx);
const now = Date.now();
const fixture = { schema: 1, order: { id: 'test-only', objective: 'Objetivo fictício de teste', medals: 15, confirmedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 3600000).toISOString(), source: 'https://example.com/confirmed-test' } };
assert.ok(ctx.HDBRPersonalOrder.validate(fixture, now));
for (const change of [{ medals: '15' }, { confirmedAt: new Date(now + 1000).toISOString() }, { expiresAt: new Date(now).toISOString() }, { objective: '' }, { source: 'javascript:alert(1)' }, { confirmedAt: new Date(now - 49 * 3600000).toISOString() }]) {
 assert.equal(ctx.HDBRPersonalOrder.validate({ schema: 1, order: { ...fixture.order, ...change } }, now), null);
}
assert.equal(ctx.HDBRPersonalOrder.validate({ schema: 1, order: null }, now), null);
assert.equal(ctx.HDBRPersonalOrder.duration(now + 391 * 60000, now), '6H 31M');
(async () => {
 for (const page of ['index.html', 'guerra.html']) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, page), 'utf8'), { url: 'https://example.com/' + page, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; let payload = fixture, calls = [], intervals = [], fail = false;
  w.fetch = async (url) => { calls.push(url); if (fail) throw Error('offline'); return { ok: true, json: async () => payload }; };
  w.setInterval = fn => { intervals.push(fn); return 1; }; w.clearInterval = () => {};
  w.eval(code);
  await new Promise(resolve => setImmediate(resolve));
  const card = w.document.querySelector('[data-personal-order]');
  assert.equal(w.document.querySelectorAll('[data-personal-order]').length, 1);
  assert.equal(card.querySelector('[data-personal-objective]').textContent, fixture.order.objective);
  assert.equal(card.querySelector('[data-personal-medals]').textContent, '15');
  assert.equal(card.querySelector('[data-personal-reward]').hidden, false);
  assert.equal(card.querySelector('progress'), null);
  assert.equal(card.querySelector('[role="progressbar"]'), null);
  if (page === 'index.html') {
   const pair = card.parentElement; assert.ok(pair.classList.contains('hd-command-pair'));
   assert.ok(pair.children[0].classList.contains('hd-app-promo'));
   assert.equal(pair.querySelector('.apps-button').getAttribute('href'), 'aplicativos.html');
  } else assert.ok(card.nextElementSibling.querySelector('#dss'));
  fail = true; intervals[0](); await new Promise(resolve => setImmediate(resolve));
  assert.equal(card.querySelector('[data-personal-objective]').textContent, fixture.order.objective);
  fail = false; payload = { schema: 1, order: { ...fixture.order, objective: '<img src=x onerror=alert(1)>' } };
  intervals[0](); await new Promise(resolve => setImmediate(resolve));
  assert.equal(card.querySelector('[data-personal-objective] img'), null);
  payload = { schema: 1, order: null }; intervals[0](); await new Promise(resolve => setImmediate(resolve));
  assert.equal(card.querySelector('[data-personal-reward]').hidden, true);
  assert.match(card.querySelector('[data-personal-objective]').textContent, /Aguardando/);
  assert.ok(calls.every(url => url === 'dados/personal-order.json'));
  dom.window.close();
 }
 assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'dados/personal-order.json'), 'utf8')).order, null);
 console.log('PASS: cartões Home/Guerra, ausência confirmada, expiração, data futura/antiga, recompensa, texto seguro, leitura indisponível e nenhuma consulta às APIs da guerra ou progresso pessoal inventado.');
})().catch(error => { console.error(error); process.exitCode = 1; });
