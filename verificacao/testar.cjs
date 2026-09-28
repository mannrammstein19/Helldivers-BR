const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.classList={add(){},contains(){return false}};this.events={};}
 append(...nodes){this.children.push(...nodes)}
 setAttribute(k,v){this.attrs[k]=v} removeAttribute(k){delete this.attrs[k]} addEventListener(k,v){this.events[k]=v}
 querySelectorAll(){return this.children.filter(n=>n.tag==='a')}
}
function navigation(url,script='https://example.test/mobile-nav.js'){
 const body=new Element('body');const listeners={};const ctx={URL,location:new URL(url),window:{addEventListener:(k,v)=>listeners[k]=v},document:{currentScript:{src:script},readyState:'complete',querySelector:()=>null,getElementById:()=>null,createElement:t=>new Element(t),createTextNode:t=>t,body}};
 vm.runInNewContext(fs.readFileSync(root+'/mobile-nav.js','utf8'),ctx);
 const links=body.children[0].querySelectorAll();return {active:()=>links.filter(a=>a.attrs['aria-current']==='page').map(a=>a.children[1]),ctx,listeners};
}
let cases=0;
for(const prefix of ['', '/Helldivers-BR']){
 for(const [route,label] of [['/','Início'],['/index.html','Início'],['/guerra','Guerra'],['/ordem','Ordem'],['/estratagemas','Arsenal'],['/mapa-classico','Mapa'],['/mapa-galatico','Mapa'],['/estratagemas/1-orbitais/laser/','Arsenal'],['/guerra#ordem-maior','Ordem'],['/faccoes',null]]){
  const n=navigation('https://example.test'+prefix+route,'https://example.test'+prefix+'/mobile-nav.js?v=1');assert.deepEqual(n.active(),label?[label]:[]);cases++;
 }
 for(const name of ['guerra','ordem','estratagemas','mapa-classico','mapa-galatico']){
  const label={guerra:'Guerra',ordem:'Ordem',estratagemas:'Arsenal','mapa-classico':'Mapa','mapa-galatico':'Mapa'}[name];
  for(const suffix of ['.html','/','/index.html','?teste=1']){assert.deepEqual(navigation('https://example.test'+prefix+'/'+name+suffix,'https://example.test'+prefix+'/mobile-nav.js').active(),[label]);cases++;}
 }
}
const n=navigation('https://example.test/guerra');n.ctx.location.hash='#ordem-maior';n.listeners.hashchange();assert.deepEqual(n.active(),['Ordem']);n.ctx.location.hash='';n.listeners.hashchange();assert.deepEqual(n.active(),['Guerra']);
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(root+'/order-targets.js','utf8'),context);
const task=(id,faction=2,goal=25000000)=>({type:3,valueTypes:[1,2,3,4,6],values:[faction,0,goal,id,0]});
const label=context.window.HDBROrderTargets.label;
assert.equal(label(task(2651633799),'Terminídeos'),'Atropeladores');assert.equal(label(task(2664856027,3),'Autômatos'),'Tanques Autômatos');
assert.equal(label(task(999),'Terminídeos'),'alvo específico não identificado');assert.equal(label(task(0),'Terminídeos'),'Terminídeos');assert.equal(label(task(2651633799,3),'Autômatos'),'alvo específico não identificado');
assert.equal(label({valueTypes:['4','3','1'],values:['2651633799',25e6,2]},'Terminídeos'),'Atropeladores');
assert.equal(label({valueTypes:[1,3],values:[2,25e6]},'Terminídeos'),'Terminídeos');
for(const [file,fn,next] of [['guerra.js','majorOrderTaskTitle','majorOrderTaskPercent'],['overview.js','taskTitle',''],['mapa-classico.js','majorOrderTaskTitle','']]){
 const code=fs.readFileSync(root+'/'+file,'utf8');const start=code.indexOf('function '+fn+'(');const end=code.indexOf('\n'+(file==='overview.js'?'':'    ')+'function ',start+10);
 const piece=code.slice(start,end);
 const value=(t,k)=>t.values[t.valueTypes.indexOf(k)];
 const c={window:context.window,clean:x=>String(x||''),majorOrderTaskGoal:t=>value(t,3),majorOrderTaskFactionName:t=>value(t,1)===2?'Terminídeos':'Autômatos',majorOrderPlanetName:()=>'',majorOrderTaskPlanetIndex:()=>0,majorOrderTaskFactionId:t=>value(t,1),taskGoal:t=>value(t,3),taskFactionName:t=>value(t,1)===2?'Terminídeos':'Autômatos',planetNameByIndex:()=>'',taskPlanetIndex:()=>0,fmt:x=>x.toLocaleString('pt-BR')};
 vm.createContext(c);vm.runInContext(piece+';this.title='+fn,c);
 assert.equal(c.title(task(2651633799),0),'Eliminar 25.000.000 Atropeladores',file);
 assert.equal(c.title(task(2664856027,3,5e6),1),'Eliminar 5.000.000 Tanques Autômatos',file);
 assert.equal(c.title(task(999),0),'Eliminar 25.000.000 alvo específico não identificado',file);
 assert.equal(c.title({...task(0),type:11},0),'Cumprir objetivo de libertação',file);
}
console.log(`PASS: ${cases} rotas, hashchange, catálogo conhecido/desconhecido/geral, tipos reordenados e títulos nas três interfaces.`);
