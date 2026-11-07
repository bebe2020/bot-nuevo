import test from 'node:test';
import assert from 'node:assert/strict';
import {deviceJournal,mergeObservations,siteAPI} from '../worker/journal.js';
import {parseCalendar,parseNews,fedContext,publicContext,validateContextMirror} from '../worker/context.js';
import {protocolReadiness} from '../worker/protocol.js';
import {acquire,assemble} from '../worker/collector.js';
import worker from '../worker/service.js';
import {MemoryBucket,fakeFetch} from './fixtures.js';

function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};}
const input={symbol:'BTCUSDT',market:'PERP',side:'LONG',entry:100,stop:95,quantity:1,targets:[110,115,120],entryFee:.001,exitFee:.001,fundingCash:0};

test('Sesión 401 queda tipada y la petición incluye credenciales sin incrustar secretos',async()=>{
 await assert.rejects(()=>siteAPI('/api/history',{},async(path,options)=>{assert.equal(options.credentials,'include');assert.equal(options.headers,undefined);return new Response('sign in',{status:401});}),e=>e.status===401&&e.message.includes('sesión'));
 await assert.rejects(()=>siteAPI('/api/history',{},async()=>new Response('<html>login</html>',{headers:{'Content-Type':'text/html'}})),e=>e.status===401);
});
test('Un fallo del servidor mantiene su estado y no se confunde con sesión vencida',async()=>{
 await assert.rejects(()=>siteAPI('/api/plans',{},async()=>Response.json({error:'GEOMETRIA_INVALIDA'},{status:400})),e=>e.status===400&&e.message==='GEOMETRIA_INVALIDA');
});
test('Un plan pendiente sobrevive al reinicio y conserva el ID al sincronizar',()=>{
 const s=storage(),journal=deviceJournal(s),plan=journal.stagePlan(input,'dc4ba029-2730-42b4-9e91-9e0a56bbd9da',1000);
 const reopened=deviceJournal(s);assert.equal(reopened.read().plans[0].clientId,plan.clientId);assert.equal(reopened.read().plans[0].sync,'PENDIENTE');
 reopened.synced(plan.clientId,{id:plan.clientId});assert.equal(deviceJournal(s).read().plans[0].sync,'GUARDADO_EN_NUBE');assert.deepEqual(reopened.read().plans[0].targets,[110,115,120]);
});
test('Diario deduplica por minuto y mercado y conserva fecha de la fuente',()=>{
 const journal=deviceJournal(storage());
 const s={symbol:'BTCUSDT',market:'SPOT',received:120000,sourceAsOf:119000,ticker:{lastPr:'100'}};
 journal.observe(s);journal.observe({...s,received:125000});journal.observe({...s,market:'PERP'});
 assert.equal(journal.read().observations.length,2);assert.ok(journal.read().observations.every(x=>x.asof===119000));
 assert.equal(mergeObservations(journal.read().observations,[{symbol:'BTCUSDT',market:'SPOT',received:120000,price:100,storage:'NUBE'}]).length,2);
});
test('Fallo de almacenamiento no afirma que un plan se guardó',()=>{
 const journal=deviceJournal({getItem:()=>null,setItem:()=>{throw Error('QuotaExceeded');}});
 assert.throws(()=>journal.stagePlan(input),/QuotaExceeded/);
});
test('Reintento de POST después de una respuesta perdida produce un solo plan',async()=>{
 const bucket=new MemoryBucket(),clientId=crypto.randomUUID();
 const post=body=>worker.fetch(new Request('https://test.invalid/api/plans',{method:'POST',headers:{'Content-Type':'application/json','X-Bot-Write':'1'},body:JSON.stringify(body)}),{BUCKET:bucket});
 const first=await post({...input,clientId}),second=await post({...input,clientId});
 assert.equal(first.status,201);assert.equal(second.status,200);assert.equal((await first.json()).id,(await second.json()).id);
 assert.equal((await bucket.list({prefix:'plans/'})).objects.length,1);
 assert.equal((await post({...input,clientId,entry:101})).status,409);
 assert.equal((await post({...input,clientId:'../otro'})).status,400);
});
test('Dos POST concurrentes con el mismo ID no duplican el plan',async()=>{
 const bucket=new MemoryBucket(),clientId=crypto.randomUUID();
 const post=()=>worker.fetch(new Request('https://test.invalid/api/plans',{method:'POST',headers:{'Content-Type':'application/json','X-Bot-Write':'1'},body:JSON.stringify({...input,clientId})}),{BUCKET:bucket});
 const responses=await Promise.all([post(),post()]);assert.ok(responses.every(x=>[200,201].includes(x.status)));assert.equal((await bucket.list({prefix:'plans/'})).objects.length,1);
});
test('KAIO, RIF y CPOOL conservan su fila PERP y ofrecen el SPOT sin mezclar velas',async()=>{
 const base=fakeFetch(),missing=['KAIOUSDT','RIFUSDT','CPOOLUSDT'];
 const fetcher=async(url,...rest)=>{const r=await base(url,...rest),j=await r.json();if(url.includes('/mix/')&&(url.includes('/contracts?')||url.includes('/tickers?')))j.data=j.data.filter(x=>!missing.includes(x.symbol));return Response.json(j);};
 const raw=await acquire('KAIOUSDT',fetcher),s=assemble(raw);assert.equal(s.available,false);assert.equal(s.marketAvailability.PERP.available,false);assert.equal(s.marketAvailability.SPOT.available,true);assert.equal(s.marketAvailability.SPOT.price,103);
 for(const symbol of missing){const row=s.universe.find(x=>x.symbol===symbol);assert.equal(row.available,false);assert.equal(row.price,null);assert.equal(row.markets.SPOT.available,true);}
 assert.equal(s.universe.length,54);assert.equal(s.closed['15m'].length,0);
 const radar=s.radars.find(x=>x.market==='SPOT'&&x.kind==='CICLO');assert.equal(radar.rows.find(x=>x.symbol==='KAIOUSDT').price,103);
});
test('Sin evento, los cuatro perfiles muestran contexto y pendientes sin confirmar una entrada',async()=>{
 const s=assemble(await acquire('BTCUSDT',fakeFetch()));
 for(const p of ['AGRESIVO','MODERADO','CONSERVADOR','ULTRAAGRESIVO']){const r=protocolReadiness(s,'DIARIO',p);assert.equal(r.admission,'VIGILANCIA_SIN_EVENTO');assert.ok(r.keys.K1.evidence.length===3);assert.ok(r.pending.length);assert.equal(r.keys.K3.state,'UNKNOWN');}
 assert.equal(protocolReadiness(s,'TRIMESTRAL','AGRESIVO').keys.K3.state,'NOT_APPLICABLE');
});
test('Calendario BLS convierte invierno/verano de Nueva York y rechaza fechas sin zona',()=>{
 const now=Date.parse('2026-11-01T00:00:00Z');
 const ics='BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:cpi\nDTSTART;TZID=US-Eastern:20261110T083000\nSUMMARY:Consumer Price Index\nEND:VEVENT\nBEGIN:VEVENT\nUID:unknown\nDTSTART:20261111T083000\nSUMMARY:Sin zona\nEND:VEVENT\nEND:VCALENDAR';
 const rows=parseCalendar(ics,now);assert.equal(rows.length,1);assert.equal(rows[0].startsAt,Date.parse('2026-11-10T13:30:00Z'));
 const summer=ics.replaceAll('20261110','20260710');assert.equal(parseCalendar(summer,Date.parse('2026-07-01'))[0].startsAt,Date.parse('2026-07-10T12:30:00Z'));
 assert.throws(()=>parseCalendar('<html>error</html>'),/INVALIDO/);
});
test('RSS admite solo noticias fechadas con enlace oficial y conserva la fecha de publicación',()=>{
 const rss='<rss><item><title>Publicación &amp; datos</title><link>https://www.bls.gov/bls/</link><pubDate>Fri, 06 Nov 2026 08:30:00 -0500</pubDate><description><![CDATA[<p>Datos oficiales</p>]]></description></item><item><title>Ajena</title><link>https://example.com/</link><pubDate>Fri, 06 Nov 2026 08:30:00 -0500</pubDate></item></rss>';
 const rows=parseNews(rss,Date.parse('2026-11-07'));assert.equal(rows.length,1);assert.equal(rows[0].source,'BLS');assert.equal(rows[0].summary,'Datos oficiales');assert.equal(rows[0].published,Date.parse('2026-11-06T13:30:00Z'));
 assert.throws(()=>parseNews('<html>Forbidden</html>'),/INVALIDO/);
});
test('Contexto Fed conserva unidades, componentes y fecha común',()=>{
 const series={WALCL:[{date:'2026-10-28',value:6700000},{date:'2026-11-04',value:6750000}],WTREGEN:[{date:'2026-10-28',value:700000},{date:'2026-11-04',value:750000}],RRPONTSYD:[{date:'2026-10-28',value:50},{date:'2026-11-04',value:40}]};
 const m=fedContext(series,Date.parse('2026-11-07'));assert.equal(m.value.usdBillions,5960);assert.equal(m.value.components.WALCL,6750);assert.equal(m.value.changeBillions,10);assert.equal(m.value.previousDate,'2026-10-28');
});
test('Caída de las fuentes retiene último válido y no adelanta su fecha ni su recepción',async()=>{
 const bucket=new MemoryBucket(),received=Date.now()-3600000;
 await bucket.put('context/latest.json',JSON.stringify({macro:{status:'PARTIAL',value:{date:'2026-11-04',usdBillions:5000},received},calendar:{status:'OK',items:[],received},news:{status:'OK',items:[],received},nextCheck:0}));
 const c=await publicContext(bucket,async()=>new Response('Forbidden',{status:403}));assert.equal(c.macro.status,'STALE');assert.equal(c.macro.received,received);assert.equal(c.macro.value.date,'2026-11-04');assert.equal(c.calendar.received,received);assert.equal(c.errors.length,6);
});
test('Respaldo público conserva relojes y rechaza noticias externas o recepción futura',()=>{
 const now=Date.parse('2026-11-07T12:00:00Z'),received=now-3600000;
 const context={macro:{received,status:'PARTIAL',value:{date:'2026-11-04',usdBillions:5000,scope:'PROXY_USD_FED; NO_LIQUIDEZ_GLOBAL'}},news:{received,status:'OK',items:[{title:'Oficial',link:'https://www.bls.gov/bls/',published:now-86400000},{title:'Ajena',link:'https://example.com/',published:now-1000}]}};
 const valid=validateContextMirror(context,now);assert.equal(valid.macro.received,received);assert.equal(valid.news.items.length,1);assert.equal(valid.macro.transport,'RESPALDO_PUBLICO_GITHUB');
 assert.equal(validateContextMirror({...context,macro:{...context.macro,received:now+60000}},now).macro,undefined);
 assert.equal(validateContextMirror(context,now+14400000).macro.status,'STALE');
});
test('Fallo del proveedor directo permite un respaldo oficial con fecha intacta',async()=>{
 const now=Date.now(),received=now-60000,mirror={macro:{received,status:'PARTIAL',value:{date:new Date(now-3*86400000).toISOString().slice(0,10),usdBillions:5000,scope:'PROXY_USD_FED; NO_LIQUIDEZ_GLOBAL'}}};
 const fetcher=async url=>url.startsWith('https://raw.githubusercontent.com/bebe2020/bot-nuevo/market-data/context.json')?Response.json(mirror):new Response('no',{status:503});
 const context=await publicContext(new MemoryBucket(),fetcher,now);assert.equal(context.macro.received,received);assert.equal(context.macro.value.usdBillions,5000);assert.equal(context.macro.transport,'RESPALDO_PUBLICO_GITHUB');assert.ok(context.errors.length);
});
