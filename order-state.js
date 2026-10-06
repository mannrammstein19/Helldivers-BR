/* Resultado automático: anúncio explícito + vínculo com a ordem + data válida. */
(typeof window !== 'undefined' ? window : globalThis).HDBROrderState = (() => {
  const terminal = s => ['completed', 'failed'].includes(s);
  const key = o => o && String(o.id ?? o.id32 ?? o.assignmentId ?? o.assignmentID ?? o.settingId ?? o.settingID ?? [o.title,o.description,o.expiration??o.expiresAt].join('|'));
  const clean = v => String(typeof v === 'object' && v ? v['pt-BR'] || v['en-US'] || Object.values(v)[0] || '' : v ?? '').replace(/<[^>]*>/g, ' ');
  const norm = v => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  const heading = v => norm(clean(v).trim().split(/\r?\n/)[0]);
  const date = v => v == null || v === '' ? NaN : typeof v === 'number' ? (v < 1e10 ? v*1000 : v) : Date.parse(v);
  const read = () => {try{const v=JSON.parse(localStorage.getItem('hdbr_order_evidence_v2')||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch{return {}}};
  const save = value => {try{localStorage.setItem('hdbr_order_evidence_v2',JSON.stringify(value))}catch{}};
  const contains = (text, phrase) => phrase && (' '+text+' ').includes(' '+phrase+' ');
  function expiration(order,readAt=Date.now()) {
    const explicit=order?.expiration??order?.expiresAt??order?.expireTime;
    if(explicit!=null&&explicit!=='')return Number.isFinite(date(explicit))?new Date(date(explicit)).toISOString():null;
    const seconds=order?.expiresIn;
    return typeof seconds==='number'&&Number.isFinite(seconds)&&seconds>=0&&Number.isFinite(readAt)?new Date(readAt+seconds*1000).toISOString():null;
  }
  function targetIds(order) {
    return [...new Set((order.tasks||[]).map(t=>{const i=(t.valueTypes||[]).indexOf(12);return i>=0?String(t.values?.[i]??''):''}).filter(v=>v&&v!=='0'))];
  }
  const contextStop = new Set('THE AND FOR WITH FROM THAT THIS HAVE HAS WERE WAS ARE INTO THEIR THEM THEY YOUR YOU ITS OUR NOT NOW MUST BEEN WILL SHALL ORDER MAJOR PRINCIPAL ORDEM PEDIDO HELLDIVERS HELLDIVER SUPER EARTH TERRA ENEMIES ENEMY INIMIGOS INIMIGO KILL KILLS KILLED REQUIRED REQUISITE ENSURE RECEIVE RECEIVED PARA PELOS PELAS COMO MAIS ESTA ESTE ESSA ESSE TODOS TODAS SEUS SUAS SENDO DEVE DEVEM'.split(' '));
  const contextWords = v => norm(v).split(' ').filter(w => /^[A-Z]+$/.test(w)&&w.length>=4&&!contextStop.has(w)).map(w=>w.endsWith('S')?w.slice(0,-1):w);
  const newOrderTitle=/^(?:NEW MAJOR ORDER|NOVA (?:GRANDE ORDEM|ORDEM (?:MAIOR|PRINCIPAL|IMPERATIVA))|NOVO PEDIDO PRINCIPAL)$/;
  function latestOpening(time,timeline) {
    return timeline.filter(({d,time:t})=>t<=time&&(newOrderTitle.test(heading(d.title))||newOrderTitle.test(heading(d.message)))).sort((a,b)=>b.time-a.time)[0];
  }
  function crossesOrder(order,snapshot,time,timeline) {
    const opening=latestOpening(time,timeline);
    if(!opening)return false;
    const d=opening.d,linked=d.assignmentId??d.assignmentID??d.majorOrderId;
    // Um ID explícito tem prioridade; nomes repetidos nunca anulam a troca.
    if(linked!=null)return String(linked)!==key(order);
    // Sem vínculo por ID, um anúncio posterior ao primeiro registro é outro ciclo.
    // Empate de horário com o resultado também é ambíguo.
    return opening.time>date(snapshot?.first_seen_at)||opening.time===time;
  }
  function contextualMatch(order,msg,time,candidates) {
    const expiry=date(order.expiration??order.expiresAt??order.expireTime);
    if(!Number.isFinite(expiry)||time<expiry-300000||time>expiry+86400000)return false;
    const next=newOrderTitle;
    if(candidates.some(({d,time:t})=>t>=expiry-300000&&t<=time&&(next.test(heading(d.title))||next.test(heading(d.message)))))return false;
    const words=contextWords([order.title,order.briefing,order.description].map(clean).join(' '));
    const announcement=contextWords(msg),shared=new Set(announcement);
    const common=new Set(words.filter(w=>shared.has(w)));
    const pairs=w=>new Set(w.slice(1).map((word,i)=>w[i]+' '+word));
    const a=pairs(words),b=pairs(announcement);
    return common.size>=4&&[...a].filter(pair=>b.has(pair)).length>=2;
  }
  function cycleMatch(order,snapshot,time,timeline,targets) {
    // O resultado pode sair antes do prazo e não repetir os nomes dos alvos.
    // Vinculamos o anúncio à abertura da mesma ordem, sem atravessar uma nova.
    const start=date(snapshot?.first_seen_at),expiry=date(order.expiration??order.expiresAt??order.expireTime);
    if(!Number.isFinite(start)||!Number.isFinite(expiry)||time>expiry+86400000)return false;
    const opening=latestOpening(time,timeline);
    if(!opening||time<=opening.time)return false;
    const d=opening.d,linked=d.assignmentId??d.assignmentID??d.majorOrderId;
    if(linked!=null)return String(linked)===key(order);
    if(opening.time>start)return false;
    const message=[norm(d.title),norm(d.message)].join(' ');
    if(targets.length)return targets.every(name=>name&&contains(message,name));
    const words=contextWords([order.title,order.briefing,order.description].map(clean).join(' '));
    const other=contextWords(message),shared=new Set(other);
    const pairs=new Set(other.slice(1).map((word,i)=>other[i]+' '+word));
    return new Set(words.filter(w=>shared.has(w))).size>=4&&words.slice(1).filter((word,i)=>pairs.has(words[i]+' '+word)).length>=2;
  }
  function outcome(order, snapshot, dispatches, catalog={}, now=Date.now()) {
    const start=date(snapshot?.first_seen_at);
    if(!Number.isFinite(start))return null;
    const ids=targetIds(order);
    const targets=ids.map(id=>norm(catalog[id]?.name||catalog[id]?.names||snapshot?.target_planets?.[id]||''));
    const timeline=(Array.isArray(dispatches)?dispatches:[]).map(d=>({d,time:date(d.published??d.publishedAt??d.date??d.timestamp)})).filter(x=>Number.isFinite(x.time)&&x.time<=now+300000).sort((a,b)=>b.time-a.time);
    const candidates=timeline.filter(x=>x.time>=start);
    const win=/^(?:MAJOR ORDER (?:COMPLETED|SUCCESSFUL|SUCCESS|VICTORY|WON)|(?:GRANDE ORDEM|ORDEM (?:MAIOR|PRINCIPAL|IMPERATIVA)) (?:CONCLUIDA|COMPLETADA|VENCIDA|GANHA|CUMPRIDA|CONQUISTADA)|PEDIDO PRINCIPAL (?:GANHO|CONCLUIDO)|VITORIA NA ORDEM MAIOR)$/;
    const lose=/^(?:MAJOR ORDER (?:FAILED|LOST|FAILURE)|(?:GRANDE ORDEM|ORDEM (?:MAIOR|PRINCIPAL|IMPERATIVA)) (?:PERDIDA|FRACASSADA|FALHOU)|PEDIDO PRINCIPAL (?:PERDIDO|FRACASSADO)|FALHA NO PEDIDO PRINCIPAL|DERROTA NA ORDEM MAIOR)$/;
    for(const {d,time} of candidates){
      const title=norm(d.title),body=norm(d.message),msg=[title,body].filter(Boolean).join(' ');
      const success=win.test(heading(d.title))||win.test(heading(d.message)),failure=lose.test(heading(d.title))||lose.test(heading(d.message));
      if(success===failure)continue;
      const linkedId=d.assignmentId??d.assignmentID??d.majorOrderId;
      if(linkedId!=null&&String(linkedId)!==key(order))continue;
      const explicit=linkedId!=null&&String(linkedId)===key(order);
      if(!explicit&&crossesOrder(order,snapshot,time,timeline))continue;
      const planetMatch=ids.length>0&&targets.every(name=>name&&contains(msg,name));
      const orderTitle=norm(order.title);
      const specificTitle=orderTitle.split(' ').length>=3&&!['MAJOR ORDER','ORDEM MAIOR','PEDIDO PRINCIPAL'].includes(orderTitle)&&contains(msg,orderTitle);
      const contextual=ids.length===0&&contextualMatch(order,msg,time,candidates);
      if(!explicit&&!planetMatch&&!(ids.length===0&&specificTitle)&&!contextual&&!cycleMatch(order,snapshot,time,timeline,targets))continue;
      return {state:success?'completed':'failed',outcome_source:'dispatch',outcome_dispatch:{id:d.id??null,published:new Date(time).toISOString(),message:clean(d.message||d.title)},ended_at:new Date(time).toISOString()};
    }
    return null;
  }
  function resolve(live, snapshot, now=Date.now(), options={}) {
    const history=read();
    let order=live||snapshot?.order||history.order;
    if(!order)return {order:null,state:'pending',snapshot};
    if(!order.expiration&&!order.expiresAt&&!order.expireTime){const end=expiration(order,options.readAt??now);if(end)order={...order,expiration:end};}
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
  async function loadSnapshot() {
    const cacheKey='hdbr_major_order_snapshot_v1';
    let cached;try{cached=JSON.parse(localStorage.getItem(cacheKey)||'null')}catch{}
    if(cached?.data?.order&&Date.now()-cached.time<30000)return cached.data;
    const central=String(window.HDBRTelemetryConfig?.centralUrl||'').replace(/\/+$/,'');
    const bases=[...(central?[central+'/api/v1/major-order-state']:[]),'https://raw.githubusercontent.com/mannrammstein19/Helldivers-BR/main/dados/major-order.json','dados/major-order.json'];
    for(const base of bases) {
      try {
        const response=await globalThis.fetch(`${base}?v=${Math.floor(Date.now()/30000)}`,{cache:'no-store',signal:AbortSignal.timeout(6000)});
        if(!response.ok)continue;const data=await response.json();
        if(data?.order){
          // A delayed GitHub fallback must not replace a newer central cycle.
          const previous=cached?.data,olderCycle=previous?.order&&key(previous.order)!==key(data.order)&&date(previous.first_seen_at)>date(data.first_seen_at);
          const confirmed=previous?.order&&key(previous.order)===key(data.order)&&terminal(previous.state);
          const selected=olderCycle||confirmed?previous:data;
          try{localStorage.setItem(cacheKey,JSON.stringify({time:Date.now(),data:selected}))}catch{}return selected;
        }
      }catch{}
    }
    return cached?.data||null;
  }
  return {resolve,outcome,expiration,loadSnapshot};
})();
