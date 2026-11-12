import {barClock} from './freshness.js';
import {unifiedRow,marketNumber,priceChanges} from './market-contract.js';
import {PROTOCOLS,sectorStrength} from './protocol.js';
import {buildReadings} from './auto-protocol.js';
import {ASSETS} from './universe.js';

// Every view reads this same selection and the same observed quotes.
// Source clocks remain independent: serving a snapshot never renews its bars.
export function ageMarketRows(rows,now=Date.now()){
 return rows.map(row=>{
  const frames=Object.fromEntries(Object.entries(row.frames||{}).map(([tf,f])=>{
   const clock=barClock(tf,f.asof,now),status=f.status==='OK'?clock.state:f.status;
   return [tf,{...f,status,clock,observedStatus:f.observedStatus||f.status}];
  }));
  const accumulations=Object.fromEntries(Object.entries(row.accumulations||{}).map(([tf,a])=>[tf,{...a,clock:a.clock==='OK'?barClock(tf,a.closeAsOf,now).state:a.clock}]));
  return {...row,frames,accumulations,state:row.state==='OK'&&frames['15m']?.status!=='OK'?frames['15m']?.status||'UNKNOWN':row.state};
 });
}
export function buildDashboard({snapshot=null,quotes=new Map(),selection,now=Date.now()}){
 const primary=snapshot?.symbol===selection.symbol&&snapshot?.market===selection.market?snapshot:null;
 const base=snapshot?.radarUniverse||snapshot?.universe||ASSETS.map(a=>({symbol:a.base+'USDT',market:selection.market,price:null,frames:{},state:'PENDING'}));
 let rows=ageMarketRows(base.map(original=>{const r=primary&&original.symbol===primary.symbol&&(original.market||primary.market)===primary.market&&Number(primary.ticker?.ts)>=Number(original.sourceAsOf||0)?unifiedRow({...original,market:primary.market},{symbol:primary.symbol,market:primary.market,price:marketNumber(primary.ticker.lastPr),ts:Number(primary.ticker.ts),received:primary.received,source:'CAPTURA',changes:priceChanges(primary.ticker,primary.market)},selection.basis,now):original;return unifiedRow({...r,market:r.market||selection.market},quotes.get((r.market||selection.market)+':'+r.symbol),selection.basis,now);}),now);
 rows=buildReadings(rows,{[selection.horizon]:PROTOCOLS[selection.horizon]},sectorStrength(rows));
 const fallback=primary?{symbol:primary.symbol,market:primary.market,price:marketNumber(primary.ticker?.lastPr),sourceAsOf:marketNumber(primary.ticker?.ts??primary.sourceAsOf),changes:primary.universe?.find(r=>r.symbol===selection.symbol)?.changes,frames:{}}:{symbol:selection.symbol,market:selection.market,price:null,frames:{}};
 const selected=rows.find(r=>r.symbol===selection.symbol&&r.market===selection.market)||unifiedRow(fallback,quotes.get(selection.market+':'+selection.symbol),selection.basis,now);
 const actual=quotes.get(selection.market+':'+selection.symbol),useActual=actual&&selected.displaySource!=='CAPTURA';
 const quote=useActual?{...actual,price:selected.price}:selected.price>0?{symbol:selection.symbol,market:selection.market,price:selected.price,ts:selected.displayAsOf,received:primary?.received,source:'CAPTURA',changes:selected.changes}:null;
 return {selection:{...selection},rows,selected,quote,analysisReceived:primary?.received??null,
  key:[selection.symbol,selection.market,selection.profile,selection.horizon,selection.basis].join(':'),evaluatedAt:now};
}
