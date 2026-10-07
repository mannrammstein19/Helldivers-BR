import {CentralStore,routes} from './core.mjs';
import seed from '../dados/major-order.json' with {type:'json'};
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store',...headers}});
export class WarCentral {
 constructor(ctx,env){this.ctx=ctx;this.store=new CentralStore(ctx.storage,{contact:env.CONTACT});this.initialized=this.store.initOrderHistory(seed);}
 async armMonitor(){
  await this.initialized;
  if(await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(Date.now()+120000);
 }
 async alarm(){
  await this.initialized;
  // Arm first: an upstream exception cannot silently stop future monitoring.
  await this.ctx.storage.setAlarm(Date.now()+120000);
  try{await this.store.refreshOrderHistory();}catch(e){console.warn('[major-order monitor]',e.message);}
 }
 async fetch(request){await this.armMonitor();const url=new URL(request.url);
  if(url.pathname==='/health')return json({service:'Helldivers-BR-Central',version:2});
  if(url.pathname==='/diagnostics'){await this.store.ready;return json({resources:this.store.diagnostics(),orderMonitor:{...(this.store.memory.get('order:monitor')||{}),nextAlarm:await this.ctx.storage.getAlarm()}});}
  const name=routes[url.pathname];if(!name)return json({error:'Endpoint desconhecido'},404);
  try{return json(await this.store.get(name,{background:true,waitUntil:p=>this.ctx.waitUntil(p)}));}catch(e){return json({error:e.message,next:Date.now()+30000},503);}
 }
}
export default {async fetch(request,env){
 const url=new URL(request.url),origin=request.headers.get('Origin'),allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(origin&&!allowed.includes(origin))return json({error:'Origem não autorizada'},403);
 const cors=origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Accept, Content-Type'}:{};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='GET')return json({error:'Método não permitido'},405,cors);
 if(!routes[url.pathname]&&!['/health','/diagnostics'].includes(url.pathname))return json({error:'Endpoint desconhecido'},404,cors);
 // Um único objeto global, independente do visitante/PoP/query string.
 const stub=env.WAR_CENTRAL.get(env.WAR_CENTRAL.idFromName('galactic-war-v1'));
 const result=await stub.fetch(new Request('https://central.internal'+url.pathname));
 const response=new Response(result.body,result);for(const [k,v]of Object.entries(cors))response.headers.set(k,v);return response;
}};
