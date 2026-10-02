import {root,field,rows,warDate,normalizeWar,normalizeAssignments,normalizeDispatches,validArray} from './normalize.mjs';
const GAME='https://api.live.prod.thehelldiversgame.com',COMMUNITY='https://api.helldivers2.dev';
export const routes=Object.freeze({'/api/v1/planets':'planets','/api/v1/campaigns':'campaigns','/api/v1/assignments':'assignments','/api/v1/dispatches':'dispatches','/api/v2/space-stations':'dss','/api/v1/steam':'steam'});
const paths={planets:'/api/v1/planets',campaigns:'/api/v1/campaigns',assignments:'/api/v1/assignments',dispatches:'/api/v1/dispatches',dss:'/api/v2/space-stations',steam:'/api/v1/steam'};
export class CentralStore{
 constructor(storage,{fetcher=(...args)=>globalThis.fetch(...args),now=Date.now,wait=ms=>new Promise(r=>setTimeout(r,ms)),contact='https://github.com/mannrammstein19/Helldivers-BR'}={}){this.storage=storage;this.fetcher=fetcher;this.now=now;this.wait=wait;this.contact=contact;this.memory=new Map();this.pending=new Map();this.queue=Promise.resolve();this.ready=this.load();}
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
    if(response.status===429){const raw=response.headers.get('Retry-After'),seconds=Number(raw);const delay=raw!==null&&Number.isFinite(seconds)?seconds*1000:Date.parse(raw)-this.now();await this.save('blocked:'+source,this.now()+Math.max(1000,Number.isFinite(delay)?delay:60000));}
    if(!response.ok)throw Error('HTTP '+response.status);return await response.json();
   }catch(e){const reason=['TimeoutError','AbortError'].includes(e.name)?'timeout de 12 segundos':e.message;console.warn(JSON.stringify({source,path:new URL(url).pathname,durationMs:this.now()-start,status:response?.status||null,error:reason}));throw Error(`${source}: ${reason}`);}
  };
  const task=this.queue.then(run,run);this.queue=task.catch(()=>{});return task;
 }
 async cached(key,ttl,loader){
  const old=this.memory.get(key);if(old&&this.now()-old.time<ttl)return old;
  if(this.pending.has(key))return this.pending.get(key);
  const failure=this.memory.get('failure:'+key);if(failure?.next>this.now())throw Error(failure.error);
  const task=(async()=>{try{const value=await loader();return await this.save(key,{time:this.now(),...value});}catch(e){await this.save('failure:'+key,{next:this.now()+30000,error:e.message});throw e;}finally{this.pending.delete(key);}})();this.pending.set(key,task);return task;
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
   if(r.owner)return r;const old=byId.get(p.index)?.regions?.find(x=>x.id===r.id&&x.hash===r.hash&&x.owner&&x.telemetryReadAtMillis);
   if(!old)return r;return {...r,owner:old.owner,health:old.health,regenPerSecond:old.regenPerSecond,isAvailable:old.isAvailable,availabilityFactor:old.availabilityFactor,players:old.players,telemetryReadAtMillis:old.telemetryReadAtMillis,telemetrySource:old.telemetrySource,telemetryStale:true};
  })});
  return data.map(x=>name==='planets'?enrich(x):{...x,planet:enrich(x.planet)});
 }
 async community(name){let data=await this.request(COMMUNITY+paths[name],'community');if(!validArray(data,name))throw Error('Community: formato inválido de '+name);data=this.rememberRegions(data,name);return {data,source:'community'};}
 async update(name){return this.cached('resource:'+name,this.ttl(name),async()=>{
  const errors=[];try{return await this.direct(name)}catch(e){errors.push(e.message)}
  if(['dss','dispatches'].includes(name))throw Error(errors.join(' | '));
  try{return {...await this.community(name),warning:errors.join(' | ')}}catch(e){errors.push(e.message);throw Error(errors.join(' | '));}
 });}
 async get(name,{background=false,waitUntil=()=>{}}={}){
  await this.ready;const old=this.memory.get('resource:'+name),now=this.now();
  if(old&&now-old.time<this.ttl(name))return {...old,stale:false,next:old.time+this.ttl(name)};
  const usable=old&&now>=old.time&&now-old.time<86400000;
  if(usable&&background){waitUntil(this.update(name).catch(()=>{}));return {...old,stale:true,next:now+10000,error:this.memory.get('failure:resource:'+name)?.error||'Atualizando leitura compartilhada'};}
  try{const item=await this.update(name);return {...item,stale:false,next:item.time+this.ttl(name)};}catch(e){if(usable)return {...old,stale:true,next:now+30000,error:e.message};throw e;}
 }
 diagnostics(){return [...this.memory].filter(([k])=>k.startsWith('resource:')||k.startsWith('failure:')).map(([key,v])=>({key,time:v.time||null,source:v.source||null,next:v.next||null,error:v.error||v.warning||null}));}
}
