import {ASSETS} from './universe.js';
import {globalProviders} from './providers.js';
import {normalizeDimension,cryptoGlobalFacts,buildFundamentalAssets,ageFundamentals,FUNDAMENTAL_CATALOG} from './fundamental-facts.js';

const FUNDAMENTALS_SEED='__BUILD_FUNDAMENTALS_CAPTURE__';
const fundamentalFlights=new WeakMap();
const FUND_MIRROR='https://raw.githubusercontent.com/bebe2020/bot-nuevo/market-data/fundamentals.json';
const FUND_REPORTS={
  fees:'https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyFees',
  revenue:'https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyRevenue',
  dexs:'https://api.llama.fi/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true'
};
async function fundamentalJSON(url,fetcher,max=12000000){
  const r=await fetcher(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
  if(!r.ok)throw Error('HTTP_'+r.status);const text=await r.text();if(text.length>max)throw Error('FUENTE_DEMASIADO_GRANDE');return JSON.parse(text);
}

export function validateFundamentalMirror(value,now=Date.now()) {
  if(value?.version!=='fundamentals-1'||value.accountData!==false||!Number.isFinite(value.checkedAt)||value.checkedAt>now||!Array.isArray(value.assets)||value.assets.length!==54||new Set(value.assets.map(x=>x.symbol)).size!==54)throw Error('CAPTURA_FUNDAMENTAL_INVALIDA');
  for(const a of value.assets){
    if(!ASSETS.some(x=>x.base+'USDT'===a.symbol)||!Array.isArray(a.facts)||a.facts.length!==FUNDAMENTAL_CATALOG.length||new Set(a.facts.map(x=>x.id)).size!==FUNDAMENTAL_CATALOG.length)throw Error('IDENTIDAD_FUNDAMENTAL_INVALIDA');
    for(const f of a.facts){
      if(!FUNDAMENTAL_CATALOG.some(x=>x.id===f.id)||!['OK','PARTIAL','UNKNOWN','STALE'].includes(f.state)||f.value!==null&&(!Number.isFinite(f.value)||f.value<0)||f.asof!==null&&f.asof!==undefined&&(!Number.isFinite(f.asof)||f.asof>now)||f.received!==null&&f.received!==undefined&&(!Number.isFinite(f.received)||f.received>now)||f.source&&!/^https:\/\/(?:www\.)?(?:api\.llama\.fi|api\.hyperliquid\.xyz|defillama\.com|coingecko\.com)(?:\/|$)/.test(f.source))throw Error('DATO_FUNDAMENTAL_INVALIDO');
    }
  }
  if(value.global){
    const g=value.global;
    if(!Number.isFinite(g.asof)||g.asof>now||!Number.isFinite(g.received)||g.received>now||g.asof>g.received||!(g.totalUSD>0)||![g.btcDominancePct,g.ethDominancePct].every(x=>Number.isFinite(x)&&x>=0)||g.btcDominancePct+g.ethDominancePct>100||Math.abs(g.exBtcUSD/g.totalUSD-(1-g.btcDominancePct/100))>1e-10||Math.abs(g.exBtcEthUSD/g.totalUSD-(1-(g.btcDominancePct+g.ethDominancePct)/100))>1e-10)throw Error('GLOBAL_FUNDAMENTAL_INVALIDO');
  }
  return value;
}

async function readFundamentals(bucket,fetcher,now,{preferMirror=true,providers=null}={}) {
  const file=await bucket?.get('providers/fundamentals-v1.json');
  let old=file?await file.json():(typeof FUNDAMENTALS_SEED==='object'?FUNDAMENTALS_SEED:null);
  if(preferMirror&&old?.nextCheck>now)return ageFundamentals(old,now);
  if(preferMirror)try{
    const mirror=validateFundamentalMirror(await fundamentalJSON(FUND_MIRROR+'?slot='+Math.floor(now/300000),fetcher,2000000),now);
    if(now-mirror.checkedAt<3600000){const result={...mirror,nextCheck:now+300000,transport:'CAPTURA_PUBLICA_GITHUB'};if(bucket)await bucket.put('providers/fundamentals-v1.json',JSON.stringify(result));return ageFundamentals(result,now);}
  }catch{}
  if(!old&&!preferMirror)try{old=validateFundamentalMirror(await fundamentalJSON(FUND_MIRROR,fetcher,2000000),now);}catch{}
  const reports={},errors=[];
  // Normalize each large report before acquiring the next one to bound memory.
  for(const [kind,url] of Object.entries(FUND_REPORTS))try{
    reports[kind]=normalizeDimension(await fundamentalJSON(url,fetcher),kind,now);
  }catch(e){errors.push(kind+':'+e.message);reports[kind]=old?.reports?.[kind]?{...old.reports[kind],status:'STALE',error:e.message}:{kind,status:'UNKNOWN',received:null,rows:[],source:url,error:e.message};}
  let global;
  try{global=cryptoGlobalFacts(await fundamentalJSON('https://api.coingecko.com/api/v3/global',fetcher),now);}
  catch(e){errors.push('global:'+e.message);global=old?.global?{...old.global,status:'STALE',error:e.message}:null;}
  const data=providers||await globalProviders(bucket,fetcher,now);
  const assets=buildFundamentalAssets(data?.defi,reports,data?.hyper);
  for(const asset of assets){const prior=old?.assets?.find(x=>x.symbol===asset.symbol);for(let i=0;i<asset.facts.length;i++){const fact=asset.facts[i],previous=prior?.facts?.find(x=>x.id===fact.id);if(fact.value===null&&previous?.value!==null&&previous?.value!==undefined)asset.facts[i]={...previous,state:'STALE',reason:'La fuente actual no entregó este dato; se conserva el anterior fechado.'};}}
  // Bound stored reports to the identities actually used by our 54 assets.
  const used=new Set(assets.flatMap(a=>Object.values(a.matched||{}).map(x=>x.id)));
  for(const report of Object.values(reports))report.rows=report.rows.filter(x=>used.has(x.id));
  const result={version:'fundamentals-1',accountData:false,checkedAt:now,nextCheck:now+(errors.length?300000:900000),assets,global,reports,errors};
  if(bucket)await bucket.put('providers/fundamentals-v1.json',JSON.stringify(result));
  return ageFundamentals(result,now);
}

export function fundamentalsProvider(bucket,fetcher=fetch,now=Date.now(),options={}) {
  if(fetcher!==fetch||!bucket)return readFundamentals(bucket,fetcher,now,options);
  if(!fundamentalFlights.has(bucket))fundamentalFlights.set(bucket,readFundamentals(bucket,fetcher,now,options).finally(()=>fundamentalFlights.delete(bucket)));
  return fundamentalFlights.get(bucket);
}
