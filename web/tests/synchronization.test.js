import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDashboard,ageMarketRows} from '../worker/dashboard.js';
import {LiveFeed} from '../worker/live.js';
import {watchObservation} from '../worker/auto-protocol.js';
import {priceChanges} from '../worker/market-contract.js';
import {RefreshCoordinator} from '../worker/refresh.js';
import service,{refreshBackground} from '../worker/service.js';
import {MemoryBucket} from './fixtures.js';
const now=Date.UTC(2026,10,12,14,0,5);
const selection={symbol:'BTCUSDT',market:'PERP',profile:'MODERADO',horizon:'DIARIO',basis:'ROLLING_24H'};
const row=(price=100,asof=now-1000)=>({symbol:'BTCUSDT',market:'PERP',price,sourceAsOf:asof,change:0,changes:priceChanges({lastPr:price,open24h:100}),frames:{},state:'OK',available:true});
const quote=(price,ts,market='PERP')=>({symbol:'BTCUSDT',market,price,ts,received:now,source:'WS',changes:priceChanges({lastPr:price,open24h:100})});
const snapshot=r=>({symbol:r.symbol,market:r.market,received:now,sourceAsOf:r.sourceAsOf,ticker:{lastPr:r.price,ts:r.sourceAsOf,open24h:100},universe:[r],radarUniverse:[r]});
test('Cotización anterior a la captura no hace retroceder la ficha ni el radar',()=>{
 const q=quote(90,now-3000),model=buildDashboard({snapshot:snapshot(row(110)),quotes:new Map([['PERP:BTCUSDT',q]]),selection,now});
 assert.equal(model.quote.price,110);assert.equal(model.selected.price,110);assert.equal(model.rows[0].price,110);assert.ok(model.selected.displayChange>0);
});
test('Precio vencido se conserva con su reloj si sigue siendo la observación más nueva',()=>{
 const q=quote(110,now-10000),model=buildDashboard({snapshot:snapshot(row(90,now-20000)),quotes:new Map([['PERP:BTCUSDT',q]]),selection,now});
 assert.equal(model.quote.price,110);assert.equal(model.rows[0].price,110);assert.equal(model.selected.displayFresh,false);assert.equal(model.quote.ts,now-10000);
});
test('Cambiar mercado nunca utiliza la cotización del otro instrumento',()=>{
 const model=buildDashboard({snapshot:snapshot(row()),quotes:new Map([['SPOT:BTCUSDT',quote(999,now,'SPOT')]]),selection,now});
 assert.equal(model.selected.price,100);assert.equal(model.quote.market,'PERP');
});
test('Precio fresco no renueva estructuras vencidas ni sus lecturas',()=>{
 const r=row(),close=Date.UTC(2026,10,12,13);r.frames={'15m':{status:'OK',asof:close,regime:'LONG',rsi:80,cmf:.8,macdHistogram:1,rsiSlope:1,obvSlope:5,adSlope:5},'1H':{status:'OK',asof:close,regime:'LONG'}};
 const original=structuredClone(r),model=buildDashboard({snapshot:snapshot(r),quotes:new Map([['PERP:BTCUSDT',quote(120,now)]]),selection,now});
 assert.equal(model.rows[0].frames['15m'].status,'STALE');assert.equal(model.rows[0].readings.DIARIO.components.mom.value,null);assert.equal(model.rows[0].readings.DIARIO.components.flu.value,null);assert.deepEqual(r,original);
 assert.equal(model.selected.displayFresh,true);
});
test('Perfiles comparten hechos y el cambio de horizonte recalcula la lectura correspondiente',()=>{
 const s=snapshot(row()),a=buildDashboard({snapshot:s,selection,now}),b=buildDashboard({snapshot:s,selection:{...selection,profile:'AGRESIVO',horizon:'SEMANAL'},now});
 assert.equal(a.selected.price,b.selected.price);assert.notEqual(a.key,b.key);assert.equal(b.selection.profile,'AGRESIVO');assert.ok(b.rows[0].readings.SEMANAL);assert.equal(b.rows[0].readings.DIARIO,undefined);
});
test('Edad de filas no cambia la fecha de la fuente al servir otra vez',()=>{
 const r=row();r.frames={'15m':{status:'OK',asof:now-5000,regime:'LONG'}};
 const a=ageMarketRows([r],now),b=ageMarketRows(a,now+915000);assert.equal(b[0].frames['15m'].status,'STALE');assert.equal(b[0].frames['15m'].asof,r.frames['15m'].asof);
});
test('Respuesta UNKNOWN tiene hora de respuesta pero no acredita éxito de datos',async()=>{
 const c=new RefreshCoordinator({clock:()=>now});await c.run('macro',async()=>({status:'UNKNOWN'}));const job=c.snapshot()[0];assert.equal(job.lastResponseAt,now);assert.equal(job.lastSuccess,undefined);assert.equal(job.state,'UNKNOWN');
});
test('Mensaje con mismo precio y hora admite cambios de funding sin falsear la hora de precio',()=>{
 let received=now,seen=[];const socket={readyState:1,send(){},close(){}};
 const feed=new LiveFeed({symbols:['BTCUSDT'],socketFactory:()=>socket,now:()=>received,setIntervalFn:()=>1,clearIntervalFn(){},onQuote:q=>seen.push(q)});feed.start();socket.onopen();
 const msg=fundingRate=>({data:JSON.stringify({arg:{instType:'USDT-FUTURES',channel:'ticker',instId:'BTCUSDT'},data:[{lastPr:'100',ts:String(now),fundingRate}]})});
 socket.onmessage(msg('0.0001'));received+=1000;socket.onmessage(msg('0.0002'));feed.stop();
 assert.equal(seen.length,2);assert.equal(seen[1].fundingRate,.0002);assert.equal(seen[1].ts,now);assert.equal(seen[1].received,now+1000);
});
test('Actualización sin navegador persiste resultados y distingue respuesta útil de fallo',async()=>{
 const bucket=new MemoryBucket(),value=await refreshBackground({BUCKET:bucket},{now,jobs:{fred:async()=>({status:'PARTIAL',coverage:{observed:19,total:20}}),soso:async()=>{throw Error('provider');}}});
 assert.equal(value.state,'PARTIAL');assert.equal(value.lastSuccess,now);assert.equal(value.sources.find(x=>x.id==='soso').state,'ERROR');
 const r=await service.fetch(new Request('https://bot.test/api/background-status'),{BUCKET:bucket}),stored=await r.json();assert.equal(stored.lastAttempt,now);assert.equal(stored.accountData,false);assert.equal(stored.sources.length,2);
 const partial=await refreshBackground({BUCKET:bucket},{now:now+1000,jobs:{fred:async()=>({status:'PARTIAL'})}});assert.equal(partial.state,'PARTIAL');
});
test('Un fallo de todas las fuentes no fabrica éxito y la escritura rechaza otro origen',async()=>{
 const bucket=new MemoryBucket(),value=await refreshBackground({BUCKET:bucket},{now,jobs:{macro:async()=>({status:'UNKNOWN'})}});assert.equal(value.state,'ERROR');assert.equal(value.lastSuccess,null);
 const r=await service.fetch(new Request('https://bot.test/api/background-refresh',{method:'POST',headers:{Origin:'https://other.test','X-Bot-Write':'1'}}),{BUCKET:bucket});assert.equal(r.status,403);
});

test('Precio, retornos y descuento se recalculan sobre las mismas referencias sin renovar velas',()=>{
 const r=row(90,now-20000);r.return3h=-10;r.return7d=-10;r.return30d=-10;r.discount={status:'PARTIAL',high:200,low:50,from:1,to:2};r.accumulations={'15m':{clock:'OK',closeAsOf:Math.floor(now/900000)*900000-1800000,state:'ACUMULACION_POSIBLE'}};
 const model=buildDashboard({snapshot:snapshot(r),quotes:new Map([['PERP:BTCUSDT',quote(110,now-1000)]]),selection,now}),live=model.selected;
 assert.ok(Math.abs(live.return7d-10)<1e-10);assert.equal(live.discount.drawdown,-44.99999999999999);assert.equal(live.discount.priceAsOf,now-1000);assert.equal(live.sourceAsOf,now-1000);assert.equal(live.accumulations['15m'].clock,'STALE');assert.equal(live.accumulations['15m'].closeAsOf,r.accumulations['15m'].closeAsOf);
 const next=buildDashboard({snapshot:{...snapshot(r),ticker:{lastPr:100,ts:now-2000,open24h:100}},quotes:new Map([['PERP:BTCUSDT',quote(110,now-1000)]]),selection,now});assert.ok(Math.abs(next.selected.return30d-10)<1e-10);
});

test('Vigilancia conserva el precio más nuevo y no lee un régimen vencido como contexto actual',()=>{
 const r=row(110);r.frames={'15m':{status:'STALE',regime:'SHORT'}};const result=watchObservation(r,quote(90,now-2000),now);assert.equal(result.price,110);assert.equal(result.asof,r.sourceAsOf);assert.equal(result.phase,'OBSERVACION');
});
