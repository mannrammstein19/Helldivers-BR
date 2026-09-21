/* Separa a ordem ao vivo do ultimo registro preservado. */
window.HDBROrderState = (() => {
  const terminal = s => ['completed', 'failed'].includes(s);
  const key = o => o && String(o.id ?? o.assignmentId ?? o.assignmentID ?? o.settingId ?? o.settingID ?? [o.title, o.description, o.expiration ?? o.expiresAt].join('|'));
  function resolve(live, snapshot, now = Date.now()) {
    const same = live && snapshot?.order && key(live) === key(snapshot.order);
    if (same && terminal(snapshot.state)) return {order:snapshot.order, state:snapshot.state, snapshot};
    const order = live || snapshot?.order;
    if (!order) return {order:null, state:'pending', snapshot};
    const raw = order.expiration ?? order.expiresAt ?? order.expireTime;
    const expires = typeof raw === 'number' ? (raw < 1e10 ? raw*1000 : raw) : Date.parse(raw);
    let state = live ? 'active' : (terminal(snapshot?.state) ? snapshot.state : 'pending');
    // O navegador nao transforma dados antigos em prova de derrota.
    if (state === 'active' && Number.isFinite(expires) && expires <= now) state = 'pending';
    return {order, state, snapshot};
  }
  return {resolve};
})();
