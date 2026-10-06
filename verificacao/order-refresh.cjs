const {JSDOM}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const dom=new JSDOM('<div id="hd-ov-order"></div><div id="ordem-maior"></div>',{runScripts:'outside-only',url:'https://example.test/'});
 const w=dom.window;let desktop=true,change;w.matchMedia=()=>({get matches(){return desktop},addEventListener(_,fn){change=fn}});
 w.requestAnimationFrame=fn=>fn();let observed=0,disconnected=0;
 w.ResizeObserver=class{observe(){observed++}disconnect(){disconnected++}};
 function paint(id,key,progress){const home=id==='hd-ov-order';w.document.getElementById(id).innerHTML=`<article class="${home?'hd-ov-order-main':'guerra-order'}" data-order-key="${key}"><h3>ORDEM MAIOR</h3><div class="${home?'hd-mo-objectives-grid':'guerra-mo-grid'}"><div class="${home?'hd-mo-task':'guerra-mo-task'}">${progress}</div></div></article>`;}
 paint('hd-ov-order','101','10%');paint('ordem-maior','201','20%');
 w.eval(fs.readFileSync(path.join(root,'order-desktop.js'),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await tick();
 for(const [id,key] of [['hd-ov-order','101'],['ordem-maior','201']]){
  const node=w.document.getElementById(id),button=()=>node.querySelector('.order-show-objectives'),panel=()=>node.querySelector('.order-objectives-panel');
  assert.equal(panel().hidden,true,'starts collapsed');button().click();assert.equal(panel().hidden,false);
  panel().scrollTop=24;panel().dispatchEvent(new w.Event('scroll'));
  paint(id,key,'45%');await tick();assert.equal(panel().hidden,false,'same order remains open after replacement');assert.equal(panel().scrollTop,24);assert.match(panel().textContent,/45%/);
  node.querySelector('.order-objectives-content').textContent+=' tradução';await tick();assert.equal(panel().hidden,false,'translation does not close it');
  button().click();paint(id,key,'50%');await tick();assert.equal(panel().hidden,true,'manual close survives replacement');
  button().click();paint(id,key+'-new','0%');await tick();assert.equal(panel().hidden,true,'new order starts collapsed');
  button().click();panel().dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(panel().hidden,true);
  button().click();desktop=false;change();assert.equal(node.querySelector('.order-objectives-popover'),null);desktop=true;change();await tick();assert.equal(panel().hidden,false,'responsive layout retains same-order choice');
 }
 assert.ok(disconnected>0&&disconnected<observed,'observers from replaced cards are released');
 for(const file of ['overview.js','guerra.js'])assert.match(fs.readFileSync(path.join(root,file),'utf8'),/data-order-key=/,'production renderer supplies identity');
 dom.window.close();console.log('PASS: Home and Guerra keep same-order objectives and scroll after replacement, preserve manual close, reset on new ID, Escape, translation and responsive layout; observers released.');
 const vm=require('node:vm'),saved=new Map();let calls=0,quota=false;
 const context={window:{},TextEncoder,URL,AbortSignal,localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},fetch:async url=>{calls++;const part=new URL(url).searchParams.get('q');assert.ok(Buffer.byteLength(part)<=450);return {ok:true,json:async()=>({responseStatus:200,quotaFinished:quota,responseData:{translatedText:'Traduzido '+part}})}}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'public-text.js'),'utf8'),context);const api=context.window.HDBRPublicText;
 const raw='The enemy has attacked our planet. '.repeat(40);await Promise.all([api.translate(raw),api.translate(raw)]);const first=calls;assert.ok(first>1);await api.translate(raw);assert.equal(calls,first,'cached complete translation');
 assert.equal(api.planetName('ALAMAK VII'),'Alamak VII');assert.equal(api.biome('Deciduous Forest'),'Floresta decídua');quota=true;await assert.rejects(api.translate('The enemy has attacked a different planet.'));assert.ok(!Object.values(Object.fromEntries(saved)).some(v=>v.includes('different planet')),'quota failure is not cached as a valid translation');
 console.log('PASS: complete translations use bounded UTF-8 chunks, deduplicate, cache success and reject quota responses; names and biome labels.');
})().catch(error=>{console.error(error);process.exitCode=1});
