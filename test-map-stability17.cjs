const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
require('./test-map-dom17.cjs');
const html=fs.readFileSync('mapa-classico.html','utf8');
class Classes{constructor(...xs){this.values=new Set(xs)}contains(x){return this.values.has(x)}toggle(x,on){on??=!this.contains(x);on?this.values.add(x):this.values.delete(x);return on}add(...xs){xs.forEach(x=>this.values.add(x))}remove(...xs){xs.forEach(x=>this.values.delete(x))}}
function element(...classes){return {classList:new Classes(...classes),attrs:{},children:[],appendChild(child){this.children.push(child)},style:{setProperty(){}},querySelectorAll(){return []},dataset:{},parentElement:{clientWidth:1440,clientHeight:800},offsetWidth:360,getAttribute(k){return this.attrs[k]},setAttribute(k,v){this.attrs[k]=String(v)},removeAttribute(k){delete this.attrs[k]},querySelector(){return {style:{setProperty(){}},focus(){}}}}}
const ids=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],element()]));
ids.forEach((element,id)=>element.id=id);
ids.set('mapa-viewport',element());
ids.set('mapa-intel-boss-note',element());
const document={getElementById:id=>ids.get(id),querySelectorAll(){return []},addEventListener(){},body:element(),createElementNS(){return element()}};
let mobile=false;
const window={matchMedia:()=>({matches:mobile})};
const sandbox={document,window,localStorage:{getItem(){return null},setItem(){}},navigator:{maxTouchPoints:0},console,Map,Set,Date,Number,Math,JSON,setTimeout,clearTimeout};
const source=fs.readFileSync('mapa-classico.js','utf8').replace(/\}\)\(\);\s*$/,`window.testMap={renderMajorOrder,supplyRoutePaint,drawInvasions,appendOwnerBadge,setMapPresentation,activePlanet,markActiveNeighborhood,renderTopFronts,applyFilters,applyLayerVisibility,positionInspector,positionDossier,openPlanetModal,closePlanetModal,showQuickIntel,hideQuickIntel,appendInvasionPulses,drawSectors,focusSearchedPlanet,loadPlanets,refreshSimulation(){buildMap=()=>{};renderOffensiveCampaigns=()=>{};renderMajorOrder=()=>{};},handleFrontToggle,openFrontPanel,openFrontRegions,closeFrontPanel,closeFrontRegions,positionFloatingPanel,layoutIntelPanels,frontMarkup,titlePlanetName,planetName,layerVisibility,setFixture(ps,cs,nodes,lines){allPlanets=ps;campaignIndexes=new Set(cs.map(String));campaignsKnown=true;nodeByIndex.clear();nodes.forEach((v,k)=>nodeByIndex.set(k,v));lineRecords=lines},search(q){searchQuery=q},faction(f){activeFaction=f}};})();`);
vm.runInNewContext(fs.readFileSync("campaign-metrics.js","utf8"),sandbox);vm.runInNewContext(source,sandbox);const api=window.testMap;

window.HDBROrderState={resolve:()=>({order:null,state:'unknown'})};window.HDBRWarData={meta:()=>({time:Date.now()})};
api.renderMajorOrder([]);assert.ok(ids.get('mapa-major-order').innerHTML.includes('Aguardando novas diretrizes'));
const fixtures=[{index:1,name:'Wasat',currentOwner:'Humans',position:{x:.1,y:.1},statistics:{playerCount:120},event:{faction:'Automatons',health:70,maxHealth:100,startTime:new Date(Date.now()-3600000).toISOString(),endTime:new Date(Date.now()+7200000).toISOString()}},{index:2,name:'Meissa',currentOwner:'Automatons',position:{x:.3,y:.1},waypoints:[1],attacking:[1],health:100,maxHealth:100,activeEffects:[1248]}];
const markerNodes=new Map(fixtures.map(data=>[String(data.index),{data,group:element('planet-inactive')}]));
api.setFixture(fixtures,[1,2],markerNodes,[]);
for(const [aOwner,bOwner] of [['Humans','Automatons'],['Humans','Illuminates'],['Terminids','Humans']]){
 const defs=element(),a={raw:{currentOwner:aOwner},x:0,y:0},b={raw:{currentOwner:bOwner},x:100,y:0};
 assert.ok(api.supplyRoutePaint(defs,'test',a,b).startsWith('url('));
 const stops=defs.children[0].children;assert.equal(stops.length,4);assert.equal(stops[0].attrs['stop-color'],stops[1].attrs['stop-color']);assert.equal(stops[2].attrs['stop-color'],stops[3].attrs['stop-color']);assert.notEqual(stops[0].attrs['stop-color'],stops[3].attrs['stop-color']);
}
let defs=element();assert.equal(api.supplyRoutePaint(defs,'same',{raw:{currentOwner:'Humans'},x:0,y:0},{raw:{currentOwner:'Humans'},x:100,y:0}),'#66c9f1');
ids.get('mapa-svg').querySelector=()=>element();
const routes=element();api.drawInvasions(fixtures,routes,200);assert.equal(routes.children.filter(n=>n.attrs.class==='mapa-route-presence').length,0);assert.equal(routes.children.find(n=>n.attrs.class==='mapa-invasion-arrow').attrs.stroke,'transparent');assert.equal(routes.children.filter(n=>n.attrs.class==='mapa-route-energy').length,1);
const owner=element();api.appendOwnerBadge(owner,fixtures[1],0,0,5,true);assert.equal(owner.children[0].attrs['aria-label'],'Controle: Autômatos');const human=element();api.appendOwnerBadge(human,fixtures[0],0,0,5);assert.equal(human.children.length,0);
assert.ok(!fs.readFileSync('mapa-classico.css','utf8').includes('attack-route{stroke:var(--route-attack-color)'));
console.log('PASS: mixed-owner routes retain both endpoint colors, same-owner routes retain one color, attack pulse/head does not repaint the connection, no duplicated brigade on route, factual owner badge.');
(async()=>{
 mobile=true;api.showQuickIntel(fixtures[0],{sticky:true});api.openFrontRegions(fixtures[0],false);api.openPlanetModal(fixtures[0],false);api.refreshSimulation();
 ids.get('mapa-svg')._mapaPanZoomState=null;
 const modal=ids.get('planet-modal'),quick=ids.get('mapa-intel-card');let closed=0;
 for(const panel of [modal,quick]){const original=panel.classList.remove.bind(panel.classList);panel.classList.remove=(...args)=>{if(args.includes('open'))closed++;original(...args);};}
 let stamp=Date.now();window.HDBRWarData={due:()=>true,hasStale:()=>false,meta:()=>({time:stamp,stale:false}),get:async url=>url.endsWith('/planets')?fixtures:url.endsWith('/campaigns')?fixtures.map(p=>({type:0,planet:p})):[]};
 for(const mode of ['complete','clean']){
  api.setMapPresentation(mode);
  for(let n=0;n<12;n++){stamp+=60000;fixtures[0].statistics.playerCount++;await api.loadPlanets();assert.ok(modal.classList.contains('open'));assert.equal(ids.get('planet-modal-title').textContent,'Wasat');assert.ok(ids.get('mapa-regions-panel').classList.contains('open'));}
 }
 assert.equal(closed,0,'refresh may not transiently close the dossier or inspector');
 api.closePlanetModal(false);stamp+=60000;await api.loadPlanets();assert.ok(!modal.classList.contains('open'),'manual closure remains closed');
 console.log('PASS: 24 mobile refreshes in Complete/Clean retain the selected dossier and regions without transient close; manual close remains closed.');
})().catch(e=>{console.error(e);process.exitCode=1});
