import test from 'node:test';
import assert from 'node:assert/strict';
import {ASSETS} from '../worker/universe.js';
import {normalizeDimension,dimensionFor,cryptoGlobalFacts,ageCryptoGlobal,buildFundamentalAssets,ageFundamentals,FUNDAMENTAL_CATALOG} from '../worker/fundamental-facts.js';
import {fundamentalsProvider,validateFundamentalMirror} from '../worker/fundamentals.js';
import {integralConfluence} from '../worker/integral.js';
import {MemoryBucket} from './fixtures.js';

const NOW=Date.UTC(2026,10,12,15),DAY=86400000;
const provider=()=>({defi:{status:'OK',received:NOW,assets:[{symbol:'AAVEUSDT',name:'Aave',marketCap:1000,fdv:2000,circulatingSupply:100,totalSupply:200,maxSupply:null,marketAsOf:NOW-1000,received:NOW,principalTVL:9000,protocols:[{id:'1599',slug:'aave-v3',name:'Aave V3',url:'https://defillama.com/protocol/aave-v3'},{id:'111',slug:'aave-v2',name:'Aave V2'}]}]}});
const payload=rows=>({protocols:rows});
const row=(extra={})=>({defillamaId:'1599',slug:'aave-v3',name:'Aave V3',protocolType:'protocol',total24h:100,total7d:700,...extra});
const reports=()=>Object.fromEntries(['fees','revenue','dexs'].map(kind=>[kind,normalizeDimension(payload([row()]),kind,NOW)]));
const get=(snapshot,symbol,id)=>snapshot.assets.find(x=>x.symbol===symbol).facts.find(x=>x.id===id);
const globalPayload=()=>({data:{updated_at:(NOW-1000)/1000,total_market_cap:{usd:1000},total_volume:{usd:200},market_cap_percentage:{btc:60,eth:10},market_cap_change_percentage_24h_usd:-2,fear_and_greed_index:{value:34}}});

test('Dominancia conserva puntos porcentuales y las capitalizaciones derivadas no son TOTAL2/3 oficiales',()=>{
 const g=cryptoGlobalFacts(globalPayload(),NOW);
 assert.equal(g.btcDominancePct,60);assert.equal(g.exBtcUSD,400);assert.ok(Math.abs(g.exBtcEthUSD-300)<1e-10);
 assert.equal(g.change24hPct,-2);assert.equal(g.fearGreed,34);assert.match(g.method,/NO_INDICES_OFICIALES/);
});
test('Global rechaza tiempo futuro, porcentajes incompatibles y capitalización ausente',()=>{
 for(const edit of [x=>x.data.updated_at=(NOW+1000)/1000,x=>x.data.market_cap_percentage.eth=60,x=>x.data.total_market_cap.usd=null]){
  const x=globalPayload();edit(x);assert.throws(()=>cryptoGlobalFacts(x,NOW));
 }
});
test('Comisiones se vinculan por ID y slug: homónimo y padre no se suman a Aave V3',()=>{
 const a=provider().defi.assets[0],report=normalizeDimension(payload([row({defillamaId:'parent#aave',slug:'aave',total24h:999}),row({defillamaId:'bad',total24h:888}),row(),row({defillamaId:'111',slug:'aave-v2',total24h:222})]),'fees',NOW);
 const selected=dimensionFor(a,report);assert.equal(selected.total24h,100);assert.equal(selected.id,'1599');
 assert.equal(dimensionFor({...a,protocols:[{id:'1599',slug:'another-protocol'}]},report),null);
});
test('Fees de Bitcoin se rotulan como red nativa y no como ingreso del tenedor',()=>{
 const a={symbol:'BTCUSDT',protocols:[],chain:{name:'Bitcoin'}};
 const report=normalizeDimension(payload([row({defillamaId:'chain#bitcoin',slug:'bitcoin',name:'Bitcoin',protocolType:'chain'})]),'fees',NOW);
 assert.match(dimensionFor(a,report).scope,/RED_NATIVA/);
 assert.equal(dimensionFor({...a,chain:{name:'Ethereum'}},report),null);
});
test('Hyperliquid separa TVL del bridge y fees de Perps sin sumar versiones',()=>{
 const p=provider();p.defi.assets[0].protocols=[{id:'4481',slug:'hyperliquid-bridge',name:'Bridge'},{id:'5507',slug:'hyperliquid-perps',name:'Perps'}];
 const d=reports();d.fees=normalizeDimension(payload([row({defillamaId:'5507',slug:'hyperliquid-perps',name:'Hyperliquid Perps',total24h:123})]),'fees',NOW);
 const s=ageFundamentals({assets:buildFundamentalAssets(p.defi,d)},NOW),a=s.assets.find(x=>x.symbol==='AAVEUSDT');
 assert.equal(a.protocol.id,'4481');assert.equal(a.matched.fees.id,'5507');assert.equal(get(s,'AAVEUSDT','FEES_24H').value,123);
 assert.equal(get(s,'AAVEUSDT','FEES_24H').entity.name,'Hyperliquid Perps');
});
test('Volumen de Hyperliquid conserva mercado, unidad y recepción sin fingir Bitget',()=>{
 const hyper={status:'OK',received:NOW,rows:[{symbol:'AAVEUSDT',available:true,volumeUSD:987,received:NOW}]};
 const s=ageFundamentals({assets:buildFundamentalAssets(provider().defi,reports(),hyper)},NOW),f=get(s,'AAVEUSDT','PERP_VOLUME_24H');
 assert.equal(f.value,987);assert.equal(f.market,'PERP_USDC');assert.equal(f.venue,'HYPERLIQUID');assert.equal(f.state,'PARTIAL');
});
test('Cero reportado es cero; null no se vuelve cero y una fecha no informada queda explícita',()=>{
 const d=reports();d.fees=normalizeDimension(payload([row({total24h:0,total7d:null})]),'fees',NOW);
 const s=ageFundamentals({assets:buildFundamentalAssets(provider().defi,d)},NOW);
 assert.equal(get(s,'AAVEUSDT','FEES_24H').value,0);assert.equal(get(s,'AAVEUSDT','FEES_24H').state,'PARTIAL');
 assert.equal(get(s,'AAVEUSDT','FEES_24H').asof,null);assert.equal(get(s,'AAVEUSDT','FEES_7D').value,null);
 assert.equal(get(s,'AAVEUSDT','FEES_7D').state,'UNKNOWN');
});
test('Oferta, dilución y cobertura conservan las 54 identidades y fuentes diferentes',()=>{
 const s=ageFundamentals({assets:buildFundamentalAssets(provider().defi,reports())},NOW);
 assert.equal(s.assets.length,54);assert.equal(s.coverage.total,54*14);assert.equal(FUNDAMENTAL_CATALOG.length,14);
 assert.equal(get(s,'AAVEUSDT','CIRCULATING_PCT').value,50);assert.equal(get(s,'AAVEUSDT','DILUTION_RATIO').value,2);
 assert.equal(get(s,'AAVEUSDT','MAX_SUPPLY').state,'UNKNOWN');
 assert.equal(get(s,'KAIOUSDT','MARKET_CAP').value,null);assert.equal(get(s,'RIFUSDT','FEES_24H').value,null);
});
test('Circulante mayor que total no genera una relación aparentemente válida',()=>{
 const p=provider();p.defi.assets[0].circulatingSupply=300;
 const s=ageFundamentals({assets:buildFundamentalAssets(p.defi,reports())},NOW);
 assert.equal(get(s,'AAVEUSDT','CIRCULATING_PCT').value,null);assert.equal(get(s,'AAVEUSDT','CIRCULATING').value,300);
});
test('Caducidad usa la fecha propia o la recepción declarada, sin renovarlas al servir',()=>{
 const s={assets:buildFundamentalAssets(provider().defi,reports()),global:cryptoGlobalFacts(globalPayload(),NOW)};
 const aged=ageFundamentals(s,NOW+3*3600000);
 assert.equal(get(aged,'AAVEUSDT','FEES_24H').state,'STALE');assert.equal(get(aged,'AAVEUSDT','MARKET_CAP').state,'OK');
 assert.equal(get(aged,'AAVEUSDT','FEES_24H').received,NOW);assert.equal(aged.global.status,'STALE');
});
test('Dominancia cacheada vence también en el panorama sin alterar fecha ni recepción',()=>{
 const g=cryptoGlobalFacts(globalPayload(),NOW),old=ageCryptoGlobal(g,NOW+3*3600000);
 assert.equal(old.status,'STALE');assert.equal(old.received,NOW);assert.equal(old.asof,NOW-1000);assert.equal(g.status,'OK');
});
test('Un estado UNKNOWN no se promueve a OK por conservar un valor numérico',()=>{
 const x=mirror();x.assets.find(a=>a.symbol==='AAVEUSDT').facts.find(f=>f.id==='MARKET_CAP').state='UNKNOWN';
 const s=ageFundamentals(x,NOW);assert.equal(get(s,'AAVEUSDT','MARKET_CAP').state,'UNKNOWN');assert.equal(get(s,'AAVEUSDT','MARKET_CAP').value,null);
});
function mirror(){return {version:'fundamentals-1',accountData:false,checkedAt:NOW,assets:buildFundamentalAssets(provider().defi,reports()),global:cryptoGlobalFacts(globalPayload(),NOW),reports:reports()};}
test('Espejo rechaza universo duplicado, relojes futuros y enlaces externos',()=>{
 const x=mirror();assert.equal(validateFundamentalMirror(x,NOW),x);
 const duplicate=structuredClone(x);duplicate.assets[1]=duplicate.assets[0];assert.throws(()=>validateFundamentalMirror(duplicate,NOW));
 const future=structuredClone(x);future.assets[0].facts[0].received=NOW+1;assert.throws(()=>validateFundamentalMirror(future,NOW));
 const link=structuredClone(x);link.assets[0].facts[0].source='https://attacker.invalid';assert.throws(()=>validateFundamentalMirror(link,NOW));
});
test('Confluencia no presenta métricas positivas como K4 PASS ni rentabilidad certificada',()=>{
 const r=integralConfluence({symbol:'AAVEUSDT',fundamentals:mirror(),evaluation:{admission:'CONFIRMADA'}},NOW);
 assert.equal(r.keys.K4.state,'UNKNOWN');assert.ok(r.keys.K4.coverage.observed>0);assert.ok(r.keys.K4.missing.includes('UNLOCKS_FECHADOS'));
 assert.match(r.note,/no certifica/);
});
test('Servidor consume espejo reciente sin peticiones a proveedores ni retimbrar sus datos',async()=>{
 const calls=[],x=mirror();x.checkedAt=NOW-1000;
 const s=await fundamentalsProvider(null,async url=>{calls.push(url);return Response.json(x);},NOW);
 assert.equal(calls.length,1);assert.match(calls[0],/fundamentals.json/);assert.equal(s.assets.length,54);
 assert.equal(get(s,'AAVEUSDT','MARKET_CAP').asof,NOW-1000);
});
test('Capturador consulta fuentes primarias aunque exista un espejo reciente',async()=>{
 const calls=[],fetcher=async url=>{calls.push(url);return url.includes('fundamentals.json')?Response.json(mirror()):url.includes('coingecko')?Response.json(globalPayload()):Response.json(payload([row()]));};
 const s=await fundamentalsProvider(null,fetcher,NOW,{preferMirror:false,providers:provider()});
 assert.equal(calls.filter(x=>x.includes('api.llama.fi')).length,3);assert.equal(s.reports.fees.received,NOW);
});
test('Fallo de fuente conserva datos antiguos como STALE con su reloj anterior',async()=>{
 const bucket=new MemoryBucket(),old=mirror();old.nextCheck=0;await bucket.put('providers/fundamentals-v1.json',JSON.stringify(old));
 const s=await fundamentalsProvider(bucket,async()=>new Response('error',{status:503}),NOW+60000,{preferMirror:false,providers:provider()});
 assert.equal(get(s,'AAVEUSDT','FEES_24H').state,'STALE');assert.equal(get(s,'AAVEUSDT','FEES_24H').received,NOW);
 assert.equal(s.global.status,'STALE');
});
