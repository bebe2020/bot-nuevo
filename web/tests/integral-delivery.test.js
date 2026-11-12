import test from 'node:test';
import assert from 'node:assert/strict';
import {MACRO_SERIES,macroPoint,ageMacro,macroProvider,capitalRegime,usdLiquidity,validateMacroMirror} from '../worker/macro.js';
import {protocolIdeas,protocolReadiness,evaluateIdea,refreshEvaluation,protocolApplicable} from '../worker/protocol.js';
import {PaperBook} from '../worker/paper.js';
import {savePaper,readPaper,mergePaperRecords} from '../worker/paper-cloud.js';
import {integralConfluence} from '../worker/integral.js';
import {MemoryBucket} from './fixtures.js';

const NOW=Date.UTC(2026,10,12,12),DAY=86400000;
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
const idea=(market='PERP',horizon='DIARIO')=>({id:'event-1',symbol:'BTCUSDT',market,horizon,side:'LONG',family:'BARRIDO_RECLAIM',formed:NOW,entry:100,stop:95,targets:[110,120,130],tick:.1});
function snapshot(market='PERP'){
 const frames=['1m','5m','15m','1H','4H','1Dutc','1Wutc','1Mutc'];
 return {symbol:'BTCUSDT',market,venue:'BITGET',received:NOW,ticker:{lastPr:100,ts:NOW},instrument:{pricePlace:1,priceEndStep:1},
  closed:Object.fromEntries(frames.map(tf=>[tf,Array.from({length:40},(_,i)=>[NOW-(40-i)*300000,100,101,99,100.8,10])])),
  structures:Object.fromEntries(frames.map((tf,i)=>[tf,{status:'OK',value:{atr:2,asof:NOW,regime:'LONG',sweeps:i===1?[{side:'LONG',level:100,extreme:95,detected:NOW}]:[],pivots:[{type:'HIGH',price:110+i*10}]}}])),
  book:{status:'UNKNOWN'},trades:{status:'UNKNOWN'}};
}

test('Micro pivote SPOT queda excluido del productor, lectura y evaluación cacheada',()=>{
 const s=snapshot('SPOT'),x=idea('SPOT','MICRO_PIVOTE');
 assert.deepEqual(protocolIdeas(s,'MICRO_PIVOTE'),[]);
 for(const p of ['AGRESIVO','MODERADO','CONSERVADOR','ULTRAAGRESIVO']){
  assert.equal(protocolReadiness(s,'MICRO_PIVOTE',p).admission,'NO_APLICA_MERCADO');
  const e=evaluateIdea(s,x,p,NOW);assert.equal(e.keys.K1.state,'NOT_APPLICABLE');
  assert.equal(refreshEvaluation(e,x,NOW).kind,'OBSERVACION');
 }
 assert.equal(protocolApplicable('MICRO_PIVOTE','PERP'),true);
});
test('Explosión SPOT exige volumen y evento; no se obtiene copiando micro o un descuento',()=>{
 const s=snapshot('SPOT');assert.deepEqual(protocolIdeas(s,'EXPLOSION'),[]);
 s.closed['5m'].at(-1)[5]=100;
 const results=protocolIdeas(s,'EXPLOSION');assert.ok(results.length>0);
 assert.ok(results.every(x=>x.market==='SPOT'&&x.side==='LONG'&&x.horizon==='EXPLOSION'&&x.family!=='FIBONACCI'));
 assert.deepEqual(protocolIdeas({...s,market:'PERP'},'EXPLOSION'),[]);
 assert.deepEqual(protocolIdeas(s,'ACUMULACION'),[]);
});
test('CSV de condiciones financieras y curva conserva valores negativos reales',()=>{
 for(const id of ['NFCI','T10Y2Y','DFII10']){
  const def=MACRO_SERIES.find(x=>x.id===id),p=macroPoint(def,'observation_date,'+id+'\n2026-11-10,-0.32\n2026-11-11,-0.40',NOW);
  assert.equal(p.value,-.4);assert.ok(Math.abs(p.change+.08)<1e-12);
 }
});
test('Veinte identidades y unidades; CPI nivel no se confunde con inflación interanual',()=>{
 assert.equal(MACRO_SERIES.length,20);assert.equal(new Set(MACRO_SERIES.map(x=>x.id)).size,20);
 const def=MACRO_SERIES.find(x=>x.id==='CPIAUCSL');
 const p=macroPoint(def,'DATE,CPIAUCSL\n2025-10-01,100\n2026-10-01,103',NOW);
 assert.equal(p.value,103);assert.ok(Math.abs(p.yoy-3)<1e-10);assert.equal(p.change,3);
 assert.throws(()=>macroPoint(def,'<html>error</html>',NOW));
});
test('Macro con observación vieja o futura no se renueva al servir la caché',()=>{
 const def=MACRO_SERIES[0],x={...def,value:4,asof:NOW-10*DAY,date:'2026-11-02',received:NOW-1000,status:'OK'};
 const out=ageMacro({metrics:[x]},NOW);assert.equal(out.metrics[0].status,'STALE');assert.equal(out.metrics[0].received,NOW-1000);
 assert.equal(ageMacro({metrics:[{...x,asof:NOW+DAY}]},NOW).metrics[0].value,null);
});
test('Espejo macro conserva reloj y rechaza identidad duplicada o timestamp futuro',()=>{
 const value={accountData:false,metrics:MACRO_SERIES.map(def=>({...def,value:1,date:'2026-11-10',asof:Date.UTC(2026,10,10),received:NOW-1000,status:'OK',history:[{date:'2026-11-10',value:1}]}))};
 assert.equal(validateMacroMirror(value,NOW)[0].received,NOW-1000);
 const duplicate=structuredClone(value);duplicate.metrics[1]=duplicate.metrics[0];assert.throws(()=>validateMacroMirror(duplicate,NOW));
 const future=structuredClone(value);future.metrics[0].received=NOW+1;assert.throws(()=>validateMacroMirror(future,NOW));
});
test('Servidor usa captura pública reciente sin retimbrar observaciones',async()=>{
 const value={accountData:false,checkedAt:NOW-1000,metrics:MACRO_SERIES.map(def=>({...def,value:1,date:'2026-11-10',asof:Date.UTC(2026,10,10),received:NOW-1000,status:'OK',history:[{date:'2026-11-10',value:1}]}))};
 const calls=[],result=await macroProvider(null,async url=>{calls.push(url);return Response.json(value);},NOW);
 assert.equal(calls.length,1);assert.match(calls[0],/market-data\/macro.json/);assert.equal(result.coverage.observed,20);
 assert.equal(result.metrics[0].received,NOW-1000);assert.equal(result.captureCheckedAt,NOW-1000);
});
test('Fallo de FRED conserva el último valor con su fecha y estado STALE',async()=>{
 const bucket=new MemoryBucket(),fetcher=async url=>{const id=new URL(url).searchParams.get('id');return new Response('DATE,'+id+'\n2026-11-10,1');};
 const first=await macroProvider(bucket,fetcher,NOW);
 const failed=await macroProvider(bucket,async()=>new Response('error',{status:503}),NOW+1000000);
 assert.equal(first.coverage.observed,20);assert.equal(failed.coverage.observed,0);
 assert.equal(failed.metrics[0].status,'STALE');assert.equal(failed.metrics[0].received,NOW);
});
test('Régimen no utiliza una referencia vencida ni asegura flujo de capital',()=>{
 const cross={assets:['^GSPC','TLT','GC=F','DX-Y.NYB'].map((id,i)=>({id,status:'DELAYED_OR_CLOSED',asof:NOW,change20d:i===3?-.02:.03}))};
 assert.equal(capitalRegime(cross,NOW).state,'RIESGO_FAVORABLE');
 cross.assets[0].status='STALE';assert.equal(capitalRegime(cross,NOW).state,'UNKNOWN');
});
test('Liquidez USD usa TGA de miércoles y RRP de la misma fecha; no resta niveles de fechas distintas',()=>{
 const metrics=[['WALCL',6000000],['WDTGAL',800000],['RRPONTSYD',100]].map(([id,value])=>({id,status:'OK',history:[{date:'2026-11-04',value},{date:'2026-11-11',value:id==='WALCL'?value+100000:value}]}));
 const x=usdLiquidity(metrics,NOW);assert.equal(x.value,5200);assert.equal(x.change,100);assert.equal(x.unit,'miles de millones USD');
 metrics[1].history=[{date:'2026-11-03',value:800000}];assert.equal(usdLiquidity(metrics,NOW).status,'UNKNOWN');
});
test('Confluencia integral no convierte confirmación técnica en fundamentales completos',()=>{
 const result=integralConfluence({symbol:'BTCUSDT',evaluation:{admission:'CONFIRMADA',keys:{K1:{state:'PASS'},K2:{state:'PASS'}}}},NOW);
 assert.equal(result.keys.K1.state,'UNKNOWN');assert.equal(result.keys.K2.state,'PASS');assert.equal(result.keys.K3.state,'PASS');
 assert.equal(result.keys.K4.state,'UNKNOWN');assert.equal(result.state,'CONFLUENCIA_PARCIAL');
});
function paper(){const book=new PaperBook(memory());book.arm(idea(),{status:'SIMULACION',quantity:3},.1,NOW);return book;}
test('PAPER rechaza micro SPOT incluso si se intenta armar desde una ficha vieja',()=>{
 const book=paper();assert.throws(()=>book.arm(idea('SPOT','MICRO_PIVOTE'),{status:'SIMULACION',quantity:3},.1,NOW));
 book.quote({symbol:'BTCUSDT',market:'PERP',price:100},NOW);assert.equal(book.read()[0].state,'SIM_PENDIENTE');
});
test('Libro PAPER persiste y otra sesión recupera exactamente los mismos eventos',async()=>{
 const bucket=new MemoryBucket(),book=paper();
 book.quote({symbol:'BTCUSDT',market:'PERP',price:100,ts:NOW+1,received:NOW+1},NOW+1);
 const saved=await savePaper(bucket,{baseVersion:0,records:book.read()});assert.equal(saved.conflict,false);
 const read=await readPaper(bucket);assert.equal(read.version,1);assert.equal(read.records[0].events[0].type,'ENTRADA_HIPOTETICA');
 assert.deepEqual(read.records,book.read());
});
test('PAPER con revisión anterior no sobrescribe una sesión nueva',async()=>{
 const bucket=new MemoryBucket(),book=paper();await savePaper(bucket,{baseVersion:0,records:book.read()});
 const result=await savePaper(bucket,{baseVersion:0,records:[]});assert.equal(result.conflict,true);assert.equal(result.book.records.length,1);
});
test('Reconciliación PAPER conserva cierre y rechaza historias divergentes',()=>{
 const book=paper(),pending=structuredClone(book.read());
 book.quote({symbol:'BTCUSDT',market:'PERP',price:100,ts:NOW+1,received:NOW+1},NOW+1);
 book.quote({symbol:'BTCUSDT',market:'PERP',price:94,ts:NOW+2,received:NOW+2},NOW+2);
 const terminal=book.read();assert.equal(mergePaperRecords(pending,terminal)[0].state,'SIM_CERRADA');
 const other=structuredClone(terminal);other[0].events[0].price=99;
 assert.throws(()=>mergePaperRecords(other,terminal),/CONFLICTO_DE_EVENTOS/);
});
test('API PAPER exige mismo origen y mantiene revisión ante escrituras simultáneas',async()=>{
 const worker=(await import('../worker/service.js')).default,bucket=new MemoryBucket(),book=paper(),payload=JSON.stringify({baseVersion:0,records:book.read()});
 const request=origin=>new Request('https://test.local/api/paper',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Bot-Write':'1'},body:payload});
 assert.equal((await worker.fetch(request('https://other.local'),{BUCKET:bucket})).status,403);
 const results=await Promise.all([worker.fetch(request('https://test.local'),{BUCKET:bucket}),worker.fetch(request('https://test.local'),{BUCKET:bucket})]);
 assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
});
