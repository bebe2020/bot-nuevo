// Radar causal de eventos de liquidez. Observaciones: no crea ni ejecuta órdenes.
import {closed,endOfBar,atr,ema} from './engine.js';
import {marketCapTier} from './trading-lanes.js';
const TF='15m',PERIOD=900000;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const incomplete=(symbol,market,reason,status='UNKNOWN')=>({symbol,market,status,reason,event:'SIN_EVIDENCIA',side:null,isTradeSignal:false});
const nearest=(array,price,side)=>{
 const levels=array.filter(finite).filter(x=>side==='LONG'?x>price:x<price).sort((a,b)=>Math.abs(a-price)-Math.abs(b-price));
 return levels.length?levels[0]:null;
};
export function evaluateHunt(row,{market='PERP',now=Date.now(),quote=null,capUsd=null,capAsOf=null}={}){
 const symbol=row?.symbol||'SIN_SIMBOLO';
 if(!['PERP','SPOT'].includes(market)||row?.market&&row.market!==market)return incomplete(symbol,market,'MERCADOS_NO_COMPATIBLES');
 if(!row?.available)return incomplete(symbol,market,row?.reason||'INSTRUMENTO_NO_ACTIVO','UNAVAILABLE');
 const src=row.bars?.ok?row.bars:row.frames?.['15m'];
 if(!src?.ok||!Array.isArray(src.data))return incomplete(symbol,market,src?.error||'OHLCV_15M_AUSENTES');
 let bars;
 try{bars=closed(src.data,TF,now);}catch{return incomplete(symbol,market,'OHLCV_CON_HUECOS_O_INVALIDAS');}
 if(bars.length<32)return incomplete(symbol,market,'SE_NECESITAN_32_VELAS_CERRADAS');
 const last=bars.at(-1),asof=endOfBar(last[0],TF);
 if(asof>now||now-asof>PERIOD+60000)return {...incomplete(symbol,market,'VELAS_15M_VENCIDAS','STALE'),asof};
 const history=bars.slice(-13,-1),longHistory=bars.slice(0,-1);
 const priorHigh=Math.max(...history.map(x=>x[2])),priorLow=Math.min(...history.map(x=>x[3]));
 const volumeReference=bars.slice(-25,-1).reduce((s,x)=>s+x[5],0)/24;
 const rvol=volumeReference>0?last[5]/volumeReference:null;
 const highSweep=last[2]>priorHigh&&last[4]<priorHigh;
 const lowSweep=last[3]<priorLow&&last[4]>priorLow;
 let event='SIN_EVENTO',side=null;
 if(highSweep&&lowSweep)event='DOBLE_BARRIDO_AMBIGUO';
 else if(lowSweep){event='BARRIDO_SSL_Y_RECUPERACION';side='LONG';}
 else if(highSweep){event=market==='SPOT'?'BARRIDO_BSL_SPOT_VIGILAR_SALIDAS':'BARRIDO_BSL_Y_RECHAZO';side=market==='SPOT'?null:'SHORT';}
 else if(last[4]>priorHigh){event='RUPTURA_ALCISTA_SIN_RETESTEO';side='LONG';}
 else if(last[4]<priorLow){event=market==='SPOT'?'RUPTURA_BAJISTA_SPOT_NO_SHORT':'RUPTURA_BAJISTA_SIN_RETESTEO';side=market==='SPOT'?null:'SHORT';}
 const a=atr(bars,14),buffer=finite(a)?a*.1:0;
 const stop=side==='LONG'?last[3]-buffer:side==='SHORT'?last[2]+buffer:null;
 const entryReference=side?last[4]:null;
 const observedPool=side==='LONG'?nearest(longHistory.map(x=>x[2]),last[4],side):side==='SHORT'?nearest(longHistory.map(x=>x[3]),last[4],side):null;
 const unitRisk=side?Math.abs(entryReference-stop):null;
 const rr=side&&observedPool!==null&&unitRisk>0?Math.abs(observedPool-entryReference)/unitRisk:null;
 const freshQuote=quote?.market===market&&quote.symbol===symbol&&finite(quote.ts)&&finite(quote.received)&&quote.ts<=now+5000&&now-quote.ts<=5000&&now-quote.received<=5000&&finite(quote.price)&&quote.price>0;
 const livePrice=freshQuote?quote.price:null;
 const broken=side&&livePrice!==null&&(side==='LONG'?livePrice<=stop:livePrice>=stop);
 const capValid=finite(capUsd)&&capUsd>0&&finite(capAsOf)&&capAsOf<=now&&now-capAsOf<=86400000;
 const reasons=[];
 if(event==='SIN_EVENTO')reasons.push('ESPERANDO_BARRIDO_O_RUPTURA');
 if(!side)reasons.push('SIN_ENTRADA_ADMISIBLE_EN_ESTE_MERCADO');
 if(rvol===null)reasons.push('RVOL_DESCONOCIDO');
 else if(rvol<1.3)reasons.push('RVOL_SIN_EXPANSION');
 if(!freshQuote)reasons.push('COTIZACION_NO_CONFIRMADA_5S');
 if(!capValid)reasons.push('CAPITALIZACION_NO_VERIFICADA');
 if(observedPool===null&&side)reasons.push('PISCINA_OBJETIVO_NO_LOCALIZADA');
 if(rr!==null&&rr<1)reasons.push('ASIMETRIA_MENOR_1R_ANTES_DE_COSTES');
 if(broken)reasons.push('INVALIDACION_OBSERVADA');
 reasons.push('DOM_OI_CVD_Y_FILLS_NO_CERTIFICADOS');
 const status=broken?'INVALIDATED':side&&rvol!==null&&rvol>=1.3?'CANDIDATO_EN_OBSERVACION':'OBSERVATION';
 const htf=(()=>{
  try{const hourly=row.frames?.['1H'];if(!hourly?.ok)return 'N/D';
   const h=closed(hourly.data,'1H',now);
   if(h.length<22||now-endOfBar(h.at(-1)[0],'1H')>3660000)return 'N/D';
   const mean=ema(h.map(x=>x[4]),21),price=h.at(-1)[4];return price>mean?'1H_SOBRE_EMA21':price<mean?'1H_BAJO_EMA21':'1H_EN_EMA21';
  }catch{return 'N/D';}
 })();
 return {symbol,market,status,event,side,asof,source:'BITGET_OHLCV_15M_CERRADAS',isTradeSignal:false,
   priceAtClose:last[4],livePrice,priorHigh,priorLow,sweepHigh:last[2],sweepLow:last[3],rvol,
   entryReference,stopReference:stop,oppositeObservedLiquidity:observedPool,rrGrossBeforeCosts:rr,
   htf,capTier:marketCapTier(capValid?capUsd:null).tier,capUsd:capValid?capUsd:null,
   reasons,method:'BARRIDO_DE_12_VELAS_CON_RECLAIM/RECHAZO; NIVELES_DESCRIPTIVOS_NO_ORDEN',
   nextAction:side==='LONG'?'Esperar retesteo y defensa, después validar L2/OI/costes.':side==='SHORT'?'Esperar retesteo fallido y validar L2/OI/costes.':'No abrir posición por esta lectura.'};
}
export function liquidityHuntRadar(raw,{market=raw?.market,now=Date.now(),providerAssets=[],getQuote=()=>null}={}){
 if(!raw||raw.market!==market||!['SPOT','PERP'].includes(market))return {status:'BLOCKED',reason:'MERCADO_SIN_SEPARACION',items:[]};
 const assets=new Map(providerAssets.map(x=>[x.symbol,x]));
 const rows=Array.isArray(raw.rows)?raw.rows:[];
 const items=rows.map(row=>{
  const cap=assets.get(row.symbol)||{};
  return evaluateHunt({...row,market},{market,now,quote:getQuote(row.symbol,market),capUsd:cap.marketCap,capAsOf:cap.marketAsOf});
 }).sort((a,b)=>Number(b.status==='CANDIDATO_EN_OBSERVACION')-Number(a.status==='CANDIDATO_EN_OBSERVACION')||
  Number(b.event!=='SIN_EVENTO'&&b.event!=='SIN_EVIDENCIA')-Number(a.event!=='SIN_EVENTO'&&a.event!=='SIN_EVIDENCIA')||
  (b.rvol||0)-(a.rvol||0));
 return {status:rows.length?'OBSERVATION':'UNKNOWN',market,coverage:items.length,
  candidates:items.filter(x=>x.status==='CANDIDATO_EN_OBSERVACION').length,
  unknown:items.filter(x=>['UNKNOWN','STALE','UNAVAILABLE'].includes(x.status)).length,
  items,realOrdersEnabled:false};
}
