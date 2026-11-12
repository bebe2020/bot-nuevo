import test from 'node:test';
import assert from 'node:assert/strict';
import {RefreshCoordinator} from '../worker/refresh.js';
import {analyticsFetch,connectorStatus} from '../worker/connectors.js';
import {macroProvider} from '../worker/macro.js';
import {sosoProvider} from '../worker/sosovalue.js';
import {MemoryBucket} from './fixtures.js';

test('El ciclo comparte una consulta, conserva su fecha y consulta de nuevo al vencer',async()=>{
 let now=1000,calls=0,resolve;const c=new RefreshCoordinator({clock:()=>now});
 const load=()=>{calls++;return new Promise(r=>resolve=r);};
 const a=c.run('soso',load,{ttl:100}),b=c.run('soso',load,{ttl:100});
 await Promise.resolve();assert.equal(calls,1);resolve({status:'PARTIAL',asof:12});
 assert.equal((await a).asof,12);assert.equal((await b).asof,12);
 now=1050;assert.equal((await c.run('soso',load)).asof,12);assert.equal(calls,1);
 now=1101;const next=c.run('soso',async()=>{calls++;return {status:'OK',asof:13};});await next;assert.equal(calls,2);
});
test('Un fallo reintenta solo su recurso y no bloquea el resto ni duplica un forzado en vuelo',async()=>{
 let now=0;const c=new RefreshCoordinator({clock:()=>now,concurrency:1});
 const results=await Promise.allSettled([c.run('fallo',async()=>{throw Error('no disponible');}),c.run('macro',async()=>({status:'OK'}))]);
 assert.equal(results[0].status,'rejected');assert.equal(results[1].value.status,'OK');
 assert.equal(c.snapshot().find(x=>x.id==='fallo').nextCheck,30000);
 now=30001;await c.run('fallo',async()=>({status:'OK'}));assert.equal(c.snapshot().find(x=>x.id==='fallo').runs,2);
});
test('Las peticiones de distintos activos conservan identidad y límite de concurrencia',async()=>{
 const c=new RefreshCoordinator({concurrency:2}),releases=[];let running=0,max=0;
 const load=id=>async()=>{running++;max=Math.max(max,running);await new Promise(r=>releases.push(()=>{running--;r();}));return {symbol:id};};
 const a=c.run('onchain:A',load('A')),b=c.run('onchain:B',load('B')),d=c.run('onchain:C',load('C'));
 await Promise.resolve();assert.equal(running,2);releases.shift()();await a;await Promise.resolve();assert.equal(running,2);
 releases.shift()();releases.shift()();assert.equal((await b).symbol,'B');assert.equal((await d).symbol,'C');assert.equal(max,2);
});
test('La clave CoinGecko se envía solo al dominio exacto y nunca sigue una redirección',async()=>{
 const calls=[],f=analyticsFetch({COINGECKO_API_KEY:'fixture-secret'},async(url,options)=>{calls.push({url,options});return Response.json({});});
 await f('https://api.coingecko.com/api/v3/global');await f('https://api.coingecko.com.other.test/api/v3/global');
 assert.equal(calls[0].options.headers.get('x-cg-demo-api-key'),'fixture-secret');assert.equal(calls[1].options.headers.has('x-cg-demo-api-key'),false);assert.ok(calls.every(c=>c.options.redirect==='manual'&&!c.url.includes('fixture-secret')));
});
test('El diagnóstico interpreta rechazo lógico HTTP200 sin exponer claves ni cuerpo',async()=>{
 const value=await connectorStatus({COINGLASS_API_KEY:'fixture-secret'},async()=>Response.json({code:'401',msg:'denied'}),1000);
 assert.equal(value.providers.find(x=>x.id==='COINGLASS').status,'AUTH_REQUIRED');assert.equal(value.providers.find(x=>x.id==='FRED').status,'CONFIG_REQUIRED');assert.ok(!JSON.stringify(value).includes('fixture-secret'));
});
test('FRED autenticado mantiene negativos, fechas y unidades sin guardar la clave',async()=>{
 const now=Date.UTC(2026,10,12),bucket=new MemoryBucket(),calls=[];
 const fetcher=async url=>{calls.push(url);assert.equal(new URL(url).hostname,'api.stlouisfed.org');return Response.json({observations:[{date:'2026-11-10',value:'-0.5'},{date:'2026-11-11',value:'-0.4'}]});};
 const value=await macroProvider(bucket,fetcher,now,{preferMirror:false,apiKey:'fixture-secret'});
 assert.equal(calls.length,20);assert.equal(value.metrics.find(x=>x.id==='NFCI').value,-.4);assert.equal(value.metrics[0].asof,Date.UTC(2026,10,11));
 assert.ok([...bucket.objects.values()].every(x=>!x.text.includes('fixture-secret')));
});
test('Un error lógico SoSoValue detiene la tanda aunque HTTP sea200',async()=>{
 let count=0;const value=await sosoProvider(new MemoryBucket(),'fixture-secret',async()=>{count++;return Response.json({code:401,message:'denied',data:null});});
 assert.equal(value.status,'AUTH_REQUIRED');assert.equal(count,1);assert.equal(value.coverage.observed,0);
});
test('Compatibilidad Worker: modo manual y redirección rechazada antes de otra petición',async()=>{
 let calls=0;const workerFetch=async(url,options)=>{
  if(!['follow','manual',undefined].includes(options.redirect))throw new TypeError('Invalid redirect value');
  assert.equal(options.redirect,'manual');calls++;return new Response('',{status:302,headers:{Location:'https://other.test/'}});
 };
 const value=await connectorStatus({SOSOVALUE_API_KEY:'fixture-secret'},workerFetch);
 assert.equal(calls,1);assert.equal(value.providers.find(x=>x.id==='SOSOVALUE').status,'ERROR');
 assert.equal(value.providers.find(x=>x.id==='SOSOVALUE').http,302);
});
