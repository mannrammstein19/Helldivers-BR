import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceOrderHistory} from './order-history.mjs';
import {CentralStore} from './core.mjs';
import {WarCentral} from './worker.mjs';
const time=Date.parse('2026-10-06T10:00:00Z');
const order=(id=11,type=12)=>({id,title:'MAJOR ORDER',expiration:new Date(time+600000).toISOString(),tasks:[{type,valueTypes:[3,12],values:[1,173]}],progress:[0]});
const sample=(data,t=time)=>({data,time:t,source:'direct',stale:false});
const opening={id:1,published:new Date(time-1000).toISOString(),message:'NEW MAJOR ORDER\nDefend GATRIA.'};
const win={id:2,published:new Date(time+1000).toISOString(),assignmentId:11,message:'MAJOR ORDER WON\nCampaign complete.'};
const input=(assignments,dispatches=[],now=time)=>({assignments,dispatches:sample(dispatches,now),catalog:{173:{name:'GATRIA'}},now});
test('central preserves explicitly confirmed result across disappearance, failures, restart and repeated old order',()=>{
 let s=advanceOrderHistory(null,input(sample([order()])));
 assert.equal(s.state,'active');assert.equal(s.target_planets['173'],'GATRIA');
 s=advanceOrderHistory(s,input(sample([]),[opening,win],time+2000));assert.equal(s.state,'completed');assert.equal(s.order.progress[0],0);
 for(const a of [null,sample([]),sample([order()])])assert.deepEqual(advanceOrderHistory(structuredClone(s),input(a)),s);
 const newer=advanceOrderHistory(s,input(sample([order(12)]),[win],time+3000));assert.equal(newer.key,'12');assert.equal(newer.state,'active');
});
test('absence and expired incomplete order never invent defeat or victory; stale data cannot open another cycle',()=>{
 let s=advanceOrderHistory(null,input(sample([order()])));
 assert.deepEqual(advanceOrderHistory(s,input({...sample([order(22)]),stale:true})),s);
 s=advanceOrderHistory(s,input(sample([],time+700000),[],time+700000));assert.equal(s.state,'pending');
 s=advanceOrderHistory(s,input(sample([],time+2600000),[],time+2600000));assert.equal(s.state,'unknown');
 assert.equal(advanceOrderHistory(s,input(sample([]),[{...win,assignmentId:44}],time+2700000)).state,'unknown');
});
test('unavailable assignments do not prevent a dated, linked dispatch from proving defeat',()=>{
 const s=advanceOrderHistory(null,input(sample([order()])));
 const result=advanceOrderHistory(s,input(null,[{...win,message:'MAJOR ORDER FAILED\nCampaign lost.'}],time+2000));assert.equal(result.state,'failed');
});
test('counter-only completion requires real goal and absence/expiry, never rounds 99.999 into victory',()=>{
 const o=order(11,3);o.tasks[0].values[0]=100;o.progress=[99.999];
 let s=advanceOrderHistory(null,input(sample([o])));assert.equal(advanceOrderHistory(s,input(sample([],time+700000),[],time+700000)).state,'pending');
 o.progress=[100];s=advanceOrderHistory(null,input(sample([o])));assert.equal(s.state,'active');
 assert.equal(advanceOrderHistory(s,input(sample([],time+700000),[],time+700000)).outcome_source,'objective_progress');
 const defense=order();defense.progress=[1];s=advanceOrderHistory(null,input(sample([defense])));assert.equal(advanceOrderHistory(s,input(sample([],time+700000),[],time+700000)).state,'pending');
});
function storeSetup(){const disk=new Map();const storage={list:async()=>new Map(disk),put:async(k,v)=>disk.set(k,structuredClone(v)),delete:async k=>disk.delete(k)};return {disk,storage};}
test('server history survives restart and resolves previous archived order when a new one is already active',async()=>{
 const {disk,storage}=storeSetup();let t=time;let live=[order()],dispatches=[];
 const options={now:()=>t,wait:async()=>{},fetcher:async url=>{
  if(url.endsWith('WarID'))return Response.json({id:801});
  if(url.includes('/Assignment/'))return Response.json(live.map(o=>({id32:o.id,progress:o.progress,expiresIn:600,setting:{tasks:o.tasks,overrideTitle:o.title}})));
  if(url.endsWith('/dispatches'))return Response.json(dispatches);
  if(url.endsWith('/planets'))return Response.json(Array.from({length:10},(_,i)=>({index:i===0?173:i,name:i===0?'GATRIA':'P'+i})));
  throw Error('unexpected '+url);
 }};
 const store=new CentralStore(storage,options);await store.refreshOrderHistory();assert.equal(disk.get('order:current').key,'11');
 t+=200000;live=[order(12)];dispatches=[opening,win];await store.refreshOrderHistory();assert.equal(disk.get('order:current').key,'12');assert.equal(disk.get('order:archive:11').state,'completed');
 const restarted=new CentralStore(storage,options);await restarted.ready;const result=await restarted.get('order-history');assert.equal(result.key,'12');assert.equal(restarted.memory.get('order:archive:11').state,'completed');
});
test('durable alarm is preserved on normal requests and rearmed even when monitoring fails',async()=>{
 const {storage}=storeSetup();let alarm=null;let writes=0;storage.getAlarm=async()=>alarm;storage.setAlarm=async v=>{alarm=v;writes++};
 const obj=new WarCentral({storage,waitUntil(){}},{CONTACT:'test'});await obj.armMonitor();const first=alarm;await obj.armMonitor();assert.equal(alarm,first);assert.equal(writes,1);
 obj.store.refreshOrderHistory=async()=>{throw Error('upstream unavailable')};await obj.alarm();assert.equal(writes,2);assert.ok(alarm>Date.now());
});
test('429 without Retry-After backs off progressively, persists through restart and resets only on successful JSON',async()=>{
 const {disk,storage}=storeSetup();let t=time,calls=0;let fail=true;
 const opts={now:()=>t,wait:async ms=>{t+=ms},fetcher:async()=>{calls++;return fail?new Response('',{status:429}):Response.json([])}};
 let store=new CentralStore(storage,opts);await store.ready;await assert.rejects(store.request('https://community.example/dss','community'));assert.equal(disk.get('blocked:community'),time+60000);
 store=new CentralStore(storage,opts);await store.ready;await assert.rejects(store.request('https://community.example/dss','community'));assert.equal(calls,1);
 t=time+60000;await assert.rejects(store.request('https://community.example/dss','community'));assert.equal(disk.get('blocked:community'),t+120000);
 t+=120000;fail=false;await store.request('https://community.example/dss','community');assert.equal(disk.get('rate-failures:community'),0);
});
test('successful cache revalidation clears obsolete failure diagnostics',async()=>{
 const {storage}=storeSetup();const s=new CentralStore(storage,{now:()=>time});await s.ready;
 await assert.rejects(s.cached('sample',1000,async()=>{throw Error('timeout')}));assert.ok(s.memory.has('failure:sample'));
 s.memory.set('failure:sample',{next:0,error:'timeout'});await s.cached('sample',1000,async()=>({data:[]}));assert.equal(s.memory.has('failure:sample'),false);
});
test('concurrent snapshot readers share one monitoring cycle instead of multiplying upstream requests',async()=>{
 const {storage}=storeSetup();const s=new CentralStore(storage,{now:()=>time});let reads=0;
 s.get=async name=>{reads++;return sample(name==='assignments'?[order()]:[])};s.catalog=async()=>({data:[],time});
 await Promise.all(Array.from({length:50},()=>s.refreshOrderHistory()));assert.equal(reads,2);
});
test('Retry-After HTTP date is respected exactly and a blocked source never consumes a request',async()=>{
 const {disk,storage}=storeSetup();let count=0;const end=time+300000;
 const s=new CentralStore(storage,{now:()=>time,wait:async()=>{},fetcher:async()=>{count++;return new Response('',{status:429,headers:{'Retry-After':new Date(end).toUTCString()}})}});await s.ready;
 await assert.rejects(s.request('https://community.example/dss','community'));assert.equal(disk.get('blocked:community'),end);
 await assert.rejects(s.request('https://community.example/dss','community'));assert.equal(count,1);
});
