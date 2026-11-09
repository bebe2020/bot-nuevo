import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PaperBook} from '../worker/paper.js';
import {TRADING_LANES,validateLane,marketCapTier,spotStagePlan,advanceSpotPaper,perpRiskPlan,portfolioGoal} from '../worker/trading-lanes.js';
import {evaluateSpotExplosion,spotExplosionRadar} from '../worker/spot-explosion.js';
const NOW=Date.UTC(2026,10,9,12,32),H=3600000,anchor=Date.UTC(2026,10,9,12);
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
const base={symbol:'MAGMAUSDT',budgetUsd:100,entryPrices:[100,95,90],stop:80,now:NOW,sourceAsOf:NOW-1000};
const quote=(price,offset=1,market='SPOT',source='WS')=>({market,symbol:'MAGMAUSDT',price,ts:NOW+offset,received:NOW+offset,source});
const row=()=>({symbol:'MAGMAUSDT',market:'SPOT',available:true,frames:{'1H':{ok:true,data:Array.from({length:50},(_,i)=>[anchor-(50-i)*H,100,102,99,100,10])}}});
test('contratos: SPOT compra x1 y swing, PERP intradia x20/x30 y swing x3/x5, ambos lados',()=>{
 assert.deepEqual(TRADING_LANES.SPOT_EXPLOSIVO.horizons,['1H','4H','14H','24H','36H']);
 assert.deepEqual(TRADING_LANES.SPOT_SWING.horizons,['SEMANAL','MENSUAL','TRIMESTRAL','CICLO_3_ANOS']);
 for(const lev of [20,30])for(const side of ['LONG','SHORT'])assert.equal(validateLane({lane:'PERP_INTRADIA',market:'PERP',side,horizon:'SCALP',leverage:lev}).status,'PAPER_ONLY');
 for(const lev of [3,5])for(const side of ['LONG','SHORT'])for(const horizon of ['SEMANAL','MENSUAL','TRIMESTRAL'])assert.equal(validateLane({lane:'PERP_SWING',market:'PERP',side,horizon,leverage:lev}).status,'PAPER_ONLY');
 assert.equal(validateLane({lane:'SPOT_EXPLOSIVO',market:'SPOT',side:'SHORT',horizon:'24H',leverage:1}).status,'BLOCKED');
 assert.equal(validateLane({lane:'PERP_SWING',market:'PERP',side:'LONG',horizon:'MENSUAL',leverage:30}).status,'BLOCKED');
 assert.equal(validateLane({lane:'PERP_INTRADIA',market:'PERP',side:'SHORT',horizon:'DIARIO',leverage:5}).status,'BLOCKED');
});
test('capitalización real no se reemplaza por volumen',()=>{
 assert.equal(marketCapTier(null).tier,'DESCONOCIDA');
 assert.equal(marketCapTier(150000000).tier,'MICRO');
 assert.equal(marketCapTier(800000000).tier,'BAJA');
 assert.equal(marketCapTier(5000000000).tier,'MEDIA');
});
test('SPOT escalonado asigna 40/35/25 y salida +30/+50/+80/+100 sin señal automática',()=>{
 const x=spotStagePlan(base);assert.equal(x.status,'PAPER_ELIGIBLE');assert.deepEqual(x.stages.map(s=>s.allocationUsd),[40,35,25]);assert.deepEqual(x.exitGains,[.30,.50,.80,1]);assert.equal(x.realOrdersEnabled,false);
 assert.equal(spotStagePlan({...base,stop:95}).status,'BLOCKED');
 assert.equal(spotStagePlan({...base,market:'PERP'}).status,'BLOCKED');
});
test('SPOT: apertura por ticks frescos, tres compras y cuatro ventas conservan costes netos y deduplicación',()=>{
 const book=new PaperBook(storage()),p=book.armStagedSpot(spotStagePlan(base),NOW);
 assert.equal(p.state,'SIM_PENDIENTE');
 book.quote(quote(100,1),NOW+1);
 assert.equal(book.read()[0].stages.filter(s=>s.filled).length,1);
 book.quote(quote(94,2),NOW+2);
 book.quote(quote(89,3),NOW+3);
 let live=book.read()[0];assert.equal(live.stages.filter(s=>s.filled).length,3);assert.ok(Math.abs(live.entryNotionalUsd+live.entryFeesUsd-100)<1e-6);
 const before=live.events.length;book.quote(quote(89,3),NOW+3);assert.equal(book.read()[0].events.length,before);
 book.quote(quote(live.avgEntry*2.01,4),NOW+4);
 const done=book.read()[0];assert.equal(done.targetIndex,4);assert.equal(done.state,'SIM_CERRADA');assert.equal(done.remaining,0);assert.ok(done.net>0);assert.equal(done.events.filter(e=>e.type.startsWith('VENTA_TRAMO')).length,4);
 book.quote(quote(0.001,5),NOW+5);assert.equal(book.read()[0].net,done.net);
});
test('SPOT: prioridad del stop, gap conservador, no se fabrican compras sin ticks verificados',()=>{
 const book=new PaperBook(storage());book.armStagedSpot(spotStagePlan(base),NOW);
 book.quote(quote(95,1,'PERP'),NOW+1);assert.equal(book.read()[0].state,'SIM_PENDIENTE');
 book.quote(quote(100,2,'SPOT','MANUAL'),NOW+2);assert.equal(book.read()[0].state,'SIM_PENDIENTE');
 book.quote(quote(79,3),NOW+3);assert.equal(book.read()[0].state,'SIM_CANCELADA');assert.equal(book.read()[0].quantity,0);
});
test('SPOT: stop después de la primera compra realiza pérdida solo en PAPER',()=>{
 const book=new PaperBook(storage());book.armStagedSpot(spotStagePlan(base),NOW);book.quote(quote(100,1),NOW+1);book.quote(quote(70,2),NOW+2);const p=book.read()[0];assert.equal(p.state,'SIM_CERRADA');assert.ok(p.net<0);assert.equal(p.market,'SPOT');
});
test('radar horario admite la última 1H cerrada aunque hayan pasado 32 minutos',()=>{
 const x=evaluateSpotExplosion(row(),{now:NOW,market:'SPOT',marketCapUsd:100e6,fdvUsd:200e6,spotVolume24hUsd:600000,bid:100,ask:100.02});
 assert.equal(x.status,'OBSERVATION');assert.equal(x.market,'SPOT');assert.equal(x.capTier,'MICRO');assert.equal(x.window[14].returnPct,0);assert.equal(x.rvol,1);assert.equal(x.targets.at(-1).scenarioPct,100);
 const older=row();older.frames['1H'].data.pop();assert.equal(evaluateSpotExplosion(older,{now:NOW}).status,'STALE');
});
test('radar nunca reutiliza PERP y conserva faltantes',()=>{
 assert.equal(evaluateSpotExplosion({...row(),market:'PERP'},{market:'PERP',now:NOW}).status,'UNKNOWN');
 const r=spotExplosionRadar({market:'SPOT',rows:[row()],tickers:{ok:true,data:[{symbol:'MAGMAUSDT',usdtVolume:'600000'}]}},{now:NOW,providerAssets:[{symbol:'MAGMAUSDT',marketCap:100000000,fdv:200000000}]});
 assert.equal(r.coverage,1);assert.equal(r.items[0].status,'OBSERVATION');assert.ok(r.items[0].blockers.includes('PROFUNDIDAD_SPOT_Y_IMPACTO_NO_VERIFICADOS'));
 assert.equal(spotExplosionRadar({market:'PERP',rows:[row()]}).status,'BLOCKED');
});
test('riesgo bidireccional perp con costes, apalancamiento y límite de margen',()=>{
 const base={lane:'PERP_INTRADIA',horizon:'MICRO_PIVOTE',leverage:20,side:'LONG',entry:100,stop:99.8,equityUsd:710,riskFraction:.005,quoteFresh:true};
 const r=perpRiskPlan(base);assert.equal(r.status,'PAPER_ONLY');assert.ok(Math.abs(r.riskUsd-3.55)<1e-10);assert.equal(r.liquidationPrice,null);
 assert.equal(perpRiskPlan({...base,side:'SHORT',stop:100.2,leverage:30}).status,'PAPER_ONLY');
 assert.equal(perpRiskPlan({...base,riskFraction:.01}).status,'BLOCKED');
 assert.equal(perpRiskPlan({...base,quoteFresh:false}).status,'BLOCKED');
 assert.equal(perpRiskPlan({lane:'PERP_SWING',side:'SHORT',horizon:'TRIMESTRAL',leverage:5,entry:100,stop:105,equityUsd:710,riskFraction:.01,quoteFresh:true}).status,'PAPER_ONLY');
});
test('meta de 3500 USDT es +493% neto, sin promesas ni claves de ejecución',()=>{
 const g=portfolioGoal();assert.equal(g.totalNeededUsd,4210);assert.ok(Math.abs(g.requiredNetReturnPct-3500/710*100)<1e-9);assert.equal(g.guaranteed,false);
});
test('PERP x20 y x30: seguimiento LONG y SHORT registra apalancamiento y spread simulado',()=>{
 for(const [side,lev,stop,targetQuote] of [['LONG',20,99.8,100.8],['SHORT',30,100.2,99.2]]){
  const risk=perpRiskPlan({lane:'PERP_INTRADIA',side,horizon:'DIARIO',leverage:lev,entry:100,stop,equityUsd:710,riskFraction:.005,quoteFresh:true,slippageRate:.001});
  assert.equal(risk.status,'PAPER_ONLY');
  const book=new PaperBook(storage()),position=book.armPerpLab(risk,{symbol:'MAGMAUSDT',sourceAsOf:NOW-1000},NOW);
  assert.equal(position.leverage,lev);assert.equal(position.mode,'PERP_INTRADIA');assert.equal(position.fundingStatus,'UNKNOWN_NOT_INCLUDED');
  const q=(price,delta)=>({market:'PERP',symbol:'MAGMAUSDT',price,ts:NOW+delta,received:NOW+delta,source:'WS'});
  book.quote(q(100,1),NOW+1);assert.equal(book.read()[0].state,'SIM_ABIERTA');
  book.quote(q(targetQuote,2),NOW+2);
  const done=book.read()[0];assert.equal(done.state,'SIM_CERRADA');assert.ok(done.net>0);assert.equal(done.events.filter(x=>x.type.startsWith('TP')).length,3);
  const duplicate=book.armPerpLab(risk,{symbol:'MAGMAUSDT',sourceAsOf:NOW-1000},NOW);assert.equal(duplicate.id,position.id);
 }
});
test('SPOT al primer TP cancela compras pendientes y no reabre posiciones',()=>{
 const book=new PaperBook(storage());book.armStagedSpot(spotStagePlan(base),NOW);
 book.quote(quote(100,1),NOW+1);
 const before=book.read()[0];assert.equal(before.stages.filter(x=>x.filled).length,1);
 book.quote(quote(before.avgEntry*1.31,2),NOW+2);
 const mid=book.read()[0];assert.equal(mid.targetIndex,1);assert.equal(mid.stages.filter(x=>x.canceled).length,2);
 book.quote(quote(85,3),NOW+3);
 const after=book.read()[0];assert.equal(after.stages.filter(x=>x.filled).length,1);
 assert.equal(spotStagePlan({...base,entryPrices:[100,105,90]}).status,'BLOCKED');
});
test('PERP no inventa liquidacion y bloquea geometria potencialmente peligrosa',()=>{
 const r=perpRiskPlan({lane:'PERP_INTRADIA',side:'LONG',horizon:'SCALP',leverage:30,entry:100,stop:97,equityUsd:710,riskFraction:.005,quoteFresh:true});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.reason,'STOP_CERCA_DE_UMBRAL_TEORICO_LIQUIDACION');
});

test('caza PERP LONG/SHORT x3/x5/x7/x10 con límites por capitalización y liquidez',()=>{
 for(const side of ['LONG','SHORT'])for(const lev of [3,5,7,10]){
  const risk=perpRiskPlan({lane:'PERP_CAZA',horizon:'15m',side,leverage:lev,entry:100,stop:side==='LONG'?98:102,equityUsd:710,riskFraction:0.005,quoteFresh:true,marketCapUsd:15e9,volume24hUsd:35e6});
  assert.equal(risk.status,'PAPER_ONLY',JSON.stringify(risk));
  const book=new PaperBook(storage());
  const paper=book.armPerpLab(risk,{symbol:'BTCUSDT',sourceAsOf:NOW-1000},NOW);
  assert.equal(paper.side,side);assert.equal(paper.leverage,lev);assert.equal(paper.market,'PERP');
 }
 assert.equal(perpRiskPlan({lane:'PERP_CAZA',horizon:'15m',side:'LONG',leverage:10,entry:100,stop:99.5,riskFraction:0.005,quoteFresh:true,marketCapUsd:3e9,volume24hUsd:35e6}).reason,'X10_CAZA_SOLO_ALTA_CAPITALIZACION_EN_LABORATORIO');
 assert.equal(perpRiskPlan({lane:'PERP_CAZA',horizon:'15m',side:'SHORT',leverage:7,entry:100,stop:100.5,riskFraction:0.005,quoteFresh:true,marketCapUsd:3e9,volume24hUsd:1e6}).reason,'LIQUIDEZ_PERP_INSUFICIENTE_PARA_X7_X10');
 assert.equal(perpRiskPlan({lane:'PERP_SWING',horizon:'SEMANAL',side:'LONG',leverage:7,entry:100,stop:98,riskFraction:0.005,quoteFresh:true,marketCapUsd:3e9,volume24hUsd:35e6}).status,'PAPER_ONLY');
 assert.equal(perpRiskPlan({lane:'PERP_SWING',horizon:'SEMANAL',side:'LONG',leverage:7,entry:100,stop:98,riskFraction:0.005,quoteFresh:true,marketCapUsd:15e9,volume24hUsd:35e6}).reason,'X7_SWING_SOLO_MEDIANA_CAPITALIZACION_VERIFICADA');
});
test('interfaz incluye nuevas modalidades sin quitar Kronos ni paneles antiguos',async()=>{
 const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
 const [ui,panels,build]=await Promise.all([read('worker/ui.js'),read('worker/panels.js'),read('scripts/build.mjs')]);
 for(const id of ['spotRadarRows','spotTrancheForm','spotPlanEntry1','spotPlanEntry2','spotPlanEntry3','spotPlanStop','perpRiskCalc'])assert.ok(ui.includes('id="'+id+'"'));
 assert.ok(ui.includes('data-view="operativa"'));assert.ok(ui.includes('data-panel="lab"'));assert.ok(ui.includes('data-panel="defi"'));assert.ok(ui.includes('id="perpArmPaper"'));assert.ok(ui.includes('value="PERP_CAZA"'));assert.ok(ui.includes('id="exportPaperLog"'));assert.match(panels,/exportPaperLog\(\)/);
 assert.match(panels,/armStagedSpot/);assert.match(panels,/spotExplosionRadar/);
 assert.match(build,/'trading-lanes.js'/);assert.match(build,/'spot-explosion.js'/);assert.match(build,/'panels.js'/);
});
