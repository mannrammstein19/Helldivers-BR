const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
// Modelo DOM com identidade, ordem, atributos e remoção observáveis.
class Node{
 constructor(tag,text){this.tagName=tag;this.nodeType=tag?1:3;this.nodeValue=text??null;this.childNodes=[];this.attrs=new Map();this.parentNode=null;this.writes=0;this.removals=0;this.dataset={};}
 get attributes(){return [...this.attrs].map(([name,value])=>({name,value}));}
 get classList(){const n=this;return {contains:v=>(n.getAttribute('class')||'').split(' ').includes(v),add:v=>{if(!n.classList.contains(v))n.setAttribute('class',(n.getAttribute('class')||'')+' '+v);}};}
 get firstChild(){return this.childNodes[0]||null;}get nextSibling(){if(!this.parentNode)return null;return this.parentNode.childNodes[this.parentNode.childNodes.indexOf(this)+1]||null;}
 getAttribute(k){return this.attrs.get(k)??null;}hasAttribute(k){return this.attrs.has(k);}
 setAttribute(k,v){if(k==='href'||k==='src')this.writes++;this.attrs.set(k,String(v));if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);}
 removeAttribute(k){this.attrs.delete(k);}
 insertBefore(n,before){if(n.parentNode){const a=n.parentNode.childNodes;a.splice(a.indexOf(n),1);}const index=before?this.childNodes.indexOf(before):this.childNodes.length;assert.ok(index>=0);this.childNodes.splice(index,0,n);n.parentNode=this;}
 appendChild(n){this.insertBefore(n,null);return n;}remove(){if(this.parentNode){const a=this.parentNode.childNodes;a.splice(a.indexOf(this),1);this.parentNode=null;}this.removals++;}
 querySelector(selector){for(const n of this.childNodes){if(n.nodeType===1&&selector.startsWith('.')&&n.classList.contains(selector.slice(1)))return n;const found=n.querySelector(selector);if(found)return found;}return null;}
}
const el=(tag,attrs={},children=[])=>{const n=new Node(tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));children.forEach(c=>n.appendChild(c));return n;};
const window={},context={window,document:{},Map};vm.createContext(context);vm.runInContext(fs.readFileSync('map-dom-update.js','utf8'),context);
let clicked=null;
const scene=(players=1,progress=1,url='planet.webp',index=7)=>el('svg',{},[el('g',{id:'mapa-viewport'},[el('g',{'data-index':index,class:'mapa-planet'},[el('image',{class:'mapa-planet-artwork','data-src':url,href:url}),el('circle',{class:'mapa-control-fill','stroke-dasharray':progress}),el('text',{class:'mapa-player-label'},[new Node(null,String(players))])])])]);
const live=scene(),viewport=live.firstChild,marker=viewport.firstChild,image=marker.firstChild,count=marker.childNodes[2].firstChild;
for(let i=2;i<30;i++){
 const next=scene(i,i);next.firstChild.firstChild.onclick=()=>{clicked=i;};const mapping=window.HDBRMapDOM.children(live,next);
 assert.equal(live.firstChild,viewport);assert.equal(viewport.firstChild,marker);assert.equal(marker.firstChild,image);assert.equal(count.nodeValue,String(i));assert.equal(mapping.get(next.firstChild.firstChild),marker);marker.onclick();assert.equal(clicked,i);
}
assert.equal(image.writes,1,'identical artwork URL is assigned once');assert.equal(image.removals,0);assert.equal(marker.removals,0);
window.HDBRMapDOM.children(live,scene(31,31,'new-planet.webp'));assert.equal(image.writes,2,'changed artwork updates once');
window.HDBRMapDOM.children(live,scene(32,32,'other.webp',8));assert.equal(marker.removals,1,'different planet identity replaces old marker');
const same=el('div',{},[el('img',{src:'photo.webp'}),el('span',{},[new Node(null,'1')])]),photo=same.firstChild;
window.HDBRMapDOM.children(same,el('div',{},[el('img',{src:'photo.webp'}),el('span',{},[new Node(null,'2')])]));assert.equal(same.firstChild,photo);assert.equal(photo.writes,1);
console.log('PASS: SVG viewport/planet/artwork identity survives 28 updates, live metrics and current click callbacks update, unchanged image source is never reassigned, changed source/planet identity update, HTML photo survives numeric refresh.');
