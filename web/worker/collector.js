import {VERSION,UNIVERSE,FRAMES,HORIZONS,POLICIES,n,fact,closed,endOfBar,structures,profileFacts,bookFacts,fundingFact,tradesFact,quarterBars,ema,netLiquidity,fredCSV,candidatePlans,CHECKS,riskPlan} from './engine.js';
const collectorError=e=>e?.message?.slice(0,120)||'ERROR_DESCONOCIDO';
export async function bitget(path,params={},fetcher=fetch){
 const u=new URL('https://api.bitget.com/api/v2/mix/market/'+path);u.search=new URLSearchParams({productType:'USDT-FUTURES',...params});
 const r=await fetcher(u.toString(),{signal:AbortSignal.timeout(9000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('BITGET_HTTP_'+r.status);
 const j=await r.json();if(j.code!=='00000'||j.data===undefined)throw Error('BITGET_RESPUESTA_'+String(j.code));return {data:j.data,requestTime:n(j.requestTime),received:Date.now(),source:u.pathname};
}
async function safely(task){try{return {ok:true,...await task()};}catch(e){return {ok:false,error:collectorError(e)};}}
async function mapLimit(items,limit,fn){const result=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const i=next++;result[i]=await fn(items[i],i);}}));return result;}
export async function frameData(symbol,tf,fetcher=fetch){
 const endpoint=['1Dutc','1Wutc','1Mutc'].includes(tf)?'history-candles':'candles';
 let result=await bitget(endpoint,{symbol,granularity:tf,limit:tf==='15m'?'100':'200'},fetcher),data=result.data;
 const minimum=tf==='1Wutc'?30:tf==='1Dutc'?200:0;
 if(minimum)for(let i=0;i<2&&data.length<minimum;i++){
  const oldest=Math.min(...data.map(r=>Number(r[0])));if(!Number.isFinite(oldest))break;
  const page=await bitget(endpoint,{symbol,granularity:tf,limit:'200',endTime:String(oldest)},fetcher),merged=new Map(data.map(r=>[String(r[0]),r]));
  for(const r of page.data){const old=merged.get(String(r[0]));if(old&&old.slice(0,6).some((v,j)=>Number(v)!==Number(r[j])))throw Error('VELA_CERRADA_INCONSISTENTE_ENTRE_PAGINAS');merged.set(String(r[0]),r);}
  const next=[...merged.values()].sort((a,b)=>Number(a[0])-Number(b[0]));if(next.length===data.length)break;data=next;
 }
 return {...result,data};
}
export async function acquire(symbol,fetcher=fetch){
 const [tickers,contracts,funding]=await Promise.all([safely(()=>bitget('tickers',{},fetcher)),safely(()=>bitget('contracts',{},fetcher)),safely(()=>bitget('current-fund-rate',{},fetcher))]);
 for(const r of [tickers,contracts,funding])if(r.ok&&Array.isArray(r.data))r.data=r.data.filter(x=>UNIVERSE.includes(x.symbol));
 const rows=await mapLimit(UNIVERSE,4,async s=>({symbol:s,bars:await safely(()=>frameData(s,'15m',fetcher))}));
 const detail=await mapLimit(Object.keys(FRAMES).filter(k=>k!=='15m'),3,async tf=>[tf,await safely(()=>frameData(symbol,tf,fetcher))]);
 const [trades,oi]=await Promise.all([safely(()=>bitget('fills',{symbol,limit:'100'},fetcher)),safely(()=>bitget('open-interest',{symbol},fetcher))]);
 const books=await mapLimit(UNIVERSE,5,s=>safely(()=>bitget('merge-depth',{symbol:s,limit:'50',precision:'scale0'},fetcher)));
 rows.forEach((r,i)=>r.book=books[i]);
 const freshTicker=await safely(()=>bitget('ticker',{symbol},fetcher));
 rows.find(r=>r.symbol===symbol).book=await safely(()=>bitget('merge-depth',{symbol,limit:'50',precision:'scale0'},fetcher));
 return {symbol,tickers,selectedTicker:freshTicker,contracts,funding,rows,detail:Object.fromEntries(detail),trades,oi,received:Date.now()};
}
export function makeCoverage(s,storage){
 const all=Object.values(s.structures),known=all.filter(v=>v.status==='OK').length,cur=s.structures['15m'],has=cur?.value;
 const states=[s.sourceErrors.length?'PARTIAL':'OK',s.instrument?'OK':'UNKNOWN',known===Object.keys(FRAMES).length?'OK':'PARTIAL',cur.status,has?.sweeps.length?'OBSERVADO':cur.status==='OK'?'SIN_EVENTO':'UNKNOWN',s.profiles.AGRESIVO.zones?.length?'CANDIDATOS':'SIN_PATRON',has?.gaps.length?'CANDIDATOS':'SIN_PATRON',s.structures['4H'].status, s.profiles.AGRESIVO.status,s.book.status,s.trades.status,s.funding.status,s.oi.status,'PARTIAL','CALCULADORA_MANUAL',s.cycle.status,'PARTIAL',s.macro?.status||'UNKNOWN',storage?'OK':'UNKNOWN','LOCAL_NO_CERTIFICACION_ESTADISTICA'];
 return CHECKS.map(([id,label],i)=>({id,label,state:states[i]}));
}
export function assemble(raw,previous=null){
 const now=raw.received,tickerList=raw.tickers.ok&&Array.isArray(raw.tickers.data)?raw.tickers.data:[],ticker=raw.selectedTicker?.ok?raw.selectedTicker.data.find(t=>t.symbol===raw.symbol)||{}:tickerList.find(t=>t.symbol===raw.symbol)||{},row=raw.rows.find(x=>x.symbol===raw.symbol),errors=[];
 const closedByTF={},ss={};for(const tf of Object.keys(FRAMES)){const r=tf==='15m'?row.bars:raw.detail[tf];try{if(!r?.ok)throw Error(r?.error||'FUENTE_AUSENTE');const bars=closed(r.data,tf,now);closedByTF[tf]=bars;ss[tf]=structures(bars,tf);if(bars.length){const lastEnd=endOfBar(bars.at(-1)[0],tf),duration=tf==='1Mutc'?32*86400000:FRAMES[tf];if(now-lastEnd>=duration)ss[tf]=fact(null,'STALE','SERIE_VENCIDA');}}catch(e){closedByTF[tf]=[];ss[tf]=fact(null,'UNKNOWN',collectorError(e));errors.push(tf+': '+collectorError(e));}}
 const ob=row.book.ok?bookFacts({...row.book.data,timestamp:row.book.data.ts},now):fact(null,'UNKNOWN',row.book.error);
 const profiles=Object.fromEntries(Object.keys(POLICIES).map(k=>[k,profileFacts(closedByTF['15m'],ob,ticker,k,ss)]));
 const universe=raw.rows.map(r=>{const t=tickerList.find(x=>x.symbol===r.symbol)||{};try{const bars=r.bars.ok?closed(r.bars.data,'15m',now):[],b=r.book.ok?bookFacts({...r.book.data,timestamp:r.book.data.ts},now):fact();const p=profileFacts(bars,b,t,'AGRESIVO');return {symbol:r.symbol,price:n(t.lastPr),change:n(t.change24h),volume:n(t.usdtVolume??t.quoteVolume),pointsLong:p.checklists?.LONG.points??null,pointsShort:p.checklists?.SHORT.points??null,state:p.status,book:b.status};}catch(e){return {symbol:r.symbol,price:n(t.lastPr),change:n(t.change24h),state:'UNKNOWN',error:collectorError(e)};}});
 const f=raw.funding.ok?raw.funding.data.find(x=>x.symbol===raw.symbol):null,funding=fundingFact(f,raw.funding.received??now,now);
 const oiRaw=raw.oi.ok?raw.oi.data:null,oiValue=n(oiRaw?.openInterestList?.find(x=>x.symbol===raw.symbol)?.size),oiAsOf=n(oiRaw?.ts??raw.oi.requestTime),old=previous?.oi;
 const oi=oiValue===null||oiAsOf===null||oiAsOf>now||now-oiAsOf>120000?fact(null,'UNKNOWN','OI_AUSENTE_O_VENCIDO'):fact({contractsOrBaseSize:oiValue,unit:'size publicada por Bitget; no convertir a USDT sin contrato',asof:oiAsOf,change:old?.value?.contractsOrBaseSize!==null&&old?.value?.asof<oiAsOf?oiValue-old.value.contractsOrBaseSize:null,elapsedMs:old?.value?.asof<oiAsOf?oiAsOf-old.value.asof:null},old?.status==='OK'||old?.status==='PARTIAL'?'OK':'PARTIAL');
 const months=closedByTF['1Mutc'],quarters=quarterBars(months),cycle=months.length>=36?fact({months:months.length,ema12:ema(months.map(r=>r[4]),12),ema36:ema(months.map(r=>r[4]),36),closedQuarters:quarters.length},'PARTIAL','HISTORIA_36M; NO_PREDICCION_DE_CICLO'):fact({months:months.length,required:36},'UNKNOWN','HISTORIA_CICLO_INSUFICIENTE');
 ss['3M']=structures(quarters,'3M');
 const s={version:VERSION,symbol:raw.symbol,venue:'BITGET',market:'USDT-FUTURES',received:now,sourceAsOf:n(ticker.ts??raw.selectedTicker?.requestTime??raw.tickers.requestTime),ticker,instrument:raw.contracts.ok?raw.contracts.data.find(x=>x.symbol===raw.symbol)||null:null,closed:closedByTF,structures:ss,profiles,universe,book:ob,funding,trades:raw.trades.ok?tradesFact(raw.trades.data,now):fact(null,'UNKNOWN',raw.trades.error),oi,cycle,quarters,breadth:{up:universe.filter(x=>x.change!==null&&x.change>0).length,known:universe.filter(x=>x.change!==null).length,universe:UNIVERSE.length,method:'RETORNO_24H_MUESTRA; NO_ESTRUCTURA_HTF_NI_MERCADO_GLOBAL'},sourceErrors:errors,account:'NO_VERIFICADA',execution:'NOT_SUPPORTED'};
 s.plans=Object.fromEntries(Object.keys(HORIZONS).map(h=>[h,candidatePlans(s,h)]));return s;
}
