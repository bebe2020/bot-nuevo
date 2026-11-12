import {ASSETS} from './universe.js';
import {n} from './engine.js';

export const FUNDAMENTAL_CATALOG = [
  ['MARKET_CAP','Capitalización','USD'],['FDV','Valoración diluida','USD'],
  ['CIRCULATING','Oferta circulante','tokens'],['TOTAL_SUPPLY','Oferta total','tokens'],
  ['MAX_SUPPLY','Oferta máxima declarada','tokens'],['CIRCULATING_PCT','Circulante / total','%'],
  ['DILUTION_RATIO','FDV / capitalización','veces'],['TVL','TVL del protocolo seleccionado','USD'],
  ['FEES_24H','Comisiones reportadas 24h','USD'],['REVENUE_24H','Ingresos reportados 24h','USD'],
  ['FEES_7D','Comisiones reportadas 7d','USD'],['REVENUE_7D','Ingresos reportados 7d','USD'],
  ['DEX_VOLUME_24H','Volumen DEX reportado 24h','USD'],['PERP_VOLUME_24H','Volumen del activo 24h · Hyperliquid PERP/USDC','USD nocionales']
].map(([id,label,unit])=>({id,label,unit}));
const fundDefinition=id=>FUNDAMENTAL_CATALOG.find(x=>x.id===id);
const fundNumber=x=>n(x)!==null&&Number(x)>=0?Number(x):null;

export function normalizeDimension(value,kind,received) {
  if(!['fees','revenue','dexs'].includes(kind))throw Error('DIMENSION_NO_ADMITIDA');
  if(!Array.isArray(value?.protocols))throw Error('RESPUESTA_DIMENSION_INVALIDA');
  return {kind,received,status:'OK',source:'https://api.llama.fi/overview/'+(kind==='dexs'?'dexs':'fees'),
    rows:value.protocols.map(p=>({id:String(p.defillamaId??''),slug:p.slug,name:p.name,
      type:p.protocolType,parent:p.parentProtocol||null,disabled:p.disabled===true||p.latestFetchIsOk===false,
      total24h:fundNumber(p.total24h),total7d:fundNumber(p.total7d)})).filter(p=>p.id&&typeof p.slug==='string')};
}

export function dimensionFor(asset,report) {
  if(asset?.protocols?.length) {
   for(const protocol of asset.protocols){
    const match=report?.rows?.find(x=>x.id===String(protocol.id)&&x.slug===protocol.slug&&x.type==='protocol');
    if(match)return {...match,scope:'PROTOCOLO_ASOCIADO_SELECCIONADO; NO_SUMA_DE_VERSIONES'};
   }
   return null;
  }
  // A network fee is explicitly a network fee, not revenue of a DeFi token.
  const chain=asset?.chain?.name;
  const match=chain?report?.rows?.find(x=>x.type==='chain'&&x.name===chain):null;
  return match?{...match,scope:'RED_NATIVA; NO_INGRESO_DE_TENEDORES'}:null;
}

export function cryptoGlobalFacts(payload,received=Date.now()) {
  const d=payload?.data,asof=n(d?.updated_at)!==null?Number(d.updated_at)*1000:null;
  const total=fundNumber(d?.total_market_cap?.usd),btc=n(d?.market_cap_percentage?.btc),eth=n(d?.market_cap_percentage?.eth);
  if(!(total>0&&asof>0&&asof<=received&&btc!==null&&eth!==null&&btc>=0&&eth>=0&&btc+eth<=100))throw Error('GLOBAL_CRIPTO_IDENTIDAD_O_RELOJ_INVALIDOS');
  const fear=n(d.fear_and_greed_index?.value);
  return {status:'OK',asof,received,totalUSD:total,volume24hUSD:fundNumber(d.total_volume?.usd),
    btcDominancePct:btc,ethDominancePct:eth,exBtcUSD:total*(1-btc/100),exBtcEthUSD:total*(1-(btc+eth)/100),
    change24hPct:n(d.market_cap_change_percentage_24h_usd),fearGreed:fear!==null&&fear>=0&&fear<=100?fear:null,
    source:'https://www.coingecko.com/en/charts',
    method:'COINGECKO; EX_BTC_Y_EX_BTC_ETH_DERIVADOS; NO_INDICES_OFICIALES_TRADINGVIEW; VOLUMEN_NO_FLUJO_NETO'};
}

export function ageCryptoGlobal(value,now=Date.now()) {
  if(!value)return null;
  return {...value,status:value.status==='STALE'||!Number.isFinite(value.asof)||value.asof>now||now-value.asof>7200000?'STALE':value.status};
}

function fundamentalFact(id,value,{asof=null,received=null,source=null,stale=false,reason=null,scope=null,entity=null,venue=null,market=null}={}) {
  const numeric=fundNumber(value);
  return {...fundDefinition(id),value:numeric,asof,received,source,scope,entity,venue,market,
    state:numeric===null?'UNKNOWN':stale?'STALE':asof===null?'PARTIAL':'OK',
    clock:asof===null?'FECHA_DE_DATO_NO_INFORMADA':'FECHA_DE_FUENTE',
    reason:reason||(numeric===null?'SIN_OBSERVACION':asof===null?'Ventana reportada por proveedor; su cierre no está fechado.':null)};
}

export function buildFundamentalAssets(defi,reports={},hyper=null) {
  return ASSETS.map(canonical=>{
    const symbol=canonical.base+'USDT',a=defi?.assets?.find(x=>x.symbol===symbol),market={asof:a?.marketAsOf??null,received:a?.received??null,source:'https://www.coingecko.com',stale:defi?.status==='STALE'};
    const facts=[['MARKET_CAP',a?.marketCap],['FDV',a?.fdv],['CIRCULATING',a?.circulatingSupply],['TOTAL_SUPPLY',a?.totalSupply],['MAX_SUPPLY',a?.maxSupply]].map(([id,v])=>fundamentalFact(id,v,market));
    const circ=fundNumber(a?.circulatingSupply),total=fundNumber(a?.totalSupply),cap=fundNumber(a?.marketCap),fdv=fundNumber(a?.fdv);
    facts.push(fundamentalFact('CIRCULATING_PCT',total>0&&circ!==null&&circ<=total?100*circ/total:null,{...market,reason:circ!==null&&total!==null&&circ>total?'Circulante mayor que total: relación no interpretable.':null}));
    facts.push(fundamentalFact('DILUTION_RATIO',cap>0&&fdv!==null?fdv/cap:null,market));
    const protocol=a?.protocols?.[0];
    facts.push(fundamentalFact('TVL',a?.principalTVL,{received:defi?.received??null,source:protocol?.url||'https://defillama.com',stale:defi?.status==='STALE',scope:protocol?.slug||'SIN_PROTOCOLO_ASOCIADO'}));
    const matched={};
    for(const [kind,windows] of [['fees',[['FEES_24H','total24h'],['FEES_7D','total7d']]],['revenue',[['REVENUE_24H','total24h'],['REVENUE_7D','total7d']]],['dexs',[['DEX_VOLUME_24H','total24h']]]]){
      const report=reports[kind],row=dimensionFor(a,report);if(row)matched[kind]={id:row.id,slug:row.slug,name:row.name,scope:row.scope};
      for(const [id,column] of windows)facts.push(fundamentalFact(id,row?.[column],{received:report?.received??null,source:report?.source||'https://defillama.com',stale:report?.status==='STALE'||row?.disabled,scope:row?.scope,entity:row?{id:row.id,slug:row.slug,name:row.name}:null,reason:!row?'SIN_IDENTIDAD_DE_PROTOCOLO_O_RED_EN_ESTA_FUENTE':null}));
    }
    const hl=hyper?.rows?.find(x=>x.symbol===symbol&&x.available===true);
    facts.push(fundamentalFact('PERP_VOLUME_24H',hl?.volumeUSD,{received:hl?.received??hyper?.received??null,source:'https://api.hyperliquid.xyz/info',stale:hyper?.status==='STALE',scope:'VOLUMEN_DEL_ACTIVO_EN_HYPERLIQUID; NO_INGRESOS_DEL_PROTOCOLO',venue:'HYPERLIQUID',market:'PERP_USDC'}));
    return {symbol,base:canonical.base,name:canonical.proyecto,protocol:protocol?{id:String(protocol.id),slug:protocol.slug,name:protocol.name}:null,matched,facts,
      missing:['UNLOCKS_FECHADOS','EMISION_Y_QUEMAS','USUARIOS_ACTIVOS','CATALIZADORES_VERIFICADOS'],
      method:'HECHOS_FUNDAMENTALES_PARCIALES; SIN_PUNTUACION_DE_INFRAVALORACION'};
  });
}

export function ageFundamentals(value,now=Date.now()) {
  const assets=ASSETS.map(a=>{
    const original=value?.assets?.find(x=>x.symbol===a.base+'USDT');
    const facts=FUNDAMENTAL_CATALOG.map(def=>{
      const x=original?.facts?.find(x=>x.id===def.id);
      if(!x||x.state==='UNKNOWN'||fundNumber(x.value)===null)return {...def,value:null,asof:null,received:x?.received??null,state:'UNKNOWN',reason:x?.reason||'SIN_OBSERVACION'};
      const clock=x.asof??x.received,limit=x.asof===null?7200000:86400000;
      if(!Number.isFinite(clock)||clock>now)return {...x,...def,value:null,state:'UNKNOWN',reason:'RELOJ_INVALIDO'};
      return {...x,...def,state:x.state==='STALE'||now-clock>limit?'STALE':x.asof===null?'PARTIAL':'OK'};
    });
    return {...original,symbol:a.base+'USDT',base:a.base,name:a.proyecto,facts,
      coverage:{observed:facts.filter(x=>['OK','PARTIAL'].includes(x.state)).length,dated:facts.filter(x=>x.state==='OK').length,total:facts.length}};
  });
  const facts=assets.flatMap(x=>x.facts),global=ageCryptoGlobal(value?.global,now);
  return {...value,assets,global,servedAt:now,coverage:{assets:54,withObservations:assets.filter(x=>x.coverage.observed>0).length,observed:facts.filter(x=>['OK','PARTIAL'].includes(x.state)).length,dated:facts.filter(x=>x.state==='OK').length,total:facts.length},
    status:facts.some(x=>['OK','PARTIAL'].includes(x.state))?'PARTIAL':'UNKNOWN',
    note:'Comisiones no son ingresos, ingresos no son beneficio del token. Una métrica positiva no certifica compra ni infravaloración.'};
}
