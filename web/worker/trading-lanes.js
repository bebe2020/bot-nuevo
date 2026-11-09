// Contrato único de estrategias del BOT PERSONAL; nunca envía órdenes.
// SPOT: únicamente compra/venta sin apalancamiento. PERP: LONG/SHORT separados.
export const TRADING_LANES=Object.freeze({
 SPOT_EXPLOSIVO:Object.freeze({market:'SPOT',sides:['LONG'],leverage:[1],horizons:['1H','4H','14H','24H','36H'],entryWeights:[.40,.35,.25],exitWeights:[.25,.25,.25,.25],exitGains:[.30,.50,.80,1.00],description:'Compras escalonadas y ventas parciales; +30/50/80/100% son escenarios, no previsiones'}),
 SPOT_SWING:Object.freeze({market:'SPOT',sides:['LONG'],leverage:[1],horizons:['SEMANAL','MENSUAL','TRIMESTRAL','CICLO_3_ANOS'],description:'Acumulación spot por tramos y salidas estructurales'}),
 PERP_INTRADIA:Object.freeze({market:'PERP',sides:['LONG','SHORT'],leverage:[20,30],horizons:['MICRO_PIVOTE','SCALP','DIARIO'],description:'Scalping y diario bidireccionales; x20/x30 solo laboratorio, sujetos a liquidación'}),
 PERP_SWING:Object.freeze({market:'PERP',sides:['LONG','SHORT'],leverage:[3,5],horizons:['SEMANAL','MENSUAL','TRIMESTRAL'],description:'Swing bidireccional semanal/mensual/trimestral; ciclo 3 años solo contexto'})
});
export const CAPITAL_TARGET=Object.freeze({initialUsdt:710,targetNetProfitUsdt:3500,requiredNetReturnPct:3500/710*100,realOrdersEnabled:false});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const validSum=values=>Array.isArray(values)&&values.length>0&&values.every(x=>finite(x)&&x>0)&&Math.abs(values.reduce((a,b)=>a+b,0)-1)<1e-9;
export function validateLane({lane,market,side='LONG',horizon,leverage}={}){
 const c=TRADING_LANES[lane];
 if(!c)return {status:'BLOCKED',reason:'MODALIDAD_DESCONOCIDA'};
 if(market!==c.market)return {status:'BLOCKED',reason:'MERCADO_INCORRECTO'};
 if(!c.sides.includes(side))return {status:'BLOCKED',reason:'DIRECCION_NO_ADMITIDA'};
 if(!c.horizons.includes(horizon))return {status:'BLOCKED',reason:'HORIZONTE_NO_ADMITIDO'};
 if(!c.leverage.includes(leverage))return {status:'BLOCKED',reason:'APALANCAMIENTO_FUERA_DE_MODALIDAD'};
 return {status:'PAPER_ONLY',lane,market,side,horizon,leverage,realOrdersEnabled:false};
}
export function marketCapTier(capUsd){
 if(!finite(capUsd)||capUsd<=0)return {tier:'DESCONOCIDA',method:'CAPITALIZACION_CIRCULANTE_REAL_REQUERIDA'};
 return {tier:capUsd<3e8?'MICRO':capUsd<2e9?'BAJA':capUsd<1e10?'MEDIA':'ALTA',method:'BANDAS_DESCRIPTIVAS_NO_OFICIALES_USD'};
}
export function spotExplosionEligibility({market,spotVerified=false,sourceAsOf,now=Date.now(),volume24hUsd,spreadPct,marketCapUsd,fdvUsd,depthForPlannedNotionalUsd}={}){
 if(market!=='SPOT'||!spotVerified)return {status:'BLOCKED',reason:'DATOS_SPOT_NO_VERIFICADOS'};
 if(!finite(sourceAsOf)||sourceAsOf>now+5000||now-sourceAsOf>60000)return {status:'STALE',reason:'COTIZACION_SPOT_VENCIDA'};
 const required={volume24hUsd,spreadPct,marketCapUsd,fdvUsd,depthForPlannedNotionalUsd};
 const missing=Object.entries(required).filter(([,v])=>!finite(v)||v<=0).map(([k])=>k);
 if(missing.length)return {status:'OBSERVATION',reason:'METRICAS_DE_LIQUIDEZ_INCOMPLETAS',missing};
 if(spreadPct>1)return {status:'BLOCKED',reason:'SPREAD_ALTO'};
 if(fdvUsd/marketCapUsd>15)return {status:'OBSERVATION',reason:'DILUCION_POTENCIAL_ALTA'};
 return {status:'RESEARCH_ELIGIBLE',tier:marketCapTier(marketCapUsd).tier,reason:'NO_ES_COMPRA_NI_PREDICCION'};
}
export function spotStagePlan({symbol,market='SPOT',budgetUsd,entryPrices,stop,feeRate=.001,slippageRate=.002,entryWeights=TRADING_LANES.SPOT_EXPLOSIVO.entryWeights,exitWeights=TRADING_LANES.SPOT_EXPLOSIVO.exitWeights,exitGains=TRADING_LANES.SPOT_EXPLOSIVO.exitGains,sourceAsOf,now=Date.now()}={}){
 const ok=validateLane({lane:'SPOT_EXPLOSIVO',market,side:'LONG',horizon:'24H',leverage:1});
 if(ok.status==='BLOCKED')return ok;
 if(typeof symbol!=='string'||!symbol.endsWith('USDT')||!finite(budgetUsd)||budgetUsd<=0||!Array.isArray(entryPrices)||entryPrices.length!==entryWeights.length||!entryPrices.every(v=>finite(v)&&v>0)||!validSum(entryWeights)||!validSum(exitWeights)||exitWeights.length!==exitGains.length||exitGains.some(v=>!finite(v)||v<=0)||!finite(stop)||stop<=0||stop>=Math.min(...entryPrices)||!finite(feeRate)||feeRate<0||feeRate>=.05||!finite(slippageRate)||slippageRate<0||slippageRate>=.05)return {status:'BLOCKED',reason:'PLAN_POR_TRAMOS_INVALIDO'};
 if(!finite(sourceAsOf)||sourceAsOf>now+5000||now-sourceAsOf>60000)return {status:'STALE',reason:'PRECIO_SPOT_VENCIDO'};
 if(entryPrices.some((v,i)=>i>0&&v>=entryPrices[i-1]))return {status:'BLOCKED',reason:'COMPRAS_DEBEN_ESCALONARSE_A_PRECIOS_DECRECIENTES'};
 const stages=entryPrices.map((limitPrice,i)=>({index:i+1,limitPrice,allocationUsd:budgetUsd*entryWeights[i],weight:entryWeights[i],filled:false}));
 return {status:'PAPER_ELIGIBLE',mode:'SPOT_EXPLOSIVO',market:'SPOT',side:'LONG',leverage:1,symbol,sourceAsOf,createdAt:now,budgetUsd,stop,feeRate,slippageRate,stages,exitWeights:[...exitWeights],exitGains:[...exitGains],expectedOrderType:'BUY_LIMIT_HYPOTHETICAL',realOrdersEnabled:false};
}
export function perpRiskPlan({lane,side,horizon,leverage,entry,stop,equityUsd=710,riskFraction,feeRate=.0006,slippageRate=.001,maintenanceTierVerified=false,quoteFresh=false}={}){
 const contract=validateLane({lane,market:'PERP',side,horizon,leverage});
 if(contract.status==='BLOCKED')return contract;
 const cap=lane==='PERP_INTRADIA' ? 0.005 : 0.01;
 if(!finite(riskFraction)||riskFraction<=0||riskFraction>cap)return {status:'BLOCKED',reason:'RIESGO_SOBREPASA_TOPE_DE_LABORATORIO',maxRiskFraction:cap};
 if(!finite(entry)||!finite(stop)||entry<=0||stop<=0||side==='LONG'&&stop>=entry||side==='SHORT'&&stop<=entry||!finite(equityUsd)||equityUsd<=0||!finite(feeRate)||feeRate<0||!finite(slippageRate)||slippageRate<0)return {status:'BLOCKED',reason:'GEOMETRIA_O_COSTES_INVALIDOS'};
 if(!quoteFresh)return {status:'BLOCKED',reason:'COTIZACION_NO_FRESCA'};
 const riskUsd=equityUsd*riskFraction;
 const unitLoss=Math.abs(entry-stop)+feeRate*(entry+stop)+slippageRate*stop;
 const quantity=riskUsd/unitLoss,notionalUsd=quantity*entry,marginUsd=notionalUsd/leverage;
 const adversePct=Math.abs(stop/entry-1)*100,initialMarginBufferPct=100/leverage;
 if(marginUsd>equityUsd*.2)return {status:'BLOCKED',reason:'MARGEN_CONSUME_MAS_20_PCT_CAPITAL',marginUsd};
 if(adversePct>=initialMarginBufferPct*.75)return {status:'BLOCKED',reason:'STOP_CERCA_DE_UMBRAL_TEORICO_LIQUIDACION',adversePct,initialMarginBufferPct};
 return {status:'PAPER_ONLY',lane,side,horizon,leverage,entry,stop,equityUsd,quantity,notionalUsd,marginUsd,riskUsd,feeRate,slippageRate,adversePct,stopLossAfterFeesAndSlippageUsd:riskUsd,maintenanceTierVerified,liquidationPrice:null,liquidationStatus:'NO_CALCULADA_SIN_MARK_PRECIO_MANTENIMIENTO',realOrdersEnabled:false};
}
export function portfolioGoal({capitalUsd=710,profitGoalUsd=3500}={}){
 if(!finite(capitalUsd)||capitalUsd<=0||!finite(profitGoalUsd)||profitGoalUsd<0)return {status:'BLOCKED'};
 return {initialUsd:capitalUsd,profitGoalUsd,totalNeededUsd:capitalUsd+profitGoalUsd,requiredNetReturnPct:profitGoalUsd/capitalUsd*100,guaranteed:false};
}

export function advanceSpotPaper(paper,quote,now=Date.now()){
 if(paper?.mode!=='SPOT_EXPLOSIVO')throw Error('NO_ES_SPOT_ESCALONADO');
 if(paper.state==='SIM_CERRADA'||paper.state==='SIM_CANCELADA')return paper;
 if(!quote||quote.market!=='SPOT'||quote.symbol!==paper.symbol||!['WS','REST'].includes(quote.source)||!finite(quote.price)||quote.price<=0||!finite(quote.ts)||!finite(quote.received)||quote.ts< paper.armedAt||quote.ts<= (paper.lastAsOf||0)||quote.ts>now+5000||now-quote.ts>5000||now-quote.received>5000)return paper;
 const p=structuredClone(paper);
 const event=(type,extra={})=>p.events.push({type,at:quote.ts,source:quote.source,evidence:'COTIZACION_PUBLICA_NO_FILL_REAL',...extra});
 const sell=(qty,rawPrice,label)=>{
  const price=rawPrice*(1-p.slippageRate);
  const entryBasis=p.avgEntry*qty,fees=qty*(p.avgEntry+price)*p.feeRate;
  const net=qty*price-entryBasis-fees;
  p.net+=net;p.remaining=Math.max(0,p.remaining-qty);p.exitFeesUsd+=qty*price*p.feeRate;
  event(label,{price,quantity:qty,netUsd:net});
 };
 if(quote.price<=p.stop){
  for(const stage of p.stages)if(!stage.filled)stage.canceled=true;
  if(p.remaining>0){sell(p.remaining,quote.price,'STOP_SPOT_PAPER_PRECIO_OBSERVADO');p.state='SIM_CERRADA';}
  else {p.state='SIM_CANCELADA';event('STOP_ANTES_DE_COMPRAS_PAPER',{price:quote.price});}
  p.lastAsOf=quote.ts;return p;
 }
 if(!p.exitStarted)for(const stage of p.stages){
  if(stage.filled||quote.price>stage.limitPrice)continue;
  const price=stage.limitPrice*(1+p.slippageRate),qty=stage.allocationUsd/(price*(1+p.feeRate)),fees=qty*price*p.feeRate;
  stage.filled=true;stage.filledAt=quote.ts;stage.fillPrice=price;stage.quantity=qty;
  p.quantity+=qty;p.remaining+=qty;p.entryNotionalUsd+=qty*price;p.entryFeesUsd+=fees;p.avgEntry=p.entryNotionalUsd/p.quantity;p.state='SIM_ABIERTA';
  event('COMPRA_TRAMO_PAPER',{stage:stage.index,limitPrice:stage.limitPrice,fillPrice:price,quantity:qty,feeUsd:fees});
 }
 if(p.remaining>0){
  for(let i=p.targetIndex;i<p.exitGains.length;i++){
   const target=p.avgEntry*(1+p.exitGains[i]);
   if(quote.price<target)break;
   if(!p.exitStarted){p.exitStarted=true;p.exitBaselineQty=p.remaining;for(const stage of p.stages)if(!stage.filled)stage.canceled=true;}
   const qty=i===p.exitGains.length-1?p.remaining:Math.min(p.remaining,p.exitBaselineQty*p.exitWeights[i]);
   if(qty<=0)break;
   sell(qty,target,'VENTA_TRAMO_TP'+(i+1)+'_PAPER');p.targetIndex=i+1;
   if(p.remaining<=1e-12){p.remaining=0;p.state='SIM_CERRADA';break;}
  }
  p.unrealized=p.remaining*(quote.price-p.avgEntry)-p.remaining*quote.price*p.feeRate;
 }
 p.lastAsOf=quote.ts;
 return p;
}
