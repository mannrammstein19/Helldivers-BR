/* Shared Major Order unit catalogue. Add only verified assignment unit_id values.
   valueTypes 4 = unit_id; valueTypes 1 = faction. Never match by array position.
   Catalogue synchronized with Helldivers-BR-App OrderTargets.kt, commit
   6c4aff9ccb94e37f5cffd9341befecc90d510ab6 (14 IDs). New Bile IDs were
   correlated with the Companion screenshot; see CATALOGO-ALVOS-ORDEM.md
   in that repository. Names and faction constraints are preserved.
   Initial mappings verified against assignment 1715805482 and dispatch 3941,
   2026-09-27: 25M Chargers / 5M Automaton Tanks. */
(() => {
 'use strict';
 const units=Object.freeze({
  '20706814':Object.freeze({name:'Batedores Andantes',faction:3}),
  '2664856027':Object.freeze({name:'Tanques Autômatos',faction:3}),
  '471929602':Object.freeze({name:'Hulks',faction:3}),
  '4276710272':Object.freeze({name:'Devastadores',faction:3}),
  '878778730':Object.freeze({name:'Soldados Autômatos',faction:3}),
  '3330362068':Object.freeze({name:'Caçadores',faction:2}),
  '2058088313':Object.freeze({name:'Guerreiros',faction:2}),
  '2387277009':Object.freeze({name:'Espreitadores',faction:2}),
  '2651633799':Object.freeze({name:'Atropeladores',faction:2}),
  '2514244534':Object.freeze({name:'Titãs de Bile',faction:2}),
  '1379865898':Object.freeze({name:'Cuspidores de Bile',faction:2}),
  '717622970':Object.freeze({name:'Bile Spewers',faction:2}),
  '444529084':Object.freeze({name:'Bile Spitters',faction:2}),
  '4211847317':Object.freeze({name:'Sem-voto',faction:4})
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
