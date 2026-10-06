import {advanceOrderHistory} from './order-history.mjs';
import {root,field,rows,warDate,normalizeWar,normalizeAssignments,normalizeDispatches,validArray} from './normalize.mjs';
const GAME='https://api.live.prod.thehelldiversgame.com',COMMUNITY='https://api.helldivers2.dev';
export const routes=Object.freeze({'/api/v1/planets':'planets','/api/v1/campaigns':'campaigns','/api/v1/assignments':'assignments','/api/v1/dispatches':'dispatches','/api/v2/space-stations':'dss','/api/v1/steam':'steam','/api/v1/major-order-state':'order-history'});
const paths={planets:'/api/v1/planets',campaigns:'/api/v1/campaigns',assignments:'/api/v1/assignments',dispatches:'/api/v1/dispatches',dss:'/api/v2/space-stations',steam:'/api/v1/steam'};
export class CentralStore{
 constructor(storage,{fetcher=(...args)=>globalThis.fetch(...args),now=Date.now,wait=ms=>new Promise(r=>setTimeout(r,ms)),contact='https://github.com/mannrammstein19/Helldivers-BR'}={}){this.storage=storage;this.fetcher=fetcher;this.now=now;this.wait=wait;this.contact=contact;this.memory=new Map();this.pending=new Map();this.queue=Promise.resolve();this.historyQueue=Promise.resolve();this.ready=this.load();}
 async load(){const entries=await this.storage.list();for(const [key,value]of entries)this.memory.set(key,value);}
 async save(key,value){await this.storage.put(key,value);this.memory.set(key,value);return value;}
 ttl(name){return name==='steam'?900000:name==='dispatches'?120000:60000;}
 async request(url,source){
  const run=async()=>{
   const blocked=this.memory.get('blocked:'+source)||0;if(blocked>this.now())throw Error(`${source}: HTTP 429; aguardar até ${new Date(blocked).toISOString()}`);
   const delay=(this.memory.get('next:'+source)||0)-this.now();if(delay>0)await this.wait(delay);
   // Espaçamento comum a todos os endpoints, inclusive fallback: sem rajadas.
   this.memory.set('next:'+source,this.now()+2400);
   const start=this.now();let response;
   try{response=await this.fetcher(url,{headers:{Accept:'application/json','Accept-Language':'en-US','User-Agent':'Helldivers-BR-Central/1','X-Super-Client':'Helldivers-BR-Central','X-Super-Contact':this.contact},signal:AbortSignal.timeout(12000)});
    if(response.status===429){const raw=response.headers.get('Retry-After'),seconds=Number(raw);const delay=raw!==null&&raw.trim()!==''&&Number.isFinite(seconds)&&seconds>=0?seconds*1000:Date.parse(raw)-this.now();const failures=(this.memory.get('rate-failures:'+source)||0)+1;await this.save('rate-failures:'+source,failures);await this.save('blocked:'+source,this.now()+Math.max(1000,Number.isFinite(delay)&&delay>=0?delay:Math.min(900000,60000*2**Math.min(failures-1,4))));}
    if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();if(this.memory.get('rate-failures:'+source)){await this.save('rate-failures:'+source,0);await this.save('blocked:'+source,0);}return data;
   }catch(e){const reason=['TimeoutError','AbortError'].includes(e.name)?'timeout de 12 segundos':e.message;console.warn(JSON.stringify({source,path:new URL(url).pathname,durationMs:this.now()-start,status:response?.status||null,error:reason}));throw Error(`${source}: ${reason}`);}
  };
  const task=this.queue.then(run,run);this.queue=task.catch(()=>{});return task;
 }
 async cached(key,ttl,loader){
  const old=this.memory.get(key);if(old&&this.now()-old.time<ttl)return old;
  if(this.pending.has(key))return this.pending.get(key);
  const failure=this.memory.get('failure:'+key);if(failure?.next>this.now())throw Error(failure.error);
  const task=(async()=>{try{const value=await loader();const saved=await this.save(key,{time:this.now(),...value});if(this.memory.has('failure:'+key)){if(this.storage.delete)await this.storage.delete('failure:'+key);else await this.storage.put('failure:'+key,{next:0,error:null});this.memory.delete('failure:'+key);}return saved;}catch(e){await this.save('failure:'+key,{next:this.now()+30000,error:e.message});throw e;}finally{this.pending.delete(key);}})();this.pending.set(key,task);return task;
 }
 async warId(){const value=await this.cached('war-id',21600000,async()=>{const data=root(await this.request(GAME+'/api/WarSeason/current/WarID','direct')),id=Number(typeof data==='object'?field(data,'id')??field(data,'warId'):data);if(!(id>0&&Number.isInteger(id)))throw Error('WarID inválido');return {data:id}});return value.data;}
 async info(id){return this.cached('info:'+id,21600000,async()=>{const data=root(await this.request(GAME+`/api/WarSeason/${id}/WarInfo`,'direct'));if(!Array.isArray(field(data,'planetInfos'))||!field(data,'startDate'))throw Error('WarInfo inválido');return {data};});}
 async catalog(){return this.cached('catalog',300000,async()=>{const data=await this.request(COMMUNITY+paths.planets,'community');if(!validArray(data,'planets'))throw Error('Catálogo inválido');return {data};}).catch(e=>{const old=this.memory.get('catalog');if(old)return old;throw e;});}
 async bundle(){const id=await this.warId();return this.cached('bundle:'+id,60000,async()=>{
  // Metadados e histórico têm cache próprio. O estado do planeta vem do jogo.
  const [info,cat]=await Promise.all([this.info(id),this.catalog()]);
  const data=await this.request(GAME+`/api/WarSeason/${id}/Status`,'direct'),time=this.now();
  const normalized=normalizeWar(data,info.data,cat.data,time,cat.time);normalized.planets=this.rememberRegions(normalized.planets,'planets');const byId=new Map(normalized.planets.map(p=>[p.index,p]));normalized.campaigns=normalized.campaigns.map(c=>({...c,planet:byId.get(c.planet.index)}));return {data:normalized,raw:root(data),info:info.data,source:'direct'};
 });}
 async direct(name){
  if(['planets','campaigns'].includes(name)){const b=await this.bundle();return {data:b.data[name],time:b.time,source:'direct'};}
  if(name==='assignments'){const id=await this.warId(),raw=await this.request(GAME+`/api/v2/Assignment/War/${id}`,'direct'),time=this.now();return {data:normalizeAssignments(raw,time),time,source:'direct'};}
  // NewsFeed bruto testado truncou o histórico antes dos despachos recentes.
  if(name==='dispatches')return this.community(name);
  if(name==='steam'){const raw=await this.request('https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=553850&count=3&maxlength=1&feeds=steam_community_announcements','steam');if(raw?.appnews?.appid!==553850||!Array.isArray(raw.appnews.newsitems))throw Error('Steam inválida');return {data:raw.appnews.newsitems.map(r=>({id:r.gid,title:r.title,url:r.url,publishedAt:new Date(r.date*1000).toISOString()})),source:'steam'};}
  // Para a DSS mantemos o esquema rico da Community: ações não são inventadas.
  return this.community(name);
 }
 rememberRegions(data,name){
  if(!['planets','campaigns'].includes(name))return data;
  const previous=[...(this.memory.get('resource:planets')?.data||[]),...(this.memory.get('resource:campaigns')?.data||[]).map(c=>c.planet)];
  const byId=new Map();for(const p of previous){const prior=byId.get(p.index);if(!prior||Math.max(...(p.regions||[]).map(r=>r.telemetryReadAtMillis||0),0)>Math.max(...(prior.regions||[]).map(r=>r.telemetryReadAtMillis||0),0))byId.set(p.index,p);}
  const enrich=p=>({...p,regions:(p.regions||[]).map(r=>{
   if(r.owner&&r.telemetryStale!==true)return r;
   const old=r.owner&&r.telemetryStale===true?r:byId.get(p.index)?.regions?.find(x=>x.id===r.id&&x.hash===r.hash&&(x.owner||x.lastKnown?.owner));
   const evidence=old?.owner&&old.telemetryStale!==true?old:(old?.lastKnown||old);
   if(!evidence?.owner||!evidence.telemetryReadAtMillis)return r;
   const lastKnown={owner:evidence.owner,health:evidence.health,regenPerSecond:evidence.regenPerSecond,isAvailable:evidence.isAvailable,availabilityFactor:evidence.availabilityFactor,players:evidence.players,telemetryReadAtMillis:evidence.telemetryReadAtMillis,telemetrySource:evidence.telemetrySource};
   // Ausência não confirma combate ativo nem conquista. Só a recuperação
   // regional já confirmada permanece como resultado conhecido e datado.
   const recovered=evidence.owner==='Humans'&&evidence.isAvailable===false;
   return {...r,owner:recovered?'Humans':null,health:recovered?evidence.health:null,regenPerSecond:null,isAvailable:recovered?false:null,availabilityFactor:null,players:null,telemetryReadAtMillis:evidence.telemetryReadAtMillis,telemetrySource:evidence.telemetrySource,telemetryStale:true,lastKnown};
  })});
  return data.map(x=>name==='planets'?enrich(x):{...x,planet:enrich(x.planet)});
 }
 async community(name){let data=await this.request(COMMUNITY+paths[name],'community');if(!validArray(data,name))throw Error('Community: formato inválido de '+name);data=this.rememberRegions(data,name);return {data,source:'community'};}
 async update(name){return this.cached('resource:'+name,this.ttl(name),async()=>{
  const errors=[];try{return await this.direct(name)}catch(e){errors.push(e.message)}
  if(['dss','dispatches'].includes(name))throw Error(errors.join(' | '));
  try{return {...await this.community(name),warning:errors.join(' | ')}}catch(e){errors.push(e.message);throw Error(errors.join(' | '));}
 });}
 async initOrderHistory(seed){
  await this.ready;if(!this.memory.get('order:current')&&seed?.order){await this.save('order:current',seed);await this.save('order:archive:'+seed.key,seed);}
 }
 async refreshOrderHistory(){
  if(this.historyPending)return this.historyPending;
  const run=async()=>{
   await this.ready;
   const [assignments,dispatches]=await Promise.all([this.get('assignments').catch(()=>null),this.get('dispatches').catch(()=>null)]);
   const cat=await this.catalog().catch(()=>this.memory.get('catalog')||null);
   const previous=this.memory.get('order:current');
   const catalog=Object.fromEntries((cat?.data||[]).map(p=>[String(p.index),p]));
   const input={assignments,dispatches,catalog,now:this.now()};
   for(const [key,value]of [...this.memory])if(key.startsWith('order:archive:')&&!['completed','failed'].includes(value.state)){
    const checked=advanceOrderHistory(value,{...input,assignments:null});
    if(JSON.stringify(checked)!==JSON.stringify(value))await this.save(key,checked);
   }
   // A previous archived result may have just been confirmed while a new order starts.
   const base=previous&&(this.memory.get('order:archive:'+previous.key)||previous);
   const snapshot=advanceOrderHistory(base,input);
   if(snapshot){await this.save('order:current',snapshot);await this.save('order:archive:'+snapshot.key,snapshot);}
   await this.save('order:monitor',{time:this.now(),assignmentsTime:assignments?.time||null,dispatchesTime:dispatches?.time||null,stale:!assignments||assignments.stale||!dispatches||dispatches.stale,error:[assignments?.error,dispatches?.error].filter(Boolean).join(' | ')});
   return snapshot;
  };
  const task=this.historyQueue.then(run,run);this.historyPending=task.finally(()=>{this.historyPending=null});this.historyQueue=this.historyPending.catch(()=>{});return this.historyPending;
 }
 async get(name,{background=false,waitUntil=()=>{}}={}){
  if(name==='order-history'){
   await this.ready;const monitor=this.memory.get('order:monitor');
   if(!monitor||this.now()-monitor.time>=120000){if(background&&this.memory.get('order:current'))waitUntil(this.refreshOrderHistory().catch(()=>{}));else await this.refreshOrderHistory();}
   return {...(this.memory.get('order:current')||{schema:1,state:'pending',order:null}),telemetry:this.memory.get('order:monitor')||{time:null,stale:true}};
  }
  await this.ready;const old=this.memory.get('resource:'+name),now=this.now();
  if(old&&now-old.time<this.ttl(name))return {...old,stale:false,next:old.time+this.ttl(name)};
  const usable=old&&now>=old.time&&now-old.time<86400000;
  if(usable&&background){waitUntil(this.update(name).catch(()=>{}));return {...old,stale:true,next:now+10000,error:this.memory.get('failure:resource:'+name)?.error||'Atualizando leitura compartilhada'};}
  try{const item=await this.update(name);return {...item,stale:false,next:item.time+this.ttl(name)};}catch(e){if(usable)return {...old,stale:true,next:now+30000,error:e.message};throw e;}
 }
 diagnostics(){return [...this.memory].filter(([k])=>k.startsWith('resource:')||k.startsWith('failure:')||k==='order:monitor').map(([key,v])=>({key,time:v.time||null,source:v.source||null,next:v.next||null,error:v.error||v.warning||null}));}
}
