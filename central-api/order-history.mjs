// Reuse the same explicit announcement matcher as Home, Guerra and the maps.
import '../order-state.js';
const evidence=globalThis.HDBROrderState;
const terminal=s=>['completed','failed'].includes(s);
const identity=o=>String(o.id??o.id32??o.assignmentId??o.assignmentID??o.settingId??o.settingID??[o.title,o.description,o.expiration??o.expiresAt].join('|'));
const iso=n=>new Date(n).toISOString();
function countersComplete(order){
 const tasks=order.tasks||[],progress=order.progress||[];
 return tasks.length>0&&tasks.every((t,i)=>{
  const index=(t.valueTypes||[]).indexOf(3),goal=Number(index>=0?t.values?.[index]:t.goal??t.targetValue??t.required??t.amount);
  return t.type===3&&Number.isFinite(goal)&&goal>0&&typeof progress[i]==='number'&&Number.isFinite(progress[i])&&progress[i]>=goal;
 });
}
export function advanceOrderHistory(previous,{assignments,dispatches,catalog={},now}){
 const fresh=assignments&&!assignments.stale&&Number.isFinite(assignments.time)&&assignments.time<=now;
 const live=fresh?assignments.data?.find(o=>o&&o.id!=null&&Array.isArray(o.tasks)&&Array.isArray(o.progress)):null;
 const same=live&&previous?.order&&identity(live)===identity(previous.order);
 let snapshot=live&&!same?{schema:1,key:identity(live),state:'active',order:live,first_seen_at:iso(assignments.time),target_planets:{}}:previous?structuredClone(previous):null;
 if(!snapshot)return null;
 if(terminal(snapshot.state))return snapshot; // Only a different identity opens another cycle.
 if(live){snapshot.order=live;snapshot.last_seen_at=iso(assignments.time);delete snapshot.missing_since;}
 for(const task of snapshot.order.tasks||[]){const i=(task.valueTypes||[]).indexOf(12),id=i>=0?String(task.values?.[i]):null;if(id&&catalog[id]?.name)snapshot.target_planets={...snapshot.target_planets,[id]:catalog[id].name};}
 // Dispatch cache keeps its original time. Old announcements can prove an old result,
 // but not an announcement beyond the actual reading or a different order cycle.
 const result=dispatches&&Array.isArray(dispatches.data)?evidence.outcome(snapshot.order,snapshot,dispatches.data,catalog,Math.min(now,dispatches.time||now)):null;
 if(result){snapshot={...snapshot,...result,last_checked_at:iso(now)};if(result.state==='completed')snapshot.final_percent=100;return snapshot;}
 if(!fresh)return snapshot; // Failure never becomes absence or defeat.
 const expiry=Date.parse(snapshot.order.expiration??snapshot.order.expiresAt??snapshot.order.expireTime);
 if(!live||Number.isFinite(expiry)&&expiry<=assignments.time){
  snapshot.state='pending';snapshot.missing_since=snapshot.missing_since||iso(assignments.time);
  const missing=Date.parse(snapshot.missing_since);
  if(countersComplete(snapshot.order)&&(Number.isFinite(expiry)&&expiry<=assignments.time||assignments.time-missing>=480000))Object.assign(snapshot,{state:'completed',outcome_source:'objective_progress',ended_at:iso(assignments.time),final_percent:100});
  else if(now-(Number.isFinite(expiry)&&expiry<=now?expiry:missing)>=1800000)snapshot.state='unknown';
 }else snapshot.state='active';
 snapshot.last_checked_at=iso(assignments.time);return snapshot;
}
