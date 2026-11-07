import {SYMBOLS} from './universe.js';
// Motor numérico compartido. Datos públicos, sin cuentas ni órdenes.
export const VERSION = 'terminal-2.0';
export const UNIVERSE = SYMBOLS;
export const FRAMES = {'1m':60000,'5m':300000,'15m':900000,'30m':1800000,'1H':3600000,'2H':7200000,'4H':14400000,'6H':21600000,'8H':28800000,'12H':43200000,'1Dutc':86400000,'1Wutc':604800000,'1Mutc':null};
export const HORIZONS = {MICRO_PIVOTE:['1m','5m','15m'],SCALP:['5m','15m','1H'],DIARIO:['15m','1H','4H'],SEMANAL:['4H','1Dutc','1Wutc'],MENSUAL:['1Dutc','1Wutc','1Mutc'],TRIMESTRAL:['1Wutc','1Mutc','3M'],CICLO_3_ANOS:['1Mutc','3M','36M']};
export const POLICIES = {
 AGRESIVO:{volume:200000,range:5.5,vr:1.35,climax:2.2,cmf:.05,book:.15,flowBook:.12,flowCmf:.03,zoneVol:1.45,body:.48,high:6,medium:4,osc:8,score:5.5,rangeCheck:4.2,weights:[1.8,.04,1.8,9,16,.3]},
 CONSERVADOR:{volume:300000,range:4.5,vr:1.6,climax:2.5,cmf:.08,book:.20,flowBook:.18,flowCmf:.05,zoneVol:1.8,body:.55,high:7,medium:5,osc:15,score:6.5,rangeCheck:3.5,weights:[2,.03,1.5,8,12,.4]}
};
POLICIES.MODERADO=Object.fromEntries(Object.keys(POLICIES.AGRESIVO).map(k=>[k,Array.isArray(POLICIES.AGRESIVO[k])?POLICIES.AGRESIVO[k].map((v,i)=>(v+POLICIES.CONSERVADOR[k][i])/2):(POLICIES.AGRESIVO[k]+POLICIES.CONSERVADOR[k])/2]));
POLICIES.MODERADO.high=7; POLICIES.MODERADO.medium=5;
POLICIES.ULTRAAGRESIVO={...POLICIES.AGRESIVO,requiresContinuousL2:true};
export const n=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
export const fact=(value=null,status='UNKNOWN',reason=null,extra={})=>({value,status,reason,...extra});
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
export function endOfBar(ts,tf){const d=new Date(ts);return tf==='1Mutc'||tf==='3M'?Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+(tf==='3M'?3:1),1):ts+FRAMES[tf];}
export function closed(raw,tf,now){
 if(!(tf in FRAMES))throw Error('TF_NO_SOPORTADO');
 const a=(raw||[]).map(r=>r.slice(0,6).map(n));
 for(const r of a)if(r.length<6||r.some(v=>v===null)||r[0]<0||!Number.isInteger(r[0])||r[0]>now||Math.min(...r.slice(1,5))<=0||r[5]<0||r[3]>Math.min(r[1],r[4])||r[2]<Math.max(r[1],r[4]))throw Error('OHLCV_INVALIDO');
 const b=a.filter(r=>endOfBar(r[0],tf)<=now).sort((x,y)=>x[0]-y[0]);
 for(let i=1;i<b.length;i++)if(b[i][0]!==endOfBar(b[i-1][0],tf))throw Error('HUECO_O_DUPLICADO');
 return b;
}
export function ema(values,period){if(values.length<period)return null;let v=avg(values.slice(0,period));for(const x of values.slice(period))v+=2/(period+1)*(x-v);return v;}
export function atr(b,period=14){if(b.length<period+1)return null;const tr=b.slice(1).map((r,i)=>Math.max(r[2]-r[3],Math.abs(r[2]-b[i][4]),Math.abs(r[3]-b[i][4])));let v=avg(tr.slice(0,period));for(const x of tr.slice(period))v+=(x-v)/period;return v;}
export function volume(b){
 if(b.length<30)return fact(null,'UNKNOWN','HISTORIA_INSUFICIENTE');
 const v=b.map(r=>r[5]),base=avg(v.slice(-21,-1)),v20=avg(v.slice(-20));
 if(!base||!v20)return fact(null,'UNKNOWN','VOLUMEN_BASE_CERO');
 const cmf=b.slice(-20).reduce((s,r)=>s+(r[2]===r[3]?0:(2*r[4]-r[2]-r[3])/(r[2]-r[3]))*r[5],0)/(v20*20);
 return fact({ratio:v.at(-1)/base,osc:(avg(v.slice(-5))/v20-1)*100,cmf,signedProxy:b.slice(-10).reduce((s,r)=>s+Math.sign(r[4]-r[1])*r[5],0),range:(Math.max(...b.slice(-10).map(r=>r[2]))-Math.min(...b.slice(-10).map(r=>r[3])))/b.at(-1)[4]*100},'OK');
}
export function bookFacts(raw,now){
 const ts=n(raw?.timestamp??raw?.ts);if(ts===null||ts>now)return fact(null,'UNKNOWN','RELOJ_LIBRO');
 if(now-ts>5000)return fact(null,'STALE','LIBRO_VENCIDO',{asof:ts});
 const sides=['bids','asks'].map((k,i)=>(raw[k]||[]).map(r=>r.slice(0,2).map(n)).sort((a,b)=>i?a[0]-b[0]:b[0]-a[0]).slice(0,20));
 if(sides.some(s=>!s.length||s.some(r=>r.length<2||r.some(v=>v===null)||r[0]<=0||r[1]<0))||sides[0][0][0]>=sides[1][0][0])return fact(null,'UNKNOWN','LIBRO_INVALIDO');
 const [bw,aw]=sides.map(s=>s.reduce((z,r,i)=>z+r[1]/(i+1),0));if(!bw&&!aw)return fact(null,'UNKNOWN','LIBRO_SIN_VOLUMEN');
 return fact({imbalance:(bw-aw)/(bw+aw),spreadPct:(sides[1][0][0]/sides[0][0][0]-1)*100,levels:sides.map(s=>s.length)},sides.every(s=>s.length===20)?'OK':'PARTIAL',null,{asof:ts});
}
export function pivots(b,span=2){const out=[];for(let i=span;i<b.length-span;i++){const around=b.slice(i-span,i+span+1);if(around.every((r,j)=>j===span||b[i][2]>r[2]))out.push({type:'HIGH',price:b[i][2],origin:b[i][0],confirmed:b[i+span][0]});if(around.every((r,j)=>j===span||b[i][3]<r[3]))out.push({type:'LOW',price:b[i][3],origin:b[i][0],confirmed:b[i+span][0]});}return out;}
export function structures(b,tf){
 if(b.length<(tf==='3M'?16:30))return fact(null,'UNKNOWN','HISTORIA_INSUFICIENTE');
 const ps=pivots(b),last=b.at(-1),previous=b.at(-2),high=ps.filter(x=>x.type==='HIGH'&&x.confirmed<last[0]).at(-1),low=ps.filter(x=>x.type==='LOW'&&x.confirmed<last[0]).at(-1);
 const bos=high&&last[4]>high.price&&previous[4]<=high.price?'LONG':low&&last[4]<low.price&&previous[4]>=low.price?'SHORT':null;
 const sweeps=[];for(let i=Math.max(20,b.length-4);i<b.length;i++){const prior=b.slice(i-20,i),hi=Math.max(...prior.map(r=>r[2])),lo=Math.min(...prior.map(r=>r[3])),r=b[i];if(r[3]<lo&&r[4]>lo)sweeps.push({side:'LONG',level:lo,extreme:r[3],detected:endOfBar(r[0],tf)});if(r[2]>hi&&r[4]<hi)sweeps.push({side:'SHORT',level:hi,extreme:r[2],detected:endOfBar(r[0],tf)});}
 const gaps=[];for(let i=2;i<b.length;i++){const a=b[i-2],r=b[i],side=r[3]>a[2]?'LONG':r[2]<a[3]?'SHORT':null;if(!side)continue;const lower=side==='LONG'?a[2]:r[2],upper=side==='LONG'?r[3]:a[3];const filled=b.slice(i+1).some(x=>side==='LONG'?x[3]<=lower:x[2]>=upper);if(!filled)gaps.push({side,low:lower,high:upper,detected:endOfBar(r[0],tf)});}
 const v=atr(b),p=last[4],cl=b.map(r=>r[4]),e9=ema(cl,9),e21=ema(cl,21),e100=ema(cl,100),e200=ema(cl,200);
 return fact({pivots:ps.slice(-20),bos,sweeps,gaps:gaps.slice(-12),atr:v,ema9:e9,ema21:e21,ema100:e100,ema200:e200,regime:e9!==null&&e21!==null?(p>e21&&e9>e21?'LONG':p<e21&&e9<e21?'SHORT':'MIXED'):'UNKNOWN',choch:bos&&e21!==null&&((bos==='LONG'&&previous[4]<e21)||(bos==='SHORT'&&previous[4]>e21))?bos:null,asof:endOfBar(last[0],tf)},'OK');
}
export function zones(b,tf,p){
 const out=[];for(let i=Math.max(20,b.length-30);i<b.length;i++){const r=b[i],base=avg(b.slice(i-20,i).map(x=>x[5]));if(!base||r[2]===r[3]||r[5]/base<=p.zoneVol||Math.abs(r[4]-r[1])/(r[2]-r[3])<=p.body)continue;const before=b.slice(i-5,i),side=r[4]>r[1]&&r[4]>Math.max(...before.map(x=>x[2]))?'LONG':r[4]<r[1]&&r[4]<Math.min(...before.map(x=>x[3]))?'SHORT':null;if(!side)continue;const origin=b.slice(i-3,i).reverse().find(x=>side==='LONG'?x[4]<x[1]:x[4]>x[1]);if(!origin)continue;const later=b.slice(i+1),invalid=later.find(x=>side==='LONG'?x[3]<origin[3]:x[2]>origin[2]);out.push({side,low:origin[3],high:origin[2],origin:origin[0],detected:endOfBar(r[0],tf),state:invalid?'INVALIDATED':later.some(x=>x[3]<=origin[2]&&x[2]>=origin[3])?'RETESTED':'UNTESTED',invalidated:invalid?endOfBar(invalid[0],tf):null,method:'CANDIDATO_HEURISTICO_OB_SMC_BOS5'});}
 return out;
}
export function profileFacts(b,ob,ticker,name,contexts={}){
 const p=POLICIES[name],v=volume(b);if(!p)throw Error('PERFIL_INVALIDO');
 if(v.status!=='OK')return {profile:name,status:'UNKNOWN',reason:v.reason,points:null,signal:'NO_TRADE_SIGNAL'};
 const x=v.value,q=n(ticker?.quoteVolume??ticker?.usdtVolume),d=ob.value?.imbalance,ready=ob.status==='OK';
 const weights=p.weights,parts=[x.ratio*weights[0],Math.abs(x.osc)*weights[1],x.ratio>=p.climax?weights[2]:0,Math.abs(x.cmf)*weights[3],ready?Math.abs(d)*weights[4]:null,x.range*weights[5]],score=parts.some(a=>a===null)?null:parts.reduce((s,z)=>s+z,0);
 const zs=zones(b,'15m',p),signs=ready?[Math.abs(d)>p.flowBook?Math.sign(d):0,Math.sign(x.signedProxy),Math.abs(x.cmf)>p.flowCmf?Math.sign(x.cmf):0]:[];
 const flow=!ready?'UNKNOWN':signs.every(y=>y===1)?'LONG':signs.every(y=>y===-1)?'SHORT':signs.includes(1)&&signs.includes(-1)?'MIXED':'NEUTRAL';
 const checklists={};for(const side of ['LONG','SHORT']){const sign=side==='LONG'?1:-1,items=[x.ratio>=p.vr,x.ratio>=p.climax,sign*x.cmf>=p.cmf,ready?sign*d>=p.book:null,zs.some(z=>z.side===side&&z.state!=='INVALIDATED'),flow==='UNKNOWN'?null:flow===side,null,x.range<=p.rangeCheck,x.osc>p.osc,score===null?null:score>=p.score],points=items.filter(Boolean).length;
 const ctx=name==='CONSERVADOR'?['4H','1Dutc']:name==='MODERADO'?['1H','4H']:[];const context=ctx.some(k=>contexts[k]?.status!=='OK')?'UNKNOWN':ctx.every(k=>contexts[k].value.regime===side)?'PASS':'CONFLICT';
 const gate=name==='ULTRAAGRESIVO'?'UNKNOWN_L2_CONTINUO':q===null||!ready?'DATOS_INCOMPLETOS':q<p.volume||x.range>p.range?'FUERA_DE_FILTROS':flow!==side?'CONFLICTO_O_SIN_ALINEACION':ctx.length&&context!=='PASS'?'CONTEXTO_'+context:points>=p.high?'ALTA':points>=p.medium?'MEDIA':'BAJA';
 checklists[side]={points,max:10,unknown:items.filter(z=>z===null).length,items,confluence:gate,context,absorption:'UNKNOWN'};}
 return {profile:name,status:'OK',parameters:p,policy_origin:name==='MODERADO'?'PROPUESTA_INTERMEDIA_NO_CALIBRADA':'UMBRALES_USUARIO',volume:x,attention:score,contributions:parts,flowProxy:flow,zones:zs,checklists,signal:'NO_TRADE_SIGNAL'};
}
export function fundingFact(raw,received,now){
 const rate=n(raw?.fundingRate),hours=n(raw?.fundingRateInterval),next=n(raw?.nextUpdate),asof=n(raw?.timestamp);
 if(rate===null)return fact(null,'UNKNOWN','TASA_NO_DISPONIBLE');
 if(!Number.isFinite(received)||received>now||now-received>120000||next!==null&&next<=now||asof!==null&&(asof>now||now-asof>120000))return fact(null,'STALE','FUNDING_REQUIERE_ACTUALIZACION');
 return fact({rate,percent:rate*100,intervalHours:hours&&hours>0?hours:null,next,asof,received,cashflowPer1000:{LONG:-1000*rate,SHORT:1000*rate},scenario:'TASA_ACTUAL_VARIABLE; SOLO_SI_HAY_POSICION_EN_LA_LIQUIDACION'},hours&&hours>0&&next!==null&&asof!==null?'OK':'PARTIAL','NO_ES_PRONOSTICO');
}
export function tradesFact(raw,now){
 const byId=new Map();for(const x of raw||[]){const price=n(x.price),size=n(x.size),ts=n(x.ts);if(x.tradeId&&price>0&&size>=0&&ts!==null&&ts<=now&&now-ts<=60000&&['buy','sell'].includes(x.side))byId.set(x.tradeId,{id:x.tradeId,side:x.side,ts,notional:price*size});}
 const rows=[...byId.values()];if(!rows.length)return fact(null,'UNKNOWN','SIN_OPERACIONES_RECIENTES_VALIDAS');
 const buy=rows.filter(x=>x.side==='buy').reduce((s,x)=>s+x.notional,0),sell=rows.filter(x=>x.side==='sell').reduce((s,x)=>s+x.notional,0);
 return fact({buy,sell,deltaNotional:buy-sell,count:rows.length,from:Math.min(...rows.map(x=>x.ts)),to:Math.max(...rows.map(x=>x.ts)),largest:rows.sort((a,b)=>b.notional-a.notional).slice(0,5),whaleIdentity:'UNKNOWN',coverage:'ULTIMAS_100_OPERACIONES_COMO_MAXIMO; NO_CVD_COMPLETO'},'PARTIAL');
}
export function quarterBars(months){const groups=new Map();for(const r of months){const d=new Date(r[0]),key=Date.UTC(d.getUTCFullYear(),Math.floor(d.getUTCMonth()/3)*3,1);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}return [...groups].filter(([,a])=>a.length===3&&a.every((r,i)=>new Date(r[0]).getUTCMonth()%3===i)).map(([t,a])=>[t,a[0][1],Math.max(...a.map(x=>x[2])),Math.min(...a.map(x=>x[3])),a[2][4],a.reduce((s,x)=>s+x[5],0)]);}
export function riskPlan({side,entry,stop,targets,quantity,entryFee,exitFee,fundingCash=0}){
 const values=[entry,stop,quantity,entryFee,exitFee,fundingCash].map(n);if(!['LONG','SHORT'].includes(side)||values.some(v=>v===null)||entry<=0||stop<=0||quantity<=0||entryFee<0||exitFee<0||!Array.isArray(targets)||targets.length!==3||targets.some(t=>n(t)===null||t<=0))throw Error('RIESGO_DATOS_INVALIDOS');
 const sign=side==='LONG'?1:-1,risk=sign*(entry-stop);if(risk<=0||targets.some(t=>sign*(t-entry)<=0)||targets.some((t,i)=>i>0&&sign*(t-targets[i-1])<=0))throw Error('GEOMETRIA_INVALIDA');
 const loss=quantity*risk+quantity*(entry*entryFee+stop*exitFee)-fundingCash;
 return {notional:entry*quantity,lossAtStop:loss,legs:targets.map(t=>{const gross=quantity*sign*(t-entry),net=gross-quantity*(entry*entryFee+t*exitFee)+fundingCash;return {target:t,gross,net,rrGross:sign*(t-entry)/risk,rrNet:loss>0?net/loss:null};}),equalThirdsNet:targets.reduce((s,t)=>s+(quantity/3)*(sign*(t-entry)-entry*entryFee-t*exitFee),0)+fundingCash,note:'CADA_LEG_SIMULA_SALIDA_TOTAL; TERCIOS_SEPARADOS. NO_INCLUYE_DESLIZAMIENTO. NO_ENVIA_ORDENES'};
}
export function fredCSV(text,id){
 const lines=text.trim().split(/\r?\n/),head=lines.shift().split(',');if(head.length!==2||head[1]!==id||!['DATE','observation_date'].includes(head[0]))throw Error('FRED_CSV_INVALIDO');
 return lines.map(x=>x.split(',')).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r[0])&&n(r[1])!==null&&n(r[1])>=0).map(([date,value])=>({date,value:Number(value)}));
}
export function netLiquidity(series,now){
 if(['WALCL','WTREGEN','RRPONTSYD'].some(k=>!series[k]?.length))return fact(null,'UNKNOWN','FRED_COBERTURA_INCOMPLETA');
 const maps=Object.fromEntries(Object.entries(series).map(([k,v])=>[k,new Map(v.map(x=>[x.date,x.value]))]));
 const dates=series.WALCL.map(x=>x.date).filter(d=>maps.WTREGEN.has(d)&&maps.RRPONTSYD.has(d)).sort();
 if(!dates.length)return fact(null,'UNKNOWN','FRED_SIN_FECHA_COMUN');
 const date=dates.at(-1),value=maps.WALCL.get(date)/1000-maps.WTREGEN.get(date)/1000-maps.RRPONTSYD.get(date);
 return fact({usdBillions:value,date,formula:'WALCL/1000 - WTREGEN/1000 - RRPONTSYD',frequency:'WALCL nivel miércoles; WTREGEN promedio semanal; RRP diario en fecha común',scope:'PROXY_USD_FED; NO_LIQUIDEZ_GLOBAL'},now-Date.parse(date+'T00:00:00Z')>10*86400000?'STALE':'PARTIAL','GLOBAL_NO_OBSERVADA');
}
export const CHECKS=[['01','Integridad y fecha de fuentes'],['02','Perpetuos USDT e instrumento'],['03','Fractales F1/F2/F3'],['04','BOS / cambio de carácter heurístico'],['05','Pools estimados y barridos con reclaim'],['06','Order blocks / oferta y demanda candidatos'],['07','FVG y mitigación'],['08','Dip LONG / rally SHORT y contexto'],['09','Volumen, CMF y proxies'],['10','Libro, spread y profundidad'],['11','Operaciones ejecutadas / delta de muestra'],['12','Funding e intervalo real'],['13','Open interest y tiempo transcurrido'],['14','Cuatro perfiles sobre datos compartidos'],['15','SL, TP1/2/3, R:R y costes'],['16','Scalp a ciclo de tres años'],['17','Operaciones grandes / identidad de ballena'],['18','Breadth cripto / liquidez USD / global'],['19','Historial durable y registro manual'],['20','Pruebas, cobertura y límites estadísticos']];
