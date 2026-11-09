import {planUUID} from './journal.js';
import {advanceSpotPaper,validateLane} from './trading-lanes.js';
export class PaperBook{
 constructor(storage){this.storage=storage;this.key='terminal54-paper-v1';}
 read(){try{const value=JSON.parse(this.storage.getItem(this.key)||'[]');return Array.isArray(value)?value:[];}catch{return [];}}
 write(rows){const active=rows.filter(x=>!['SIM_CERRADA','SIM_CANCELADA'].includes(x.state)),closed=rows.filter(x=>['SIM_CERRADA','SIM_CANCELADA'].includes(x.state)).slice(0,300);this.storage.setItem(this.key,JSON.stringify([...active,...closed]));}
 arm(idea,sizing,feePct,now=Date.now()){
  if(sizing?.status!=='SIMULACION'||!(sizing.quantity>0)||!Number.isFinite(feePct)||feePct<0||idea.market==='SPOT'&&idea.side==='SHORT')throw Error('CONFIGURACION_DE_SIMULACION_INCOMPLETA');
  if(!['LONG','SHORT'].includes(idea.side)||idea.targets.length!==3)throw Error('TESIS_NO_ADMITIDA_PARA_SIMULACION');
  const rows=this.read(),old=rows.find(x=>x.sourceId===(idea.lifecycleId||idea.id));if(old)return old;
  const p={id:planUUID(),sourceId:idea.lifecycleId||idea.id,mode:idea.mode||'PAPER_LEGACY',horizon:idea.horizon||null,leverage:sizing.leverage??null,marginUsd:sizing.estimatedMargin??null,symbol:idea.symbol,market:idea.market,side:idea.side,entry:idea.entry,stop:idea.stop,targets:[...idea.targets],quantity:sizing.quantity,remaining:sizing.quantity,fee:feePct/100,state:'SIM_PENDIENTE',armedAt:now,net:0,targetIndex:0,events:[],policy:'FILLS_HIPOTETICOS_POR_TICKS; TERCIOS; COMISION_DECLARADA; SIN_LIQUIDEZ_O_CUENTA_REAL'};
  rows.unshift(p);this.write(rows);return p;
 }
 armPerpLab(risk,{symbol,sourceAsOf,feeRate=.0006}={},now=Date.now()){
  if(risk?.status!=='PAPER_ONLY'||!['PERP_INTRADIA','PERP_SWING'].includes(risk.lane)||typeof symbol!=='string'||!symbol.endsWith('USDT')||!Number.isFinite(sourceAsOf)||sourceAsOf>now+5000||now-sourceAsOf>5000||!Number.isFinite(feeRate)||feeRate<0||feeRate>=.05)throw Error('RIESGO_PERP_O_FUENTE_NO_CERTIFICADOS');
  const checked=validateLane({lane:risk.lane,market:'PERP',side:risk.side,horizon:risk.horizon,leverage:risk.leverage});
  if(checked.status!=='PAPER_ONLY')throw Error(checked.reason);
  const sign=risk.side==='LONG'?1:-1,dist=Math.abs(risk.entry-risk.stop),targets=[1,2,3].map(mult=>risk.entry+sign*dist*mult);
  if(targets.some(x=>x<=0))throw Error('TARGET_PERP_FUERA_DE_PRECIO_VALIDO');
  const sourceId=['PAPER_PERP',risk.lane,symbol,risk.side,risk.horizon,risk.leverage,sourceAsOf,risk.entry,risk.stop].join(':');
  const idea={id:sourceId,lifecycleId:sourceId,mode:risk.lane,horizon:risk.horizon,symbol,market:'PERP',side:risk.side,entry:risk.entry,stop:risk.stop,targets};
  const sizing={status:'SIMULACION',quantity:risk.quantity,leverage:risk.leverage,estimatedMargin:risk.marginUsd};
  return this.arm(idea,sizing,feeRate*100,now);
 }
 armStagedSpot(plan,now=Date.now()){
  if(plan?.status!=='PAPER_ELIGIBLE'||plan.mode!=='SPOT_EXPLOSIVO'||plan.market!=='SPOT'||plan.side!=='LONG'||plan.leverage!==1||!Array.isArray(plan.stages)||plan.stages.length!==3)throw Error('PLAN_SPOT_INCOMPLETO');
  const rows=this.read(),sourceId=['SPOT_EXPLOSIVO',plan.symbol,plan.sourceAsOf,plan.stages.map(x=>x.limitPrice).join(',')].join(':');
  const existing=rows.find(x=>x.sourceId===sourceId);if(existing)return existing;
  const p={id:planUUID(),sourceId,mode:'SPOT_EXPLOSIVO',symbol:plan.symbol,market:'SPOT',side:'LONG',leverage:1,budgetUsd:plan.budgetUsd,stop:plan.stop,stages:plan.stages.map(x=>({...x})),exitGains:[...plan.exitGains],exitWeights:[...plan.exitWeights],feeRate:plan.feeRate,slippageRate:plan.slippageRate,state:'SIM_PENDIENTE',armedAt:now,lastAsOf:0,quantity:0,remaining:0,entryNotionalUsd:0,entryFeesUsd:0,exitFeesUsd:0,avgEntry:0,exitStarted:false,targetIndex:0,net:0,unrealized:0,events:[],policy:'SOLO_SIMULACION_TICKS_FRESCOS_SPOT; TRES_COMPRAS_CUATRO_VENTAS; NO_ORDEN_REAL'};
  rows.unshift(p);this.write(rows);return p;
 }
 quote(q,now=Date.now()){
  if(!q||!Number.isFinite(q.price)||q.price<=0||q.ts>now+5000||now-q.ts>5000||now-q.received>5000)return;
  const rows=this.read();let changed=false;
  for(const p of rows){if(p.symbol!==q.symbol||p.market!==q.market||q.ts<p.armedAt||q.ts<=p.lastAsOf||['SIM_CERRADA','SIM_CANCELADA'].includes(p.state))continue;
   if(p.mode==='SPOT_EXPLOSIVO'){
    const next=advanceSpotPaper(p,q,now);
    if(next!==p){Object.assign(p,next);changed=true;}
    continue;
   }
   const sign=p.side==='LONG'?1:-1;p.lastAsOf=q.ts;p.lastPrice=q.price;
   if(p.state==='SIM_PENDIENTE'){
    if(sign*(q.price-p.stop)<=0){p.state='SIM_CANCELADA';p.events.push({at:q.ts,type:'GAP_O_STOP_ANTES_DE_ENTRADA',price:q.price});changed=true;continue;}
    if(sign*(q.price-p.entry)<=0){p.state='SIM_ABIERTA';p.net=-p.quantity*p.entry*p.fee;p.events.push({at:q.ts,type:'ENTRADA_HIPOTETICA',price:p.entry});changed=true;}
   }
   if(p.state==='SIM_ABIERTA'){
    if(sign*(q.price-p.stop)<=0){const price=q.price;p.net+=p.remaining*(sign*(price-p.entry)-price*p.fee);p.events.push({at:q.ts,type:'STOP_SIMULADO_PRECIO_OBSERVADO',price,quantity:p.remaining});p.remaining=0;p.state='SIM_CERRADA';changed=true;}
    else while(p.targetIndex<3&&sign*(q.price-p.targets[p.targetIndex])>=0){const quantity=p.targetIndex===2?p.remaining:p.quantity/3,price=p.targets[p.targetIndex];p.net+=quantity*(sign*(price-p.entry)-price*p.fee);p.remaining=Math.max(0,p.remaining-quantity);p.events.push({at:q.ts,type:'TP'+(p.targetIndex+1)+'_SIMULADO',price,quantity});p.targetIndex++;if(p.targetIndex===3)p.state='SIM_CERRADA';changed=true;}
    p.unrealized=p.remaining*sign*(q.price-p.entry);changed=true;
   }
  }
  if(changed)this.write(rows);
 }
}
