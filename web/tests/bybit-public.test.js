import test from 'node:test';
import assert from 'node:assert/strict';
import {assertBybitMarket,bybitPublicRequest,bybitPublicSnapshot,bybitCandles,BYBIT_PUBLIC_BASE} from '../worker/bybit-public.js';

const NOW=1800000000000;
function fixture({empty=false,broken=null}={}){
 const calls=[];
 const fetcher=async(url,options)=>{
  const u=new URL(url),path=u.pathname.split('/').at(-1),market=u.searchParams.get('category');
  calls.push({u,options});
  if(broken===path)return new Response('blocked',{status:503});
  let result;
  if(path==='instruments-info')result={list:empty?[]:[{symbol:'BTCUSDT',quoteCoin:'USDT',status:'Trading',
    contractType:'LinearPerpetual',fundingInterval:480,priceFilter:{tickSize:'0.1'},lotSizeFilter:{qtyStep:'0.001',minOrderQty:'0.001'}}]};
  else if(path==='tickers')result={list:[{symbol:'BTCUSDT',lastPrice:'100',prevPrice24h:'80',price24hPcnt:'0.25',
    turnover24h:'100000',volume24h:'1000',fundingRate:'0.0001',nextFundingTime:String(NOW+3600000),
    highPrice24h:'110',lowPrice24h:'79',openInterest:'200',bid1Price:'99',ask1Price:'101'}]};
  else if(path==='kline')result={list:[[String(NOW-1800000),'90','105','85','100','9','900'],[String(NOW-2700000),'89','96','80','90','8','800']]};
  else if(path==='orderbook')result={s:'BTCUSDT',ts:NOW,b:[['99','2']],a:[['101','3']]};
  else if(path==='recent-trade')result={list:[{execId:'a',side:'Buy',price:'100',size:'0.5',time:String(NOW-1000)}]};
  else if(path==='open-interest')result={list:[{openInterest:'200',timestamp:String(NOW-30000)}]};
  else throw Error('Unexpected '+path);
  assert.equal(market,'linear');return Response.json({retCode:0,retMsg:'OK',result,time:NOW});
 };
 return {fetcher,calls};
}
test('Lista blanca: ningún endpoint privado, símbolo ajeno o mercado arbitrario',async()=>{
 assert.equal(BYBIT_PUBLIC_BASE,'https://api.bybit.com');
 for(const path of ['../v5/order/create','order/create','wallet-balance'])await assert.rejects(()=>bybitPublicRequest(path),/NO_PUBLICO/);
 assert.throws(()=>assertBybitMarket('NOTUSDT','PERP'),/INVALIDO/);
 assert.throws(()=>assertBybitMarket('BTCUSDT','PRIVATE'),/INVALIDO/);
});
test('Bybit PERP: vela ascendente y cerrada; funding y OI con unidades; sin claves',async()=>{
 const {fetcher,calls}=fixture();const s=await bybitPublicSnapshot('BTCUSDT','PERP',fetcher,NOW);
 assert.equal(s.venue,'BYBIT');assert.equal(s.market,'PERP');assert.equal(s.available,true);
 assert.equal(s.ticker.price,100);assert.equal(s.ticker.change24h,0.25);
 assert.equal(s.ticker.fundingRate,0.0001);assert.equal(s.instrument.fundingIntervalHours,8);
 assert.equal(s.openInterest.sizeBase,200);assert.equal(s.candles15m.length,2);
 assert.equal(s.candles15m[0].open,89);assert.equal(s.candles15m.at(-1).close,100);
 assert.ok(s.candles15m.every(x=>x.closed));assert.equal(s.book.asof,NOW);
 assert.equal(s.trades[0].side,'buy');assert.equal(s.accountData,false);assert.equal(s.orders,false);
 assert.ok(calls.every(x=>x.u.origin===BYBIT_PUBLIC_BASE&&x.u.pathname.startsWith('/v5/market/')));
 assert.ok(calls.every(x=>x.options.method==='GET'&&!x.options.headers.Authorization&&!x.u.searchParams.has('api_key')));
});
test('Instrumento ausente no inventa precio ni consulta market depth',async()=>{
 const {fetcher,calls}=fixture({empty:true});const s=await bybitPublicSnapshot('BTCUSDT','PERP',fetcher,NOW);
 assert.equal(s.available,false);assert.equal(s.reason,'SIN_INSTRUMENTO_ACTIVO');assert.equal(calls.length,2);
});
test('Error parcial de libro conserva velas y no presenta profundidad falsa',async()=>{
 const {fetcher}=fixture({broken:'orderbook'});const s=await bybitPublicSnapshot('BTCUSDT','PERP',fetcher,NOW);
 assert.equal(s.book,null);assert.equal(s.candles15m.length,2);assert.ok(s.errors.some(x=>x.startsWith('ORDERBOOK:')));
});
test('Rechaza timestamps duplicados, OHLC corrupto y fallo del proveedor',async()=>{
 assert.throws(()=>bybitCandles([['1','1','2','0.5','1','1','1'],['1','1','2','0.5','1','1','1']],NOW),/REPETIDAS/);
 assert.throws(()=>bybitCandles([['1','2','1','0.5','2','1','1']],NOW),/OHLCV_INVALIDO/);
 const fetcher=async()=>Response.json({retCode:10001,result:{},time:NOW});
 await assert.rejects(()=>bybitPublicRequest('tickers',{category:'linear'},fetcher),/RESPUESTA/);
});
