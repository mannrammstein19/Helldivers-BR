/* Resultado automático: anúncio explícito + vínculo com a ordem + data válida. */
window.HDBROrderState = (() => {
  const terminal = s => ['completed', 'failed'].includes(s);
  const key = o => o && String(o.id ?? o.assignmentId ?? o.assignmentID ?? o.settingId ?? o.settingID ?? [o.title,o.description,o.expiration??o.expiresAt].join('|'));
  const clean = v => String(typeof v === 'object' && v ? v['pt-BR'] || v['en-US'] || Object.values(v)[0] || '' : v ?? '').replace(/<[^>]*>/g, ' ');
  const norm = v => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  const date = v => v == null || v === '' ? NaN : typeof v === 'number' ? (v < 1e10 ? v*1000 : v) : Date.parse(v);
  const read = () => {try{return JSON.parse(localStorage.getItem('hdbr_order_evidence_v2')||'{}')}catch{return {}}};
  const save = value => {try{localStorage.setItem('hdbr_order_evidence_v2',JSON.stringify(value))}catch{}};
  const contains = (text, phrase) => phrase && (' '+text+' ').includes(' '+phrase+' ');
  function targetIds(order) {
    return [...new Set((order.tasks||[]).map(t=>{const i=(t.valueTypes||[]).indexOf(12);return i>=0?String(t.values?.[i]??''):''}).filter(v=>v&&v!=='0'))];
  }
  function outcome(order, snapshot, dispatches, catalog={}, now=Date.now()) {
    const start=date(snapshot?.first_seen_at);
    if(!Number.isFinite(start))return null;
    const ids=targetIds(order);
    const targets=ids.map(id=>norm(catalog[id]?.name||catalog[id]?.names||snapshot?.target_planets?.[id]||''));
    const candidates=(Array.isArray(dispatches)?dispatches:[]).map(d=>({d,time:date(d.published??d.publishedAt??d.date??d.timestamp)})).filter(x=>Number.isFinite(x.time)&&x.time>=start&&x.time<=now+300000).sort((a,b)=>b.time-a.time);
    const win=/^(?:MAJOR ORDER (?:COMPLETED|SUCCESSFUL|SUCCESS|VICTORY|WON)|ORDEM (?:MAIOR|PRINCIPAL) (?:CONCLUIDA|COMPLETADA|VENCIDA|GANHA|CUMPRIDA)|PEDIDO PRINCIPAL (?:GANHO|CONCLUIDO)|VITORIA NA ORDEM MAIOR)\b/;
    const lose=/^(?:MAJOR ORDER (?:FAILED|LOST|FAILURE)|ORDEM (?:MAIOR|PRINCIPAL) (?:PERDIDA|FRACASSADA|FALHOU)|PEDIDO PRINCIPAL (?:PERDIDO|FRACASSADO)|DERROTA NA ORDEM MAIOR)\b/;
    for(const {d,time} of candidates){
      const title=norm(d.title),body=norm(d.message),msg=[title,body].filter(Boolean).join(' ');
      const success=win.test(title)||win.test(body),failure=lose.test(title)||lose.test(body);
      if(success===failure)continue;
      const linkedId=d.assignmentId??d.assignmentID??d.majorOrderId;
      if(linkedId!=null&&String(linkedId)!==key(order))continue;
      const explicit=linkedId!=null&&String(linkedId)===key(order);
      const planetMatch=ids.length>0&&targets.every(name=>name&&contains(msg,name));
      const orderTitle=norm(order.title);
      const specificTitle=orderTitle.split(' ').length>=3&&!['MAJOR ORDER','ORDEM MAIOR','PEDIDO PRINCIPAL'].includes(orderTitle)&&contains(msg,orderTitle);
      if(!explicit&&!planetMatch&&!(ids.length===0&&specificTitle))continue;
      return {state:success?'completed':'failed',outcome_source:'dispatch',outcome_dispatch:{id:d.id??null,published:new Date(time).toISOString(),message:clean(d.message||d.title)},ended_at:new Date(time).toISOString()};
    }
    return null;
  }
  function resolve(live, snapshot, now=Date.now(), options={}) {
    const history=read();
    let order=live||snapshot?.order||history.order;
    if(!order)return {order:null,state:'pending',snapshot};
    const id=key(order),same=snapshot?.order&&key(snapshot.order)===id;
    const remembered=history.key===id?history:null;
    let basis=same?snapshot:remembered||{key:id,order,first_seen_at:new Date(now).toISOString()};
    // Não fazer a leitura antiga do snapshot reabrir um resultado já confirmado.
    if(remembered&&terminal(remembered.state))basis=remembered;
    if(terminal(basis.state)){save(basis);return {order:basis.order||order,state:basis.state,snapshot:basis};}
    const result=outcome(order,basis,options.dispatches,options.catalog,now);
    if(result){basis={...basis,...result,key:id,order};save(basis);return {order,state:result.state,snapshot:basis};}
    const expires=date(order.expiration??order.expiresAt??order.expireTime);
    let state=live?'active':'pending';
    if(state==='active'&&Number.isFinite(expires)&&expires<=now)state='pending';
    const missing=date(basis.missing_since);
    const ended=Number.isFinite(expires)&&expires<=now?expires:missing;
    if(state==='pending'&&Number.isFinite(ended)&&now-ended>=1800000)state='unknown';
    basis={...basis,key:id,order,state};save(basis);
    return {order,state,snapshot:basis};
  }
  return {resolve,outcome};
})();
