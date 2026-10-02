import test from 'node:test';import assert from 'node:assert/strict';
import {eventClockDate,normalizeWar} from './normalize.mjs';
const now=Date.parse('2026-10-02T19:42:00Z');
test('prazo usa Status.time; startDate desfasado não transforma defesa recém-iniciada em invasão concluída',()=>{
 const info={startDate:1706040313,planetInfos:Array.from({length:10},(_,index)=>({index,maxHealth:100,initialOwner:1,position:{x:index/10,y:0},waypoints:[]}))};
 const status={time:83032340,planetStatus:info.planetInfos.map(p=>({index:p.index,health:100,owner:1,players:1})),campaigns:[{planetIndex:0}],planetEvents:[{id:5707,planetIndex:0,race:2,health:1249361,maxHealth:1250000,startTime:83030800,expireTime:83203600}]};
 const event=normalizeWar(status,info,[],now).planets[0].event;
 assert.equal(Date.parse(event.startTime),now-1540000);assert.equal(Date.parse(event.endTime),now+171260000);
 assert.equal(event.health,1249361);assert.equal(event.maxHealth,1250000);assert.equal(event.clockSource,'game-status');
 const enemy=(now-Date.parse(event.startTime))/(Date.parse(event.endTime)-Date.parse(event.startTime))*100;
 assert.ok(enemy>0.89&&enemy<0.90);const defense=(1-event.health/event.maxHealth)*100;assert.ok(defense>0.05&&defense<0.06);
 const later=normalizeWar({...status,time:status.time+60},info,[],now+60000).planets[0].event;
 assert.equal(later.startTime,event.startTime);assert.equal(later.endTime,event.endTime,'datas permanecem estáveis entre leituras quando os dois relógios avançam juntos');
});
test('datas de evento não são inventadas quando o relógio bruto ou o prazo estiver ausente/inválido',()=>{
 for(const value of [null,undefined,NaN,Infinity,-1,'83032340'])assert.equal(eventClockDate({time:value},83030800,now),null);
 for(const value of [null,undefined,NaN,Infinity,-1])assert.equal(eventClockDate({time:83032340},value,now),null);
 assert.equal(eventClockDate({Time:83032340},83030800,now),new Date(now-1540000).toISOString());
});
