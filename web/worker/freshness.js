import {FRAMES,endOfBar,n} from './engine.js';

// asof is a source close, never the time the cached payload was served.
export function expectedClose(tf,now){
 const d=new Date(now);
 if(tf==='1Mutc')return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1);
 if(tf==='3M')return Date.UTC(d.getUTCFullYear(),Math.floor(d.getUTCMonth()/3)*3,1);
 if(tf==='1Wutc')return Math.floor((now-345600000)/604800000)*604800000+345600000;
 return FRAMES[tf]>0?Math.floor(now/FRAMES[tf])*FRAMES[tf]:null;
}
export function barClock(tf,asof,now=Date.now(),graceMs=10000){
 const t=n(asof),expected=expectedClose(tf,now);
 if(t===null||expected===null||t>now)return {state:'UNKNOWN',asof:t,expected,validUntil:null,reason:'RELOJ_DE_CIERRE_NO_VALIDO'};
 const validUntil=endOfBar(t,tf)+graceMs,aligned=expectedClose(tf,t)===t;
 if(!aligned)return {state:'UNKNOWN',asof:t,expected,validUntil:null,reason:'CIERRE_NO_ALINEADO_AL_CALENDARIO'};
 const valid=t===expected||endOfBar(t,tf)===expected&&now<=expected+graceMs;
 return {state:valid?'OK':'STALE',asof:t,expected,validUntil,reason:valid?null:'FALTA_ULTIMA_VELA_CERRADA'};
}
export function frameClock(s,tf,now=Date.now()){
 const f=s.structures?.[tf],b=s.closed?.[tf],asof=b?.length?endOfBar(b.at(-1)[0],tf):f?.value?.asof;
 const c=barClock(tf,asof,now);
 return {...c,state:f?.status==='OK'?c.state:f?.status==='STALE'?'STALE':'UNKNOWN'};
}
export function feedHealth(status,now=Date.now()){
 const lastSuccess=n(status.lastSuccess),asof=n(status.sourceAsOf),ageMs=lastSuccess!==null&&lastSuccess<=now?now-lastSuccess:null;
 const valid=ageMs!==null&&(asof===null||asof<=lastSuccess&&asof<=now);
 const age=Math.max(ageMs??0,asof===null?0:now-asof),targetMs=300000;
 const state=status.state==='ERROR'?'ERROR':!valid?'UNKNOWN':age>900000?'STALE':age>2*targetMs?'DELAYED':'OK';
 return {...status,observationState:status.state,state,ageMs:valid?age:null,checkedAt:now,targetIntervalMinutes:5,
   nextExpectedAt:lastSuccess===null?null:lastSuccess+targetMs,missedTargets:valid?Math.max(0,Math.floor(ageMs/targetMs)-1):null,
   reason:state==='ERROR'?'ULTIMO_INTENTO_FALLO':!valid?'RELOJ_NUBE_NO_VALIDO':state==='STALE'?'CAPTURA_VENCIDA':state==='DELAYED'?'CADENCIA_RETRASADA':state==='ERROR'?'ULTIMO_INTENTO_FALLO':null};
}
