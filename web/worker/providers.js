import {ASSETS,SYMBOLS} from './universe.js';
import {n,fredCSV} from './engine.js';

// IDs contrastados con el catálogo público. No se resuelven homónimos por volumen.
export const GECKO_IDS={ETH:'ethereum',LINK:'chainlink',BTC:'bitcoin',BNB:'binancecoin',SOL:'solana',XRP:'ripple',INJ:'injective-protocol',KAS:'kaspa',XMR:'monero',ALGO:'algorand',TAO:'bittensor',AVAX:'avalanche-2',LIT:'lighter',TRX:'tron',AAVE:'aave',SUI:'sui',ENA:'ethena',LDO:'lido-dao',NEAR:'near',ONDO:'ondo-finance',XLM:'stellar',AERO:'aerodrome-finance',HYPE:'hyperliquid',UNI:'uniswap',QNT:'quant-network',RENDER:'render-token',FET:'fetch-ai',SUPER:'superfarm',RAY:'raydium',BEAM:'beam-2',CGPT:'chaingpt',ASTER:'aster-2',MORPHO:'morpho',VIRTUAL:'virtual-protocol',ARKM:'arkham',KITE:'kite-2',CFG:'centrifuge-2',JUP:'jupiter-exchange-solana',GRASS:'grass',ZK:'zksync',VVV:'venice-token',BERA:'berachain-bera',CPOOL:'clearpool',ARIA:'aria-ai',MAGMA:'magma-finance',PLUME:'plume',IO:'io',ACE:'endurance',MUBARAK:'mubarak',PONS:'pons',PUMP:'pump-fun',EDGE:'edgex',KAIO:'kaio',RIF:'rif-token'};
const DEFI_PREFIXES={AAVE:['aave-'],UNI:['uniswap-'],MORPHO:['morpho-'],CPOOL:['clearpool-'],HYPE:['hyperliquid-'],LIT:['lighter-'],ASTER:['aster-'],CFG:['centrifuge-','tinlake'],LDO:['lido'],ENA:['ethena'],RAY:['raydium'],AERO:['aerodrome'],JUP:['jupiter-'],ONDO:['ondo-'],KAIO:['kaio'],MAGMA:['magma-finance'],PUMP:['pump-','pumpfun'],EDGE:['edgex'],INJ:['injective-'],PONS:['pons-']};
const CHAIN_NAMES={ETH:'Ethereum',BTC:'Bitcoin',BNB:'BSC',SOL:'Solana',XRP:'XRPL',ALGO:'Algorand',AVAX:'Avalanche',INJ:'Injective',SUI:'Sui',TRX:'Tron',NEAR:'Near',XLM:'Stellar',ZK:'ZKsync Era',PLUME:'Plume',BERA:'Berachain'};
const PROVIDER_SEED='__BUILD_PROVIDER_CAPTURE__';
const FORECAST_SEED='__BUILD_KRONOS_CAPTURE__';
const providerMemory=new WeakMap();
let providersPending=null;

export function normalizeProtocol(p){return {id:String(p.id),slug:p.slug,name:p.name,symbol:p.symbol,category:p.category,chains:p.chains||[],tvl:n(p.tvl),change1d:n(p.change_1d),change7d:n(p.change_7d),change30d:n(p.change_1m),url:'https://defillama.com/protocol/'+encodeURIComponent(p.slug||''),parent:p.parentProtocol||null};}
export function defiFacts(protocols,chains,stableRows,markets,coinMeta,asof){
 const ranked=protocols.filter(p=>n(p.tvl)!==null&&p.category!=='CEX').sort((a,b)=>Number(b.tvl)-Number(a.tvl));
 const coinRows=Array.isArray(coinMeta?.data)?coinMeta.data:[];
 const assets=ASSETS.map(a=>{
  const id=GECKO_IDS[a.base],m=markets.find(x=>x.id===id&&String(x.symbol).toUpperCase()===a.base),matched=protocols.filter(p=>(DEFI_PREFIXES[a.base]||[]).some(prefix=>String(p.slug).startsWith(prefix))&&String(p.symbol).toUpperCase()===a.base).sort((a,b)=>Number(b.tvl||0)-Number(a.tvl||0));
  const coin=coinRows.find(x=>x.coin===a.base),chain=chains.find(x=>x.name===CHAIN_NAMES[a.base]);
  return {symbol:a.base+'USDT',base:a.base,name:a.proyecto,geckoId:m?id:null,marketCap:m?n(m.market_cap):null,marketCapRank:m?n(m.market_cap_rank):null,fdv:m?n(m.fully_diluted_valuation):null,circulatingSupply:m?n(m.circulating_supply):null,totalSupply:m?n(m.total_supply):null,maxSupply:m?n(m.max_supply):null,marketAsOf:m?Date.parse(m.last_updated):null,
   protocols:matched.slice(0,10).map(normalizeProtocol),principalTVL:n(matched[0]?.tvl),tvlMethod:'MAYOR_PROTOCOLO_ASOCIADO; NO_SUMAR_VERSIONES_O_DOBLE_CONTEO',chain:chain?{name:chain.name,tvl:n(chain.tvl),source:'DEFILLAMA'}:null,
   exchangeCoinId:coin?.coinId||null,networks:(coin?.chains||[]).map(c=>({chain:c.chain,contract:c.contractAddress||null})),identityStatus:coin?'CATALOGO_BITGET':'SIN_METADATOS',defiStatus:matched.length?'OBSERVADO':chain?'TVL_DE_RED':'SIN_PROTOCOLO_TVL_ASOCIADO',received:asof};
 });
 const st=Array.isArray(stableRows)?stableRows:[],sum=x=>x?.totalCirculatingUSD?Object.values(x.totalCirculatingUSD).reduce((s,v)=>s+(n(v)||0),0):null,last=st.at(-1);
 const atDays=d=>{const target=Number(last?.date)-d*86400;return [...st].reverse().find(x=>Number(x.date)<=target);};
 const stable=last?{usd:sum(last),asof:Number(last.date)*1000,change1d:sum(atDays(1))!==null?sum(last)-sum(atDays(1)):null,change7d:sum(atDays(7))!==null?sum(last)-sum(atDays(7)):null,method:'CAPITALIZACION_CIRCULANTE_USD; NO_FLUJO_NETO_DE_ENTRADAS'}:null;
 return {status:protocols.length?'OK':'UNKNOWN',assets,ranking:ranked.slice(0,80).map((p,i)=>({...normalizeProtocol(p),rank:i+1})),chains:chains.filter(x=>n(x.tvl)!==null).sort((a,b)=>b.tvl-a.tvl).slice(0,30).map(x=>({name:x.name,tvl:n(x.tvl),token:x.tokenSymbol})),stable,source:'DEFILLAMA_COINGECKO_BITGET_PUBLICOS',received:asof};
}
export function hyperFacts(value,asof){
 if(!Array.isArray(value)||!Array.isArray(value[0]?.universe)||!Array.isArray(value[1])||value[0].universe.length!==value[1].length)throw Error('CONTRATO_HYPERLIQUID_INVALIDO');
 return {status:'OK',received:asof,source:'https://api.hyperliquid.xyz/info',market:'PERP_USDC',fundingIntervalHours:1,rows:ASSETS.map(a=>{
  // No se convierten tokens kXXX a XXX sin una identidad y escala verificadas.
  const i=value[0].universe.findIndex(x=>x.name===a.base),r=i>=0?value[1][i]:null,mark=n(r?.markPx),oi=n(r?.openInterest),previous=n(r?.prevDayPx);
  return {symbol:a.base+'USDT',coin:a.base,available:i>=0,mark,oracle:n(r?.oraclePx),funding:n(r?.funding),oiBase:oi,oiUSD:mark!==null&&oi!==null?mark*oi:null,volumeUSD:n(r?.dayNtlVlm),change:mark>0&&previous>0?mark/previous-1:null,received:asof};
 })};
}
export function marketReference(value,id,label,kind){
 const r=value?.chart?.result?.[0],meta=r?.meta;if(!meta||meta.symbol!==id)throw Error('COTIZACION_DE_REFERENCIA_INVALIDA');
 const closes=r.indicators?.quote?.[0]?.close||[],series=(r.timestamp||[]).flatMap((t,i)=>n(closes[i])===null?[]:[{time:t*1000,close:Number(closes[i])}]);
 const last=series.at(-1),previous=series.at(-2);
 return {id,label,kind,unit:kind.startsWith('INDICE')?'puntos':kind==='FUTURO_ORO'?'USD / onza troy':kind==='ETF_BONOS'?'USD / participación':'USD / BTC',price:n(meta.regularMarketPrice),currency:meta.currency,asof:n(meta.regularMarketTime)!==null?Number(meta.regularMarketTime)*1000:null,venue:meta.fullExchangeName||meta.exchangeName,change1d:last&&previous?last.close/previous.close-1:null,change5d:series.length>5?last.close/series.at(-6).close-1:null,change20d:series.length>20?last.close/series.at(-21).close-1:null,series:series.slice(-24),source:'https://finance.yahoo.com/quote/'+encodeURIComponent(id),status:'DELAYED_OR_CLOSED',calendar:'SESIONES_DEL_MERCADO_DE_ORIGEN'};
}
async function providerJSON(url,fetcher,options={}){
 const r=await fetcher(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json','User-Agent':'BotNuevo public analytics'},...options});if(!r.ok)throw Error('HTTP_'+r.status);
 const text=await r.text();if(text.length>16000000)throw Error('FUENTE_DEMASIADO_GRANDE');return JSON.parse(text);
}
async function providerCached(bucket,key,ttl,fn,now){
 const cached=await bucket?.get(key),old=cached?await cached.json():null;
 if(old&&now-old.received<ttl)return old;
 try{const result=await fn(old),value={...result,received:result.status==='STALE'?result.received:now};if(bucket)await bucket.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});return value;}
 catch(e){return old?{...old,status:'STALE',error:e.message}:{status:'UNKNOWN',received:null,error:e.message};}
}
export async function globalProviders(bucket,fetcher=fetch,now=Date.now()){
 if(fetcher===fetch&&providersPending)return providersPending;
 const run=async()=>providerCached(bucket,'providers/global-v1.json',300000,async old=>{
  const calls={protocols:()=>providerJSON('https://api.llama.fi/protocols',fetcher),chains:()=>providerJSON('https://api.llama.fi/v2/chains',fetcher),stables:()=>providerJSON('https://stablecoins.llama.fi/stablecoincharts/all',fetcher),markets:()=>providerJSON('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids='+Object.values(GECKO_IDS).join(',')+'&per_page=100&page=1',fetcher),coins:()=>providerJSON('https://api.bitget.com/api/v2/spot/public/coins',fetcher),hyper:()=>providerJSON('https://api.hyperliquid.xyz/info',fetcher,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'metaAndAssetCtxs'})})};
  const pairs=await Promise.all(Object.entries(calls).map(async([name,fn])=>{try{return [name,{ok:true,data:await fn()}];}catch(e){return [name,{ok:false,error:e.message}];}}));
  const loaded=Object.fromEntries(pairs),errors=pairs.filter(([,x])=>!x.ok).map(([name,x])=>name+': '+x.error);
  let defi=defiFacts(loaded.protocols.data||[],loaded.chains.data||[],loaded.stables.data||[],loaded.markets.data||[],loaded.coins.data||{},now),hyper=loaded.hyper.ok?hyperFacts(loaded.hyper.data,now):{status:'UNKNOWN',rows:[],received:null,error:loaded.hyper.error};
  const fallback=old||(typeof PROVIDER_SEED==='object'?PROVIDER_SEED:null);
  if(fallback){
   if(!loaded.protocols.ok&&fallback.defi){defi={...fallback.defi,status:'STALE',transport:'CAPTURA_FECHADA'};}
   if(!loaded.hyper.ok&&fallback.hyper)hyper={...fallback.hyper,status:'STALE',transport:'CAPTURA_FECHADA'};
  }
  if(loaded.protocols.ok&&fallback?.defi){
   for(const a of defi.assets){const prior=fallback.defi.assets?.find(x=>x.symbol===a.symbol);if(!prior)continue;if(!loaded.coins.ok){a.networks=prior.networks;a.exchangeCoinId=prior.exchangeCoinId;a.identityStatus='CATALOGO_PREVIO_FECHADO';}if(!loaded.markets.ok)for(const k of ['geckoId','marketCap','marketCapRank','fdv','circulatingSupply','totalSupply','maxSupply','marketAsOf'])a[k]=prior[k];}
   if(!loaded.stables.ok)defi.stable=fallback.defi.stable;if(!loaded.chains.ok)defi.chains=fallback.defi.chains;
  }
  if(errors.length&&defi.status==='OK')defi.status='PARTIAL';
  return {defi,hyper,status:errors.length?'PARTIAL':'OK',errors};
 },now);
 if(fetcher!==fetch)return run();
 providersPending=run().finally(()=>{providersPending=null;});return providersPending;
}
export async function crossAssetProviders(bucket,fetcher=fetch,now=Date.now()){
 return providerCached(bucket,'providers/cross-v1.json',900000,async old=>{
  const assets=[['GC=F','Oro · futuro COMEX','FUTURO_ORO'],['TLT','Bonos Tesoro 20+ años · ETF TLT','ETF_BONOS'],['IEF','Bonos Tesoro 7–10 años · ETF IEF','ETF_BONOS'],['DX-Y.NYB','Índice dólar DXY','INDICE_USD'],['^GSPC','S&P 500','INDICE_ACCIONES'],['BTC-USD','Bitcoin · referencia agregada USD','CRIPTO_AGREGADA']];
  const result=await Promise.all(assets.map(async([id,label,kind])=>{try{return marketReference(await providerJSON('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(id)+'?range=3mo&interval=1d',fetcher),id,label,kind);}catch(e){return {id,label,kind,status:'UNKNOWN',price:null,error:e.message};}}));
  const fred=await Promise.all(['DGS2','DGS10','DGS30','M2SL'].map(async id=>{try{const r=await fetcher('https://fred.stlouisfed.org/graph/fredgraph.csv?id='+id+'&cosd='+new Date(now-120*86400000).toISOString().slice(0,10),{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP_'+r.status);const rows=fredCSV(await r.text(),id);return {id,value:rows.at(-1)?.value??null,date:rows.at(-1)?.date??null,unit:id==='M2SL'?'Miles de millones USD · M2 de EE.UU.':'% anual · rendimiento, no precio del bono',status:rows.length?'OK':'UNKNOWN',source:'https://fred.stlouisfed.org/series/'+id};}catch(e){return {id,status:'UNKNOWN',value:null,error:e.message};}}));
  const fallback=old||(typeof PROVIDER_SEED==='object'?PROVIDER_SEED.cross:null);for(let i=0;i<result.length;i++)if(result[i].price===null){const prior=fallback?.assets?.find(x=>x.id===result[i].id);if(prior)result[i]={...prior,status:'STALE',error:result[i].error};}for(let i=0;i<fred.length;i++)if(fred[i].value===null){const prior=fallback?.fred?.find(x=>x.id===fred[i].id);if(prior)fred[i]={...prior,status:'STALE',error:fred[i].error};}
  const available=result.filter(x=>x.price!==null);const stale=result.some(x=>x.status==='STALE')||fred.some(x=>x.status==='STALE');
  if(!available.length&&typeof PROVIDER_SEED==='object'&&PROVIDER_SEED.cross)return {...PROVIDER_SEED.cross,status:'STALE',transport:'CAPTURA_FECHADA'};
  return {status:stale?'STALE':available.length===assets.length?'OK':'PARTIAL',received:stale?fallback?.received:now,assets:result,fred,method:'FUERZA_RELATIVA_POR_SESIONES; NO_FLUJO_NETO_DE_CAPITAL',globalM2:'SIN_SERIE_MUNDIAL_VERIFICADA'};
 },now);
}
export async function onchainProvider(bucket,symbol,fetcher=fetch,now=Date.now()){
 if(!SYMBOLS.includes(symbol))throw Error('ACTIVO_FUERA_DEL_UNIVERSO');
 return providerCached(bucket,'providers/onchain/'+symbol+'.json',1800000,async old=>{
  const base=symbol.replace(/USDT$/,''),metadata=await providerJSON('https://api.bitget.com/api/v2/spot/public/coins?coin='+encodeURIComponent(base),fetcher),coin=metadata.data?.find(x=>x.coin===base);
  if(!coin)throw Error('SIN_IDENTIDAD_EN_CATALOGO_BITGET');
  const networks=(coin.chains||[]).map(x=>({chain:x.chain,contract:x.contractAddress||null})),eth=networks.find(x=>x.chain==='ERC20'&&/^0x[0-9a-fA-F]{40}$/.test(x.contract||''));
  const identity={symbol,networks,coinId:coin.coinId,identitySource:'BITGET_PUBLIC_COINS',status:'PARTIAL',observedAt:now};
  try{if(eth){
   const token=await providerJSON('https://eth.blockscout.com/api/v2/tokens/'+eth.contract,fetcher);
   if(String(token.symbol).toUpperCase()!==base||String(token.address_hash).toLowerCase()!==eth.contract.toLowerCase())throw Error('CONTRATO_ONCHAIN_NO_COINCIDE');
   let transfers=[];try{const tr=await providerJSON('https://eth.blockscout.com/api/v2/tokens/'+eth.contract+'/transfers',fetcher);transfers=(tr.items||[]).slice(0,12).map(t=>({tx:t.transaction_hash,time:t.timestamp,from:t.from?.hash,to:t.to?.hash,value:t.total?.value,decimals:t.total?.decimals,block:t.block_number}));}catch{}
   return {...identity,status:'OK',chain:'Ethereum',contract:eth.contract,name:token.name,holders:n(token.holders_count),supplyRaw:token.total_supply,decimals:n(token.decimals),transfers,source:'https://eth.blockscout.com/token/'+eth.contract,scope:'TOKEN_ERC20_Y_MUESTRA_DE_TRANSFERENCIAS; NO_FLUJO_COMPLETO_NI_IDENTIDAD_DE_BALLENAS'};
  }
  const evmRPC={BEP20:{url:'https://bsc-dataseed.binance.org',id:56},BASE:{url:'https://mainnet.base.org',id:8453},ArbitrumOne:{url:'https://arb1.arbitrum.io/rpc',id:42161},Optimism:{url:'https://mainnet.optimism.io',id:10},Polygon:{url:'https://polygon-rpc.com',id:137},RSK:{url:'https://public-node.rsk.co',id:30}};
  const evm=networks.find(x=>evmRPC[x.chain]&&/^0x[0-9a-fA-F]{40}$/.test(x.contract||''));
  if(evm){const rpc=evmRPC[evm.chain],call=async(method,params=[])=>{const r=await providerJSON(rpc.url,fetcher,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});if(r.error)throw Error('RPC_'+r.error.code);return r.result;};
   const [chainId,block,decimalsHex,supplyHex,symbolHex]=await Promise.all([call('eth_chainId'),call('eth_blockNumber'),call('eth_call',[{to:evm.contract,data:'0x313ce567'},'latest']),call('eth_call',[{to:evm.contract,data:'0x18160ddd'},'latest']),call('eth_call',[{to:evm.contract,data:'0x95d89b41'},'latest'])]);
   const decodeSymbol=hex=>{const h=String(hex).slice(2);let raw=h;if(h.length>=128){const offset=Number(BigInt('0x'+h.slice(0,64)))*2;if(offset+64<=h.length){const len=Number(BigInt('0x'+h.slice(offset,offset+64)));if(len<80)raw=h.slice(offset+64,offset+64+len*2);}}return String.fromCharCode(...(raw.match(/../g)||[]).map(x=>parseInt(x,16))).replace(/\0/g,'');};
   const decimals=Number(BigInt(decimalsHex));if(Number(BigInt(chainId))!==rpc.id||!Number.isInteger(decimals)||decimals<0||decimals>36||decodeSymbol(symbolHex).toUpperCase()!==base)throw Error('IDENTIDAD_RPC_NO_COINCIDE');
   return {...identity,status:'OK',chain:evm.chain,contract:evm.contract,block:Number(BigInt(block)),supplyRaw:BigInt(supplyHex).toString(),decimals,source:rpc.url,scope:'OFERTA_TOTAL_ERC20_EN_LA_RED_IDENTIFICADA; SIN_HOLDERS_NI_FLUJO_INSTITUCIONAL'};
  }
  const sui=networks.find(x=>x.chain==='SUI'&&x.contract?.includes('::'));
  if(sui){const meta=await providerJSON('https://fullnode.mainnet.sui.io:443',fetcher,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'suix_getCoinMetadata',params:[sui.contract]})});if(meta.result?.symbol!==base||n(meta.result?.decimals)===null)throw Error('METADATOS_SUI_NO_COINCIDEN');const value=await providerJSON('https://fullnode.mainnet.sui.io:443',fetcher,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'suix_getTotalSupply',params:[sui.contract]})});if(value.error)throw Error('SUI_RPC_'+value.error.code);return {...identity,status:'OK',chain:'Sui',contract:sui.contract,supplyRaw:value.result?.value,decimals:n(meta.result.decimals),source:'https://suivision.xyz/',scope:'OFERTA_TOTAL_EN_SUI; SIN_HOLDERS_INDEXADOS'};}
  const sol=networks.find(x=>x.chain==='SOL'&&x.contract);
  if(sol){const value=await providerJSON('https://api.mainnet-beta.solana.com',fetcher,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getTokenSupply',params:[sol.contract]})});if(value.error)throw Error('SOLANA_RPC_'+value.error.code);return {...identity,status:'OK',chain:'Solana',contract:sol.contract,supplyRaw:value.result?.value?.amount,decimals:value.result?.value?.decimals,slot:value.result?.context?.slot,source:'https://solscan.io/token/'+sol.contract,scope:'OFERTA_TOTAL_EN_SOLANA; SIN_HOLDERS_INDEXADOS'};}
  return {...identity,scope:'CONTRATOS_Y_REDES_VERIFICADOS_EN_BITGET; METRICAS_DE_ESTA_RED_NO_INTEGRADAS'};
  }catch(e){return old?.supplyRaw?{...old,status:'STALE',error:e.message}:{...identity,error:e.message,scope:'IDENTIDAD_EN_CATALOGO; LA_FUENTE_DE_METRICAS_NO_RESPONDIO: '+e.message};}
 },now);
}
export function kronosSnapshot(symbol,market,now=Date.now(),capture=FORECAST_SEED){
 const item=typeof capture==='object'?capture.items?.find(x=>x.symbol===symbol&&x.market===market):null;
 if(!item)return {status:'NO_INFERENCE',symbol,market,engine:'KRONOS_MINI',message:'No hay inferencia ejecutada para este instrumento y mercado.'};
 return {...item,coverage:{valid:capture.items.filter(x=>x.status==='OK').length,total:54,generatedAt:capture.generatedAt},status:item.validUntil<now?'STALE':item.status,model:capture.model,engine:capture.engine,sampleCount:capture.sampleCount,codeCommit:capture.codeCommit,seed:capture.seed,amountMethod:capture.amountMethod,automaticProcessor:'REQUIERE_PROCESO_PYTHON_O_WORKFLOW_APROBADO',note:'Dispersión de trayectorias del modelo; no probabilidad calibrada ni orden.'};
}
export function validateKronosCapture(value,now=Date.now()){
 if(value?.engine!=='PYTORCH_REAL_CPU'||value.model!=='NeoQuasar/Kronos-mini'||value.accountData!==false||!Array.isArray(value.items)||value.items.length!==54||new Set(value.items.map(x=>x.symbol)).size!==54)throw Error('CAPTURA_KRONOS_NO_VALIDA');
 for(const x of value.items){if(!SYMBOLS.includes(x.symbol)||!['SPOT','PERP'].includes(x.market)||x.tf!=='15m'||!Number.isFinite(x.inputAsOf)||x.inputAsOf>now+5000||!Number.isFinite(x.generatedAt)||x.generatedAt>now+5000||!Array.isArray(x.points)||x.points.length!==16||x.points.some((p,i)=>p.time!==x.inputAsOf+i*900000||![p.low,p.mean,p.high].every(v=>Number.isFinite(v)&&v>0)||p.low>p.mean||p.high<p.mean)||x.validUntil!==x.inputAsOf+16*900000)throw Error('SALIDA_KRONOS_NO_VALIDA');}
 return value;
}
export async function kronosProvider(bucket,symbol,market,fetcher=fetch,now=Date.now()){
 if(!SYMBOLS.includes(symbol)||!['SPOT','PERP'].includes(market))throw Error('INSTRUMENTO_NO_ADMITIDO');
 const file=await bucket?.get('providers/kronos-v1.json'),old=file?await file.json():null;
 let capture=typeof FORECAST_SEED==='object'?FORECAST_SEED:null,origin='INFERENCIA_INCLUIDA_EN_VERSION';
 if(old?.capture?.generatedAt>(capture?.generatedAt||0)){capture=old.capture;origin='GITHUB_WORKFLOW_PUBLICO';}
 if(!old||now-old.checkedAt>300000){try{const next=validateKronosCapture(await providerJSON('https://raw.githubusercontent.com/bebe2020/bot-nuevo/market-data/kronos.json?batch='+Math.floor(now/300000),fetcher),now);if(next.generatedAt>(capture?.generatedAt||0)){capture=next;origin='GITHUB_WORKFLOW_PUBLICO';}if(bucket)await bucket.put('providers/kronos-v1.json',JSON.stringify({capture,checkedAt:now}));}catch{if(bucket&&capture)await bucket.put('providers/kronos-v1.json',JSON.stringify({capture,checkedAt:now}));}}
 return {...kronosSnapshot(symbol,market,now,capture),origin};
}
export async function publicWatchHistory(fetcher=fetch,now=Date.now()){
 const day=new Date(now).toISOString().slice(0,10),url='https://raw.githubusercontent.com/bebe2020/bot-nuevo/market-data/history/'+day+'.json?batch='+Math.floor(now/300000);
 try{const h=await providerJSON(url,fetcher),records=h.records||[],items=records.flatMap(r=>(r.watch||[]).filter(x=>SYMBOLS.includes(x.symbol)&&x.attention&&x.isTradeSignal===false).map(x=>({...x,received:r.received}))).sort((a,b)=>b.asof-a.asof).slice(0,150);return {status:items.length?'OK':'SIN_EVENTOS_EN_COBERTURA',day,items,source:'CAPTURAS_PUBLICAS_GITHUB; NO_HISTORIAL_PRIVADO',checkedAt:now,firstCapture:records[0]?.received??null,lastCapture:records.at(-1)?.received??null};}
 catch(e){return {status:'UNKNOWN',day,items:[],error:e.message,source:'CAPTURAS_PUBLICAS_GITHUB',checkedAt:now};}
}
