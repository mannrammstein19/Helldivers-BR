/* A API V1 fornece tipo/quantidade, mas nao um catalogo completo de itens.
   Tipo 1 com quantidade >=2 e sem ID usa a heuristica de medalhas.
   Itens desconhecidos nunca sao classificados como capa/armadura por quantidade. */
window.HDBRRewards = (() => {
 const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const text = v => (typeof v==='object'&&v ? v['pt-BR']||v['en-US']||'' : String(v??'')).replace(/<[^>]*>/g,'').trim();
 function list(o) {
  const many=o?.rewards?.length?o.rewards:o?.setting?.rewards;
  const one=o?.reward??o?.setting?.reward;
  return Array.isArray(many)&&many.length?many:one?[one]:[];
 }
 function describe(r,o={}) {
  const amount=Number(r.amount??r.quantity??r.value);
  const id=r.id??r.id32??r.itemId??r.itemID??o.rewardId;
  const name=text(r.name||r.description), type=text(r.type);
  const source=(name+' '+type).toLowerCase();
  let kind='generica',label=name, inferred=false;
  if(Number(id)===897894480||/\b(medal|medals|medalha|medalhas)\b/.test(source)){kind='medalhas';label=amount===1?'Medalha':'Medalhas';}
  else if(/\b(cape|capa)\b/.test(source)){kind='capa';label=name||'Capa';}
  else if(/\b(helmet|helmets|capacete|capacetes)\b/.test(source)){kind='capacete';label=name||'Capacete';}
  else if(!/\b(stratagem|estratagema)\b/.test(source)&&/\b(weapon|weapons|gun|guns|rifle|rifles|arma|armas)\b/.test(source)){kind='arma';label=name||'Arma';}
  else if(/\b(armor|armour|armadura)\b/.test(source)){kind='armadura';label=name||'Armadura';}
  else if(/\b(stratagem|estratagema)\b/.test(source)){kind='estratagema';label=name||'Estratagema';}
  else if(!name && (id==null||Number(id)===0) && Number(r.type)===1 && amount>=2){kind='medalhas';label='Medalhas';inferred=true;}
  if(!label)label='Recompensa especial — item não identificado';
  return {kind,label,amount:Number.isFinite(amount)&&amount>0?amount:null,inferred};
 }
 function render(o){
  const rewards=list(o);if(!rewards.length)return 'Recompensa não informada';
  return rewards.map(r=>{
   const d=describe(r,o),label=(d.amount===null?'':d.amount.toLocaleString('pt-BR')+' ')+d.label;
   return `<span class="order-reward"${d.inferred?' title="Medalhas identificadas pelo padrão de tipo e quantidade da API."':''}><img src="icons/recompensas/${d.kind}.svg" alt="" aria-hidden="true" onerror="this.hidden=true"><span>${esc(label)}</span></span>`;
  }).join('');
 }
 return {list,describe,render};
})();
