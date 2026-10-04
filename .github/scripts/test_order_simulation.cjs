/* Simula ciclos e compara os resultados do navegador e do coletor Python. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'order-state.js'),'utf8');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/order-defense-result.json'),'utf8'));
const clone=v=>JSON.parse(JSON.stringify(v)),stamp=t=>new Date(t).toISOString();
function rules(storage=new Map()){
 const sandbox={window:{},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
 vm.runInNewContext(source,sandbox);return sandbox.window.HDBROrderState;
}
const cases=[],start=Date.parse(fixture.snapshot.first_seen_at),now=Date.parse(fixture.now);
function add(name,snapshot,dispatches,expected,time=now){cases.push({name,snapshot,dispatches,expected,now:stamp(time)});}
// Uma abertura desconhecida posterior não pode usar nomes/contexto para fechar a anterior.
for(const offset of [1000,10000,30000,60000,120000,299000,300000,301000,3600000]){
 for(const [title,state] of [['MAJOR ORDER WON','completed'],['MAJOR ORDER FAILED','failed'],['ORDEM IMPERATIVA CONCLUÍDA','completed'],['ORDEM IMPERATIVA FRACASSADA','failed']]){
  for(const names of ['', '\nGATRIA and WASAT.']){
   for(const mode of ['unlinked','opening-same-id','opening-other-id','result-same-id','result-other-id']){
    const opening={id:9999,published:stamp(start+offset),message:'NEW MAJOR ORDER\nGATRIA and WASAT.'};
    const result={...fixture.dispatch,message:title+names};
    if(mode==='opening-same-id')opening.assignmentId=fixture.snapshot.order.id;
    if(mode==='opening-other-id')opening.assignmentId=999;
    if(mode==='result-same-id')result.assignmentId=fixture.snapshot.order.id;
    if(mode==='result-other-id')result.assignmentId=999;
    const expected=['opening-same-id','result-same-id'].includes(mode)?state:null;
    const entries=[fixture.opening,opening,result];
    add(`${offset}/${title}/${names.length}/${mode}`,fixture.snapshot,entries,expected);
    add(`reverse/${offset}/${title}/${names.length}/${mode}`,fixture.snapshot,[...entries].reverse(),expected);
   }
  }
 }
}
// Publicações empatadas, sem vínculo explícito, não comprovam o ciclo.
add('same-time opening/result',fixture.snapshot,[fixture.opening,{published:fixture.dispatch.published,message:'NEW MAJOR ORDER'}, {...fixture.dispatch,message:'MAJOR ORDER WON\nGATRIA and WASAT.'}],null);
// Uma notícia comum ou título apenas parecido não declara vitória/derrota.
for(const headline of ['WAR UPDATE','MAJOR ORDER PROGRESS','NEW MAJOR ORDER','TANK SALES UPDATE',"MAJOR ORDER WON'T BE EASY",'MAJOR ORDER FAILED TO LOAD','MAJOR ORDER WON LAST WEEK']){
 add('ordinary/'+headline,fixture.snapshot,[fixture.opening,{...fixture.dispatch,message:headline+'\nGATRIA and WASAT.'}],null);
}
add('speculation is not opening',fixture.snapshot,[fixture.opening,{published:stamp(start+120000),message:'NEW MAJOR ORDER EXPECTED TOMORROW'},fixture.dispatch],'completed');
add('contradictory headings',fixture.snapshot,[fixture.opening,{...fixture.dispatch,title:'MAJOR ORDER FAILED'}],null);
// Simula ordens em sequência, coleta após abertura, derrota e vitória alternadas.
let lifecycleChecks=0;
for(const delay of [0,10000,60000,300000,21600000,86400000]){
 for(const [oldTitle,oldState,nextTitle,nextState] of [['MAJOR ORDER WON','completed','MAJOR ORDER FAILED','failed'],['MAJOR ORDER FAILED','failed','MAJOR ORDER WON','completed']]){
  const oldResult={...fixture.dispatch,message:oldTitle};
  const end=Date.parse(oldResult.published),newTime=end+delay;
  const opening={id:4000,published:stamp(newTime),message:'NEW MAJOR ORDER\nDefend GATRIA and WASAT.'};
  const nextResult={id:4001,published:stamp(newTime+3600000),message:nextTitle};
  const snapshot=clone(fixture.snapshot);snapshot.key='123456';snapshot.order.id=123456;
  snapshot.first_seen_at=stamp(newTime+1000);snapshot.order.expiration=stamp(newTime+86400000);
  const entries=[fixture.opening,oldResult,opening,nextResult];
  // Um anúncio no mesmo instante do resultado antigo é ambíguo sem IDs.
  add('previous-cycle/'+delay+'/'+oldState,fixture.snapshot,entries,delay===0?null:oldState,newTime+3605000);
  add('next-cycle/'+delay+'/'+nextState,snapshot,entries,nextState,newTime+3605000);
  const memory=new Map();
  assert.equal(rules(memory).resolve(null,fixture.snapshot,end+1000,{dispatches:[fixture.opening,oldResult]}).state,oldState);lifecycleChecks++;
  assert.equal(rules(memory).resolve(null,fixture.snapshot,end+2000,{dispatches:[]}).state,oldState);lifecycleChecks++;
  assert.equal(rules(memory).resolve(snapshot.order,fixture.snapshot,newTime+1000,{dispatches:[fixture.opening,oldResult,opening]}).state,'active');lifecycleChecks++;
  assert.equal(rules(memory).resolve(snapshot.order,snapshot,newTime+3605000,{dispatches:entries}).state,nextState);lifecycleChecks++;
  assert.equal(rules(memory).resolve(snapshot.order,snapshot,newTime+3610000,{dispatches:[]}).state,nextState);lifecycleChecks++;
 }
}
for(const test of cases){
 const actual=rules().outcome(test.snapshot.order,test.snapshot,test.dispatches,{},Date.parse(test.now))?.state??null;
 assert.equal(actual,test.expected,'browser: '+test.name);
}
const python=spawnSync('python3',['-c',`
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path('.github/scripts').resolve()))
import update_major_order as r
out=[]
for t in json.load(sys.stdin):
 v=r.dispatch_outcome(t['dispatches'],t['snapshot'],r.parse_date(t['now']))
 out.append(v['state'] if v else None)
print(json.dumps(out))
`],{cwd:root,input:JSON.stringify(cases),encoding:'utf8',maxBuffer:5*1024*1024});
assert.equal(python.status,0,python.stderr);
const results=JSON.parse(python.stdout);
assert.equal(results.length,cases.length);
results.forEach((value,i)=>assert.equal(value,cases[i].expected,'python: '+cases[i].name));
console.log(`${cases.length} scenarios passed in JS and Python (${cases.length*2} checks), plus ${lifecycleChecks} browser lifecycle checks`);
