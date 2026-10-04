const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const window={};vm.runInNewContext(fs.readFileSync('planet-presences.js','utf8'),{window});
const svg=(tag,attrs)=>({tag,attrs,children:[],appendChild(n){this.children.push(n)}});
function models(effects,stale=false){window.HDBRWarData={meta:()=>({stale})};const root=svg('g',{});window.HDBRPresences.mapBadges(root,{activeEffects:effects},0,0,6,svg);return root}
function ships(root){return root.children.flatMap(n=>n.children).filter(n=>n.attrs.class==='mapa-presence-ship')}
assert.equal(ships(models([1413,1414])).length,1);
assert.ok(ships(models([1413]))[0].children[0].attrs.href.endsWith('nave-iluminada.webp'));
assert.equal(ships(models([1248,1249,1202,1360])).length,1,'one automaton illustration despite several brigades');
assert.equal(ships(models([1379,1400,9999])).length,0,'no decorative fleet on unrelated effects');
assert.ok(models([1413],true).children[0].attrs.class.includes('presence-stale'));
for(const name of ['nave-automata','nave-iluminada','hive-lord','draco-barata'])assert.ok(fs.statSync('imagens/guerra/modelos/'+name+'.webp').size<60000);
const map=fs.readFileSync('mapa-classico.js','utf8');assert.ok(map.includes("href:'imagens/guerra/modelos/'+boss.file"));assert.ok(map.includes('marcação editorial'));assert.ok(map.includes('sem confirmação ao vivo da API'));
const css=fs.readFileSync('mapa-classico.css','utf8');assert.ok(css.includes('.mapa-boss-marker.presence-stale{animation:none}'));assert.ok(css.includes('(prefers-reduced-motion:reduce){.mapa-boss-marker{animation:none}'));
console.log('PASS: confirmed presences, one ship per type, no invented fleet, stale state, small assets, editorial bosses and reduced motion.');
