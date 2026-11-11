import {emaSeries,rsiSeries} from './indicators.js';
import {volume} from './engine.js';

const techMean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
export function smaSeries(values,period){
 const out=values.map(()=>null);
 for(let i=period-1;i<values.length;i++){const a=values.slice(i-period+1,i+1);if(a.every(Number.isFinite))out[i]=techMean(a);}
 return out;
}
export function wilderSeries(values,period){
 const out=values.map(()=>null);let seed=[],last=null;
 for(let i=0;i<values.length;i++){
  const v=values[i];if(!Number.isFinite(v)){last=null;seed=[];continue;}
  if(last===null){seed.push(v);if(seed.length===period)last=techMean(seed);}else last+=(v-last)/period;
  out[i]=last;
 }
 return out;
}
function rollingExtrema(values,period,fn){return values.map((_,i)=>i+1<period?null:fn(...values.slice(i-period+1,i+1)));}
function techEMA(values,period){const start=values.findIndex(Number.isFinite);if(start<0)return values.map(()=>null);return [...values.slice(0,start).map(()=>null),...emaSeries(values.slice(start),period)];}
export function technicalSeries(b){
 const close=b.map(r=>r[4]),high=b.map(r=>r[2]),low=b.map(r=>r[3]),vol=b.map(r=>r[5]),typ=b.map(r=>(r[2]+r[3]+r[4])/3);
 const ma=Object.fromEntries([5,10,20,50,200].map(p=>[p,smaSeries(close,p)]));
 const ema=Object.fromEntries([5,9,10,20,21,50,100,200].map(p=>[p,emaSeries(close,p)]));
 const rsi=Object.fromEntries([6,12,14,24].map(p=>[p,rsiSeries(close,p)]));
 const middle=ma[20],sd=close.map((_,i)=>middle[i]===null?null:Math.sqrt(techMean(close.slice(i-19,i+1).map(x=>(x-middle[i])**2))));
 const boll={middle,upper:middle.map((v,i)=>v===null?null:v+2*sd[i]),lower:middle.map((v,i)=>v===null?null:v-2*sd[i])};
 const fast=emaSeries(close,12),slow=emaSeries(close,26),dif=close.map((_,i)=>fast[i]===null||slow[i]===null?null:fast[i]-slow[i]),dea=techEMA(dif,9);
 const macd={dif,dea,histogram:dif.map((v,i)=>v===null||dea[i]===null?null:2*(v-dea[i]))};
 const tr=b.map((r,i)=>i?Math.max(r[2]-r[3],Math.abs(r[2]-b[i-1][4]),Math.abs(r[3]-b[i-1][4])):null),atr=wilderSeries(tr,14),atr10=wilderSeries(tr,10);
 let obvValue=0,adValue=0,pv=0,totalV=0,day='';
 const obv=b.map((r,i)=>{if(i)obvValue+=Math.sign(r[4]-b[i-1][4])*r[5];return obvValue;});
 const ad=b.map(r=>{adValue+=(r[2]===r[3]?0:(2*r[4]-r[2]-r[3])/(r[2]-r[3]))*r[5];return adValue;});
 const vwap=b.map(r=>{const next=new Date(r[0]).toISOString().slice(0,10);if(day!==next){day=next;pv=0;totalV=0;}pv+=(r[2]+r[3]+r[4])/3*r[5];totalV+=r[5];return totalV?pv/totalV:null;});
 const cci=typ.map((v,i)=>{if(i<19)return null;const a=typ.slice(i-19,i+1),mean=techMean(a),dev=techMean(a.map(x=>Math.abs(x-mean)));return dev?(v-mean)/(.015*dev):0;});
 const roc=close.map((v,i)=>i<12?null:(v/close[i-12]-1)*100),mtm=close.map((v,i)=>i<12?null:v-close[i-12]);
 const hi14=rollingExtrema(high,14,Math.max),lo14=rollingExtrema(low,14,Math.min),wr=close.map((v,i)=>hi14[i]===null?null:hi14[i]===lo14[i]?-50:-100*(hi14[i]-v)/(hi14[i]-lo14[i]));
 const hi9=rollingExtrema(high,9,Math.max),lo9=rollingExtrema(low,9,Math.min);let k=50,d=50;
 const kdj={k:[],d:[],j:[]};close.forEach((v,i)=>{if(hi9[i]===null){kdj.k.push(null);kdj.d.push(null);kdj.j.push(null);return;}const rsv=hi9[i]===lo9[i]?50:100*(v-lo9[i])/(hi9[i]-lo9[i]);k=2*k/3+rsv/3;d=2*d/3+k/3;kdj.k.push(k);kdj.d.push(d);kdj.j.push(3*k-2*d);});
 const money=typ.map((v,i)=>({positive:i&&v>typ[i-1]?v*vol[i]:0,negative:i&&v<typ[i-1]?v*vol[i]:0}));
 const mfi=close.map((_,i)=>{if(i<14)return null;const a=money.slice(i-13,i+1),p=a.reduce((s,x)=>s+x.positive,0),m=a.reduce((s,x)=>s+x.negative,0);return p+m===0?null:m===0?100:100-100/(1+p/m);});
 const stochRaw=rsi[14].map((v,i)=>{const a=rsi[14].slice(i-13,i+1);if(a.length<14||!a.every(Number.isFinite))return null;const lo=Math.min(...a),hi=Math.max(...a);return hi===lo?50:(v-lo)/(hi-lo)*100;});
 const stochK=smaSeries(stochRaw,3),stochD=smaSeries(stochK,3);
 const plus=b.map((r,i)=>{if(!i)return null;const up=r[2]-b[i-1][2],down=b[i-1][3]-r[3];return up>down&&up>0?up:0;}),minus=b.map((r,i)=>{if(!i)return null;const up=r[2]-b[i-1][2],down=b[i-1][3]-r[3];return down>up&&down>0?down:0;});
 const pSmooth=wilderSeries(plus,14),mSmooth=wilderSeries(minus,14),pdi=close.map((_,i)=>atr[i]===null?null:atr[i]===0?0:100*pSmooth[i]/atr[i]),mdi=close.map((_,i)=>atr[i]===null?null:atr[i]===0?0:100*mSmooth[i]/atr[i]);
 const dx=pdi.map((v,i)=>v===null?null:v+mdi[i]===0?0:100*Math.abs(v-mdi[i])/(v+mdi[i])),adx=wilderSeries(dx,14);
 const ma10=ma[10],ma50=ma[50],dma=close.map((_,i)=>ma50[i]===null?null:ma10[i]-ma50[i]);
 const emv=b.map((r,i)=>!i||r[5]===0?null:((r[2]+r[3]-b[i-1][2]-b[i-1][3])/2)*(r[2]-r[3])/r[5]*1e8),emv14=smaSeries(emv,14);
 const mid=(period)=>{const h=rollingExtrema(high,period,Math.max),l=rollingExtrema(low,period,Math.min);return h.map((v,i)=>v===null?null:(v+l[i])/2);};
 const tenkan=mid(9),kijun=mid(26),spanB=mid(52),spanA=close.map((_,i)=>tenkan[i]===null||kijun[i]===null?null:(tenkan[i]+kijun[i])/2);
 const sar=close.map(()=>null);let up=b.length>1?close[1]>=close[0]:true,extreme=up?high[0]:low[0],af=.02,current=up?low[0]:high[0];
 for(let i=1;i<b.length;i++){current+=af*(extreme-current);if(up){current=Math.min(current,low[i-1],low[Math.max(0,i-2)]);if(low[i]<current){up=false;current=extreme;extreme=low[i];af=.02;}else if(high[i]>extreme){extreme=high[i];af=Math.min(.2,af+.02);}}else{current=Math.max(current,high[i-1],high[Math.max(0,i-2)]);if(high[i]>current){up=true;current=extreme;extreme=high[i];af=.02;}else if(low[i]<extreme){extreme=low[i];af=Math.min(.2,af+.02);}}sar[i]=current;}
 const supertrend=close.map(()=>null),superSide=close.map(()=>null);let finalUpper=null,finalLower=null,trend=1;
 for(let i=0;i<b.length;i++){if(atr10[i]===null)continue;const upper=(high[i]+low[i])/2+3*atr10[i],lower=(high[i]+low[i])/2-3*atr10[i];finalUpper=finalUpper===null||upper<finalUpper||close[i-1]>finalUpper?upper:finalUpper;finalLower=finalLower===null||lower>finalLower||close[i-1]<finalLower?lower:finalLower;if(trend<0&&close[i]>finalUpper)trend=1;else if(trend>0&&close[i]<finalLower)trend=-1;supertrend[i]=trend>0?finalLower:finalUpper;superSide[i]=trend;}
 return {ma,ema,rsi,boll,macd,atr,vwap,obv,obvMA:smaSeries(obv,30),ad,volMA5:smaSeries(vol,5),volMA10:smaSeries(vol,10),cci,roc,wr,kdj,mfi,stochRSI:{k:stochK,d:stochD},dmi:{plus:pdi,minus:mdi,adx},dma:{dif:dma,signal:smaSeries(dma,10)},mtm:{value:mtm,signal:smaSeries(mtm,6)},emv:{value:emv14,signal:smaSeries(emv14,9)},sar,supertrend,superSide,ichimoku:{tenkan,kijun,spanA,spanB,shift:26}};
}

export function accumulationState(b,series=null){
 if(b.length<50)return {state:'HISTORIA_INSUFICIENTE',status:'UNKNOWN',bars:b.length,required:50,evidence:[]};
 const s=series||technicalSeries(b),v=volume(b),last=b.at(-1),window=b.slice(-20),hi=Math.max(...window.map(r=>r[2])),lo=Math.min(...window.map(r=>r[3])),position=hi===lo?.5:(last[4]-lo)/(hi-lo),obvSlope=s.obv.at(-1)-s.obv.at(-20),adSlope=s.ad.at(-1)-s.ad.at(-20),compression=s.atr.at(-21)>0?s.atr.at(-1)/s.atr.at(-21):null,cmf=v.value?.cmf??null;
 const accumulation=cmf!==null&&cmf>.05&&obvSlope>0&&adSlope>0&&position<.5&&compression!==null&&compression<=1;
 const distribution=cmf!==null&&cmf<-.05&&obvSlope<0&&adSlope<0&&position>.5;
 const trend=s.ema[9].at(-1)>s.ema[21].at(-1)?'AVANCE':'DESCENSO';
 const state=accumulation?'ACUMULACION_CANDIDATA':distribution?'DISTRIBUCION_CANDIDATA':compression!==null&&compression<.8?'COMPRESION_EN_VIGILANCIA':trend;
 return {state,status:'PARTIAL',method:'PROXY_OHLCV_CMF_OBV_ADL_ATR_20; NO_IDENTIDAD_INSTITUCIONAL',asof:last[0],bars:b.length,evidence:[{name:'CMF20',value:cmf},{name:'Pendiente OBV20',value:obvSlope},{name:'Pendiente ADL20',value:adSlope},{name:'ATR14 actual / hace20',value:compression},{name:'Posición rango20',value:position}],note:'Diagnóstico de precio y volumen del instrumento. No acredita tenencias ni compras institucionales.'};
}

export const INDICATOR_CATALOG={MA:'SMA 5/10/20',EMA:'EMA 5/9/10/20/21/50/100/200',BOLL:'Bollinger 20 · 2σ poblacional',SAR:'Parabolic SAR .02 / .20',RESIST:'Pivotes confirmados 2+2',SUPER:'SuperTrend ATR10 · 3',VWAP:'VWAP HLC3 · sesión UTC',ICHI:'Ichimoku 9/26/52 · desplazamiento26',VOL:'Volumen base · SMA5/10',MACD:'12/26/9 · histograma 2×(DIF−DEA)',KDJ:'9/3/3 · semillas K=D=50',RSI:'Wilder 6/12/14/24',ROC:'ROC12 %',CCI:'CCI20 · 0.015',WR:'Williams %R14',OBV:'OBV acumulado · SMA30',STOCH_RSI:'14/14/3/3',MFI:'MFI14 · HLC3×volumen',DMI:'DI14 / ADX14 Wilder',DMA:'SMA10−SMA50 · SMA10',MTM:'Cierre−cierre12 · SMA6',EMV:'EMV14 · escala1e8 · SMA9'};
