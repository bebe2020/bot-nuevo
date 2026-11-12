import {VERSION,FRAMES,HORIZONS,POLICIES,n,endOfBar,structures,volume,riskPlan} from './engine.js';
import {fibonacci,indicatorSeries,volumeProfile,discountFromHistory} from './indicators.js';
import {ASSETS,TAXONOMY,assetFor} from './universe.js';
import {barClock,frameClock} from './freshness.js';
import {accumulationState} from './technicals.js';
export const PROTOCOL_VERSION='protocolo-2.2';
export const PROTOCOLS={
 MICRO_PIVOTE:{label:'Micro pivote · futuros',markets:['PERP'],frames:['1m','5m','15m'],window:4,kind:'TACTICO',rule:'Solo PERP. Barrido de 20 extremos y reclaim cerrado en 1m; contexto 5m/15m. Detección provisional separada de cierre.'},
 EXPLOSION:{label:'Explosión SPOT',markets:['SPOT'],frames:['5m','15m','1H'],window:4,kind:'TACTICO',rule:'SPOT LONG: barrido/reclaim o ruptura con retesteo cerrado en 5m, volumen relativo ≥2× y CMF positivo. Caída o subida fuerte aislada permanece en vigilancia.'},
 ACUMULACION:{label:'Acumulación SPOT',markets:['SPOT'],frames:['1Dutc','1Wutc','1Mutc'],window:4,kind:'TACTICO',rule:'SPOT LONG: compresión diaria, CMF/OBV/ADL compatibles, defensa o zona Fibonacci con invalidación propia. Proxy OHLCV; descuento no prueba infravaloración.'},
 SCALP:{label:'Scalping',frames:['5m','15m','1H'],window:4,kind:'TACTICO',rule:'Barrido/reclaim 5m o ruptura cerrada con retesteo; invalidación táctica. No trasladar su stop a swing.'},
 DIARIO:{label:'Diario',frames:['15m','1H','4H'],window:4,kind:'TACTICO',rule:'Gatillo 15m cerrado y contexto 1H/4H. Anticipación conserva condiciones pendientes.'},
 SEMANAL:{label:'Swing semanal',frames:['4H','1Dutc','1Wutc'],window:4,kind:'TACTICO',rule:'Barrido o retesteo 4H; contexto diario/semanal. Zonas y targets pertenecen a este horizonte.'},
 MENSUAL:{label:'Swing mensual',frames:['1Dutc','1Wutc','1Mutc'],window:4,kind:'TACTICO',rule:'Gatillo diario cerrado, contexto semanal/mensual. Descuento solo no acredita acumulación.'},
 TRIMESTRAL:{label:'Trimestre calendario',frames:['1Wutc','1Mutc','3M'],kind:'ESTRUCTURAL',rule:'Trimestres completos de calendario, independientes de rolling 90 días. Radar de contexto; no dispara entrada táctica.'},
 CICLO_3_ANOS:{label:'Ciclo · 3 años',frames:['1Mutc','3M','36M'],kind:'ESTRUCTURAL',rule:'Contexto mensual y disponibilidad de 36 meses propios. No hereda historia de otro token. No es predicción del ciclo.'}
};
export const protocolApplicable=(horizon,market)=>!!PROTOCOLS[horizon]&&(!PROTOCOLS[horizon].markets||PROTOCOLS[horizon].markets.includes(market));
function notApplicable(horizon,market,profile){return {version:PROTOCOL_VERSION,profile,admission:'NO_APLICA_MERCADO',phase:'NO_APLICA',kind:'OBSERVACION',pending:['Elegir una modalidad disponible para '+market],keys:Object.fromEntries(['K1','K2','K3','K4'].map(k=>[k,{state:'NOT_APPLICABLE',reason:PROTOCOLS[horizon].label+' no aplica a '+market}])),summary:'Modalidad no aplicable al mercado seleccionado.'};}
const keyFact=(state,reason,evidence=null)=>({state,reason,evidence});
function currentPrice(s){return s.currentPrice!==undefined?n(s.currentPrice):n(s.ticker?.lastPr);}
function instrumentTick(s){const p=n(s.instrument?.pricePlace??s.instrument?.pricePrecision),step=n(s.instrument?.priceEndStep)??1;return p!==null&&p>=0&&p<=12&&step>0?step*10**(-p):null;}
export function makeGeometry(s,horizon,side,family,event,entry,extreme,targets){const st=s.structures[PROTOCOLS[horizon].frames[0]],atr=st?.value?.atr;if(!(entry>0&&extreme>0&&atr>0))return null;const sign=side==='LONG'?1:-1,tick=instrumentTick(s),round=(p,method)=>tick?Number((Math[method](p/tick)*tick).toPrecision(14)):p;
 entry=round(entry,'round');const stop=round(extreme-sign*.1*atr,side==='LONG'?'floor':'ceil');targets=[...new Set(targets.filter(x=>n(x)>0).map(x=>round(x,side==='LONG'?'floor':'ceil')).filter(x=>sign*(x-entry)>0))].sort((a,b)=>sign*(a-b)).slice(0,3);if(sign*(entry-stop)<=0)return null;
 return {lifecycleId:['protocolo-2.0',s.market,s.symbol,horizon,side,family,event,entry,stop].join(':'),id:['protocolo-2.0',s.market,s.symbol,horizon,side,family,event,entry,stop,...targets].join(':'),symbol:s.symbol,market:s.market,venue:s.venue,horizon,side,family,formed:event,entry,stop,targets,rr:targets.map(t=>sign*(t-entry)/(sign*(entry-stop))),tick,source:'REGLAS_EXPLICITAS_NO_CALIBRADAS',stopMethod:'EXTREMO_MAS_0.1_ATR',targetMethod:family==='FIBONACCI'?'EXTREMO_OBSERVADO_Y_EXTENSIONES_PROYECTADAS':'PIVOTES_OBSERVADOS',execution:'INTENCION_CALCULADA_SIN_FILL'};
}
export function protocolGeometryValid(idea){
 const sign=idea.side==='LONG'?1:idea.side==='SHORT'?-1:0,entry=n(idea.entry),stop=n(idea.stop),tick=n(idea.tick),targets=idea.targets;
 return !!(sign&&entry>0&&stop>0&&sign*(entry-stop)>0&&tick>0&&Array.isArray(targets)&&targets.length===3&&targets.every((t,i)=>n(t)>0&&sign*(t-entry)>0&&(!i||sign*(t-targets[i-1])>0)));
}
// Admission is recomputed from dated evidence, including cached non-selected rows.
function admissionFor(profile,context,flow,trigger,geometry,invalidated,expired){
 if(invalidated)return 'INVALIDADA';if(expired)return 'CADUCADA';
 if(profile==='ULTRAAGRESIVO')return 'OBSERVACION_SIN_L2_CONTINUO';
 const ready=trigger&&flow==='PASS'&&geometry;
 if(profile==='CONSERVADOR')return context==='PASS'&&ready?'CONFIRMADA':'ESPERA_CONFIRMACION_Y_CONTEXTO';
 if(profile==='MODERADO')return context==='PASS'&&ready?'CONFIRMADA':'CONDICIONAL';
 return ready?'CONFIRMADA':trigger&&flow==='CONFLICT'?'ANTICIPADA_CON_FLUJO_CONTRARIO':'ANTICIPADA';
}
export function refreshEvaluation(e,idea,now=Date.now(),quote=null){
 if(!protocolApplicable(idea.horizon,idea.market))return notApplicable(idea.horizon,idea.market,e.profile);
 const p=PROTOCOLS[idea.horizon],tf=p.frames[0],keys=structuredClone(e.keys);
 const contexts=(keys.K1.evidence||[]).map(x=>({...x,clock:barClock(x.tf,x.asof,now)}));
 keys.K1.state=contexts.length===2&&contexts.every(x=>x.status==='OK'&&x.clock.state==='OK')?(contexts.every(x=>x.regime===idea.side)?'PASS':'CONFLICT'):'UNKNOWN';
 const inputs=(keys.K2.evidence?.inputs||[]).filter(x=>n(x.value)!==null&&n(x.asof)!==null&&x.asof<=now&&n(x.validUntil)!==null&&now<=x.validUntil);
 keys.K2.state=!inputs.length?'UNKNOWN':inputs.some(x=>x.value<0)?'CONFLICT':inputs.some(x=>x.value>0)?'PASS':'UNKNOWN';
 keys.K2.evidence={...keys.K2.evidence,used:inputs.map(x=>x.id)};
 const closedTrigger=['BARRIDO_RECLAIM','CONTINUACION_RETEST'].includes(idea.family),triggerClock=barClock(tf,keys.K3.evidence?.sourceAsOf,now);
 keys.K3.state=closedTrigger&&n(idea.formed)!==null&&idea.formed<=now&&keys.K3.evidence?.sourceState==='OK'?(triggerClock.state==='OK'?'PASS':triggerClock.state):'UNKNOWN';
 const expired=now-idea.formed>4*(FRAMES[tf]||86400000),price=quote?n(quote.price):e.currentPrice,priceAsOf=quote?n(quote.asof):n(e.priceAsOf),sign=idea.side==='LONG'?1:-1;
 const invalidated=e.phase==='INVALIDADA'||price!==null&&priceAsOf!==null&&priceAsOf<=now&&now-priceAsOf<=5000&&sign*(price-idea.stop)<=0;
 keys.K4.state=protocolGeometryValid(idea)?'PASS':'UNKNOWN';
 let admission=admissionFor(e.profile,keys.K1.state,keys.K2.state,keys.K3.state==='PASS',keys.K4.state==='PASS',invalidated,expired);
 if(admission==='CONFIRMADA'&&!(price>0&&priceAsOf!==null&&priceAsOf<=now&&now-priceAsOf<=5000))admission='ESPERA_PRECIO_FRESCO';
 const pending=Object.entries(keys).filter(([,v])=>v.state!=='PASS').map(([k,v])=>k+': '+v.reason);
 if(admission==='ESPERA_PRECIO_FRESCO')pending.unshift('Falta cotización vigente del mismo mercado');
 if(e.profile==='ULTRAAGRESIVO')pending.unshift('Falta registro L2 continuo con calidad y latencia medidos');
 return {...e,version:PROTOCOL_VERSION,keys,admission,pending,phase:invalidated?'INVALIDADA':expired?'CADUCADA':closedTrigger?'GATILLO_CERRADO':'ANTICIPADA',kind:admission==='CONFIRMADA'?'DISPARO_CANDIDATO':'ANTICIPADA',currentPrice:price,priceAsOf,evaluatedAt:now,countertrend:keys.K1.state==='CONFLICT',
  summary:invalidated?'El precio atravesó el stop. No se rearma por un rebote.':expired?'El evento superó su ventana de entrada.':'K1 '+keys.K1.state+' · K2 '+keys.K2.state+' · K3 '+keys.K3.state+'. Perfil '+e.profile+': '+admission.toLowerCase().replaceAll('_',' ')+'.'};
}
export function evaluateIdea(s,idea,profile,now=Date.now()){
 if(!protocolApplicable(idea.horizon,idea.market))return notApplicable(idea.horizon,idea.market,profile);
 const p=PROTOCOLS[idea.horizon],tf=p.frames[0],sign=idea.side==='LONG'?1:-1,price=currentPrice(s),b=s.closed[tf]||[],clock=frameClock(s,tf,now),vol=volume(b),book=s.book;
 const contexts=p.frames.slice(1).map(k=>({tf:k,status:s.structures[k]?.status,regime:s.structures[k]?.value?.regime,asof:frameClock(s,k,now).asof}));
 const bookAsOf=n(book?.asof),imbalance=n(book?.value?.imbalance),tradeTo=n(s.trades?.value?.to),delta=n(s.trades?.value?.deltaNotional),inputs=[];
 if(book?.status==='OK'&&bookAsOf!==null&&imbalance!==null&&Math.abs(imbalance)<=1&&bookAsOf<=now&&now-bookAsOf<=5000)inputs.push({id:'DOM',value:sign*imbalance,asof:bookAsOf,validUntil:bookAsOf+5000});
 if(['OK','PARTIAL'].includes(s.trades?.status)&&tradeTo!==null&&delta!==null&&tradeTo<=now&&now-tradeTo<=60000)inputs.push({id:'DELTA_MUESTRA',value:sign*delta,asof:tradeTo,validUntil:tradeTo+60000});
 if(vol.status==='OK'&&clock.state==='OK')inputs.push({id:'CMF_CERRADO',value:sign*vol.value.cmf,asof:clock.asof,validUntil:clock.validUntil});
 const geometry=protocolGeometryValid(idea);
 const keys={K1:keyFact('UNKNOWN','Contexto fechado '+p.frames.slice(1).join(' / '),contexts),
  K2:keyFact('UNKNOWN','CMF cerrado y DOM/delta de muestra solo vigentes; no CVD ni absorción',{inputs,cmf:vol.value?.cmf??null,bookAsOf,bookUsed:inputs.some(x=>x.id==='DOM'),tradeTo,tradeUsed:inputs.some(x=>x.id==='DELTA_MUESTRA')}),
  K3:keyFact('UNKNOWN','Evento cerrado con última vela verificable; un toque no prueba fill',{formed:idea.formed,tf,family:idea.family,sourceAsOf:clock.asof,sourceState:clock.state}),
  K4:keyFact(geometry?'PASS':'UNKNOWN',geometry?'Geometría válida; sizing y estadística separados':'Faltan geometría o tres objetivos válidos',{entry:idea.entry,stop:idea.stop,rr:idea.rr,tick:idea.tick,sizing:'SIN_RIESGO_PERSONAL_CONFIGURADO',statistics:'SIN_VALIDACION_ESTADISTICA'})};
 const after=b.filter(r=>endOfBar(r[0],tf)>idea.formed),invalidated=after.some(r=>sign*((idea.side==='LONG'?r[3]:r[2])-idea.stop)<=0);
 const priceAsOf=s.currentPrice!==undefined?n(s.currentPriceAsOf):n(s.ticker?.ts??s.sourceAsOf);
 return refreshEvaluation({profile,keys,phase:invalidated?'INVALIDADA':'OBSERVADA',currentPrice:price,priceAsOf,stats:'NO_CERTIFICADA',sizing:'NO_CONFIGURADO'},idea,now);
}
export function protocolIdeas(s,horizon){const p=PROTOCOLS[horizon];if(!p||!protocolApplicable(horizon,s.market)||p.kind==='ESTRUCTURAL')return [];const tf=p.frames[0],st=s.structures[tf],b=s.closed[tf]||[];if(st?.status!=='OK')return [];const candidates=[],price=currentPrice(s),allPivots=p.frames.flatMap(frame=>s.structures[frame]?.status==='OK'?s.structures[frame].value.pivots||[]:[]);
 if(horizon==='EXPLOSION'&&!(volume(b).value?.ratio>=2&&volume(b).value?.cmf>0))return [];
 if(horizon==='ACUMULACION'&&accumulationState(b).state!=='ACUMULACION_CANDIDATA')return [];
 for(const e of st.value.sweeps){const sign=e.side==='LONG'?1:-1,targets=allPivots.filter(x=>x.type===(e.side==='LONG'?'HIGH':'LOW')&&sign*(x.price-e.level)>0).map(x=>x.price),idea=makeGeometry(s,horizon,e.side,'BARRIDO_RECLAIM',e.detected,e.level,e.extreme,targets);if(idea)candidates.push(idea);}
 const fib=fibonacci(b,tf,price);if(fib.status==='OK'&&price!==null&&price>=fib.ote[0]-st.value.atr*.5&&price<=fib.entryZone[1]+st.value.atr*.5){const entry=(fib.entryZone[0]+fib.entryZone[1])/2,idea=makeGeometry(s,horizon,fib.side,'FIBONACCI',fib.asof,entry,fib.anchorA.price,[fib.anchorB.price,...fib.extensions.map(x=>x.price)]);if(idea)candidates.push(idea);}
 // Retesteo causal: ruptura en una vela anterior y una vela posterior cerrada defendiendo el nivel.
 for(let i=Math.max(30,b.length-4);i<b.length-1;i++){const earlier=structures(b.slice(0,i+1),tf);if(earlier.value?.bos){const side=earlier.value.bos,sign=side==='LONG'?1:-1,level=earlier.value.pivots.filter(x=>x.type===(side==='LONG'?'HIGH':'LOW')).at(-1)?.price,r=b[i+1];if(level&&r[3]<=level&&r[2]>=level&&sign*(r[4]-level)>0){const idea=makeGeometry(s,horizon,side,'CONTINUACION_RETEST',endOfBar(r[0],tf),level,side==='LONG'?r[3]:r[2],allPivots.filter(x=>x.type===(side==='LONG'?'HIGH':'LOW')).map(x=>x.price));if(idea)candidates.push(idea);}}}
 return [...new Map(candidates.filter(x=>(s.market!=='SPOT'||x.side==='LONG')&&(horizon!=='EXPLOSION'||x.family!=='FIBONACCI')).map(x=>[x.id,x])).values()].map(x=>({...x,evaluations:Object.fromEntries(Object.keys(POLICIES).map(name=>[name,evaluateIdea(s,x,name,s.received)]))}));
}
export function enrichSnapshot(s){s.indicators=Object.fromEntries(Object.entries(s.closed).map(([tf,b])=>[tf,{rsi:rsiSeriesLast(b),fib:fibonacci(b,tf,currentPrice(s)),profile:volumeProfile(b)}]));s.asset=assetFor(s.symbol);s.protocols=PROTOCOLS;s.plans=Object.fromEntries(Object.keys(PROTOCOLS).map(h=>[h,protocolIdeas(s,h)]));s.narrative=marketNarrative(s);s.taxonomyRevision=TAXONOMY.revision;return s;}
function rsiSeriesLast(b){return b.length?indicatorSeries(b).rsi.at(-1):null;}
export function marketNarrative(s){const context=['1H','4H','1Dutc','1Wutc'].map(tf=>tf+': '+(s.structures[tf]?.value?.regime||s.structures[tf]?.status||'UNKNOWN')),rsi=s.indicators?.['4H']?.rsi,fib=s.indicators?.['4H']?.fib,vol=volume(s.closed['15m']||[]),asset=assetFor(s.symbol);return {title:asset?.proyecto??s.symbol,tags:asset?.narrativas||[],text:context.join(' · ')+'. '+(rsi===null?'RSI 4H no disponible. ':'RSI 4H '+rsi.toFixed(1)+(rsi<30?': sobreventa, no confirma un piso. ':rsi>70?': sobrecompra, no confirma un techo. ':': zona intermedia. '))+(fib?.status==='OK'?'Precio en '+fib.location.toLowerCase()+' del último impulso confirmado. ':'Fibonacci sin anclas válidas. ')+(vol.status==='OK'?'Volumen relativo '+vol.value.ratio.toFixed(2)+'× en última vela cerrada. ':'Volumen sin cobertura suficiente. '),method:'LECTURA_DE_REGLAS_Y_DATOS; SIN_LLAMADAS_A_IA',notForecast:true};}
export function sectorStrength(universe){const median=xs=>{const a=xs.sort((x,y)=>x-y),i=Math.floor(a.length/2);return a.length?(a.length%2?a[i]:(a[i-1]+a[i])/2):null;};return Object.entries(TAXONOMY.categories).map(([id,label])=>{const members=ASSETS.filter(a=>a.narrativas.includes(id)).map(a=>a.base+'USDT');if(!members.length)return null;const rows=universe.filter(r=>members.includes(r.symbol));return {id,label,total:members.length,known:rows.filter(r=>r.change!==null&&r.change!==undefined).length,median24h:median(rows.map(x=>x.change===null||x.change===undefined?null:x.change*100).filter(x=>x!==null)),median7d:median(rows.map(x=>x.return7d).filter(x=>n(x)!==null)),median30d:median(rows.map(x=>x.return30d).filter(x=>n(x)!==null)),symbols:members,asof:Math.min(...rows.map(x=>x.sourceAsOf).filter(x=>n(x)!==null)),method:'MEDIANA_DE_RETORNOS; GRUPOS_SOLAPADOS; NO_FLUJO_NETO'};}).filter(Boolean);}
export {discountFromHistory};

export function protocolReadiness(s, horizon, profile, idea = null, now = Date.now()) {
 if(!protocolApplicable(horizon,s.market))return notApplicable(horizon,s.market,profile);
 if (idea) return evaluateIdea(s, idea, profile, now);
 const protocol = PROTOCOLS[horizon];
 const contexts = protocol.frames.map(tf => ({tf,status:tf==='36M'?s.cycle?.status:frameClock(s,tf,now).state,
   regime:s.structures[tf]?.value?.regime??null,bars:tf==='36M'?s.cycle?.value?.months:(s.closed[tf]?.length||0),
   asof:s.structures[tf]?.value?.asof??null}));
 const vol = volume(s.closed[protocol.frames[0]] || []);
 const structural = protocol.kind === 'ESTRUCTURAL';
 const contextText = contexts.map(x => x.tf + ': ' + (x.regime || x.status || 'UNKNOWN') + ' (' + x.bars + ' barras)').join(' · ');
 const keys = {
  K1:keyFact(contexts.every(x=>x.status==='OK')?'PASS':'UNKNOWN',contextText,contexts),
  K2:keyFact('UNKNOWN',vol.value?'CMF '+vol.value.cmf.toFixed(3)+' · volumen relativo '+vol.value.ratio.toFixed(2)+'×; falta tesis direccional para evaluar confluencia.':vol.reason||'Sin volumen cerrado suficiente',vol.value),
  K3:keyFact(structural?'NOT_APPLICABLE':'UNKNOWN',structural?'Contexto estructural; no emite gatillo táctico.':'Sin evento vigente con geometría para '+protocol.frames[0]+'. Esperar barrido/reclaim cerrado, retesteo o entrada Fibonacci según la regla.'),
  K4:keyFact('NOT_APPLICABLE','Entrada, stop y objetivos aparecen cuando existe una tesis válida; los datos del contexto siguen visibles.')
 };
 const pending = [structural?'Consultar el radar del mercado seleccionado.':profile==='ULTRAAGRESIVO'?'Falta evento vigente y registro L2 continuo medido.':profile==='CONSERVADOR'?'Esperar evento cerrado, contexto alineado y flujo compatible.':profile==='MODERADO'?'Esperar evento cerrado, contexto alineado y flujo positivo vigente.':'Vigilar zona y evento; una anticipada conserva su confirmación pendiente.'];
 return {profile,admission:structural?'CONTEXTO_ESTRUCTURAL':'VIGILANCIA_SIN_EVENTO',phase:'SIN_EVENTO',keys,pending,contexts,evaluatedAt:now,kind:'OBSERVACION'};
}

export function refreshIdeaEvaluation(idea,evaluation,quote,now=Date.now()){
 if(!evaluation)return evaluation;const valid=quote&&quote.symbol===idea.symbol&&quote.market===idea.market&&quote.received<=now&&now-quote.received<=5000;return refreshEvaluation(evaluation,idea,now,valid?{price:quote.price,asof:quote.ts}:{price:null,asof:null});
}
