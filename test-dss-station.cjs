const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let now=Date.parse('2026-10-06T17:00:00Z');
class Clock extends Date { static now(){return now;} }
const context={window:{},Date:Clock,Intl,console};
vm.runInNewContext(fs.readFileSync('dss-station.js','utf8'),context);
const api=context.window.HDBRDssStation,meta={time:now,stale:false};
const station={electionEnd:'2026-10-06T20:19:05Z',tacticalActions:[
 {id32:4091660627,name:'EAGLE STORM',status:2,statusExpire:'2026-10-07T12:19:35Z',costs:[{itemMixId:3992382197,currentValue:0,targetValue:86400,deltaPerSecond:.01}]},
 {id32:3248573007,name:'ORBITAL BLOCKADE',status:1,statusExpire:'2026-09-20T23:43:35Z',costs:[{itemMixId:3608481516,currentValue:.7,targetValue:86400,deltaPerSecond:.01}]},
 {id32:3578080409,name:'HEAVY ORDNANCE DISTRIBUTION',status:1,statusExpire:'2026-09-25T20:24:55Z',costs:[{itemMixId:2985106497,currentValue:.7,targetValue:86400,deltaPerSecond:.01}]}
]};
const planet={name:'SENGE 23',sector:'Omega',currentOwner:'Illuminate'};
let html=api.render(station,planet,{meta,image:'imagens/planetas/Sandy_mineral_Landscape.png'});
assert.equal((html.match(/<article /g)||[]).length,3);
assert.ok(html.includes('Tempestade da Águia') && html.includes('Bloqueio Orbital') && html.includes('Distribuição de Artilharia Pesada'));
assert.ok(html.includes('rare-sample.svg') && html.includes('Requisition_Slip.svg'));
assert.ok(html.includes('0,001%'),'small real contributions stay visible without rounded 0%');
assert.ok(html.includes('fim da votação') && html.includes('dss-landscape'));
assert.ok(!html.includes('dss-reading-note'));
assert.equal(api.costMetrics({currentValue:.7,targetValue:86400,deltaPerSecond:.01}).seconds,86399.3/.01);
for(const bad of [null,undefined,'',-1,NaN]) assert.equal(api.costMetrics({currentValue:bad,targetValue:100}).pct,null);
for(const bad of [null,0,-1,'',NaN]) assert.equal(api.costMetrics({currentValue:10,targetValue:bad}).pct,null);
for(const bad of [null,0,-1,'',NaN]) assert.equal(api.costMetrics({currentValue:10,targetValue:100,deltaPerSecond:bad}).seconds,null);
assert.equal(api.costMetrics({currentValue:150,targetValue:100,deltaPerSecond:1}).pct,100);
assert.equal(api.actionState({status:2,statusExpire:'2026-10-06T16:59:59Z'},now).kind,'pending');
assert.equal(api.actionState({status:2,statusExpire:'bad'},now).kind,'pending');
assert.equal(api.actionState({status:2},null).kind,'pending');
assert.equal(api.actionState({status:'inactive'},now).kind,'offline');
assert.equal(api.actionState({status:88},now).kind,'pending');
for(const bad of [{time:now,stale:true},{time:now-300001,stale:false},{time:now+60001,stale:false},{time:null,stale:false},undefined]) assert.equal(api.clock(bad).live,false);
assert.equal(api.clock(meta).live,true);
const saved={time:now,stale:true};let old=api.render(station,planet,{meta:saved});now+=60000;
assert.equal(api.render(station,planet,{meta:saved}),old,'saved countdowns do not advance with download/render time');
assert.ok(old.includes('Última leitura') && old.includes('dss-estimate'));
html=api.render({tacticalActions:[{status:1,name:'<script>alert(1)</script>',costs:[{itemMixId:999,currentValue:1,targetValue:10}]}]},planet,{meta:{time:now,stale:false}});
assert.ok(!html.includes('<script>') && !html.includes('rare-sample.svg') && html.includes('Recurso não identificado'));
assert.ok(html.includes('Prazo não informado') && html.includes('Estimativa indisponível'));
html=api.render({tacticalActions:[]},planet,{meta:{time:now,stale:false}});
assert.ok(html.includes('Nenhuma ação tática informada'));
// Integração: a função real da Guerra recebe o horário da central e usa o novo painel.
const nodes=new Map();context.document={getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:''});return nodes.get(id);},addEventListener(){}};
context.window.HDBRWarData={meta:()=>saved};
const war=fs.readFileSync('guerra.js','utf8').replace(/\}\)\(\);\s*$/,'window.testDSS={renderDSS};})();');
vm.runInNewContext(war,context);
context.window.testDSS.renderDSS([{...station,planet}]);
assert.ok(nodes.get('dss').innerHTML.includes('dss-station') && nodes.get('dss').innerHTML.includes('Última leitura'));
context.window.testDSS.renderDSS([]);assert.ok(nodes.get('dss').innerHTML.includes('DSS TEMPORARIAMENTE INDISPONÍVEL'));
context.window.testDSS.renderDSS(null);assert.ok(nodes.get('dss').innerHTML.includes('SINAL DA DSS INDISPONÍVEL'));
for(const page of ['guerra.html','ordem.html']){
 const text=fs.readFileSync(page,'utf8');assert.ok(text.indexOf('dss-station.js')<text.indexOf('guerra.js'));
}
for(const icon of ['common-sample.svg','rare-sample.svg','super-sample.svg']) assert.ok(fs.readFileSync('imagens/guerra/dss/'+icon,'utf8').includes('<svg'));
console.log('PASS: DSS rendering and real Guerra integration; factual item IDs, funding/ETA, voting deadline, expired/invalid/unknown actions, frozen old readings, absent costs, escaped text, absent station and local assets.');
// Recarga recebida em produção: status 3 tem prazo próprio, separado do financiamento.
const deadline=now+4*86400000, cooldown={id32:4091660627,status:3,statusExpire:new Date(deadline).toISOString()};
assert.equal(api.actionState(cooldown,now).kind,'cooldown');
for(const end of ['', 'invalid',new Date(now-1).toISOString()]) assert.equal(api.actionState({...cooldown,statusExpire:end},now).kind,'pending');
assert.equal(api.actionState({...cooldown,status:'recharging'},now).kind,'cooldown');
assert.equal(api.actionState({...cooldown,status:1},now).kind,'funding');
let liveHTML=api.render({tacticalActions:[cooldown,{id32:3248573007,status:2,statusExpire:new Date(deadline).toISOString()}]},planet,{meta:{time:now,stale:false},now});
assert.ok(liveHTML.includes('Recarregando') && liveHTML.includes('Disponível em: '));
assert.equal((liveHTML.match(/dss-confirmed-active/g)||[]).length,1);
let frozenHTML=api.render({tacticalActions:[cooldown,{status:2,statusExpire:new Date(deadline).toISOString()}]},planet,{meta:{time:now,stale:true},now});
assert.ok(!frozenHTML.includes('dss-confirmed-active'));
assert.ok(frozenHTML.includes('Disponível em: ') && (frozenHTML.match(/Última leitura/g)||[]).length===1);
assert.equal(api.render({tacticalActions:[cooldown,{status:2,statusExpire:new Date(deadline).toISOString()}]},planet,{meta:{time:now,stale:true},now:now+60000}),frozenHTML);
const activeClasses=new Set(['dss-tactical-active','dss-confirmed-active']);
const card={classList:{remove:s=>activeClasses.delete(s),replace:(a,b)=>{activeClasses.delete(a);activeClasses.add(b);}}};
const node={dataset:{dssDeadline:String(now+1000),dssPrefix:'Ativa por: '},closest:s=>s==='.dss-tactical-active'?card:null};
const root={querySelector:()=>null,querySelectorAll:s=>s==='[data-dss-deadline]'?[node]:s==='.dss-confirmed-active'?[card]:[]};
api.tick(root,{time:now,stale:false},now+2000);
assert.ok(!activeClasses.has('dss-confirmed-active') && activeClasses.has('dss-tactical-pending'));
activeClasses.add('dss-confirmed-active');api.tick(root,{time:now,stale:true},now+2000);assert.ok(!activeClasses.has('dss-confirmed-active'));
const css=fs.readFileSync('guerra.css','utf8');assert.ok(css.includes('prefers-reduced-motion:reduce') && css.includes('.dss-tactical-icon{filter:none;opacity:1}'));
assert.ok(!css.includes('filter:grayscale(1);opacity:.85') && !css.includes('filter:sepia(1) saturate(8)'));
console.log('PASS: cooldown state 3/deadline, no inferred activation after expiry, frozen cached clocks, active-only yellow frame, expiry/stale removes pulse, original icon colors and reduced motion.');
const visual=api.render({tacticalActions:[{id32:4091660627,status:3,statusExpire:new Date(deadline).toISOString()},{id32:3248573007,status:1},{id32:3578080409,status:1}]},planet,{meta:{time:now,stale:false},now});
assert.equal((visual.match(/class="dss-keyword"/g)||[]).length,6);
assert.ok(visual.indexOf('<h4>Distribuição')<visual.indexOf('<h4>Bloqueio') && visual.indexOf('<h4>Bloqueio')<visual.indexOf('<h4>Tempestade'));
assert.ok(css.includes('filter:none'));
const visualCss=fs.readFileSync('guerra.css','utf8');assert.ok(visualCss.includes('repeating-linear-gradient(45deg') && visualCss.includes('.dss-tactical-cooldown h4,.dss-tactical-offline h4{color:#db4800}'));
assert.ok(visualCss.includes('color:#b8dcea;font:800 15px') && visualCss.includes('.dss-keyword{color:#ffe600'));
console.log('PASS: reference layout order, six escaped Portuguese keyword highlights, blue preparation titles, orange-red unavailable cards and static hazard stripes.');
assert.equal((old.match(/Última leitura/g)||[]).length,1,'one dated footer for saved station');
assert.ok(!old.includes('Próximo salto') && !old.includes('Estimativa na última leitura') && !old.includes('Ativa na última leitura'));
assert.ok(old.indexOf('dss-reading-footer')>old.lastIndexOf('</article>'),'reading notice belongs after all action cards');
let repeated={textContent:''},tickNode={dataset:{dssDeadline:String(deadline),dssPrefix:'Disponível em: '},closest:()=>null};
const noticeRoot={querySelector:s=>s==='.dss-reading-footer'?repeated:null,querySelectorAll:s=>s==='[data-dss-deadline]'?[tickNode]:[]};
api.tick(noticeRoot,{time:now,stale:true},now+1000);let frozen=tickNode.textContent;
for(let i=2;i<8;i++)api.tick(noticeRoot,{time:now,stale:true},now+i*1000);
assert.equal(tickNode.textContent,frozen);assert.ok(frozen.startsWith('Disponível em: ') && !frozen.includes('leitura'));
assert.ok(repeated.textContent.includes('situação atual sem confirmação'));
api.tick(noticeRoot,{time:now,stale:false},now+1000);assert.ok(!repeated.textContent.includes('sem confirmação'));
console.log('PASS: one compact dated footer, only time for election/funding, short cooldown label and repeated ticks preserve historical times without duplicated notices.');
