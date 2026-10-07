// Catálogo estático e estado regional: sem consultar APIs ou inferir inimigos pelo dono.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const context={window:{},document:{addEventListener(){},currentScript:{src:'https://example.org/planet-regions.js'},baseURI:'https://example.org/',body:{classList:{contains(){return false}}}},URL,console};vm.createContext(context);
vm.runInContext(fs.readFileSync('planet-presences.js','utf8'),context);
const api=context.window.HDBRPresences;
for(const [key,names] of Object.entries(api.gallery))for(const name of names){const file='imagens/guerra/presencas/inimigos/'+name.toLowerCase().replaceAll(' ','-')+'-enemy-icon.webp';const b=fs.readFileSync(file);assert.equal(b.subarray(0,4).toString(),'RIFF');assert.equal(b.subarray(8,12).toString(),'WEBP');}
assert.ok(api.gallery.snatchers.includes('Wretch'));assert.ok(!api.gallery.appropriators.includes('Wretch'));assert.ok(!api.gallery.appropriators.includes('Voteless'));
assert.deepEqual(Array.from(api.list({currentOwner:'Automatons'})),[]);
const markup=api.render({name:'Teste',activeEffects:[{galacticEffectId:1248},{galacticEffectId:1249}]},{stale:true});assert.equal((markup.match(/data-presence-gallery=/g)||[]).length,1);assert.match(markup,/role="button"/);assert.match(markup,/data-presence-stale="true"/);assert.doesNotMatch(markup,/<figure|data-presence-photo/);
vm.runInContext(fs.readFileSync('planet-regions.js','utf8'),context);
const regions=context.window.HDBRRegions,fixture={index:1,name:'Teste',regions:[{name:'Ativa',owner:3,isAvailable:true,health:10,maxHealth:100},{name:'Bloqueada',owner:3,isAvailable:false},{name:'Recuperada',owner:1,isAvailable:false},{name:'Sem confirmação',telemetryStale:true,owner:3,isAvailable:true}]};
const key=regions.render(fixture).match(/data-region-key="([^"]+)/)[1];assert.equal(key,'campaigns:1');
// Usa o render do mapa para conferir os quatro banners sem trocar a lógica de estado.
context.document.body.classList.contains=()=>true;const html=regions.render(fixture);for(const file of ['region_operacao','region_bloqueado','region_recuperado','region_sem_atualizacao']){assert.match(html,new RegExp(file+'\\.webp'));assert.ok(fs.existsSync('imagens/regioes/'+file+'.webp'));}
assert.equal(regions.normalize(fixture).at(-1).state,'unknown');
console.log('PASS: gallery assets valid, factual partial rosters, paired IDs deduplicated, no owner-based presence, stale context, lazy photos, all four regional states and banners.');
