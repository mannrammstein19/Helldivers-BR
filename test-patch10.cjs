const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('mapa-classico.html','utf8');
class Classes{constructor(...xs){this.values=new Set(xs)}contains(x){return this.values.has(x)}toggle(x,on){on??=!this.contains(x);on?this.values.add(x):this.values.delete(x);return on}add(...xs){xs.forEach(x=>this.values.add(x))}remove(...xs){xs.forEach(x=>this.values.delete(x))}}
function element(...classes){return {classList:new Classes(...classes),attrs:{},children:[],appendChild(child){this.children.push(child)},style:{setProperty(){}},querySelectorAll(){return []},dataset:{},parentElement:{clientWidth:1440,clientHeight:800},offsetWidth:360,getAttribute(k){return this.attrs[k]},setAttribute(k,v){this.attrs[k]=String(v)},removeAttribute(k){delete this.attrs[k]},querySelector(){return {style:{setProperty(){}},focus(){}}}}}
const ids=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],element()]));
ids.set('mapa-viewport',element());
ids.set('mapa-intel-boss-note',element());
const document={getElementById:id=>ids.get(id),querySelectorAll(){return []},addEventListener(){},body:element(),createElementNS(){return element()}};
let mobile=false;
const window={matchMedia:()=>({matches:mobile})};
const sandbox={document,window,localStorage:{getItem(){return null},setItem(){}},navigator:{maxTouchPoints:0},console,Map,Set,Date,Number,Math,JSON,setTimeout,clearTimeout};
const source=fs.readFileSync('mapa-classico.js','utf8').replace(/\}\)\(\);\s*$/,`window.testMap={activePlanet,markActiveNeighborhood,renderTopFronts,applyFilters,applyLayerVisibility,positionInspector,positionDossier,openPlanetModal,closePlanetModal,showQuickIntel,hideQuickIntel,appendInvasionPulses,drawSectors,focusSearchedPlanet,loadPlanets,refreshSimulation(){buildMap=()=>hideQuickIntel({clearSelection:false});renderOffensiveCampaigns=()=>{};renderMajorOrder=()=>{};},handleFrontToggle,openFrontPanel,openFrontRegions,closeFrontPanel,closeFrontRegions,positionFloatingPanel,frontMarkup,titlePlanetName,planetName,layerVisibility,setFixture(ps,cs,nodes,lines){allPlanets=ps;campaignIndexes=new Set(cs.map(String));campaignsKnown=true;nodeByIndex.clear();nodes.forEach((v,k)=>nodeByIndex.set(k,v));lineRecords=lines},search(q){searchQuery=q},faction(f){activeFaction=f}};})();`);
vm.runInNewContext(fs.readFileSync("campaign-metrics.js","utf8"),sandbox);vm.runInNewContext(source,sandbox);const api=window.testMap;
const fixture=[{index:1,name:'ALPHA',currentOwner:'Automatons',statistics:{playerCount:5}},{index:2,name:'BETA',currentOwner:'Humans',statistics:{playerCount:0}},{index:3,name:'GAMMA',currentOwner:'Terminids',statistics:{playerCount:99999}},{index:4,name:'DELTA',currentOwner:'Humans',event:{faction:'Automatons'},statistics:{playerCount:20}},{index:5,name:'EPSILON',currentOwner:'Illuminates',statistics:{playerCount:10}}];
const planets=fixture;
const nodes=new Map(fixture.map(data=>[String(data.index),{data,group:element('planet-inactive')}]));const lines=[[1,2],[2,3],[4,2]].map(([a,b])=>({a,b,line:element(),base:element()}));
api.setFixture(fixture,[1,5],nodes,lines);api.markActiveNeighborhood();api.applyLayerVisibility();
assert.equal(api.layerVisibility.activeFronts,true);
assert.equal(nodes.get('1').group.classList.contains('filtered-out'),false);
assert.equal(nodes.get('2').group.classList.contains('filtered-out'),false,'neighbor of active front stays visible');
assert.equal(nodes.get('3').group.classList.contains('filtered-out'),true,'neighbor of neighbor is not a confirmed direct neighbor');
assert.equal(nodes.get('4').group.classList.contains('filtered-out'),false,'defense appears even if absent from campaigns');
assert.equal(lines[0].line.classList.contains('active-front-route'),true);
assert.equal(lines[1].line.classList.contains('active-front-route'),false);
assert.equal(nodes.get('3').group.attrs.tabindex,'-1');
api.renderTopFronts();assert.ok(ids.get('mapa-top-fronts').innerHTML.indexOf('Delta')<ids.get('mapa-top-fronts').innerHTML.indexOf('Epsilon'));assert.equal((ids.get('mapa-top-fronts').innerHTML.match(/data-planet-index=/g)||[]).length,3);assert.ok(!ids.get('mapa-top-fronts').innerHTML.includes('Gamma'));
api.search('GAMMA');api.applyFilters();assert.equal(nodes.get('3').group.classList.contains('filtered-out'),false,'search reveals an inactive match');
api.search('');api.layerVisibility.activeFronts=false;api.applyLayerVisibility();assert.equal(nodes.get('3').group.classList.contains('filtered-out'),false,'all-planets toggle shows inactive worlds');
api.faction('terminid');api.applyFilters();assert.equal(nodes.get('3').group.classList.contains('filtered-out'),false);assert.equal(nodes.get('1').group.classList.contains('filtered-out'),true);
const panel=element('open');api.positionInspector(panel);assert.equal(panel.style.left,'1066px');assert.equal(panel.style.top,'72px');mobile=true;api.positionInspector(panel);assert.equal(panel.style.left,'8px');assert.equal(panel.style.bottom,'8px');assert.equal(panel.style.maxHeight,'62%');
api.setFixture(planets,planets.filter(p=>p.event||p.statistics?.playerCount>0).map(p=>p.index),new Map(),[]);api.renderTopFronts();assert.equal((ids.get('mapa-top-fronts').innerHTML.match(/data-planet-index=/g)||[]).length,3);
assert.ok(html.includes('href="index.html"'));assert.ok(!html.includes('class="sidebar"'));assert.ok(!html.includes('mapa-galatico.html'));
assert.ok(fs.readFileSync('mapa-galatico.html','utf8').includes('location.replace'));assert.ok(!fs.readFileSync('mapa-galatico.html','utf8').includes('iframe'));
console.log('PASS: active fronts + direct supply neighbors, defense, all-planets toggle, faction/search filters, focus visibility, Top 3 with deterministic fixtures, desktop/mobile positioning, home link and old-URL redirect.');

api.setFixture(fixture,[1,5],nodes,lines);api.showQuickIntel(fixture[0],{sticky:true});assert.equal(ids.get('mapa-intel-card').inert,false,'first planet selection must accept clicks');assert.equal(ids.get('mapa-intel-card').classList.contains('open'),true);api.showQuickIntel(fixture[4],{sticky:true});assert.equal(ids.get('mapa-intel-card').inert,false,'switching planets must accept clicks');console.log('PASS: quick inspector accepts clicks on first selection and when switching planets.');

// Position from screen-space marker geometry, including transformed map hosts.
mobile=false;
const anchored=element('open');anchored.offsetWidth=330;anchored.offsetHeight=300;
anchored.parentElement={clientWidth:1440,clientHeight:800,getBoundingClientRect:()=>({left:100,top:50,width:1440,height:800})};
let point={left:690,right:710,top:440,bottom:460,width:20,height:20};
nodes.get('5').circle={getBoundingClientRect:()=>point};api.setFixture(fixture,[1,5],nodes,lines);
api.positionInspector(anchored);assert.equal(anchored.style.left,'630px');assert.equal(anchored.style.top,'330px');assert.equal(anchored.style.maxHeight,'520px');assert.equal(anchored.style.right,'auto');
point={left:1490,right:1510,top:795,bottom:815,width:20,height:20};api.positionInspector(anchored);assert.equal(anchored.style.left,'1040px','right-edge planet opens inspector to its left');assert.equal(anchored.style.top,'486px','panel stays above bottom edge');
point={left:105,right:125,top:55,bottom:75,width:20,height:20};api.positionInspector(anchored);assert.equal(anchored.style.left,'45px');assert.equal(anchored.style.top,'72px','top controls remain accessible');
anchored.parentElement={clientWidth:1440,clientHeight:800,getBoundingClientRect:()=>({left:100,top:50,width:720,height:400})};
point={left:395,right:405,top:245,bottom:255,width:10,height:10};api.positionInspector(anchored);assert.equal(anchored.style.left,'630px','coordinate scaling preserves anchor position');
mobile=true;api.positionInspector(anchored);assert.equal(anchored.style.left,'8px');assert.equal(anchored.style.bottom,'8px');assert.equal(anchored.style.maxHeight,'62%');
const pulses=element();api.appendInvasionPulses(pulses,{name:'Test',currentOwner:'Humans',event:{faction:'Automatons'}},100,100,2);assert.equal(pulses.children.length,2);assert.ok(pulses.children.every(p=>p.attrs.stroke==='#ff414b'&&p.attrs['pointer-events']==='none'));
const peaceful=element();api.appendInvasionPulses(peaceful,{name:'Test',currentOwner:'Humans'},100,100,2);assert.equal(peaceful.children.length,0);
const territories=element(),borders=element();api.drawSectors([{raw:{sector:'Andromeda',currentOwner:'Humans',event:{faction:'Automatons'}}}],territories,borders);
assert.equal(territories.children.find(p=>p.attrs['data-sector']==='Andromeda').attrs.fill,'#ff4242','human planet under invasion paints sector in attacker color');
console.log('PASS: anchored inspector follows marker geometry/zoom, edge clamping, bounded height, mobile sheet, invasion pulses only for API event and sector attack color.');

mobile=false;
const quick=ids.get('mapa-intel-card'),dossier=ids.get('planet-modal');
quick.classList.add('open');dossier.classList.add('open');quick.offsetWidth=360;dossier.offsetWidth=430;
quick.style.left='600px';quick.style.top='120px';dossier.parentElement={clientWidth:1440,clientHeight:800};dossier.offsetHeight=540;
api.positionDossier();assert.equal(dossier.style.left,'972px');assert.equal(dossier.style.maxHeight,'600px');
quick.style.left='1066px';api.positionDossier();assert.equal(dossier.style.left,'624px','dossier opens left when right side is full');
quick.style.left='450px';dossier.parentElement.clientWidth=1000;api.positionDossier();assert.equal(quick.style.left,'184px');assert.equal(dossier.style.left,'556px');assert.ok(parseFloat(quick.style.left)+quick.offsetWidth<parseFloat(dossier.style.left),'pair does not overlap');
api.openPlanetModal(fixture[0],false);assert.equal(quick.inert,false,'desktop keeps summary clickable while dossier is open');api.closePlanetModal(false);assert.equal(quick.inert,false);
mobile=true;api.openPlanetModal(fixture[0],false);assert.equal(quick.inert,true,'mobile still uses a single active sheet');api.closePlanetModal(false);
api.setFixture(fixture,[1,5],nodes,lines);api.renderTopFronts();const fronts=ids.get('mapa-top-fronts').innerHTML;assert.equal((fronts.match(/<details class="mapa-top-front"/g)||[]).length,3);assert.ok(!fronts.includes('mapa-front-expanded'));assert.ok(fronts.includes('helldiver.png'));assert.ok(!fronts.includes('data-front-regions'));api.openFrontPanel(fixture[0],false);assert.ok(ids.get('mapa-front-panel').classList.contains('open'));assert.ok(ids.get('mapa-front-panel-content').innerHTML.includes('data-front-regions'));assert.ok(!ids.get('mapa-front-panel-content').innerHTML.includes('🛡'));api.openFrontRegions(fixture[0],false);assert.ok(ids.get('mapa-regions-panel').classList.contains('open'));api.closeFrontPanel();
console.log('PASS: dossier beside summary on either side, no overlap when repositioning pair, desktop controls remain active, mobile sheet, Top 3 local disclosures with helmet.');

assert.equal(api.titlePlanetName('NEW STOCKHOLM'),'New Stockholm');assert.equal(api.titlePlanetName('ALAMAK VII'),'Alamak VII');assert.equal(api.titlePlanetName('ÔMICRON'),'Ômicron');assert.equal(api.titlePlanetName("ANGEL'S VENTURE"),"Angel's Venture");
mobile=false;api.setFixture(fixture,[1,5],nodes,lines);api.faction('all');api.search('ALPHA');api.applyFilters();assert.equal(lines[0].line.classList.contains('search-route-hidden'),false);assert.equal(lines[1].line.classList.contains('search-route-hidden'),true);api.search('');api.applyFilters();assert.equal(lines[1].line.classList.contains('search-route-hidden'),false,'clearing search restores other connections');
let cameraUpdates=0;const state={scale:1,requestApply(){cameraUpdates++}};ids.get('mapa-svg')._mapaPanZoomState=state;ids.get('mapa-svg').viewBox={baseVal:{x:0,y:0,width:1000,height:1000}};nodes.get('1').circle={getAttribute:key=>key==='cx'?'100':'200'};
api.search('ALP');assert.equal(api.focusSearchedPlanet(),true);assert.equal(state.scale,3.5);assert.equal(state.tx,150);assert.equal(state.ty,-200);assert.equal(cameraUpdates,1);assert.equal(ids.get('mapa-busca').value,'Alpha');assert.equal(ids.get('mapa-intel-title').textContent,'Alpha');
api.search('Inexistente');assert.equal(api.focusSearchedPlanet(),false);assert.equal(cameraUpdates,1,'not-found search does not jump to an unrelated planet');
console.log('PASS: title case/accents/Roman suffixes, connected-only search routes and clearing restoration, Enter search centers exact/prefix planet with no extra API query, no jump on missing planet.');

const frontRows=['1','4','5'].map(index=>({dataset:{planetIndex:index},open:false,isConnected:true,matches:()=>true}));ids.get('mapa-top-fronts').querySelectorAll=()=>frontRows;
mobile=false;frontRows[0].open=true;api.handleFrontToggle(frontRows[0]);frontRows[1].open=true;api.handleFrontToggle(frontRows[1]);assert.equal(frontRows[0].open,false,'desktop opens only the chosen front');
mobile=true;frontRows[2].open=true;api.handleFrontToggle(frontRows[2]);assert.equal(frontRows[0].open,false);assert.equal(frontRows[1].open,false);assert.equal(frontRows[2].open,true);api.renderTopFronts();assert.equal((ids.get('mapa-top-fronts').innerHTML.match(/ open /g)||[]).length,1,'mobile expanded front persists alone after telemetry repaint');
console.log('PASS: mobile expands one front and collapses its neighbors, state retained across new readings; desktop also uses a single floating front.');

(async()=>{
 mobile=false;api.setFixture(fixture,[1,5],nodes,lines);api.openFrontPanel(fixture[0],false);api.openPlanetModal(fixture[0],false);
 api.refreshSimulation();ids.get('mapa-svg')._mapaPanZoomState=null;
 let stamp=Date.now();window.HDBRWarData={due:()=>true,hasStale:()=>false,meta:()=>({time:stamp,stale:false}),get:async url=>url.endsWith('/planets')?fixture:url.endsWith('/campaigns')?fixture.map(p=>({type:0,planet:p})):[]};
 await api.loadPlanets();assert.ok(ids.get('planet-modal').classList.contains('open'),'dossier opened from front survives telemetry redraw');assert.equal(ids.get('planet-modal-title').textContent,'Alpha');assert.ok(ids.get('mapa-front-panel').classList.contains('open'));
 api.closePlanetModal(false);api.openFrontRegions(fixture[0],false);stamp+=60000;await api.loadPlanets();assert.ok(ids.get('mapa-regions-panel').classList.contains('open'),'separate region panel survives redraw');assert.ok(!ids.get('planet-modal').classList.contains('open'),'closed dossier must not reopen on refresh');
 console.log('PASS: refresh keeps selected front, separate regions and correct dossier planet open; manually closed dossier stays closed.');
})().catch(e=>{console.error(e);process.exitCode=1});

const home=fs.readFileSync('index.html','utf8'),overview=fs.readFileSync('overview.js','utf8'),css=fs.readFileSync('home-finish.css','utf8');
assert.ok(home.indexOf('<h2>Acesso rápido</h2>')<home.indexOf('<h3>Forças no Front</h3>'));
assert.equal((home.match(/class="hd-overview-lower"/g)||[]).length,1);
assert.ok(!overview.includes("${p.event?'🛡 ':''}"));
assert.ok(css.includes('grid-template-columns:minmax(0,1fr) max-content'));
console.log('PASS: Home access order, no duplicated panels, no unofficial shield, numeric column can grow.');
