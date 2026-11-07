// Un mismo retorno y reloj alimentan texto, orden, color y mapa de calor.
export const CHANGE_BASES={ROLLING_24H:'24 h móviles',UTC_DAY:'Hoy desde 00:00 UTC'};
export const marketNumber=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
export function priceChanges(ticker,market='PERP'){
 const price=marketNumber(ticker.lastPr??ticker.lastPrice??ticker.price),rollingOpen=marketNumber(ticker.open24h??(market==='SPOT'?ticker.open:null)),utcOpen=marketNumber(ticker.openUtc);
 const metric=(reported,anchor,method)=>{
  reported=marketNumber(reported);const calculated=price>0&&anchor>0?price/anchor-1:null;
  return {value:calculated??reported,anchor,reported,method:calculated!==null?'PRECIO_DIVIDIDO_POR_APERTURA':method,
   status:calculated===null&&reported===null?'UNKNOWN':calculated!==null&&reported!==null&&Math.abs(calculated-reported)>.0002?'CONFLICT':'OK'};
 };
 return {ROLLING_24H:metric(ticker.change24h??ticker.price24hPcnt,rollingOpen,'RETORNO_24H_DEL_EXCHANGE'),UTC_DAY:metric(ticker.changeUtc24h,utcOpen,'RETORNO_DESDE_UTC_DEL_EXCHANGE')};
}
export function quoteMetric(quote,basis='ROLLING_24H'){
 return quote?.changes?.[basis]||{value:basis==='ROLLING_24H'?marketNumber(quote?.change):null,status:'UNKNOWN',method:'SIN_REFERENCIA'};
}
export function returnTone(value){const v=marketNumber(value);return v===null||v===0?'quiet':v>0?'good':'bad';}
export function unifiedRow(row,quote,basis='ROLLING_24H',now=Date.now()){
 const live=quote&&quote.market===row.market&&quote.symbol===row.symbol&&quote.ts<=now+5000&&now-quote.ts<=5000&&now-quote.received<=5000;
 const metric=live?quoteMetric(quote,basis):row.changes?.[basis]||(basis==='ROLLING_24H'?{value:marketNumber(row.change)}:{value:marketNumber(row.changeUtc)});
 return {...row,price:live?quote.price:row.price,oiBase:live&&marketNumber(quote.oiBase)!==null?quote.oiBase:row.oiBase,oiAsOf:live&&marketNumber(quote.oiBase)!==null?quote.ts:row.sourceAsOf,fundingRate:live&&marketNumber(quote.fundingRate)!==null?quote.fundingRate:row.fundingRate,high24h:live&&quote.high24h>0?quote.high24h:row.high24h,low24h:live&&quote.low24h>0?quote.low24h:row.low24h,displayChange:marketNumber(metric?.value),displayAsOf:live?quote.ts:row.sourceAsOf,displaySource:live?quote.source:'CAPTURA',displayFresh:!!live,changeBasis:basis,changeStatus:metric?.status||'UNKNOWN'};
}
