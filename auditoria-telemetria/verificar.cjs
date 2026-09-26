const fs=require('fs'),vm=require('vm'),assert=require('assert');
let now=1000000000,meta={time:now,stale:false};const saved=new Map();
const sandbox={window:{HDBRWarData:{meta:()=>meta}},document:{addEventListener(){}},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},Date:class extends Date {static now(){return now}},console};
vm.createContext(sandbox);
let src=fs.readFileSync(require('path').join(__dirname,'..','guerra.js'),'utf8').replace(/\}\)\(\);\s*$/,`window.audit={planetProgress,liberationEnemyPressure,recordPlanetSnapshots,getPlanetRate,formatEtaFromRate,defenseEnemyRate,renderCampaigns};})();`);
vm.runInContext(src,sandbox);const a=sandbox.window.audit;
const base={id:1,planet:{index:200,name:'MATAR BAY',currentOwner:'Automaton',maxHealth:1600000,health:1600000,regenPerSecond:5.5555553,statistics:{playerCount:19000}}};
assert.equal(a.planetProgress({health:null,maxHealth:100}),null);
assert.equal(a.planetProgress({health:'',maxHealth:100}),null);
assert.equal(a.planetProgress({health:101,maxHealth:100}),null);
assert.equal(a.planetProgress({health:0,maxHealth:100}),100);
assert.equal(a.planetProgress({health:50,maxHealth:100,event:{health:20,maxHealth:100}}),80);
assert.equal(a.liberationEnemyPressure({regenPerSecond:null,maxHealth:100}),null);
assert(Math.abs(a.liberationEnemyPressure(base.planet)-1.25)<0.000001);
assert(Math.abs(a.liberationEnemyPressure({regenPerSecond:-2.7777777,maxHealth:1e6})+1)<0.000001);
a.recordPlanetSnapshots([base]);assert.equal(a.getPlanetRate(200,'attack'),null);
now+=60000;meta.time=now;a.recordPlanetSnapshots([base]);assert.equal(a.getPlanetRate(200,'attack'),0);
now+=60000;meta.time=now;const advance=structuredClone(base);advance.planet.health-=1600;a.recordPlanetSnapshots([advance]);assert(Math.abs(a.getPlanetRate(200,'attack')-6)<1e-8);
// Cached reread cannot move sample clock or replace measured rate.
now+=10000;a.recordPlanetSnapshots([advance]);assert(Math.abs(a.getPlanetRate(200,'attack')-6)<1e-8);
meta.stale=true;assert.equal(a.getPlanetRate(200,'attack'),null);meta.stale=false;
now+=60000;meta.time=now;advance.id=2;a.recordPlanetSnapshots([advance]);assert.equal(a.getPlanetRate(200,'attack'),null);
now+=60000;meta.time=now;advance.planet.health=null;a.recordPlanetSnapshots([advance]);assert.equal(a.getPlanetRate(200,'attack'),null);
assert.equal(a.formatEtaFromRate(null,5),null);assert.equal(a.formatEtaFromRate(0,0),null);
assert.equal(a.defenseEnemyRate({startTime:'2026-09-26T00:00:00Z',endTime:'2026-09-27T00:00:00Z'}),100/24);
for(const name of ['mapa-classico.js','mapa.js']){
 const code=fs.readFileSync(require('path').join(__dirname,'..',name),'utf8');const start=code.indexOf('    function regenPercentPerHour');const end=code.indexOf('\n    function ',code.indexOf('    function formatRate',start)+10);
 const scope={};vm.createContext(scope);vm.runInContext(code.slice(start,end)+';this.a={regenPercentPerHour,formatRate}',scope);
 assert.equal(scope.a.regenPercentPerHour({}),null);assert.equal(scope.a.formatRate(null),'—');assert(scope.a.formatRate(scope.a.regenPercentPerHour({regenPerSecond:-2.7777777,maxHealth:1e6})).startsWith('−'));
}
console.log('PASS: progresso válido/ausente, pressão positiva/negativa, primeira amostra, zero real, avanço, cache, falha da API, nova campanha, ETA e relógio de defesa; dois mapas.');

const nodes=new Map();sandbox.document.getElementById=id=>{if(id==='tactical-modal')return null;if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:''});return nodes.get(id)};
const fixtures=JSON.parse(fs.readFileSync(require('path').join(__dirname,'campanhas-171957.json'),'utf8'));
a.renderCampaigns(fixtures);let html=nodes.get('frentes').innerHTML;
assert.equal((html.match(/data-planet-key=/g)||[]).length,40);assert(html.includes('Avanço líquido / hora'));assert(html.includes('consulte o progresso separado'));assert(!html.includes('NaN'));assert(html.includes('-1.00%/h'));
const absent=structuredClone(fixtures[0]);absent.planet.health=null;absent.planet.statistics.playerCount=null;a.renderCampaigns([absent]);assert(nodes.get('frentes').innerHTML.includes('indisponível'));
const defense=structuredClone(fixtures[0]);defense.planet.event={health:500,maxHealth:1000,startTime:'2026-09-26T00:00:00Z',endTime:'2026-09-27T00:00:00Z'};a.renderCampaigns([defense]);assert(nodes.get('frentes').innerHTML.includes('Avanço da defesa / hora'));assert(nodes.get('frentes').innerHTML.includes('50.00%'));
console.log('PASS: HTML gerado para 40 campanhas reais, dado ausente e defesa simulada; sem NaN.');
