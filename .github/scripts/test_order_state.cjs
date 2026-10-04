const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/order-context.json'),'utf8'));
const source = fs.readFileSync(path.join(__dirname,'../../order-state.js'),'utf8');
const now = Date.parse(fixture.now);
function instance() {
  const storage = new Map();
  const sandbox = {window:{},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
  vm.runInNewContext(source,sandbox);
  return sandbox.window.HDBROrderState;
}
const copy = v => JSON.parse(JSON.stringify(v));
const cases = [
  ['real failed announcement',d=>d,'failed'],
  ['matching success',d=>({...d,message:d.message.replace('MAJOR ORDER FAILED','MAJOR ORDER WON')}),'completed'],
  ['old result',d=>({...d,published:'2026-09-26T11:32:14Z'}),null],
  ['unrelated order',d=>({...d,message:'MAJOR ORDER FAILED\nThe Helldivers failed to liberate unrelated worlds.'}),null],
  ['one common topic',d=>({...d,message:'MAJOR ORDER FAILED\nThe Maelstrom project was unsuccessful.'}),null],
  ['wrong explicit ID',d=>({...d,assignmentId:999}),null],
  ['result before deadline',d=>({...d,published:'2026-10-01T18:00:00Z'}),null],
  ['future result',d=>({...d,published:new Date(now+3600000).toISOString()}),null],
  ['matching explicit ID',d=>({...d,assignmentId:fixture.snapshot.order.id,message:'MAJOR ORDER FAILED'}),'failed'],
];
for(const [name,change,state] of cases) {
  const result=instance().outcome(fixture.snapshot.order,fixture.snapshot,[change(copy(fixture.dispatch))],{},now);
  assert.equal(result?.state??null,state,name);
}
let rules=instance();
assert.equal(rules.outcome(fixture.snapshot.order,fixture.snapshot,[],{},now),null,'expiration alone');
assert.equal(rules.outcome(fixture.snapshot.order,fixture.snapshot,[fixture.dispatch,{published:'2026-10-01T19:31:30Z',message:'NEW MAJOR ORDER\nAnother objective.'}],{},now),null,'new order boundary');
rules=instance();
assert.equal(rules.resolve(null,fixture.snapshot,now,{dispatches:[fixture.dispatch]}).state,'failed','resolve generic order');
assert.equal(rules.resolve(null,fixture.snapshot,now,{dispatches:[]}).state,'failed','old snapshot cannot reopen result');
const newOrder={...copy(fixture.snapshot.order),id:999,expiration:'2026-10-05T19:31:00Z'};
assert.equal(rules.resolve(newOrder,fixture.snapshot,now,{dispatches:[fixture.dispatch]}).state,'active','new order must not inherit old result');
console.log('14 browser result checks passed');

const defense=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/order-defense-result.json'),'utf8'));
const defenseNow=Date.parse(defense.now),ds=[defense.dispatch,defense.opening];
assert.equal(instance().outcome(defense.snapshot.order,defense.snapshot,ds,{},defenseNow)?.state,'completed','real early victory without target names');
assert.equal(instance().outcome(defense.snapshot.order,defense.snapshot,[defense.dispatch],{},defenseNow),null,'topic alone cannot associate early victory');
assert.equal(instance().outcome(defense.snapshot.order,defense.snapshot,[defense.dispatch,{...defense.opening,message:'NEW MAJOR ORDER\nDefend unrelated planets.'}],{},defenseNow),null,'unrelated opening');
const boundary={published:'2026-10-04T03:00:00Z',message:defense.opening.message};
assert.equal(instance().outcome(defense.snapshot.order,defense.snapshot,[...ds,boundary],{},defenseNow),null,'later opening even with identical planets');
assert.equal(instance().outcome(defense.snapshot.order,defense.snapshot,[{...defense.dispatch,assignmentId:999},defense.opening],{},defenseNow),null,'wrong result ID overrides cycle');
for(const headline of ['GRANDE ORDEM CONQUISTADA','ORDEM MAIOR CONQUISTADA'])assert.equal(instance().outcome(defense.snapshot.order,defense.snapshot,[{...defense.dispatch,message:headline},defense.opening],{},defenseNow)?.state,'completed',headline);
assert.equal(instance().outcome(defense.snapshot.order,defense.snapshot,[{...defense.dispatch,message:'FALHA NO PEDIDO PRINCIPAL'},defense.opening],{},defenseNow)?.state,'failed','Portuguese defeat');
const storage=new Map();
function browser(){const sandbox={window:{},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};vm.runInNewContext(source,sandbox);return sandbox.window.HDBROrderState;}
assert.equal(browser().resolve(null,defense.snapshot,defenseNow,{dispatches:ds}).state,'completed');
assert.equal(browser().resolve(defense.snapshot.order,defense.snapshot,defenseNow,{dispatches:[]}).state,'completed','reload and stale snapshot cannot reopen');
assert.equal(browser().resolve({...defense.snapshot.order,id:12345},defense.snapshot,defenseNow,{dispatches:ds}).state,'active','new order does not inherit victory');
console.log('11 defense and reload checks passed');
