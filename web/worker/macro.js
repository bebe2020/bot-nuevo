import {fredCSV, n} from './engine.js';

// Selected public US series, not a global M2 series or a SoSoValue entitlement.
export const MACRO_SERIES = [
  ['DGS2','Tesoro 2 años','% anual','DIARIA',5],
  ['DGS10','Tesoro 10 años','% anual','DIARIA',5],
  ['DGS30','Tesoro 30 años','% anual','DIARIA',5],
  ['DFII10','Tasa real TIPS 10 años','% anual','DIARIA',5],
  ['T10Y2Y','Curva 10 años menos 2 años','puntos porcentuales','DIARIA',5],
  ['DFF','Tasa efectiva Fed funds','% anual','DIARIA',5],
  ['CPIAUCSL','Inflación CPI · nivel','índice 1982–84=100','MENSUAL',75],
  ['PCEPI','Inflación PCE · nivel','índice 2017=100','MENSUAL',75],
  ['PCEPILFE','PCE núcleo · nivel','índice 2017=100','MENSUAL',75],
  ['PAYEMS','Empleo no agrícola','miles de puestos','MENSUAL',75],
  ['UNRATE','Desempleo EE.UU.','%','MENSUAL',75],
  ['BAMLH0A0HYM2','Spread crédito high yield','puntos porcentuales','DIARIA',5],
  ['NFCI','Condiciones financieras Chicago Fed','índice','SEMANAL',15],
  ['VIXCLS','VIX de acciones · cierre','puntos','DIARIA',5],
  ['M2SL','M2 de Estados Unidos','miles de millones USD','MENSUAL',75],
  ['WALCL','Activos totales Fed','millones USD','SEMANAL',15],
  ['WDTGAL','TGA · nivel miércoles','millones USD','SEMANAL',15],
  ['RRPONTSYD','Reverse repo overnight','miles de millones USD','DIARIA',5],
  ['WRESBAL','Reservas bancarias Fed','miles de millones USD','SEMANAL',15],
  ['DTWEXBGS','Dólar amplio ponderado · distinto de DXY','índice enero 2006=100','DIARIA',5]
].map(([id,label,unit,frequency,maxAgeDays])=>({id,label,unit,frequency,maxAgeDays,source:'https://fred.stlouisfed.org/series/'+id}));

const MACRO_SEED = '__BUILD_MACRO_CAPTURE__';
const macroFlights = new WeakMap();
const MACRO_MIRROR='https://raw.githubusercontent.com/bebe2020/bot-nuevo/market-data/macro.json';

export function validateMacroMirror(value,now=Date.now()) {
  if(value?.accountData!==false||!Array.isArray(value.metrics)||value.metrics.length!==20||new Set(value.metrics.map(x=>x.id)).size!==20)throw Error('CAPTURA_MACRO_INVALIDA');
  return MACRO_SERIES.map(def=>{
    const x=value.metrics.find(x=>x.id===def.id);
    if(!x)throw Error('IDENTIDAD_MACRO_INVALIDA');
    if(x.value===null)return {...def,value:null,asof:null,status:'UNKNOWN'};
    if(!Number.isFinite(x.value)||!Number.isFinite(x.asof)||x.asof>now||!Number.isFinite(x.received)||x.received>now||x.asof>x.received||Date.parse(x.date)!==x.asof||!Array.isArray(x.history)||x.history.some(p=>!Number.isFinite(p.value)||!Number.isFinite(Date.parse(p.date))||Date.parse(p.date)>x.asof))throw Error('RELOJ_O_HISTORIA_MACRO_INVALIDOS');
    return {...x,...def,transport:'CAPTURA_PUBLICA_GITHUB'};
  });
}

export function macroPoint(def, text, now=Date.now()) {
  const rows=fredCSV(text,def.id).filter(x=>Number.isFinite(Date.parse(x.date))&&Date.parse(x.date)<=now).sort((a,b)=>a.date.localeCompare(b.date));
  if (!rows.length) throw Error('SERIE_SIN_OBSERVACIONES_FECHADAS');
  const last=rows.at(-1), previous=rows.at(-2), asof=Date.parse(last.date);
  const priorYear=new Date(asof); priorYear.setUTCFullYear(priorYear.getUTCFullYear()-1);
  const year=def.frequency==='MENSUAL'?[...rows].reverse().find(x=>Date.parse(x.date)<=priorYear.getTime()):null;
  return {...def,value:last.value,date:last.date,asof,received:now,
    previousDate:previous?.date??null,change:previous?last.value-previous.value:null,
    yoy:year?.value>0?(last.value/year.value-1)*100:null,
    status:now-asof>def.maxAgeDays*86400000?'STALE':'OK',
    changeMethod:'DIFERENCIA_EN_UNIDAD_DE_LA_SERIE; NO_RETORNO_24H',
    history:rows.slice(-60)};
}

export function ageMacro(value,now=Date.now()) {
  const metrics=MACRO_SERIES.map(def=>{
    const x=value?.metrics?.find(x=>x.id===def.id);
    if (!x || n(x.value)===null || n(x.asof)===null || x.asof>now) return {...def,value:null,asof:null,status:'UNKNOWN',error:x?.error||'SIN_OBSERVACION'};
    return {...x,status:x.status==='STALE'||now-x.asof>def.maxAgeDays*86400000?'STALE':'OK'};
  });
  const observed=metrics.filter(x=>x.status==='OK').length;
  return {...value,metrics,servedAt:now,status:observed===metrics.length?'OK':observed?'PARTIAL':'UNKNOWN',
    coverage:{observed,total:metrics.length,stale:metrics.filter(x=>x.status==='STALE').length},
    scope:'EEUU; FUENTES_PUBLICAS; NO_M2_GLOBAL; NO_PREDICCION',
    liquidityUSD:usdLiquidity(metrics,now),
    globalLiquidity:{status:'UNKNOWN',reason:'Faltan series monetarias internacionales con conversión y fechas comparables.'}};
}

export function usdLiquidity(metrics,now=Date.now()) {
  const ids=['WALCL','WDTGAL','RRPONTSYD'];
  const components=ids.map(id=>metrics.find(x=>x.id===id));
  if(components.some(x=>!x?.history?.length))return {status:'UNKNOWN',value:null,reason:'COMPONENTES_SIN_HISTORIA_COMUN'};
  const maps=components.map(x=>new Map(x.history.filter(p=>Number.isFinite(p.value)&&p.value>=0&&Date.parse(p.date)<=now).map(p=>[p.date,p.value])));
  const dates=[...maps[0].keys()].filter(d=>maps.every(m=>m.has(d))).sort();
  if(!dates.length)return {status:'UNKNOWN',value:null,reason:'SIN_FECHA_COMUN'};
  const compute=d=>maps[0].get(d)/1000-maps[1].get(d)/1000-maps[2].get(d);
  const date=dates.at(-1),previousDate=dates.at(-2);
  return {status:components.some(x=>x.status!=='OK')||now-Date.parse(date)>15*86400000?'STALE':'PARTIAL',
    value:compute(date),unit:'miles de millones USD',date,asof:Date.parse(date),previousDate:previousDate||null,change:previousDate?compute(date)-compute(previousDate):null,
    formula:'WALCL/1000 − WDTGAL/1000 − RRPONTSYD',
    scope:'PROXY_USD_FED; WALCL_Y_TGA_NIVEL_MIERCOLES; RRP_MISMA_FECHA; NO_LIQUIDEZ_GLOBAL'};
}

async function readMacro(bucket,fetcher,now,{preferMirror=true}={}) {
  const file=await bucket?.get('providers/macro-v1.json');
  const prior=file?await file.json():(typeof MACRO_SEED==='object'?MACRO_SEED:null);
  if (prior?.nextCheck>now&&!prior.metrics?.some(x=>x.error)) return ageMacro(prior,now);
  // FRED may reject a Worker while allowing the scheduled public collector.
  // A successful mirror read is a new transport, never a new source timestamp.
  if(preferMirror)try {
    const r=await fetcher(MACRO_MIRROR+'?slot='+Math.floor(now/300000),{signal:AbortSignal.timeout(7000)});
    if(r.ok){
      const text=await r.text();if(text.length>1000000)throw Error('CAPTURA_DEMASIADO_GRANDE');
      const mirrorValue=JSON.parse(text),mirror=validateMacroMirror(mirrorValue,now);
      if(Number.isFinite(mirrorValue.checkedAt)&&mirrorValue.checkedAt<=now&&now-mirrorValue.checkedAt<=1800000&&mirror.some(x=>x.value!==null)){
        const metrics=mirror.map(x=>{
          const old=prior?.metrics?.find(p=>p.id===x.id);
          return old&&old.asof>x.asof||old&&old.asof===x.asof&&old.received>x.received&&!old.error?old:x;
        });
        const value={metrics,accountData:false,checkedAt:now,nextCheck:now+300000,transport:'CAPTURA_PUBLICA_GITHUB',captureCheckedAt:mirrorValue.checkedAt};
        if(bucket)await bucket.put('providers/macro-v1.json',JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
        return ageMacro(value,now);
      }
    }
  }catch{}
  const metrics=new Array(MACRO_SERIES.length); let next=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(next<MACRO_SERIES.length) {
      const i=next++,def=MACRO_SERIES[i];
      try {
        const since=new Date(now-550*86400000).toISOString().slice(0,10);
        const r=await fetcher('https://fred.stlouisfed.org/graph/fredgraph.csv?id='+def.id+'&cosd='+since,{signal:AbortSignal.timeout(7000)});
        if(!r.ok) throw Error('HTTP_'+r.status);
        const text=await r.text(); if(text.length>1000000) throw Error('SERIE_DEMASIADO_GRANDE');
        metrics[i]=macroPoint(def,text,now);
      } catch(e) {
        const old=prior?.metrics?.find(x=>x.id===def.id&&n(x.value)!==null);
        metrics[i]=old?{...old,status:'STALE',error:e.message}:{...def,value:null,asof:null,status:'UNKNOWN',error:e.message};
      }
    }
  }));
  if(metrics.some(x=>x.error))try{
    const r=await fetcher(MACRO_MIRROR+'?slot='+Math.floor(now/300000),{signal:AbortSignal.timeout(7000)});
    if(r.ok){const text=await r.text();if(text.length>1000000)throw Error('CAPTURA_DEMASIADO_GRANDE');
      const mirror=validateMacroMirror(JSON.parse(text),now);
      for(let i=0;i<metrics.length;i++)if(metrics[i].error&&mirror[i].value!==null&&(!metrics[i].asof||mirror[i].asof>metrics[i].asof||mirror[i].asof===metrics[i].asof&&mirror[i].received>metrics[i].received))metrics[i]=mirror[i];
    }
  }catch{}
  const value={metrics,accountData:false,checkedAt:now,nextCheck:now+(metrics.some(x=>x.error)?300000:900000)};
  if(bucket) await bucket.put('providers/macro-v1.json',JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
  return ageMacro(value,now);
}

export function macroProvider(bucket,fetcher=fetch,now=Date.now(),options={}) {
  if(fetcher!==fetch || !bucket) return readMacro(bucket,fetcher,now,options);
  if(!macroFlights.has(bucket)) macroFlights.set(bucket,readMacro(bucket,fetcher,now,options).finally(()=>macroFlights.delete(bucket)));
  return macroFlights.get(bucket);
}

export function capitalRegime(cross,now=Date.now()) {
  const read=id=>{
    const x=cross?.assets?.find(x=>x.id===id);
    if(!x || !['OK','DELAYED_OR_CLOSED'].includes(x.status) || !(x.asof<=now && now-x.asof<=5*86400000)) return null;
    return n(x.change20d);
  };
  const stocks=read('^GSPC'),bonds=read('TLT'),gold=read('GC=F'),dollar=read('DX-Y.NYB');
  const observed=[stocks,bonds,gold,dollar].filter(x=>x!==null).length;
  return {state:observed<4?'UNKNOWN':stocks>0&&dollar<=0?'RIESGO_FAVORABLE':stocks<0&&dollar>0?'RIESGO_DEFENSIVO':'TRANSICION',
    observed,total:4,stocks,bonds,gold,dollar,
    method:'REGLA_DESCRIPTIVA_20_SESIONES; NO_FLUJO_NETO_NI_CAUSALIDAD',evaluatedAt:now};
}
