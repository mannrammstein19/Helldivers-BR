// Adaptadores explícitos. Nenhum estado regional é deduzido do planeta.
export const field=(obj,key)=>obj?.[key]??Object.entries(obj||{}).find(([k])=>k.toLowerCase()===key.toLowerCase())?.[1];
export const root=value=>field(value,'data')??value;
export const rows=(obj,key)=>{const a=field(obj,key);return Array.isArray(a)?a:[]};
export const faction=id=>({1:'Humans',2:'Terminids',3:'Automatons',4:'Illuminate'})[id]||'';
export const epoch=value=>Number(value)>1e12?Number(value):Number(value)>1e9?Number(value)*1000:null;
export const warDate=(info,seconds)=>epoch(field(info,'startDate'))!==null&&Number.isFinite(Number(seconds))?new Date(epoch(field(info,'startDate'))+Number(seconds)*1000).toISOString():null;
// Os eventos e Status.time usam o mesmo relógio de jogo. Ele não equivale
// necessariamente a startDate + segundos no relógio civil (pausas/deslocamentos).
export function eventClockDate(status,seconds,readAt){
 const current=field(status,'time');
 if(current==null||seconds==null||![current,seconds,readAt].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0))return null;
 const value=readAt+(seconds-current)*1000;
 return Number.isFinite(value)&&Math.abs(value)<=8.64e15?new Date(value).toISOString():null;
}
// Ambas as listas são do mesmo Status. Ausência numa leitura nova remove o efeito;
// catálogo e histórico não são fontes de presença atual.
export function normalizeEffects(status,readAt){
 const byPlanet=new Map();
 const number=v=>typeof v==='number'&&Number.isInteger(v)&&v>=0;
 const add=(index,id,extra={})=>{
  if(!number(index)||!number(id)||id===0)return;
  if(!byPlanet.has(index))byPlanet.set(index,new Map());
  const effects=byPlanet.get(index);
  if(!effects.has(id))effects.set(id,{galacticEffectId:id,...extra});
 };
 for(const e of rows(status,'planetActiveEffects'))add(field(e,'planetIndex')??field(e,'index'),field(e,'galacticEffectId'));
 const clock=field(status,'time');
 if(typeof clock==='number'&&Number.isFinite(clock)&&clock>=0){
  for(const event of rows(status,'globalEvents')){
   const expiry=field(event,'expireTime');
   if(typeof expiry!=='number'||!Number.isFinite(expiry)||expiry<=clock)continue;
   const expiresAt=eventClockDate(status,expiry,readAt);
   if(!expiresAt)continue;
   for(const index of rows(event,'planetIndices'))for(const id of rows(event,'effectIds'))
    add(index,id,{source:'global-event',eventId:field(event,'eventId')??null,expiresAt});
  }
 }
 return byPlanet;
}
export function normalizeWar(status,info,catalog=[],readAt=Date.now(),catalogTime=0){
 status=root(status);info=root(info);
 if(!Array.isArray(field(status,'planetStatus'))||rows(status,'planetStatus').length<10||!Array.isArray(field(status,'campaigns'))||!Array.isArray(field(info,'planetInfos')))throw Error('Estado bruto incompleto');
 const effects=normalizeEffects(status,readAt);
 const cats=new Map(catalog.map(p=>[Number(p.index),p])),infos=new Map(rows(info,'planetInfos').map(p=>[Number(field(p,'index')),p]));
 const events=new Map(rows(status,'planetEvents').map(e=>[Number(field(e,'planetIndex')),e]));
 const regionInfo=new Map(rows(info,'planetRegions').map(r=>[`${field(r,'planetIndex')}:${field(r,'regionIndex')}`,r]));
 const regionStatus=new Map(rows(status,'planetRegions').map(r=>[`${field(r,'planetIndex')}:${field(r,'regionIndex')}`,r]));
 const planets=rows(status,'planetStatus').map(s=>{
  const index=Number(field(s,'index')),i=infos.get(index),cat=cats.get(index)||{};
  if(!i||!faction(field(s,'owner'))||!Number.isFinite(Number(field(s,'health')))||!(Number(field(i,'maxHealth'))>0))throw Error('Planeta bruto inválido');
  const e=events.get(index);
  const regions=[...regionInfo.entries()].filter(([k])=>k.startsWith(index+':')).map(([key,ri])=>{
   const id=Number(field(ri,'regionIndex')),hash=field(ri,'settingsHash'),r=regionStatus.get(key),old=(cat.regions||[]).find(v=>Number(v.id)===id&&Number(v.hash)===Number(hash));
   return {...old,id,hash,name:old?.name||`REGIÃO ${id+1}`,size:old?.size??field(ri,'regionSize'),maxHealth:field(ri,'maxHealth'),owner:r?faction(field(r,'owner')):null,
    health:r?field(r,'health')??null:null,regenPerSecond:r?field(r,'regenPerSecond')??field(r,'regerPerSecond')??null:null,
    isAvailable:r?field(r,'isAvailable')??null:null,availabilityFactor:r?field(r,'availabilityFactor')??null:null,players:r?field(r,'players')??null:null,
    telemetryReadAtMillis:r?readAt:null,telemetryStale:!r,telemetrySource:r?'direct':'unknown'};
  });
  // Estatísticas históricas possuem uma data própria; apenas playerCount é da leitura bruta.
  const statistics={...(cat.statistics||{}),playerCount:field(s,'players')??null};
  return {...cat,index,name:cat.name||`PLANETA #${index}`,sector:cat.sector||'',position:field(s,'position')||field(i,'position'),hash:field(i,'settingsHash'),
   health:field(s,'health'),maxHealth:field(i,'maxHealth'),currentOwner:faction(field(s,'owner')),initialOwner:faction(field(i,'initialOwner')),
   regenPerSecond:field(s,'regenPerSecond')??null,disabled:field(i,'disabled')===true,waypoints:rows(i,'waypoints'),
   attacking:rows(status,'planetAttacks').filter(a=>Number(field(a,'source'))===index).map(a=>field(a,'target')),statistics,statisticsReadAtMillis:catalogTime,
   statisticsSource:'community',event:e?{id:field(e,'id'),eventType:field(e,'eventType'),faction:faction(field(e,'race')),health:field(e,'health'),maxHealth:field(e,'maxHealth'),
    startTime:eventClockDate(status,field(e,'startTime'),readAt),endTime:eventClockDate(status,field(e,'expireTime'),readAt),clockSource:'game-status'}:null,
   activeEffects:[...(effects.get(index)?.values()||[])],effectsAuthoritative:true,regions};
 });
 const byId=new Map(planets.map(p=>[p.index,p]));
 const campaigns=rows(status,'campaigns').map(c=>{
  const planet=byId.get(Number(field(c,'planetIndex')));if(!planet)throw Error('Campanha sem planeta');
  return {id:field(c,'id')??field(c,'id32'),type:field(c,'type'),count:field(c,'count'),faction:faction(field(c,'race')),planet};
 });return {planets,campaigns};
}
export function normalizeAssignments(value,readAt){
 const a=root(value);if(!Array.isArray(a))throw Error('Ordem bruta inválida');
 return a.map(r=>{const s=field(r,'setting');if(!s||!Array.isArray(field(s,'tasks'))||!Array.isArray(field(r,'progress')))throw Error('Ordem bruta incompleta');
  const seconds=Number(field(r,'expiresIn'));return {id:field(r,'id32')??field(r,'id'),progress:field(r,'progress'),title:field(s,'overrideTitle')||'MAJOR ORDER',briefing:field(s,'overrideBrief'),description:field(s,'taskDescription'),tasks:rows(s,'tasks'),reward:field(s,'reward'),rewards:field(s,'rewards'),expiration:Number.isFinite(seconds)?new Date(readAt+seconds*1000).toISOString():null};});
}
export function normalizeDispatches(value,info){const a=root(value);if(!Array.isArray(a))throw Error('Despachos brutos inválidos');return a.map(r=>({id:field(r,'id'),published:warDate(info,field(r,'published')),type:field(r,'type'),message:field(r,'message')})).sort((a,b)=>(b.published||'').localeCompare(a.published||''));}
export function validArray(value,name){return Array.isArray(value)&&(name!=='planets'||value.length>=10)&&value.every(x=>x&&typeof x==='object')&&(name!=='campaigns'||value.every(x=>Number.isFinite(Number(x.planet?.index))&&x.planet?.currentOwner))&&(name!=='assignments'||value.every(x=>x.id!=null&&Array.isArray(x.tasks)&&Array.isArray(x.progress)));}
