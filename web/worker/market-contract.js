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
 const valid=quote&&quote.market===row.market&&quote.symbol===row.symbol&&Number.isFinite(quote.ts)&&Number.isFinite(quote.received)&&quote.price>0&&quote.ts<=now+5000&&quote.ts<=quote.received+5000&&quote.received<=now+5000;
 const useQuote=valid&&(!(row.sourceAsOf>0)||quote.ts>=row.sourceAsOf),live=useQuote&&now-quote.ts<=5000&&now-quote.received<=5000;
 const price=useQuote?quote.price:row.price,returnAnchors={...row.returnAnchors},returns={};
 for(const key of ['return3h','return7d','return30d']){const old=marketNumber(row[key]);let anchor=marketNumber(returnAnchors[key]?.price);if(!(anchor>0)&&row.price>0&&old!==null&&old>-100){anchor=row.price/(1+old/100);returnAnchors[key]={price:anchor,method:'REFERENCIA_RECONSTRUIDA_DEL_RETORNO_OBSERVADO',priceAsOf:row.sourceAsOf};}returns[key]=price>0&&anchor>0?(price/anchor-1)*100:row[key]??null;}
 const high=marketNumber(row.discount?.high),low=marketNumber(row.discount?.low),discount=price>0&&high>0&&low!==null?{...row.discount,drawdown:(price/high-1)*100,position:high===low?null:(price-low)/(high-low)*100,priceAsOf:useQuote?quote.ts:row.sourceAsOf}:row.discount;
 const metric=useQuote?quoteMetric(quote,basis):row.changes?.[basis]||(basis==='ROLLING_24H'?{value:marketNumber(row.change)}:{value:marketNumber(row.changeUtc)});
 return {...row,...returns,returnAnchors,discount,price,sourceAsOf:useQuote?quote.ts:row.sourceAsOf,changes:useQuote?quote.changes:row.changes,change:useQuote?marketNumber(quoteMetric(quote,'ROLLING_24H').value):row.change,volume:useQuote&&marketNumber(quote.volume)!==null?quote.volume:row.volume,oiBase:live&&marketNumber(quote.oiBase)!==null?quote.oiBase:row.oiBase,oiAsOf:live&&marketNumber(quote.oiBase)!==null?quote.ts:row.sourceAsOf,fundingRate:live&&marketNumber(quote.fundingRate)!==null?quote.fundingRate:row.fundingRate,high24h:live&&quote.high24h>0?quote.high24h:row.high24h,low24h:live&&quote.low24h>0?quote.low24h:row.low24h,displayChange:marketNumber(metric?.value),displayAsOf:useQuote?quote.ts:row.sourceAsOf,displaySource:useQuote?quote.source:'CAPTURA',displayFresh:!!live,changeBasis:basis,changeStatus:metric?.status||'UNKNOWN'};
}
