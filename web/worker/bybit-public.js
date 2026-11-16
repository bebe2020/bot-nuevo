import {SYMBOLS} from './universe.js';

// Mercado público de Bybit V5, aislado de credenciales y de órdenes.
// No reutilizar estas respuestas como prueba de saldo, posición ni fill personal.
export const BYBIT_PUBLIC_BASE='https://api.bybit.com';
const PUBLIC_ENDPOINTS=new Set(['instruments-info','tickers','kline','orderbook','recent-trade','open-interest']);
const num=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
const fail=(where,code)=>{throw Error('BYBIT_PUBLIC_'+where+'_'+String(code).slice(0,30));};
export function assertBybitMarket(symbol,market){
 if(!SYMBOLS.includes(symbol)||!['SPOT','PERP'].includes(market))throw Error('BYBIT_MERCADO_O_SIMBOLO_INVALIDO');
 return market==='SPOT'?'spot':'linear';
}
export async function bybitPublicRequest(endpoint,params={},fetcher=fetch){
 if(!PUBLIC_ENDPOINTS.has(endpoint))throw Error('BYBIT_ENDPOINT_NO_PUBLICO');
 const u=new URL(BYBIT_PUBLIC_BASE+'/v5/market/'+endpoint);
 for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null)u.searchParams.set(key,String(value));
 const response=await fetcher(u.href,{method:'GET',redirect:'manual',headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
 if(!response.ok)fail('HTTP',response.status);
 const body=await response.json();
 if(body?.retCode!==0||!body.result||!Number.isFinite(Number(body.time)))fail('RESPUESTA',body?.retCode??'INVALIDA');
 return {result:body.result,serverTime:Number(body.time)};
}
export function bybitTicker(t,serverTime,market){
 const price=num(t?.lastPrice),timestamp=num(serverTime),symbol=t?.symbol;
 if(!symbol||!(price>0)||!Number.isInteger(timestamp))throw Error('BYBIT_TICKER_INVALIDO');
 const prev=num(t.prevPrice24h),reported=num(t.price24hPcnt);
 return {symbol,market,price,asof:timestamp,change24h:prev>0?price/prev-1:reported,
  high24h:num(t.highPrice24h),low24h:num(t.lowPrice24h),turnover24hUSDT:num(t.turnover24h),
  volume24hBase:num(t.volume24h),markPrice:market==='PERP'?num(t.markPrice):null,
  fundingRate:market==='PERP'?num(t.fundingRate):null,
  nextFundingTime:market==='PERP'?num(t.nextFundingTime):null,
  openInterestBase:market==='PERP'?num(t.openInterest):null,
  bid:num(t.bid1Price),ask:num(t.ask1Price)};
}
export function bybitCandles(list,now=Date.now()){
 if(!Array.isArray(list))throw Error('BYBIT_VELAS_INVALIDAS');
 const rows=list.map(r=>{
  const a=r.slice(0,7).map(num);
  if(a.length!==7||a.some(x=>x===null)||!Number.isInteger(a[0])||a[0]<0||a[1]<=0||a[2]<Math.max(a[1],a[4])||a[3]>Math.min(a[1],a[4])||a[5]<0||a[6]<0)throw Error('BYBIT_OHLCV_INVALIDO');
  return a;
 }).sort((a,b)=>a[0]-b[0]);
 if(rows.some((r,i)=>i>0&&r[0]<=rows[i-1][0]))throw Error('BYBIT_VELAS_REPETIDAS');
 return rows.map(r=>({start:r[0],open:r[1],high:r[2],low:r[3],close:r[4],volumeBase:r[5],turnoverUSDT:r[6],closed:r[0]+900000<=now}));
}
export async function bybitPublicSnapshot(symbol='BTCUSDT',market='PERP',fetcher=fetch,now=Date.now()){
 const category=assertBybitMarket(symbol,market);
 const args={category,symbol};
 const [instruments,tickers]=await Promise.all([
  bybitPublicRequest('instruments-info',args,fetcher),
  bybitPublicRequest('tickers',args,fetcher)
 ]);
 const instrument=instruments.result.list?.find(x=>x.symbol===symbol&&x.quoteCoin==='USDT'&&x.status==='Trading'&&(market==='SPOT'||x.contractType==='LinearPerpetual'));
 if(!instrument)return {venue:'BYBIT',market,symbol,available:false,asof:tickers.serverTime,reason:'SIN_INSTRUMENTO_ACTIVO',accountData:false,orders:false};
 const t=tickers.result.list?.find(x=>x.symbol===symbol);
 if(!t)throw Error('BYBIT_TICKER_NO_DISPONIBLE');
 const ticker=bybitTicker(t,tickers.serverTime,market);
 const requests=[
  bybitPublicRequest('kline',{...args,interval:'15',limit:200},fetcher),
  bybitPublicRequest('orderbook',{...args,limit:50},fetcher),
  bybitPublicRequest('recent-trade',{...args,limit:market==='SPOT'?60:100},fetcher),
  market==='PERP'?bybitPublicRequest('open-interest',{...args,intervalTime:'5min',limit:2},fetcher):Promise.resolve(null)
 ];
 const results=await Promise.allSettled(requests);
 const asData=(i)=>results[i].status==='fulfilled'?results[i].value:null;
 const errors=results.flatMap((r,i)=>r.status==='rejected'?[['KLINE','ORDERBOOK','TRADES','OPEN_INTEREST'][i]+': '+String(r.reason?.message||r.reason).slice(0,80)]:[]);
 let candles=null;
 try{if(asData(0))candles=bybitCandles(asData(0).result.list,now);}catch(e){errors.push(String(e.message));}
 const b=asData(1)?.result;
 const book=b&&Array.isArray(b.b)&&Array.isArray(b.a)?{asof:num(b.ts),bids:b.b,asks:b.a}:null;
 const trades=asData(2)?.result?.list?.map(x=>({id:x.execId,price:num(x.price),sizeBase:num(x.size),side:x.side==='Buy'?'buy':x.side==='Sell'?'sell':'unknown',asof:num(x.time)}))??null;
 const openInterest=market==='PERP'?(asData(3)?.result?.list?.[0]||null):null;
 const info={tickSize:num(instrument.priceFilter?.tickSize),qtyStep:num(instrument.lotSizeFilter?.qtyStep??instrument.lotSizeFilter?.basePrecision),
  minQty:num(instrument.lotSizeFilter?.minOrderQty),fundingIntervalHours:market==='PERP'&&num(instrument.fundingInterval)>0?num(instrument.fundingInterval)/60:null};
 return {venue:'BYBIT',market,symbol,available:true,asof:tickers.serverTime,received:now,stale:Math.abs(now-ticker.asof)>20000,
  ticker,candles15m:candles,book,trades,openInterest:openInterest?{sizeBase:num(openInterest.openInterest),asof:num(openInterest.timestamp)}:null,
  instrument:info,errors,accountData:false,orders:false,auth:'NO_REQUERIDA',source:'BYBIT_V5_PUBLIC'};
}
