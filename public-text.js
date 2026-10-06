/* Home localization: only public order/dispatch text, using the same translation
   provider already used by the Central. No API data, markup or private text is sent. */
window.HDBRPublicText=(() => {
 'use strict';
 const KEY='hdbr-home-ptbr-v1',pending=new Map();
 let cache={};try{cache=JSON.parse(localStorage.getItem(KEY)||'{}');}catch{}
 const known={
  'MAJOR ORDER':'ORDEM MAIOR','LIBERATE':'LIBERTAR','DEFEND':'DEFENDER',
  'ORDER COMPLETE':'ORDEM CONCLUÍDA','ORDER FAILED':'ORDEM NÃO CUMPRIDA',
  'AWAITING ORDERS':'AGUARDANDO ORDENS','SUPER EARTH':'SUPER TERRA'
 };
 function english(text){
  const words=text.toLowerCase().match(/[a-zà-ú]+/g)||[];
  const en=words.filter(w=>['the','and','of','to','our','must','have','has','with','from','will','all','are','your','their','this','that','order','major','liberate','defend','complete','victory','forces','enemy','attack','hold','planet','planets','freedom','democracy','successfully','against','super','earth','dispatch','reinforcements','destroy','kill','defeat','eliminate','protect','capture'].includes(w)).length;
  const pt=words.filter(w=>['o','a','os','as','de','da','do','dos','das','para','uma','um','em','com','não','ordem','maior','libertar','defender','concluída','terra','reforços','democracia','forças','planetas'].includes(w)).length;
  return en>pt||(pt===0&&words.length>1&&!/[ãõçáéíóúâêô]/i.test(text));
 }
 // Keep chunks safely below the provider's per-query byte limit.
 function chunks(text){
  const result=[];let chunk='';const encoder=new TextEncoder();
  for(const token of text.match(/\S+\s*/g)||[]){
   if(encoder.encode(chunk+token).length>450&&chunk){result.push(chunk.trim());chunk='';}
   for(const char of token){
    if(encoder.encode(chunk+char).length>450){result.push(chunk);chunk='';}
    chunk+=char;
   }
  }
  if(chunk)result.push(chunk);return result;
 }
 async function translate(raw){
  raw=String(raw||'').trim();if(!raw)return raw;
  if(known[raw.toUpperCase()])return known[raw.toUpperCase()];
  if(cache[raw])return cache[raw];
  if(!english(raw))return raw;
  if(pending.has(raw))return pending.get(raw);
  const task=(async()=>{
   const translated=[];
   for(const part of chunks(raw)){
    const url=new URL('https://api.mymemory.translated.net/get');url.searchParams.set('q',part);url.searchParams.set('langpair','en|pt-br');
    const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('Translation unavailable');
    const data=await response.json(),value=data?.responseData?.translatedText;
    if(Number(data.responseStatus)!==200||!value||data.quotaFinished)throw new Error('Translation unavailable');
    translated.push(String(value));
   }
   const result=translated.join(' ');cache[raw]=result;
   const entries=Object.entries(cache).slice(-200);cache=Object.fromEntries(entries);
   try{localStorage.setItem(KEY,JSON.stringify(cache));}catch{}
   return result;
  })();
  pending.set(raw,task);try{return await task;}finally{pending.delete(raw);}
 }
 function planetName(raw){return String(raw||'').toLowerCase().replace(/(^|[\s-])([\p{L}])/gu,(_,a,b)=>a+b.toUpperCase()).replace(/\b[ivxlcdm]+\b/gi,v=>v.length>1?v.toUpperCase():v);}
 const biomes={'deciduous forest':'Floresta decídua','plains':'Planícies','tundra':'Tundra','icy glaciers':'Geleiras','deadlands':'Terras devastadas','desert oasis':'Oásis desértico','hive world':'Mundo colmeia','boneyard':'Cemitério','ionic jungle':'Selva iônica','volcanic jungle':'Selva vulcânica','haunted swamp':'Pântano assombrado','rocky canyons':'Cânions rochosos','desert dunes':'Dunas desérticas','desert cliffs':'Falésias desérticas','acidic badlands':'Terras ácidas','moon':'Lua'};
 function biome(raw){return biomes[String(raw||'').toLowerCase()]||raw;}
 return {translate,english,planetName,biome};
})();
