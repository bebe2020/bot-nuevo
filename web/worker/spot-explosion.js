import {closed,endOfBar} from './engine.js';
import {marketCapTier} from './trading-lanes.js';
export const SPOT_WINDOWS_H=Object.freeze([1,4,14,24,36]);
export const SPOT_UPSIDE_SCENARIOS=Object.freeze([30,50,80,100]);
const value=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
const missing=(symbol,reason,status='UNKNOWN')=>({symbol,market:'SPOT',status,reason,signal:'SOLO_OBSERVACION'});
export function evaluateSpotExplosion(row,{market='SPOT',now=Date.now(),marketCapUsd=null,fdvUsd=null,spotVolume24hUsd=null,bid=null,ask=null}={}){
 const symbol=row?.symbol||'SIN_SIMBOLO';
 if(market!=='SPOT'||row?.market&&row.market!=='SPOT')return missing(symbol,'MERCADO_SPOT_NO_VERIFICADO');
 if(!row?.available)return missing(symbol,'INSTRUMENTO_SPOT_INACTIVO','UNAVAILABLE');
 const src=row.frames?.['1H'];
 if(!src?.ok||!Array.isArray(src.data))return missing(symbol,src?.error||'VELAS_SPOT_1H_FALTANTES');
 let bars;try{bars=closed(src.data,'1H',now);}catch(e){return missing(symbol,'OHLCV_INVALIDO_O_HUECOS');}
 if(bars.length<38)return missing(symbol,'HISTORIA_SPOT_36H_INSUFICIENTE');
 const last=bars.at(-1),asof=endOfBar(last[0],'1H');
 // Vela 1H válida hasta que falta el próximo cierre horario esperado.
 if(asof>now||now-asof>=3600000+60000)return {...missing(symbol,'VELA_1H_VENCIDA','STALE'),asof};
 const price=last[4],window={};
 for(const h of SPOT_WINDOWS_H){
  const prev=bars.at(-h-1);
  window[h]={returnPct:(price/prev[4]-1)*100,high:Math.max(...bars.slice(-h).map(b=>b[2])),low:Math.min(...bars.slice(-h).map(b=>b[3]))};
 }
 const baseline=bars.slice(-25,-1).reduce((sum,b)=>sum+b[5],0)/24;
 const rvol=baseline>0?last[5]/baseline:null;
 const cap=value(marketCapUsd),fdv=value(fdvUsd),volume=value(spotVolume24hUsd),b=value(bid),a=value(ask);
 const spreadPct=b>0&&a>=b?(a/b-1)*100:null;
 const blockers=[];
 if(cap===null||cap<=0)blockers.push('CAPITALIZACION_REAL_FALTANTE');
 if(fdv===null||fdv<=0)blockers.push('FDV_FALTANTE');
 if(volume===null||volume<=0)blockers.push('VOLUMEN_24H_SPOT_FALTANTE');
 if(spreadPct===null)blockers.push('SPREAD_SPOT_FALTANTE');
 if(rvol===null)blockers.push('RVOL_FALTANTE');
 blockers.push('PROFUNDIDAD_SPOT_Y_IMPACTO_NO_VERIFICADOS');
 const upper=Math.max(...bars.slice(-15,-1).map(b=>b[2]));
 return {symbol,market:'SPOT',status:'OBSERVATION',reason:blockers.join('|'),asof,price,window,rvol,volume24hUsd:volume,marketCapUsd:cap,fdvUsd:fdv,capTier:marketCapTier(cap).tier,spreadPct,breakout14h:price>upper,breakoutLevel:upper,targets:SPOT_UPSIDE_SCENARIOS.map(p=>({scenarioPct:p,price:price*(1+p/100)})),blockers,signal:'SOLO_OBSERVACION_SIN_FILL',probability:null};
}
export function spotExplosionRadar(raw,{providerAssets=[],getQuote=()=>null,now=Date.now()}={}){
 if(raw?.market!=='SPOT')return {status:'BLOCKED',reason:'CAMBIAR_SELECTOR_A_SPOT',items:[]};
 const tickers=raw.tickers?.ok?raw.tickers.data:[],assets=new Map(providerAssets.map(x=>[x.symbol,x]));
 const items=(raw.rows||[]).map(row=>{
  const metadata=assets.get(row.symbol)||{},ticker=tickers.find(t=>t.symbol===row.symbol)||{},quote=getQuote(row.symbol,'SPOT');
  const capFresh=Number.isFinite(metadata.marketAsOf)&&metadata.marketAsOf<=now&&now-metadata.marketAsOf<=86400000;
  const freshQuote=quote?.market==='SPOT'&&quote.ts<=now+5000&&now-quote.ts<=5000&&now-quote.received<=5000;
  return evaluateSpotExplosion({...row,market:'SPOT'},{market:'SPOT',now,marketCapUsd:capFresh?metadata.marketCap:null,fdvUsd:capFresh?metadata.fdv:null,spotVolume24hUsd:ticker.usdtVolume??ticker.quoteVolume,bid:freshQuote?quote.bid:null,ask:freshQuote?quote.ask:null});
 });
 return {status:items.length?'OBSERVATION':'UNKNOWN',market:'SPOT',coverage:items.length,observed:items.filter(x=>x.window).length,items:items.sort((a,b)=>(b.rvol||0)-(a.rvol||0))};
}
