const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let now=1790970000000;class Clock extends Date{static now(){return now}}
const storage=new Map();const context={window:{},Date:Clock,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
const code=fs.readFileSync('campaign-metrics.js','utf8');vm.runInNewContext(code,context);const a=context.window.HDBRCampaignMetrics;
const planet={index:173,currentOwner:'Humans',event:{id:5707,faction:'Terminids',health:990000,maxHealth:1000000,startTime:new Date(now-3600000).toISOString(),endTime:new Date(now+47*3600000).toISOString()}};
let reading={time:now,stale:false};a.observe([planet],reading);
assert.equal(a.metrics(planet,reading).source,'Média desde o início');assert.ok(Math.abs(a.metrics(planet,reading).rate-1)<1e-8);
const id=a.identity(planet);now+=60000;planet.event.startTime=new Date(Date.parse(planet.event.startTime)+431).toISOString();planet.event.endTime=new Date(Date.parse(planet.event.endTime)+431).toISOString();planet.event.health=989500;reading={time:now,stale:false};
assert.equal(a.identity(planet),id,'civil-date drift must not reset same game event');a.observe([planet],reading);let m=a.metrics(planet,reading);assert.equal(m.source,'Ritmo observado');assert.ok(Math.abs(m.rate-3)<1e-8);assert.ok(Math.abs(m.enemyRate-100/48)<1e-8);assert.ok(m.enemyProgress!==m.progress);
a.observe([planet],reading);assert.equal(JSON.parse(storage.values().next().value)['173'].samples.length,2,'same server reading cannot manufacture samples');
const stale={time:now,stale:true};const saved=a.metrics(planet,stale).enemyProgress;now+=120000;assert.equal(a.metrics(planet,stale).rate,null);assert.equal(a.metrics(planet,stale).enemyProgress,saved,'saved enemy clock freezes');
vm.runInNewContext(code,context);assert.equal(context.window.HDBRCampaignMetrics.metrics(planet,{time:now,stale:false}).source,'Ritmo observado','persistent history survives reload and shared pages');
planet.event.id++;assert.notEqual(a.identity(planet),id);assert.equal(a.metrics(planet,{time:now,stale:false}).source,'Média desde o início');
const attack={index:199,currentOwner:'Automatons',health:1000000,maxHealth:1000000};a.observe([attack],{time:now});assert.equal(a.metrics(attack,{time:now}).rate,null,'no arbitrary liberation rate');now+=60000;attack.health=1000000;a.observe([attack],{time:now});assert.equal(a.metrics(attack,{time:now}).rate,0,'unchanged real readings yield zero');
assert.equal(a.classify(attack,{type:0}).label,'Libertação');assert.equal(a.classify(attack,{type:1}).label,'Reconhecimento');assert.equal(a.classify(attack,{type:2}).label,'Campanha especial');assert.equal(a.classify(planet,{type:4}).label,'Defesa');assert.equal(a.classify(attack,{type:99}).label,'Campanha','unknown type never becomes high priority or urgent');
assert.equal(a.metrics({event:{health:null,maxHealth:100}},reading).progress,null);assert.equal(a.metrics(planet,{time:now+600000},now).rate,null,'future timestamps rejected');
const map=fs.readFileSync('mapa-classico.js','utf8'),war=fs.readFileSync('guerra.js','utf8');assert.ok(!war.includes('campaign.id,p.event?.id,p.event?.startTime'));assert.ok(!map.includes('e.id,e.startTime,e.endTime,e.maxHealth'));assert.ok(map.includes('class="mapa-front-regions"'));assert.ok(map.includes('data-front-dossier='));
for(const file of ['guerra.html','mapa-classico.html']){const text=fs.readFileSync(''+file,'utf8');assert.ok(text.indexOf('campaign-metrics.js')<text.indexOf(file==='guerra.html'?'guerra.js?v=':'mapa-classico.js?v='));}
console.log('PASS: event/date drift, observed versus average rate, independent bars, persistent shared history, duplicated/stale/future readings, zero actual progress, new event identity, factual campaign types, region/dossier actions and script load order.');
context.document={addEventListener(){},getElementById(){return null}};context.console=console;context.window.HDBRWarData={meta:()=>({time:now,stale:false})};
const instrumented=war.replace(/\}\)\(\);\s*$/,`window.testWar={recordPlanetSnapshots,getPlanetRate,defenseEnemyProgress,setCampaigns(value){campaigns=value}};})();`);
vm.runInNewContext(instrumented,context);const w=context.window.testWar;
const defense={index:245,currentOwner:'Humans',event:{id:6000,faction:'Automatons',health:990000,maxHealth:1000000,startTime:new Date(now-3600000).toISOString(),endTime:new Date(now+47*3600000).toISOString()}};
w.setCampaigns([{id:1,type:4,planet:defense}]);w.recordPlanetSnapshots([{id:1,type:4,planet:defense}]);assert.ok(Math.abs(w.getPlanetRate(245,'defense')-1)<1e-8);
now+=60000;defense.event.startTime=new Date(Date.parse(defense.event.startTime)+317).toISOString();defense.event.health=989500;w.recordPlanetSnapshots([{id:1,type:4,planet:defense}]);assert.ok(Math.abs(w.getPlanetRate(245,'defense')-3)<1e-8,'Guerra consumes same observed rate after date jitter');
assert.equal(w.getPlanetRate(245,'defense'),context.window.HDBRCampaignMetrics.metrics(defense,{time:now,stale:false}).rate);
const savedTime=now;context.window.HDBRWarData.meta=()=>({time:savedTime,stale:true});const enemy=w.defenseEnemyProgress(defense.event);now+=60000;assert.equal(w.defenseEnemyProgress(defense.event),enemy);
console.log('PASS: real Guerra functions use shared history, fallback average, observed rate after date jitter and frozen saved invasion clock.');
