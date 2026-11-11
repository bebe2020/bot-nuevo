import {planUUID} from './journal.js';
export class PaperBook{
 constructor(storage){this.storage=storage;this.key='terminal54-paper-v1';}
 read(){try{const value=JSON.parse(this.storage.getItem(this.key)||'[]');return Array.isArray(value)?value:[];}catch{return [];}}
 write(rows){const active=rows.filter(x=>!['SIM_CERRADA','SIM_CANCELADA'].includes(x.state)),closed=rows.filter(x=>['SIM_CERRADA','SIM_CANCELADA'].includes(x.state)).slice(0,300);this.storage.setItem(this.key,JSON.stringify([...active,...closed]));}
 arm(idea,sizing,feePct,now=Date.now()){
  if(sizing?.status!=='SIMULACION'||!(sizing.quantity>0)||!Number.isFinite(feePct)||feePct<0||idea.market==='SPOT'&&idea.side==='SHORT')throw Error('CONFIGURACION_DE_SIMULACION_INCOMPLETA');
  if(!['LONG','SHORT'].includes(idea.side)||idea.targets.length!==3)throw Error('TESIS_NO_ADMITIDA_PARA_SIMULACION');
  const rows=this.read(),old=rows.find(x=>x.sourceId===(idea.lifecycleId||idea.id));if(old)return old;
  const p={id:planUUID(),sourceId:idea.lifecycleId||idea.id,symbol:idea.symbol,market:idea.market,side:idea.side,entry:idea.entry,stop:idea.stop,targets:[...idea.targets],quantity:sizing.quantity,remaining:sizing.quantity,fee:feePct/100,state:'SIM_PENDIENTE',armedAt:now,net:0,targetIndex:0,events:[],policy:'FILLS_HIPOTETICOS_POR_TICKS; TERCIOS; COMISION_DECLARADA; SIN_LIQUIDEZ_O_CUENTA_REAL'};
  rows.unshift(p);this.write(rows);return p;
 }
 quote(q,now=Date.now()){
  if(!q||!Number.isFinite(q.price)||q.price<=0||q.ts>now+5000||now-q.ts>5000||now-q.received>5000)return;
  const rows=this.read();let changed=false;
  for(const p of rows){if(p.symbol!==q.symbol||p.market!==q.market||q.ts<p.armedAt||q.ts<=p.lastAsOf||['SIM_CERRADA','SIM_CANCELADA'].includes(p.state))continue;
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
