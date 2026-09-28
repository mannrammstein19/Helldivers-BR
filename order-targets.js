/* Shared Major Order unit catalogue. Add only verified assignment unit_id values.
   valueTypes 4 = unit_id; valueTypes 1 = faction. Never match by array position.
   Initial mappings verified against assignment 1715805482 and dispatch 3941,
   2026-09-27: 25M Chargers / 5M Automaton Tanks. */
(() => {
 'use strict';
 const units=Object.freeze({
  '2651633799':Object.freeze({name:'Atropeladores',faction:2}),
  '2664856027':Object.freeze({name:'Tanques Autômatos',faction:3})
 });
 function value(task,type){
  const types=Array.isArray(task?.valueTypes)?task.valueTypes:[];
  const index=types.findIndex(v=>Number(v)===type);
  return index<0?null:task?.values?.[index];
 }
 function label(task,factionLabel=''){
  const raw=value(task,4);
  if(raw==null||raw===''||Number(raw)===0)return factionLabel||'inimigos';
  const id=Number(raw),faction=Number(value(task,1));
  const unit=Number.isSafeInteger(id)&&id>0?units[String(id)]:null;
  if(unit&&(!faction||unit.faction===faction))return unit.name;
  return 'alvo específico não identificado';
 }
 window.HDBROrderTargets=Object.freeze({label});
})();
