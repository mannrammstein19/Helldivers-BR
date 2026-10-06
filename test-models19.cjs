const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const window={};vm.runInNewContext(fs.readFileSync('planet-presences.js','utf8'),{window});
const svg=(tag,attrs)=>({tag,attrs,children:[],appendChild(n){this.children.push(n)}});
function render(effects,stale=false){window.HDBRWarData={meta:()=>({stale})};const root=svg('g',{});window.HDBRPresences.mapBadges(root,{activeEffects:effects},0,0,6,svg);return root}
function groups(root){return root.children.flatMap(n=>n.children).filter(n=>n.attrs.class==='mapa-presence-ship')}
for(const [ids,file,count] of [[[1377,1378],'nave-iluminada',3],[[1402,1403],'nave-raptores',3],[[1379,1380],'nave-apropriadores',1],[[1413,1414],'nave-frota-iluminada',1]]){
 const ships=groups(render(ids));assert.equal(ships.length,1,'paired IDs deduplicate');assert.equal(ships[0].children.length,count);
 for(const im of ships[0].children){assert.equal(im.attrs.href,'imagens/guerra/modelos/'+file+'.webp');assert.ok(fs.existsSync(im.attrs.href));if(count===3)assert.ok(Math.abs(im.attrs.width-9*.52*1.05)<1e-9,'transport keeps approved five-percent enlargement')}
}
assert.equal(groups(render([1379,1413])).length,2,'different overship variants coexist');
assert.equal(groups(render([1377,1402])).length,2,'different transport groups coexist');
assert.equal(groups(render([])).length,0,'removed presence removes art');assert.equal(groups(render([9999,1400])).length,0);
assert.equal(groups(render([1202,1248,1360])).length,1,'automaton duplicate protection preserved');
assert.ok(render([1377],true).children[0].attrs.class.includes('presence-stale'));
console.log('PASS: four exact Illuminate model mappings, paired IDs, three small transports, coexistence, removal, unknown effects, stale state and Automaton deduplication.');
