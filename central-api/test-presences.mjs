import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
import {normalizeWar,normalizeEffects} from './normalize.mjs';import {CentralStore} from './core.mjs';
const readAt=1791585499208;
const info={startDate:1706040313,planetInfos:Array.from({length:10},(_,n)=>({index:203+n,maxHealth:100,initialOwner:1}))};
const status={time:83645900,planetStatus:info.planetInfos.map(p=>({index:p.index,health:100,owner:1})),campaigns:[{planetIndex:203}],planetActiveEffects:[],globalEvents:[{eventId:1501049,effectIds:[1202,1203],planetIndices:[203],expireTime:83811600}]};
const sandbox={window:{},document:{addEventListener(){}},console,Map,Set,Date};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(new URL('../planet-presences.js',import.meta.url),'utf8'),sandbox);const ui=sandbox.window.HDBRPresences;
test('Menkent: global event explicitly binds Jet Brigade to 203 in planets and campaigns',()=>{
 const result=normalizeWar(status,info,[],readAt),p=result.planets[0];assert.deepEqual(p.activeEffects.map(e=>e.galacticEffectId),[1202,1203]);
 assert.equal(p.activeEffects[0].expiresAt,new Date(readAt+(83811600-status.time)*1000).toISOString());
 assert.equal(result.campaigns[0].planet,p);assert.equal(ui.list(p)[0].key,'jet');assert.equal(ui.list(result.planets[1]).length,0);
 assert.equal(p.currentOwner,'Humans','presence does not imply ownership');
});
test('sources and paired IDs deduplicate; explicit regional planet binding wins over generic index',()=>{
 const s={...status,planetActiveEffects:[{planetIndex:203,index:204,galacticEffectId:1202},{index:203,galacticEffectId:1203}]};
 const p=normalizeWar(s,info,[],readAt).planets[0];assert.equal(p.activeEffects.length,2);assert.equal(ui.list(p).length,1);
 assert.equal(p.activeEffects[0].expiresAt,undefined,'current planetary evidence has no invented expiry');
});
test('fresh removal and expiry remove presence even if stale catalogue aliases still mention it',()=>{
 const catalog=[{index:203,activeEffects:[{galacticEffectId:1202}],effects:[{galacticEffectId:1202}],modifiers:[{name:'THE JET BRIGADE'}]}];
 for(const s of [{...status,globalEvents:[]},{...status,time:83811600},{...status,time:83811601}]){
  const p=normalizeWar(s,info,catalog,readAt).planets[0];assert.equal(p.activeEffects.length,0);assert.equal(ui.list(p).length,0);
 }
});
test('global clock is mandatory; invalid/unbound/narrative effects never imply a presence',()=>{
 for(const time of [undefined,null,'83645900',NaN,Infinity,-1])assert.equal(normalizeEffects({...status,time},readAt).size,0);
 for(const expireTime of [undefined,null,'83811600',NaN,Infinity,0,-1])assert.equal(normalizeEffects({...status,globalEvents:[{...status.globalEvents[0],expireTime}]},readAt).size,0);
 for(const event of [{effectIds:[1202],message:'Menkent Jet Brigade',expireTime:83811600},{planetIndices:[203],message:'Jet Brigade',expireTime:83811600},{planetIndices:['203'],effectIds:[1202],expireTime:83811600}])assert.equal(normalizeEffects({...status,globalEvents:[event]},readAt).size,0);
 const p=normalizeWar({...status,globalEvents:[{...status.globalEvents[0],effectIds:[99999]}]},info,[],readAt).planets[0];assert.equal(ui.list(p).length,0);
});
test('PascalCase and multi-planet global events keep only explicit bindings',()=>{
 const effects=normalizeEffects({Time:5,GlobalEvents:[{EffectIds:[1202,1203],PlanetIndices:[203,204],ExpireTime:10}]},readAt);
 assert.equal(effects.size,2);assert.equal(effects.get(204).size,2);
 assert.equal(ui.list({index:203,activeEffects:[{planetIndex:204,galacticEffectId:1202}]}).length,0);
 assert.equal(ui.list({index:203,planetActiveEffects:[{planetIndex:203,index:204,galacticEffectId:1202}]}).length,1);
});
test('shared cache: outage/restart keeps dated history; fresh expiry removes both planets/campaign presence',async()=>{
 let clock=readAt,raw=structuredClone(status),fail=false;const disk=new Map();
 const storage={list:async()=>new Map(disk),put:async(k,v)=>disk.set(k,structuredClone(v)),delete:async k=>disk.delete(k)};
 const opts={now:()=>clock,wait:async ms=>{clock+=ms},fetcher:async url=>{
  if(fail)throw Error('outage');if(url.endsWith('WarID'))return Response.json({id:801});if(url.endsWith('WarInfo'))return Response.json(info);if(url.endsWith('/Status'))return Response.json(raw);if(url.includes('/planets'))return Response.json(info.planetInfos.map(p=>({index:p.index})));throw Error(url);
 }};
 let store=new CentralStore(storage,opts);const first=await store.get('planets');assert.equal(ui.list(first.data[0]).length,1);
 clock+=400000;fail=true;const saved=await store.get('planets');assert.equal(saved.stale,true);assert.equal(saved.time,first.time);
 store=new CentralStore(storage,opts);const restarted=await store.get('planets');assert.equal(restarted.time,first.time);assert.equal(restarted.stale,true);
 clock+=400000;fail=false;raw.time=83811600;
 const fresh=await store.get('planets');assert.equal(fresh.stale,false);assert.equal(ui.list(fresh.data[0]).length,0);
 const campaigns=await store.get('campaigns');assert.equal(ui.list(campaigns.data[0].planet).length,0);
});
test('new event moves only to explicit destination; conquest alone does not fabricate removal',()=>{
 const conquered=normalizeWar(status,info,[],readAt).planets[0];assert.equal(ui.list(conquered).length,1);
 const moved=normalizeWar({...status,globalEvents:[{...status.globalEvents[0],eventId:1501059,planetIndices:[204]}]},info,[],readAt).planets;
 assert.equal(ui.list(moved[0]).length,0);assert.equal(ui.list(moved[1])[0].key,'jet');
 const unconfirmed=normalizeWar({...status,globalEvents:[]},info,[conquered],readAt).planets[0];assert.equal(ui.list(unconfirmed).length,0);
});
