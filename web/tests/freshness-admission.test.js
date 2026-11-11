import test from 'node:test';
import assert from 'node:assert/strict';
import {barClock,feedHealth} from '../worker/freshness.js';
import {evaluateIdea,refreshEvaluation,makeGeometry} from '../worker/protocol.js';
import {publishDataEntries} from '../scripts/cloud-feed.mjs';
import {freshen} from '../worker/service.js';
const NOW=Date.UTC(2026,10,11,12,30,0),idea={horizon:'DIARIO',side:'LONG',family:'BARRIDO_RECLAIM',formed:NOW-60000,entry:100,stop:90,targets:[110,120,130],tick:.01};
function snapshot(){return {received:NOW,currentPrice:100,currentPriceAsOf:NOW,structures:Object.fromEntries(['15m','1H','4H'].map(tf=>[tf,{status:'OK',value:{regime:'LONG',asof:tf==='15m'?NOW:Date.UTC(2026,10,11,12)}}])),closed:{'15m':[]},book:{status:'OK',asof:NOW,value:{imbalance:.2}}};}
test('Frescura de cierre usa su temporalidad: 1H a HH:30, semana y mes',()=>{
 assert.equal(barClock('1H',Date.UTC(2026,10,11,12),NOW).state,'OK');
 assert.equal(barClock('1H',Date.UTC(2026,10,11,11),NOW).state,'STALE');
 assert.equal(barClock('1Wutc',Date.UTC(2026,10,9),NOW).state,'OK');
 assert.equal(barClock('1Mutc',Date.UTC(2026,10,1),NOW).state,'OK');
 assert.equal(barClock('1H',NOW+1,NOW).state,'UNKNOWN');
});
test('Evidencia positiva confirma; al vencer DOM la evaluación cacheada deja de confirmar',()=>{
 const s=snapshot(),before=structuredClone(idea),e=evaluateIdea(s,idea,'MODERADO',NOW);
 assert.equal(e.admission,'CONFIRMADA');
 const later=refreshEvaluation(e,idea,NOW+5001,{price:100,asof:NOW+5001});
 assert.equal(later.keys.K2.state,'UNKNOWN');assert.equal(later.admission,'CONDICIONAL');
 assert.equal(e.admission,'CONFIRMADA');assert.deepEqual(idea,before);
});
test('No confirman flujo futuro, ausente, NaN, contextos vencidos o geometría incompleta',()=>{
 for(const profile of ['MODERADO','AGRESIVO','CONSERVADOR']){
  for(const mutate of [s=>{s.book.asof=NOW+1;},s=>{s.book.value.imbalance=NaN;},s=>{s.book=null;}]){
   const s=snapshot();mutate(s);assert.notEqual(evaluateIdea(s,idea,profile,NOW).admission,'CONFIRMADA');
  }
  assert.notEqual(evaluateIdea(snapshot(),{...idea,targets:[110]},profile,NOW).admission,'CONFIRMADA');
 }
});
test('Cierre fuente vencido y precio vencido no son disparos; un evento futuro tampoco',()=>{
 const s=snapshot();s.structures['15m'].value.asof-=1800000;
 assert.notEqual(evaluateIdea(s,idea,'AGRESIVO',NOW).admission,'CONFIRMADA');
 const c=snapshot();c.structures['4H'].value.asof-=14400000;for(const p of ['MODERADO','CONSERVADOR'])assert.notEqual(evaluateIdea(c,idea,p,NOW).admission,'CONFIRMADA');
 const t=snapshot();t.currentPriceAsOf=NOW-16000;
 assert.equal(evaluateIdea(t,idea,'MODERADO',NOW).admission,'ESPERA_PRECIO_FRESCO');
 assert.notEqual(evaluateIdea(snapshot(),{...idea,formed:NOW+1},'MODERADO',NOW).admission,'CONFIRMADA');
});
test('K2 positivo de CMF cerrado no exige DOM cuando la regla permite evidencia independiente',()=>{
 const s=snapshot();s.book=null;s.closed['15m']=Array.from({length:40},(_,i)=>[NOW-(40-i)*900000,100,102,98,101,10]);
 const e=evaluateIdea(s,idea,'MODERADO',NOW);assert.equal(e.keys.K2.state,'PASS');assert.equal(e.keys.K2.evidence.bookUsed,false);assert.equal(e.admission,'CONFIRMADA');
 const t=refreshEvaluation(e,idea,NOW+910001,{price:100,asof:NOW+910001});assert.notEqual(t.admission,'CONFIRMADA');
});
test('Cadencia cambia con el reloj, sin retimbrar el éxito histórico',()=>{
 const s={state:'OK',lastSuccess:NOW,sourceAsOf:NOW-1000};
 assert.equal(feedHealth(s,NOW+1000).state,'OK');assert.equal(feedHealth(s,NOW+600001).state,'DELAYED');
 const h=feedHealth(s,NOW+900001);assert.equal(h.state,'STALE');assert.equal(h.lastSuccess,NOW);assert.ok(h.missedTargets>=2);
 assert.equal(feedHealth({...s,lastSuccess:NOW+1},NOW).state,'UNKNOWN');
 assert.equal(feedHealth({...s,sourceAsOf:NOW+1},NOW).state,'UNKNOWN');
});
test('Servidor degrada evaluaciones guardadas al caducar, conservando la captura original',()=>{
 const s=snapshot(),e=evaluateIdea(s,idea,'MODERADO',NOW);s.plans={DIARIO:[{...idea,evaluations:{MODERADO:e}}]};s.opportunities=structuredClone(s.plans.DIARIO);
 const t=freshen(s,NOW+6000);assert.equal(t.received,NOW);assert.notEqual(t.plans.DIARIO[0].evaluations.MODERADO.admission,'CONFIRMADA');assert.notEqual(t.opportunities[0].evaluations.MODERADO.admission,'CONFIRMADA');assert.equal(s.plans.DIARIO[0].evaluations.MODERADO.admission,'CONFIRMADA');
});
test('Nueva política conserva namespace e identidad geométrica para no rearmar eventos previos',()=>{
 const s={market:'PERP',symbol:'BTCUSDT',venue:'BITGET',instrument:{pricePlace:2,priceEndStep:1},structures:{'15m':{value:{atr:1}}}};
 const g=makeGeometry(s,'DIARIO','LONG','BARRIDO_RECLAIM',NOW,100,90,[110,120,130]);
 assert.ok(g.lifecycleId.startsWith('protocolo-2.0:PERP:BTCUSDT:DIARIO:LONG:'));assert.deepEqual([g.entry,g.stop,g.targets],[100,89.9,[110,120,130]]);
});
test('Publicaciones simultáneas de Kronos y mercado rebasan sin fuerza ni perder el otro archivo',async()=>{
 const trees=[],parents=[],refs=[];let reads=0;
 const api=async(path,method,body)=>{
  if(path.includes('/git/ref/'))return {object:{sha:++reads===1?'old':'new-head-with-market'}};
  if(path.includes('/git/commits/'))return {tree:{sha:path.endsWith('/old')?'oldtree':'market-tree'}};
  if(path==='/git/trees'){trees.push(body);return {sha:'tree'+trees.length};}
  if(path==='/git/commits'){parents.push(body.parents);return {sha:'commit'+parents.length};}
  if(method==='PATCH'){refs.push(body);if(refs.length===1){const e=Error('race');e.status=422;throw e;}return {};}
 };
 const sha=await publishDataEntries(api,[{path:'kronos.json',content:'public'}],'kronos');
 assert.equal(sha,'commit2');assert.equal(trees[1].base_tree,'market-tree');assert.deepEqual(parents[1],['new-head-with-market']);assert.ok(refs.every(r=>r.force===false));
});
