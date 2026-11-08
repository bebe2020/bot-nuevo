// Radar EXPLOSION_SPOT is NOT MICRO_PIVOTE. No real orders, no invented fills.
// Standalone pure functions: integrate only after verifying SPOT feed and tests.
export const EXPLOSION_WINDOWS_H=[1,4,14,24,36];
export const EXPLOSION_TARGETS=[0.30,0.50,0.80];
const num=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
const fail=reason=>({status:'UNKNOWN',reason});
export function spotExplosion(row,{now=Date.now(),maxAgeMs=120000,market='SPOT',spotVerified=false,marketCapUsd=null,fdvUsd=null,spotVolume24hUsd=null,spreadPct=null}={}){
 if(market!=='SPOT'||!spotVerified)return fail('SPOT_NO_VERIFICADO');
 if(!row?.symbol||!Array.isArray(row?.frames?.['1H']?.data))return fail('VELAS_SPOT_AUSENTES');
 const bars=row.frames['1H'].data.map(r=>r.slice(0,6).map(num)).sort((a,b)=>a[0]-b[0]);
 if(bars.some(b=>b.some(x=>x===null)||b[3]<=0||b[2]<b[3]||b[4]<=0||b[5]<0))return fail('OHLCV_INVALIDO');
 const closed=bars.filter(b=>b[0]+3600000<=now);
 if(closed.length<38)return fail('HISTORIA_INSUFICIENTE_36H');
 for(let i=1;i<closed.length;i++)if(closed[i][0]-closed[i-1][0]!==3600000)return fail('HUECO_EN_VELAS');
 const last=closed.at(-1),asof=last[0]+3600000;
 if(now-asof>maxAgeMs||asof>now)return {status:'STALE',reason:'VELAS_VENCIDAS',asof};
 const price=last[4],windows={};
 for(const h of EXPLOSION_WINDOWS_H){const prev=closed.at(-h-1);windows[h]={returnPct:(price/prev[4]-1)*100,high:Math.max(...closed.slice(-h).map(b=>b[2])),low:Math.min(...closed.slice(-h).map(b=>b[3]))};}
 const prevVol=closed.slice(-25,-1).reduce((s,b)=>s+b[5],0)/24;
 const rvol=prevVol>0?last[5]/prevVol:null;
 const liquidity={spotVolume24hUsd:num(spotVolume24hUsd),spreadPct:num(spreadPct),marketCapUsd:num(marketCapUsd),fdvUsd:num(fdvUsd)};
 const blockers=[];
 if(liquidity.spotVolume24hUsd===null)blockers.push('VOLUMEN_SPOT_DESCONOCIDO');
 if(liquidity.spreadPct===null)blockers.push('SPREAD_SPOT_DESCONOCIDO');
 if(liquidity.marketCapUsd===null)blockers.push('CAPITALIZACION_DESCONOCIDA');
 if(rvol===null)blockers.push('RVOL_DESCONOCIDO');
 const prior=closed.slice(-15,-1),breakout=Math.max(...prior.map(b=>b[2]));
 return {status:blockers.length?'PARTIAL':'OK',symbol:row.symbol,market:'SPOT',radar:'EXPLOSION_SPOT',asof,price,windows,rvol,liquidity,blockers,breakoutLevel:breakout,breakoutOnClosedCandle:price>breakout,targets:EXPLOSION_TARGETS.map(p=>({movePct:p*100,price:price*(1+p),kind:'ESCENARIO_NO_PROBABILIDAD'})),signal:'OBSERVACION_NO_ORDEN'};
}
export function createPaperTrade({id,symbol,market,side,entry,stop,targets,qty,entryAsOf,sourceAsOf,feeRate=0.0006,leverage=1,fillEvidence}){
 if(!id||!symbol||!['SPOT','PERP'].includes(market)||!['LONG','SHORT'].includes(side)||market==='SPOT'&&side==='SHORT')throw Error('PAPER_MERCADO_INVALIDO');
 const e=num(entry),s=num(stop),q=num(qty),l=num(leverage),fee=num(feeRate),ts=num(entryAsOf),source=num(sourceAsOf);
 if(!fillEvidence||!Number.isInteger(ts)||!Number.isInteger(source)||ts<source||e===null||s===null||q===null||l===null||fee===null||e<=0||s<=0||q<=0||l<1||fee<0||fee>=1||side==='LONG'&&s>=e||side==='SHORT'&&s<=e)throw Error('PAPER_FILL_O_RIESGO_INVALIDO');
 if(!Array.isArray(targets)||targets.length!==3||targets.some(x=>num(x)===null||side==='LONG'&&num(x)<=e||side==='SHORT'&&num(x)>=e))throw Error('PAPER_TARGETS_INVALIDOS');
 return Object.freeze({id,symbol,market,side,entry:e,stop:s,targets:targets.map(num),qty:q,leverage:l,feeRate:fee,entryAsOf:ts,sourceAsOf:source,fillEvidence,status:'OPEN_SIMULATED',kind:'PAPER_NO_REAL',exit:null});
}
export function closePaperTrade(trade,{exit,exitAsOf,exitEvidence,fundingUsd=0,slippageUsd=0}){
 if(trade?.status!=='OPEN_SIMULATED'||!exitEvidence||!Number.isInteger(exitAsOf)||exitAsOf<trade.entryAsOf)throw Error('PAPER_CIERRE_INVALIDO');
 const x=num(exit),fund=num(fundingUsd),slip=num(slippageUsd);
 if(x===null||x<=0||fund===null||slip===null||slip<0)throw Error('PAPER_CIERRE_INVALIDO');
 const sign=trade.side==='LONG'?1:-1,gross=(x-trade.entry)*trade.qty*sign,fees=(x+trade.entry)*trade.qty*trade.feeRate;
 return {...trade,status:'CLOSED_SIMULATED',exit:{price:x,asof:exitAsOf,evidence:exitEvidence,grossUsd:gross,feesUsd:fees,fundingUsd:fund,slippageUsd:slip,netUsd:gross-fees-fund-slip}};
}
export function paperSummary(trades){
 const closed=trades.filter(t=>t.status==='CLOSED_SIMULATED'),open=trades.filter(t=>t.status==='OPEN_SIMULATED');
 return {closed:closed.length,open:open.length,realizedPaperNetUsd:closed.reduce((s,t)=>s+t.exit.netUsd,0),realMoneyUsd:0,targetPaperNetUsd:4000,kind:'SIMULACION'};
}
