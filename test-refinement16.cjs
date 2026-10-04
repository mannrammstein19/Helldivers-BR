const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
class Classes{constructor(){this.items=new Set()}contains(v){return this.items.has(v)}add(...vs){vs.forEach(v=>this.items.add(v))}remove(...vs){vs.forEach(v=>this.items.delete(v))}toggle(v,on){on??=!this.contains(v);on?this.add(v):this.remove(v);return on}}
function element(){return {attrs:{},dataset:{},style:{setProperty(){}},classList:new Classes(),children:[],appendChild(v){this.children.push(v)},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]},querySelector(){return element()},querySelectorAll(){return []},focus(){}}}
const ids=new Map(),node=id=>{if(!ids.has(id))ids.set(id,element());return ids.get(id)};
const controls=['clean','complete'].map(value=>({...element(),dataset:{mapPresentation:value}}));
const stored=new Map(),document={getElementById:node,querySelectorAll:s=>s==='[data-map-presentation]'?controls:[],addEventListener(){},body:element(),createElementNS(){return element()}};
const window={matchMedia:()=>({matches:false})};const context={window,document,localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},navigator:{maxTouchPoints:0},console,Map,Set,Date,Number,Math,JSON,setTimeout,clearTimeout};
vm.createContext(context);vm.runInContext(fs.readFileSync('planet-presences.js','utf8'),context);vm.runInContext(fs.readFileSync('campaign-metrics.js','utf8'),context);
vm.runInContext(fs.readFileSync('mapa-classico.js','utf8').replace(/\}\)\(\);\s*$/,'window.test15={planetRingState,drawPlanetProgressRings,setMapPresentation,applyLayerVisibility,drawInvasions,planetEffects,renderPlanetEffects,forecastMetrics,setCatalog:value=>effectCatalog=value};})();'),context);

const api=window.test15;
api.setCatalog({'7':{weather_effects:['normal temp']}});
const effects=api.planetEffects({index:7,hazards:[{name:'tremors'}]});
assert.ok(effects.find(e=>e.key==='normal temp').possible);
assert.equal(effects.find(e=>e.key==='tremors').possible,false);
api.renderPlanetEffects({index:7,hazards:[{name:'tremors'}]});
assert.ok(node('mapa-intel-effects').innerHTML.includes('ocorrência atual não confirmada'));
assert.ok(node('mapa-intel-effects').innerHTML.includes('não indica ocorrência neste instante'));
api.setCatalog({});assert.equal(api.planetEffects({index:7}).length,0,'absence does not manufacture normal temperature');
document.baseURI='https://example.org/';context.URL=URL;
vm.runInContext(fs.readFileSync('planet-regions.js','utf8'),context);
for(const [owner,color] of [[1,'#4da6ff'],[2,'#ff9900'],[3,'#ff4242'],[4,'#bf83ff']]){
 const region=window.HDBRRegions.normalize({currentOwner:'Humans',regions:[{owner,isAvailable:owner!==1,health:50,maxHealth:100,hash:324613052}]})[0];
 assert.equal(region.ownerColor,color,'regional owner overrides conflicting planet owner');
}
assert.equal(window.HDBRRegions.normalize({currentOwner:'Automatons',regions:[{isAvailable:true}]})[0].ownerColor,null,'missing region owner cannot inherit planet owner');
const svg=(tag,attrs)=>{const el=element();el.tag=tag;el.attrs=attrs;return el};
let group=element();window.HDBRPresences.mapBadges(group,{activeEffects:[1413,1414,1379]},0,0,6,svg);
assert.equal(group.children[0].children.filter(n=>n.attrs.class==='mapa-presence-ship').length,2,'paired fleet IDs yield one fleet model plus distinct appropriator model');
group=element();window.HDBRPresences.mapBadges(group,{activeEffects:[1379]},0,0,6,svg);
assert.equal(group.children[0].children.filter(n=>n.attrs.class==='mapa-presence-ship').length,1,'appropriators have their own decorative model');
window.HDBRWarData={meta:()=>({stale:true})};group=element();window.HDBRPresences.mapBadges(group,{activeEffects:[1413]},0,0,6,svg);
assert.ok(group.children[0].attrs.class.includes('presence-stale'));
const css=fs.readFileSync('planet-presences.css','utf8');assert.ok(css.includes('.presence-stale .presence-ship-hull'));assert.ok(css.includes('optimized-mode .presence-ship-hull'));assert.ok(css.includes('prefers-reduced-motion'));
console.log('PASS: catalog conditions remain possible, no invented temperature, tooltip separates planet condition from instant occurrence; regional icon colors require regional owner; decorative ship requires confirmed fleet, deduplicates paired IDs and freezes saved readings.');

const realMetrics=window.HDBRCampaignMetrics;
for(const [rate,expected] of [[null,'Coletando estimativa'],[0,'Impasse'],[-.2,'Recuo'],[.2,'Sem prazo confiável']]){
 window.HDBRCampaignMetrics={metrics:()=>({progress:1,rate,source:'Ritmo observado',etaHours:null})};
 assert.ok(api.forecastMetrics({}).includes(expected));
}
window.HDBRCampaignMetrics=realMetrics;
console.log('PASS: null samples remain collecting; zero rate is Impasse; negative rate is Recuo; positive rate never becomes Impasse.');
