// Executes production module and map renderers without network calls.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const nodes=new Map(),el=()=>({innerHTML:'',hidden:false,style:{},dataset:{},classList:{contains(){return false}},querySelector(){return null}});
const sandbox={window:{},document:{getElementById(id){if(!nodes.has(id))nodes.set(id,el());return nodes.get(id)},querySelectorAll(){return []},addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},console,Date,Map,Set,setTimeout,clearTimeout};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('planet-presences.js','utf8'),sandbox);
const api=sandbox.window.HDBRPresences;
for(const e of api.catalog){assert.ok(fs.existsSync('imagens/guerra/presencas/'+e.file));for(const id of e.ids)assert.equal(api.list({activeEffects:[{galacticEffectId:id}]}).at(0).key,e.key)}
assert.equal(api.catalog.length,11);
const fresh={index:199,activeEffects:[{galacticEffectId:1360},{galacticEffectId:1361},{galacticEffectId:1401}]};
assert.equal(api.list(fresh).length,2,'deduplicate paired game effect IDs');
assert.equal(api.list(fresh).find(e=>e.key==='seaf').faction,'human','Enemies suffix does not make allied SEAF hostile');
assert.equal(api.list({index:199,activeEffects:[{galacticEffectId:1239}]}).length,0,'factory is not troop presence');
assert.equal(api.list({index:199,currentOwner:'Automatons'}).length,0,'owner never implies a subfaction');
assert.equal(api.list({activeEffects:[{galacticEffectId:99999,name:'CYBORGS'}]}).length,0,'unknown code never mapped by fallback name');
assert.equal(api.list({activeEffects:[{name:'CYBORGS'}]}).length,1,'exact known label supported');
assert.equal(api.list({hazards:[{description:'SEAF patrols encountered Cyborgs'}]}).length,0,'narrative mentions do not establish presence');
assert.equal(api.list({index:199,planetActiveEffects:[{index:198,galacticEffectId:1360}]}).length,0,'other planet effect not leaked');
const old=api.render(fresh,{stale:true});assert.match(old,/ÚLTIMA LEITURA/);assert.equal(api.render({...fresh,activeEffects:[]},{stale:false}),'','valid empty reading removes presence');
assert.equal(api.list({index:245,activeEffects:fresh.activeEffects}).length,2,'same troop can appear on another planet');
assert.equal(api.list({index:199,currentOwner:'Humans',activeEffects:fresh.activeEffects}).length,2,'capture alone does not erase active effect');
const group={children:[],appendChild(v){this.children.push(v)}},svg=(tag,attrs)=>({tag,attrs,children:[],appendChild(v){this.children.push(v)}});
api.mapBadges(group,fresh,20,30,8,svg);assert.equal(group.children.length,1);assert.equal(group.children[0].attrs['pointer-events'],'none','badges do not block planet clicks');
api.mapBadges(group,{activeEffects:[]},20,30,8,svg);assert.equal(group.children.length,1);
const moduleCode=fs.readFileSync('planet-presences.js','utf8');assert.ok(!/\bfetch\s*\(|setInterval\s*\(/.test(moduleCode),'no additional API requests or polling');
for(const [file,consumer] of [['mapa-classico.html','mapa-classico.js'],['guerra.html','guerra.js'],['ordem.html','guerra.js']]){
 const html=fs.readFileSync(file,'utf8');assert.ok(html.indexOf('planet-presences.js')<html.indexOf(consumer+'?'));assert.ok(html.includes('planet-presences.css'));
}
// Real map effect panel: cache is labelled; fresh removal empties the same node.
sandbox.window.HDBRWarData={meta(){return {time:Date.now(),stale:true}}};
vm.runInContext(fs.readFileSync('campaign-metrics.js','utf8'),sandbox);
vm.runInContext(fs.readFileSync('mapa-classico.js','utf8').replace(/\}\)\(\);\s*$/,'window.testPresenceMap={renderPlanetEffects,frontMarkup};})();'),sandbox);
sandbox.window.testPresenceMap.renderPlanetEffects(fresh);assert.match(nodes.get('mapa-intel-effects').innerHTML,/Cyborgs/);assert.match(nodes.get('planet-dossier-effects').innerHTML,/SEAF/);assert.equal(nodes.get('mapa-intel-effects').hidden,false);
sandbox.window.testPresenceMap.renderPlanetEffects({...fresh,activeEffects:[]});assert.equal(nodes.get('mapa-intel-effects').hidden,true);assert.doesNotMatch(nodes.get('planet-dossier-effects').innerHTML,/Cyborgs/);
assert.match(sandbox.window.testPresenceMap.frontMarkup({...fresh,name:'Martale',statistics:{playerCount:100},currentOwner:'Automatons',health:90,maxHealth:100}),/planet-presences/);
console.log('PASS: all 11 presences and assets, paired IDs deduplication, allied SEAF, unknown effects, factory distinction, no fixed planets, fresh removal, stale label, marker click-through, production map/dossier/front integration, script order and no extra API requests.');
vm.runInContext(fs.readFileSync('guerra.js','utf8').replace(/\}\)\(\);\s*$/,'window.testPresenceWar={renderFrontCards,set(v){campaigns=v}};})();'),sandbox);
const war=sandbox.window.testPresenceWar;
war.set([{id:1,type:0,planet:{...fresh,name:'Martale',currentOwner:'Automatons',health:90,maxHealth:100,statistics:{playerCount:100}}}]);war.renderFrontCards();assert.match(nodes.get('frentes').innerHTML,/Cyborgs/);assert.match(nodes.get('frentes').innerHTML,/Forte presença da SEAF/);
war.set([{id:1,type:0,planet:{...fresh,activeEffects:[],name:'Martale',currentOwner:'Automatons',health:90,maxHealth:100}}]);war.renderFrontCards();assert.doesNotMatch(nodes.get('frentes').innerHTML,/presence-chip/);
console.log('PASS: real Guerra cards display current presences and remove them on fresh effect removal.');
