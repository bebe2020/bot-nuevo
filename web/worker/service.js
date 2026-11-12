import {analyticsFetch,connectorStatus} from './connectors.js';
import {fundamentalsProvider} from './fundamentals.js';
import {readPaper,savePaper} from './paper-cloud.js';
import {macroProvider} from './macro.js';
import {feedHealth,frameClock} from './freshness.js';
import {refreshEvaluation,PROTOCOL_VERSION} from './protocol.js';
import {globalProviders,crossAssetProviders,onchainProvider,kronosProvider,publicWatchHistory} from './providers.js';
import {VERSION,UNIVERSE,FRAMES,HORIZONS,POLICIES,n,fact,closed,endOfBar,structures,profileFacts,bookFacts,fundingFact,tradesFact,quarterBars,ema,netLiquidity,fredCSV,CHECKS,riskPlan} from './engine.js';
import {HTML} from './ui.js';
import {acquire,assemble,makeCoverage} from './collector.js';
import {publicContext} from './context.js';
import {sosoProvider} from './sosovalue.js';
const PUBLIC_ASSETS = '__BUILD_PUBLIC_ASSETS__';
const BUILD_INFO='__BUILD_INFO__';
const snapshotKey=(symbol,market='PERP')=>'latest/v2/'+market+'/'+symbol+'.json';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const getObject=async(b,k)=>{const x=await b.get(k);return x?await x.json():null;};
const putObject=(b,k,v,opts={})=>b.put(k,JSON.stringify(v),{httpMetadata:{contentType:'application/json'},...opts});
const err=e=>e?.message?.slice(0,120)||'ERROR_DESCONOCIDO';
async function macroData(bucket,fetcher,now){
 const cached=await getObject(bucket,'macro/latest.json');if(cached&&now-cached.received<3600000)return cached;
 const series={},errors=[];await Promise.all(['WALCL','WTREGEN','RRPONTSYD'].map(async id=>{try{const start=new Date(now-180*86400000).toISOString().slice(0,10);const r=await fetcher('https://fred.stlouisfed.org/graph/fredgraph.csv?id='+id+'&cosd='+start,{signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('HTTP_'+r.status);series[id]=fredCSV(await r.text(),id);}catch(e){errors.push(id+':'+err(e));}}));
 const result={...netLiquidity(series,now),received:now,errors};await putObject(bucket,'macro/latest.json',result);return result;
}
export function freshen(snapshot,now){
 const s=structuredClone(snapshot);s.served=now;
 for(const [tf,f] of Object.entries(s.structures||{})){if(f.status==='OK'&&frameClock(s,tf,now).state!=='OK'){f.observedStatus=f.status;f.status=frameClock(s,tf,now).state;}}
 for(const idea of [...Object.values(s.plans||{}).flat(),...(s.opportunities||[])])for(const [profile,e] of Object.entries(idea.evaluations||{}))idea.evaluations[profile]=refreshEvaluation(e,idea,now);
 if(s.book?.asof&&now-s.book.asof>5000){s.book.observedStatus=s.book.observedStatus||s.book.status;s.book.status='STALE';for(const p of Object.values(s.profiles||{})){p.observedAttention=p.observedAttention??p.attention;p.attention=null;for(const c of Object.values(p.checklists||{})){c.observedConfluence=c.observedConfluence||c.confluence;c.confluence='DATOS_VENCIDOS';}}const c=s.coverage?.find(x=>x.id==='10');if(c)c.state='STALE';}
 return s;
}
export async function collect(bucket,symbol,fetcher=fetch){
 if(!bucket)throw Error('ALMACENAMIENTO_NO_CONECTADO');
 const now=Date.now(),key=snapshotKey(symbol),prior=await getObject(bucket,key);if(prior&&now-prior.received<30000)return {...freshen(prior,now),cache:true};
 const current=await bucket.get('collector/lease.json'),lease=current?await current.json():null;
 if(lease?.until>now)return prior?{...freshen(prior,now),collecting:true}:{collecting:true,received:null,symbol,message:'Primera adquisición en curso'};
 const owner=crypto.randomUUID(),written=await putObject(bucket,'collector/lease.json',{owner,until:now+300000},{onlyIf:current?{etagMatches:current.etag}:{etagDoesNotMatch:'*'}});
 if(!written)return prior?{...freshen(prior,now),collecting:true}:{collecting:true,symbol,received:null};
 try{
 const macro=await macroData(bucket,fetcher,Date.now());const raw=await acquire(symbol,fetcher),s=assemble(raw,prior);s.macro=macro;s.coverage=makeCoverage(s,true);s.storage='CLOUD_DURABLE';s.collectionMode='CAPTURA_PUBLICA_BAJO_DEMANDA';
  const summary={id:VERSION+':'+symbol+':'+Math.floor(s.received/60000),symbol,received:s.received,sourceAsOf:s.sourceAsOf,price:n(s.ticker.lastPr),oi:s.oi,profiles:Object.fromEntries(Object.entries(s.profiles).map(([k,p])=>[k,p.checklists||{status:p.status}])),funding:s.funding,breadth:s.breadth,planIds:Object.values(s.plans).flat().map(x=>x.id),sourceErrors:s.sourceErrors};
  const historyKey='history/'+String(9999999999999-Math.floor(s.received/60000)*60000)+'-'+symbol+'.json';
  await putObject(bucket,historyKey,summary,{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{symbol,asof:String(s.sourceAsOf??s.received),received:String(s.received),price:String(summary.price??'')}});
  await putObject(bucket,key,s);return freshen(s,Date.now());
 }finally{await putObject(bucket,'collector/lease.json',{owner,until:0},{onlyIf:{etagMatches:written.etag}});}
}
export async function history(bucket){if(!bucket)throw Error('ALMACENAMIENTO_NO_CONECTADO');const list=await bucket.list({prefix:'history/',limit:60,include:['customMetadata']});return {items:list.objects.map(x=>({id:x.key,market:x.customMetadata?.market||(x.key.includes('-SPOT-')?'SPOT':'PERP'),...x.customMetadata})),more:list.truncated};}
export async function ingest(bucket,raw,{maxAgeMs=120000,collector='NAVEGADOR_O_CLIENTE_PUBLICO_BITGET'}={}){
 if(!bucket)throw Error('ALMACENAMIENTO_NO_CONECTADO');
 const now=Date.now();if(raw?.version!==VERSION||!UNIVERSE.includes(raw.symbol)||raw.market&&!['SPOT','PERP'].includes(raw.market)||!Array.isArray(raw.rows)||raw.rows.length!==UNIVERSE.length||raw.rows.some(r=>!UNIVERSE.includes(r.symbol))||new Set(raw.rows.map(r=>r.symbol)).size!==UNIVERSE.length||!Number.isFinite(raw.received)||raw.received>now+30000||now-raw.received>maxAgeMs)throw Error('CAPTURA_NO_VALIDA_O_VENCIDA');
 const key=snapshotKey(raw.symbol,raw.market||'PERP'),obj=await bucket.get(key),prior=obj?await obj.json():null;
 const s=assemble(raw,prior);if(s.available!==false&&(n(s.ticker.lastPr)===null||!Object.values(s.structures).some(x=>x.status==='OK'))||s.available===false&&!s.universe.some(x=>x.available&&x.price>0&&x.state==='OK'))throw Error('SIN_DATOS_PUBLICOS_VALIDOS');
 s.ingestedAt=now;s.collector=collector;const context=await getObject(bucket,'context/latest.json');s.macro=context?.macro||await getObject(bucket,'macro/latest.json')||fact(null,'UNKNOWN','FUENTE_MACRO_NO_CONECTADA');s.coverage=makeCoverage(s,true);s.storage='CLOUD_DURABLE';s.collectionMode=collector==='GITHUB_ACTIONS_PUBLICO'?'CAPTURAS_PROGRAMADAS_5_MIN_CON_POSIBLES_DEMORAS':'NAVEGADOR_ABIERTO';
 if(prior&&prior.received>=s.received)return freshen(prior,now);
 const summary={id:VERSION+':'+raw.symbol+':'+Math.floor(s.received/60000),symbol:raw.symbol,market:raw.market||'PERP',received:s.received,sourceAsOf:s.sourceAsOf,price:n(s.ticker.lastPr),oi:s.oi,funding:s.funding,breadth:s.breadth,collector:s.collector,planIds:Object.values(s.plans).flat().map(x=>x.id)};
 await putObject(bucket,'history/'+String(9999999999999-Math.floor(s.received/60000)*60000)+'-'+s.market+'-'+s.symbol+'.json',summary,{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{symbol:s.symbol,market:s.market,asof:String(s.sourceAsOf),received:String(s.received),price:String(summary.price)}});
 const written=await putObject(bucket,key,s,{onlyIf:obj?{etagMatches:obj.etag}:{etagDoesNotMatch:'*'}});return written?freshen(s,Date.now()):freshen(await getObject(bucket,key),Date.now());
}
const FEED_ROOT='https://raw.githubusercontent.com/bebe2020/bot-nuevo/market-data/';
let publicCloudCache=null;
export async function cloudFeed(fetcher=fetch,now=Date.now()){
 if(fetcher===fetch&&publicCloudCache?.until>now)return feedHealth(publicCloudCache.value,now);
 const read=async path=>{const r=await fetcher(FEED_ROOT+path+'?minute='+Math.floor(now/60000),{redirect:'manual',signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('GITHUB_FEED_HTTP_'+r.status);const text=await r.text();if(text.length>12000000)throw Error('CAPTURA_DEMASIADO_GRANDE');return JSON.parse(text);};
 try{const status=await read('status.json');if(!['OK','ERROR'].includes(status.state)||status.accountData!==false)throw Error('ESTADO_NUBE_NO_VALIDO');const raw=status.state==='OK'?await read('latest.json'):null;
  const value={...status,raw};if(fetcher===fetch)publicCloudCache={until:now+60000,value};return feedHealth(value,now);
 }catch(e){return {state:'UNKNOWN',errors:[err(e)],checkedAt:now,raw:null};}
}
async function mergedHistory(bucket){
 const stored=await history(bucket),today=new Date().toISOString().slice(0,10);try{const r=await fetch(FEED_ROOT+'history/'+today+'.json?minute='+Math.floor(Date.now()/60000),{redirect:'manual',signal:AbortSignal.timeout(6000)});if(!r.ok)return stored;const text=await r.text();if(text.length>3000000)return stored;const h=JSON.parse(text);const cloud=(h.records||[]).flatMap(x=>(x.prices||[]).filter(p=>UNIVERSE.includes(p.symbol)).map(p=>({id:'github:'+x.id+':'+p.symbol,symbol:p.symbol,asof:String(x.asof),received:String(x.received),price:String(p.price??''),collector:'GITHUB_ACTIONS_PUBLICO'})));const unique=new Map();for(const x of [...cloud,...stored.items])unique.set((x.market||'PERP')+':'+x.symbol+':'+Math.floor(Number(x.received)/60000),x);return {items:[...unique.values()].sort((a,b)=>Number(b.received)-Number(a.received)).slice(0,120),more:stored.more||unique.size>120};}catch{return stored;}
}
export default {async fetch(request,env){
 const url=new URL(request.url);try{
  if(url.pathname==='/'&&request.method==='GET')return new Response(HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.bitget.com wss://ws.bitget.com; img-src 'self' data:; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com; object-src 'none'; base-uri 'self'",'X-Content-Type-Options':'nosniff'}});
  if(request.method==='GET'&&typeof PUBLIC_ASSETS==='object'&&PUBLIC_ASSETS[url.pathname]){const a=PUBLIC_ASSETS[url.pathname];return new Response(a.body,{headers:{'Content-Type':a.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
  if(url.pathname==='/api/connectors'&&request.method==='GET')return json(await connectorStatus(env));
  if(url.pathname==='/api/health')return json({version:VERSION,universe:54,protocolVersion:PROTOCOL_VERSION,admissionRevision:'20261111-fresh-flow',fundamentalSeries:20,build:typeof BUILD_INFO==='object'?BUILD_INFO:null,featureSet:'terminal-integrada-20261112',macroSeries:20,fundamentalMetricsPerAsset:14,labModules:5,liveVersion:'live-1.0',storage:!!env.BUCKET,account:'NO_VERIFICADA',orders:false,collection:'WS_abierto_y_GitHub_programado',clock:Date.now()});
  if(url.pathname==='/api/cloud'){const {raw,...status}=await cloudFeed();return json(status);}
  if(url.pathname==='/api/sosovalue'&&request.method==='GET')return json(await sosoProvider(env.BUCKET,env.SOSOVALUE_API_KEY));
  if(url.pathname==='/api/fundamentals'&&request.method==='GET')return json(await fundamentalsProvider(env.BUCKET,analyticsFetch(env)));
  if(url.pathname==='/api/macro'&&request.method==='GET')return json(await macroProvider(env.BUCKET,fetch,Date.now(),{apiKey:env.FRED_API_KEY,preferMirror:!env.FRED_API_KEY}));
  if(url.pathname==='/api/context'&&request.method==='GET')return json(await publicContext(env.BUCKET));
  if(url.pathname==='/api/providers'&&request.method==='GET')return json(await globalProviders(env.BUCKET,analyticsFetch(env)));
  if(url.pathname==='/api/cross-assets'&&request.method==='GET')return json(await crossAssetProviders(env.BUCKET));
  if(url.pathname==='/api/onchain'&&request.method==='GET')return json(await onchainProvider(env.BUCKET,url.searchParams.get('symbol')||'BTCUSDT'));
  if(url.pathname==='/api/watch-public'&&request.method==='GET')return json(await publicWatchHistory());
  if(url.pathname==='/api/kronos'&&request.method==='GET')return json(await kronosProvider(env.BUCKET,url.searchParams.get('symbol')||'BTCUSDT',url.searchParams.get('market')||'PERP'));
  if(url.pathname==='/api/snapshot'&&request.method==='GET'){const symbol=url.searchParams.get('symbol')||'BTCUSDT',market=url.searchParams.get('market')||'PERP';if(!UNIVERSE.includes(symbol)||!['SPOT','PERP'].includes(market))return json({error:'INSTRUMENTO_NO_ADMITIDO'},400);let s=await getObject(env.BUCKET,snapshotKey(symbol,market));if(symbol==='BTCUSDT'&&market==='PERP'&&(!s||Date.now()-s.received>60000)){const c=await cloudFeed();if(c.raw?.version===VERSION&&c.raw?.symbol===symbol&&(!s||c.raw.received>s.received)){try{s=await ingest(env.BUCKET,c.raw,{maxAgeMs:1800000,collector:'GITHUB_ACTIONS_PUBLICO'});}catch{}}}return json(s?freshen(s,Date.now()):{symbol,market,waitingForCollector:true,version:VERSION});}
  if(url.pathname==='/api/ingest'&&request.method==='POST'){
   if(request.headers.get('X-Bot-Write')!=='1'||request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'ORIGEN_O_CONTENIDO_INVALIDO'},403);
   const text=await request.text();if(text.length>12000000)return json({error:'CAPTURA_DEMASIADO_GRANDE'},413);return json(await ingest(env.BUCKET,JSON.parse(text)));
  }
  if(url.pathname==='/api/history'&&request.method==='GET')return json(await mergedHistory(env.BUCKET));
  if(url.pathname==='/api/plans'&&request.method==='GET'){const list=await env.BUCKET.list({prefix:'plans/',limit:100,include:['customMetadata']});return json({items:list.objects.map(x=>({id:x.key,market:x.customMetadata?.market||'NO_REGISTRADO',...x.customMetadata})).sort((a,b)=>Number(b.created)-Number(a.created)),more:list.truncated});}
  if(url.pathname==='/api/plans'&&request.method==='POST'){
   if(request.headers.get('X-Bot-Write')!=='1'||request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'ORIGEN_O_CONTENIDO_INVALIDO'},403);
   const text=await request.text();if(text.length>10000)return json({error:'PLAN_DEMASIADO_GRANDE'},413);const b=JSON.parse(text);if(!UNIVERSE.includes(b.symbol)||b.market==='SPOT'&&b.side==='SHORT'||b.market&&!['SPOT','PERP'].includes(b.market))return json({error:'SIMBOLO_INVALIDO'},400);
   if(b.clientId!==undefined&&!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.clientId))return json({error:'ID_DE_PLAN_INVALIDO'},400);
   const calculation=riskPlan(b),id=b.clientId||crypto.randomUUID(),record={id,market:b.market||'PERP',symbol:b.symbol,horizon:HORIZONS[b.horizon]?b.horizon:'MANUAL_NO_ESPECIFICADO',profile:POLICIES[b.profile]?b.profile:'MANUAL_NO_ESPECIFICADO',side:b.side,entry:b.entry,stop:b.stop,targets:b.targets,quantity:b.quantity,entryFee:b.entryFee,exitFee:b.exitFee,fundingCash:b.fundingCash,calculation,plannedAt:n(b.plannedAt),created:Date.now(),state:'PLAN_MANUAL_SIN_FILL',account:'NO_VERIFICADA'};
   const key='plans/'+id+'.json',prior=await getObject(env.BUCKET,key);
   const signature=p=>JSON.stringify([p.market,p.symbol,p.horizon,p.profile,p.side,...[p.entry,p.stop,p.quantity,p.entryFee,p.exitFee,p.fundingCash??0,...p.targets].map(Number)]);
   if(prior)return signature(prior)===signature(record)?json(prior):json({error:'ID_DE_PLAN_CON_OTRA_GEOMETRIA'},409);
   const written=await putObject(env.BUCKET,key,record,{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{symbol:b.symbol,market:record.market,side:b.side,created:String(record.created),state:record.state}});
   if(!written){const existing=await getObject(env.BUCKET,key);return existing&&signature(existing)===signature(record)?json(existing):json({error:'CONFLICTO_DE_PLAN'},409);}
   return json(record,201);
  }
  if(url.pathname==='/api/paper'&&request.method==='GET')return json(await readPaper(env.BUCKET));
  if(url.pathname==='/api/paper'&&request.method==='POST'){
   if(request.headers.get('X-Bot-Write')!=='1'||request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'ORIGEN_O_CONTENIDO_INVALIDO'},403);
   const text=await request.text();if(text.length>1000000)return json({error:'PAPER_DEMASIADO_GRANDE'},413);
   const result=await savePaper(env.BUCKET,JSON.parse(text));return json(result.book,result.conflict?409:200);
  }
  if(url.pathname==='/api/risk'&&request.method==='POST'){const b=await request.json();return json(riskPlan(b));}
  return json({error:'RUTA_NO_ENCONTRADA'},404);
 }catch(e){return json({error:err(e),observedAt:Date.now(),state:'UNKNOWN'},url.pathname==='/api/risk'?400:503);}
}};
