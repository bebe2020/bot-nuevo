// Selección propia de 20 series documentadas; no es un listado oficial de «20 indicadores».
export const SOSO_ROOT='https://openapi.sosovalue.com/openapi/v1';
export const SOSO_DOCS='https://sosovalue-1.gitbook.io/sosovalue-api-doc/9.-analysis-charts/list';
export const SOSO_METRICS=[
 ['total','Capitalización cripto','total_crypto_market_cap','total_crypto_market_cap','USD'],
 ['alts','Capitalización altcoins','altcoin_market_cap_volume','altcoin_market_cap','USD'],
 ['fear','Miedo y codicia cripto','fgi_indicator','crypto_fear_&_greed_index','0–100'],
 ['ahr','Valoración BTC · AHR999','ahr_999_indicator','ahr999','ratio'],
 ['oi','Interés abierto BTC · total','futures_open_interest','all','USD'],
 ['cme','Interés abierto BTC · CME','futures_open_interest','cme','USD'],
 ['funding','Funding BTC · Bybit','funding_rate','bybit','%',100],
 ['longshort','Long/short BTC · Binance 4h','binance_btcusdt_futures_long_short_ratio_4h','long/short_ratio','ratio',1,8],
 ['hash','Hashrate BTC','btc_hashrate','btc_hashrate','unidad del proveedor'],
 ['difficulty','Dificultad de minería BTC','btc_mining_difficulty','btc_mining_difficulty','dificultad'],
 ['transactions','Transacciones BTC','btc_transactions','number_of_transactions','transacciones'],
 ['active','Direcciones activas BTC','btc_active_addresses','number_of_active_addresses','direcciones'],
 ['new','Direcciones nuevas BTC','btc_new_addresses','number_of_new_addresses','direcciones'],
 ['stables','Capitalización stablecoins','stablecoin_total_market_cap','mcap','USD'],
 ['mint','Flujo neto stablecoins fiat','fiat_backed_stablecoins_usd_pegged_mcap_net_inflows','fiat_backed_stablecoins_net_inflows','USD'],
 ['staking','Porcentaje de ETH en staking','eth_staking_ratio','staking','%',100],
 ['inflow','Entradas USD al mercado cripto','usd_inflows_into_cryptocurrency_markets','daily_net_inflows','USD'],
 ['tvl','TVL agregado por tipos de red','tvl_of_different_type_of_chain','all','USD'],
 ['etfbtc','Flujo diario ETF BTC · EE.UU.','total_crypto_spot_btc_eth_etf_fund_flow_1d','bitcoin_daily_total_net_inflow','USD',1,120],
 ['etfeth','Flujo diario ETF ETH · EE.UU.','total_crypto_spot_btc_eth_etf_fund_flow_1d','ethereum_daily_total_net_inflow','USD',1,120]
].map(([id,label,chart,key,unit,scale=1,maxAgeHours=72])=>({id,label,chart,key,unit,scale,maxAgeHours}));
const sosoNumber=x=>x===null||x===undefined||typeof x==='boolean'||typeof x==='string'&&!x.trim()?null:Number.isFinite(Number(x))?Number(x):null;
export function sosoMetric(def,rows,now=Date.now()){
 const candidates=(Array.isArray(rows)?rows:[]).flatMap(r=>{const at=sosoNumber(r.timestamp),value=sosoNumber(r[def.key]);return at>0&&at<=now&&value!==null?[{asof:at,value}]:[];}).sort((a,b)=>b.asof-a.asof),last=candidates[0],previous=candidates[1];
 return {...def,status:!last?'UNKNOWN':now-last.asof>def.maxAgeHours*3600000?'STALE':'OK',value:last?last.value*def.scale:null,rawValue:last?.value??null,scaleApplied:def.scale,asof:last?.asof??null,previousAsOf:previous?.asof??null,change:last&&previous?(last.value-previous.value)*def.scale:null,source:SOSO_ROOT+'/analyses/'+def.chart,reason:last?null:'SERIE_AUSENTE_O_SIN_FECHA_VALIDA'};
}
function sosoResult(metrics,now,extra={}){const observed=metrics.filter(x=>x.status==='OK').length;return {provider:'SOSOVALUE',selection:'20_SERIES_SELECCIONADAS_POR_BOT_NUEVO',status:observed===20?'OK':observed?'PARTIAL':'UNKNOWN',metrics,coverage:{selected:20,observed,stale:metrics.filter(x=>x.status==='STALE').length},checkedAt:now,note:'Datos agregados con distintas frecuencias; no son señales de entrada ni sustituyen la macro de bonos, divisas y liquidez mundial.',...extra};}
export function freshenSoso(value,now=Date.now()){const metrics=value.metrics.map(x=>({...x,status:x.value===null?'UNKNOWN':x.reason==='CONSULTA_ACTUAL_NO_DISPONIBLE'||now-x.asof>x.maxAgeHours*3600000?'STALE':'OK'})),status=['AUTH_REQUIRED','RATE_LIMITED'].includes(value.status)?value.status:metrics.every(x=>x.status==='OK')?'OK':metrics.some(x=>x.status==='OK')?'PARTIAL':metrics.some(x=>x.value!==null)?'STALE':'UNKNOWN';return sosoResult(metrics,now,{...value,metrics,coverage:{selected:20,observed:metrics.filter(x=>x.status==='OK').length,stale:metrics.filter(x=>x.status==='STALE').length},status,servedAt:now});}
const sosoFlights=new WeakMap();
export async function sosoProvider(bucket,key,fetcher=fetch,now=Date.now()){
 const empty=()=>SOSO_METRICS.map(d=>sosoMetric(d,[],now));
 if(typeof key!=='string'||!key.trim())return sosoResult(empty(),now,{status:'CONFIG_REQUIRED',message:'SoSoValue necesita una clave de API configurada en el servidor. No hay datos autenticados disponibles.',setupURL:'https://sosovalue.com/developer/dashboard'});
 if(bucket&&sosoFlights.has(bucket))return sosoFlights.get(bucket);
 const run=async()=>{
  const file=await bucket?.get('providers/sosovalue-v1.json'),old=file?await file.json():null;
  if(old?.transportMode==='WORKER_MANUAL_REDIRECTS'&&old?.nextCheck>now)return freshenSoso(old,now);
  // Lease compartido: una tanda son 18 peticiones para las 20 series.
  let lease,lock;if(bucket){const obj=await bucket.get('providers/sosovalue-lease.json');lease=obj?await obj.json():null;if(lease?.transportMode==='WORKER_MANUAL_REDIRECTS'&&lease?.until>now)return old?{...freshenSoso(old,now),refreshing:true}:sosoResult(empty(),now,{status:'COLLECTING'});lock=await bucket.put('providers/sosovalue-lease.json',JSON.stringify({until:now+180000,transportMode:'WORKER_MANUAL_REDIRECTS'}),{onlyIf:obj?{etagMatches:obj.etag}:{etagDoesNotMatch:'*'}});if(!lock)return sosoResult(empty(),now,{status:'COLLECTING'});}
  const charts=[...new Set(SOSO_METRICS.map(x=>x.chart))],values={},errors=[];let authError=null,halted=false;
  for(const chart of charts){if(halted){values[chart]=[];continue;}try{const r=await fetcher(SOSO_ROOT+'/analyses/'+chart+'?limit=8',{redirect:'manual',headers:{'x-soso-api-key':key,Accept:'application/json'},signal:AbortSignal.timeout(8000)});if(!r.ok){if([401,403,429].includes(r.status)){halted=true;authError=r.status===429?'RATE_LIMITED':'AUTH_REQUIRED';}throw Error('HTTP_'+r.status);}const text=await r.text();if(text.length>500000)throw Error('RESPUESTA_DEMASIADO_GRANDE');const body=JSON.parse(text);if(body?.code!==undefined&&!['0','200'].includes(String(body.code))){const code=String(body.code);if(['401','403','429'].includes(code)){halted=true;authError=code==='429'?'RATE_LIMITED':'AUTH_REQUIRED';}throw Error('HTTP_'+code);}const rows=Array.isArray(body)?body:body.data;if(!Array.isArray(rows))throw Error('CONTRATO_DE_SERIES_INVALIDO');values[chart]=rows;}catch(e){values[chart]=[];errors.push(chart+':'+(e.message?.startsWith('HTTP_')?e.message:'RESPUESTA_NO_VALIDA_O_NO_DISPONIBLE'));}}
  const metrics=SOSO_METRICS.map(d=>{const current=sosoMetric(d,values[d.chart],now);if(current.value!==null)return current;const prior=old?.metrics?.find(x=>x.id===d.id);return prior?.value!==null&&prior?.value!==undefined?{...prior,status:'STALE',reason:'CONSULTA_ACTUAL_NO_DISPONIBLE'}:current;});
  const result=sosoResult(metrics,now,{transportMode:'WORKER_MANUAL_REDIRECTS',status:authError||undefined,errors,nextCheck:now+1800000});if(!result.status)result.status=result.coverage.observed===20?'OK':result.coverage.observed?'PARTIAL':metrics.some(x=>x.value!==null)?'STALE':'UNKNOWN';
  if(bucket){await bucket.put('providers/sosovalue-v1.json',JSON.stringify(result),{httpMetadata:{contentType:'application/json'}});if(lock)await bucket.put('providers/sosovalue-lease.json',JSON.stringify({until:0,transportMode:'WORKER_MANUAL_REDIRECTS'}),{onlyIf:{etagMatches:lock.etag}});}return result;
 };
 const promise=run().finally(()=>{if(bucket)sosoFlights.delete(bucket);});if(bucket)sosoFlights.set(bucket,promise);return promise;
}
