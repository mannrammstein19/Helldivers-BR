const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const saved=new Map(),nodes=new Map();
const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',style:{setProperty(){}},classList:{add(){},remove(){}},querySelector(){return null},contains(){return false}});return nodes.get(id)};
let reading={time:Date.now(),stale:false},fixture;
const context={window:{HDBRWarData:{meta:()=>reading}},document:{getElementById:node,querySelector(){return null},addEventListener(){}},localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},console,Date,AbortSignal};vm.createContext(context);
vm.runInContext(fs.readFileSync('order-rewards.js','utf8'),context);
vm.runInContext(fs.readFileSync('order-targets.js','utf8'),context);
const label=context.window.HDBROrderTargets.label;
for(const [id,name] of [[717622970,'Bile Spewers'],[444529084,'Bile Spitters']]){
 for(const goal of [30,30000000,25000000000]){
  assert.equal(label({valueTypes:[5,3,4,1,12],values:[999,goal,id,2,471929602]},'Terminídeos'),name);
  assert.equal(label({valueTypes:[4],values:[String(id)]},''),name);
  assert.equal(label({valueTypes:[4,1],values:[id,0]},''),name);
  assert.equal(label({valueTypes:[4,1],values:[id,3]},'Autômatos'),'alvo específico não identificado');
 }
}
assert.equal(label({valueTypes:[4],values:[1379865898]},''),'Cuspidores de Bile','ID anterior preservado');
assert.equal(label({valueTypes:[4],values:[999]},'Terminídeos'),'alvo específico não identificado');
assert.equal(label({valueTypes:[5,12],values:[717622970,444529084]},'Terminídeos'),'Terminídeos');
for(const file of ['overview.js','guerra.js']){
 const injected=file==='overview.js'?'window.testHome={renderOrder};':'loadMajorOrderSnapshot=async()=>null;loadPlanetCatalog=async()=>({});autoTranslate=async v=>v;window.testWar={renderOrder};';
 vm.runInContext(fs.readFileSync(file,'utf8').replace(/\}\)\(\);\s*$/,';'+injected+'})();'),context);
}
vm.runInContext(fs.readFileSync('order-state.js','utf8'),context);
context.window.HDBROrderState={...context.window.HDBROrderState,resolve:()=>fixture};
const order=JSON.parse(fs.readFileSync('dados/major-order.json','utf8')).order;
function check(html){
 for(const text of ['Eliminar 30.000.000 Bile Spewers','Eliminar 40.000.000 Bile Spitters','<small>Conclusão</small>','<strong>Finalizado</strong>','<strong>Concluído</strong>','<strong>Coletando</strong>'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/alvo específico não identificado|Conclusão estimada|AGUARDANDO AMOSTRAS|FINALIZADO|CONCLUÍDO/);
}
(async()=>{
 fixture={order,state:'active'};context.window.testHome.renderOrder(null,fixture);check(node('hd-ov-order').innerHTML);
 await context.window.testWar.renderOrder([order]);check(node('ordem-maior').innerHTML);
 reading={time:reading.time+60000,stale:false};const advancing={...order,progress:[1,order.progress[1]+100000,40000000]};fixture={order:advancing,state:'active'};
 context.window.testHome.renderOrder(null,fixture);await context.window.testWar.renderOrder([advancing]);
 for(const id of ['hd-ov-order','ordem-maior'])assert.match(node(id).innerHTML,/<small>Conclusão<\/small><strong>\d+(?:d |h |min)/);
 for(const file of ['index.html','guerra.html','ordem.html']){
  const html=fs.readFileSync(file,'utf8');assert.match(html,/order-targets\.js\?v=ordens-20261010/);assert.match(html,/order-desktop\.css\?v=ordens-20261010/);
 }
 console.log('PASS: alvos por ID, metas futuras, facção; nomes e métricas reais no Início/Guerra/Ordem; previsão numérica preservada.');
})().catch(e=>{console.error(e);process.exitCode=1});
