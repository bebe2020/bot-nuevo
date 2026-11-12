import {n} from './engine.js';
import {quoteMetric,unifiedRow} from './market-contract.js';

const sideSign=x=>x==='LONG'?1:x==='SHORT'?-1:x==='RANGE'?0:null;
const autoMedian=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);return a.length?(a.length%2?a[Math.floor(a.length/2)]:(a[a.length/2-1]+a[a.length/2])/2):null;};
export function directionalReading(row,horizon,protocols,sectors,allRows){
 const p=protocols[horizon],frames=p.frames.map(tf=>({tf,...row.frames?.[tf]})),known=frames.filter(x=>x.status==='OK').map(x=>sideSign(x.regime)).filter(x=>x!==null),f=frames[0]?.status==='OK'?frames[0]:{};
 const est=known.length?known.reduce((s,x)=>s+x,0):null;
 const momentum=[n(f.rsi)!==null?f.rsi>55?1:f.rsi<45?-1:0:null,n(f.macdHistogram)!==null?Math.sign(f.macdHistogram):null,n(f.rsiSlope)!==null?Math.sign(f.rsiSlope):null].filter(x=>x!==null);
 const mom=momentum.length?momentum.reduce((s,x)=>s+x,0):null;
 const flow=[n(f.cmf)!==null?f.cmf>.03?1:f.cmf<-.03?-1:0:null,n(f.obvSlope)!==null?Math.sign(f.obvSlope):null,n(f.adSlope)!==null?Math.sign(f.adSlope):null].filter(x=>x!==null);
 const flu=flow.length?flow.reduce((s,x)=>s+x,0):null;
 const global=autoMedian(allRows.map(x=>n(x.change)===null?null:x.change*100));
 const groups=sectors.filter(x=>x.symbols?.includes(row.symbol)&&n(x.median24h)!==null),relative=groups.length&&global!==null?autoMedian(groups.map(x=>x.median24h))-global:null;
 const oce=relative===null?null:Math.abs(relative)<.25?0:relative>0?1:-1;
 const components={est:{value:est,known:known.length,total:3,method:'REGIMEN_DE_LOS_TRES_FRACTALES'},mom:{value:mom,known:momentum.length,total:3,method:'RSI14_MACD_Y_PENDIENTE_RSI'},flu:{value:flu,known:flow.length,total:3,method:'CMF_OBV_ADL_CERRADOS; PROXIES_CORRELACIONADOS'},oce:{value:oce,known:relative===null?0:1,total:1,method:'MEDIANA_SECTOR_RELATIVA_AL_UNIVERSO_24H',relative}};
 const values=Object.values(components).map(x=>x.value).filter(x=>x!==null),total=values.length?values.reduce((s,x)=>s+x,0):null;
 return {side:total===null?'UNKNOWN':total>0?'LONG':total<0?'SHORT':'NEUTRAL',balance:total,observed:values.length,components,frames,status:values.length===4?'OK':'PARTIAL',method:'BALANCE_DESCRIPTIVO; NO_PROBABILIDAD; NO_VETO_GLOBAL'};
}
export function watchObservation(row,quote=null,now=Date.now()){
 const observed=unifiedRow(row,quote,'ROLLING_24H',now),price=n(observed.price),change=n(observed.change),high=n(observed.high24h),low=n(observed.low24h),f=row.frames?.['15m']?.status==='OK'?row.frames['15m']:{},asof=observed.sourceAsOf;
 if(!(price>0))return {symbol:row.symbol,market:row.market,status:'UNKNOWN',phase:'SIN_PRECIO',asof};
 const fromHigh=high>0?(price/high-1)*100:null,toLow=low>0?(price/low-1)*100:null;
 const strongDrop=change!==null&&change<=-.08||fromHigh!==null&&fromHigh<=-8,strongRise=change!==null&&change>=.08;
 const phase=strongDrop?'CAIDA_FUERTE_EN_VIGILANCIA':strongRise?'EXTENSION_ALCISTA_EN_VIGILANCIA':f.regime==='SHORT'?'CONTEXTO_BAJISTA':f.regime==='LONG'?'CONTEXTO_ALCISTA':'OBSERVACION';
 return {id:[row.market,row.symbol,phase,Math.floor(Number(asof)/900000)].join(':'),symbol:row.symbol,market:row.market,price,change24h:change,fromHigh,toLow,phase,asof,status:'OBSERVED',attention:strongDrop||strongRise,
  pending:strongDrop?'La caída está observada. Para compra faltan defensa/reclaim y geometría del protocolo; no hay compra confirmada por porcentaje.':strongRise?'Vigilar aceptación/retesteo y retroceso; extensión no equivale a entrada.':'Esperar el evento del horizonte seleccionado.',isTradeSignal:false};
}
export function tierFor(row,rows){
 const values=rows.map(x=>n(x.volume)).filter(x=>x!==null).sort((a,b)=>a-b),v=n(row.volume);if(v===null||!values.length)return {label:'SIN_VOLUMEN',percentile:null};
 const percentile=values.filter(x=>x<=v).length/values.length;
 return {label:percentile>=.8?'MEGA':percentile>=.4?'MID':'MICRO',percentile,method:'PERCENTIL_DE_VOLUMEN_24H_EN_EL_UNIVERSO; NO_CAPITALIZACION'};
}
export function buildReadings(rows,protocols,sectors){return rows.map(row=>({...row,tier:tierFor(row,rows),readings:Object.fromEntries(Object.keys(protocols).map(h=>[h,directionalReading(row,h,protocols,sectors,rows)])),watch:watchObservation(row)}));}
export function automaticSizing(idea,budget,instrument={}){
 const risk=n(budget.riskUSD),entry=n(idea.entry),stop=n(idea.stop),fee=n(budget.feePct),step=n(instrument.sizeMultiplier)??(n(instrument.quantityPrecision)!==null?10**(-Number(instrument.quantityPrecision)):null);
 if(!(risk>0&&entry>0&&stop>0&&fee!==null&&fee>=0))return {status:'NO_CONFIGURADO',quantity:null};
 const perUnit=Math.abs(entry-stop)+(entry+stop)*fee/100;if(!(perUnit>0))return {status:'GEOMETRIA_INVALIDA',quantity:null};
 let quantity=risk/perUnit;if(step>0)quantity=Math.floor(quantity/step)*step;
 const notional=entry*quantity,min=n(instrument.minTradeUSDT);
 if(quantity<=0||min!==null&&notional<min||n(instrument.minTradeAmount)!==null&&quantity<Number(instrument.minTradeAmount))return {status:'POR_DEBAJO_DEL_MINIMO',quantity:null,notional};
 const leverage=n(budget.leverage);
 return {status:'SIMULACION',quantity,notional,estimatedRisk:quantity*perUnit,estimatedMargin:leverage>=1?notional/leverage:null,leverage:leverage>=1?leverage:null,method:'RIESGO_USD_DECLARADO; COMISION_SUPUESTA; SIN_DESLIZAMIENTO; SIN_ORDEN'};
}
