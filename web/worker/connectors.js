// Server-only adapters. Credentials never enter response payloads or browser assets.
export function analyticsFetch(env,fetcher=fetch){
 return (url,options={})=>{
  const host=new URL(url).hostname,headers=new Headers(options.headers||{});
  if(host==='api.coingecko.com'&&env.COINGECKO_API_KEY)headers.set('x-cg-demo-api-key',env.COINGECKO_API_KEY);
  return fetcher(url,{...options,headers,redirect:'manual'});
 };
}
export async function connectorStatus(env,fetcher=fetch,now=Date.now()){
 const bucket=env.BUCKET,key='providers/connector-status-v1.json',file=await bucket?.get(key),old=file?await file.json():null;
 const configured=['FRED_API_KEY','SOSOVALUE_API_KEY','COINGECKO_API_KEY','COINGLASS_API_KEY'].map(k=>[k,!!env[k]]);
 const signature=JSON.stringify(configured);
 if(old?.transportMode==='WORKER_MANUAL_REDIRECTS'&&old?.signature===signature&&old.nextCheck>now)return old;
 const checks=[
  ['FRED','FRED_API_KEY','https://api.stlouisfed.org/fred/series/observations',{}, {series_id:'DGS10',file_type:'json',sort_order:'desc',limit:2}],
  ['SOSOVALUE','SOSOVALUE_API_KEY','https://openapi.sosovalue.com/openapi/v1/analyses/ahr_999_indicator?limit=2',{'x-soso-api-key':env.SOSOVALUE_API_KEY}],
  ['COINGECKO','COINGECKO_API_KEY','https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin',{'x-cg-demo-api-key':env.COINGECKO_API_KEY}],
  ['COINGLASS','COINGLASS_API_KEY','https://open-api-v4.coinglass.com/api/futures/supported-coins',{'CG-API-KEY':env.COINGLASS_API_KEY}]
 ];
 const providers=await Promise.all(checks.map(async([id,key,url,headers,query])=>{
  if(!env[key])return {id,configured:false,status:'CONFIG_REQUIRED'};
  try{
   if(query){const u=new URL(url);for(const [k,v] of Object.entries({...query,api_key:env[key]}))u.searchParams.set(k,v);url=u.href;}
   const r=await fetcher(url,{headers,redirect:'manual',signal:AbortSignal.timeout(10000)});
   if(!r.ok)return {id,configured:true,status:[401,403].includes(r.status)?'AUTH_REQUIRED':r.status===429?'RATE_LIMITED':'ERROR',http:r.status,checkedAt:now};
   const body=await r.json(),code=body?.code;
   const rejected=code!==undefined&&!['0','200','success'].includes(String(code));
   const rows=Array.isArray(body)?body:body?.observations||body?.data;
   return {id,configured:true,status:rejected?String(code)==='401'||String(code)==='403'?'AUTH_REQUIRED':'ERROR':Array.isArray(rows)&&rows.length?'OK':'UNKNOWN',http:r.status,code:code??null,checkedAt:now};
  }catch{return {id,configured:true,status:'UNREACHABLE',checkedAt:now};}
 }));
 const observed=providers.filter(x=>x.status==='OK').length;
 const value={transportMode:'WORKER_MANUAL_REDIRECTS',status:observed===providers.length?'OK':observed?'PARTIAL':'UNKNOWN',providers,checkedAt:now,nextCheck:now+1800000,signature,accountData:false};
 if(bucket)await bucket.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
 return value;
}
