// Horizon contract for SPOT and PERP, separated from SPOT explosion and PERP scalp.
// Research-inspired hypotheses, NOT validated signals or trade advice.
export const SWING_HORIZONS=Object.freeze({
 SEMANAL:Object.freeze({frames:['4H','1Dutc','1Wutc'],minClosed:30}),
 MENSUAL:Object.freeze({frames:['1Dutc','1Wutc','1Mutc'],minClosed:30}),
 TRIMESTRAL:Object.freeze({frames:['1Wutc','1Mutc','3M'],minClosed:16}),
 CICLO_3_ANOS:Object.freeze({frames:['1Mutc','3M','36M'],minClosed:12})
});
export const MICRO_PIVOTE_CONTRACT=Object.freeze({market:'PERP',frames:['1m','5m','15m'],mode:'SCALPING',leverageScenarios:[10,20,30,50],liveOrders:false,continuousL2Required:true});
export function validateHorizon({market,horizon,profile,sourceAsOf,now=Date.now(),hasContinuousL2=false,historyComplete=false}){
 if(!['SPOT','PERP'].includes(market))return {status:'BLOCKED',reason:'MERCADO_INVALIDO'};
 if(!['CONSERVADOR','MODERADO','AGRESIVO','ULTRAAGRESIVO'].includes(profile))return {status:'BLOCKED',reason:'PERFIL_INVALIDO'};
 if(horizon==='MICRO_PIVOTE'){
  if(market!=='PERP')return {status:'BLOCKED',reason:'MICROPIVOTE_SOLO_PERP'};
  if(!hasContinuousL2)return {status:'OBSERVATION',reason:'L2_CONTINUO_NO_VERIFICADO'};
  if(!historyComplete)return {status:'OBSERVATION',reason:'HISTORIA_INSUFICIENTE'};
 }else if(!SWING_HORIZONS[horizon])return {status:'BLOCKED',reason:'HORIZONTE_INVALIDO'};
 if(!Number.isFinite(sourceAsOf)||sourceAsOf>now||now-sourceAsOf>120000)return {status:'STALE',reason:'FUENTE_NO_FRESCA'};
 if(!historyComplete)return {status:'OBSERVATION',reason:'HISTORIA_INSUFICIENTE'};
 return {status:'RESEARCH_ELIGIBLE',reason:'NO_ES_DISPARO',market,horizon,profile};
}
export function leverageLab({leverage,entry,stop,marginUsd,feeRate=0.0006,maintenanceMarginRate=null}){
 const L=Number(leverage),e=Number(entry),s=Number(stop),m=Number(marginUsd),f=Number(feeRate);
 if(![3,5,7,10,20,30,50].includes(L)||![e,s,m,f].every(Number.isFinite)||e<=0||s<=0||e===s||m<=0||f<0||f>=1)return {status:'BLOCKED',reason:'PARAMETROS_INVALIDOS'};
 const notional=m*L,stopDistancePct=Math.abs(s/e-1)*100,lossAtStopUsd=notional*Math.abs(s/e-1)+notional*f*(1+s/e);
 return {status:'LAB_ONLY',leverage:L,marginUsd:m,notionalUsd:notional,stopDistancePct,estimatedLossAtStopUsd:lossAtStopUsd,lossExceedsMargin:lossAtStopUsd>=m,liquidationPrice:null,liquidationStatus:maintenanceMarginRate===null?'UNKNOWN':'NOT_CALCULATED',reason:'SIN_MARK_PRICE_TIERS_Y_FUNDING_NO_CERTIFICAR_LIQUIDACION'};
}
