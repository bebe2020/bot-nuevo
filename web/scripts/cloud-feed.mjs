// Captura pública programable. Nunca lee cuentas ni datos del sitio privado.
import {acquire,assemble,primeCache} from '../worker/collector.js';
import {VERSION} from '../worker/engine.js';
import {macroProvider} from '../worker/macro.js';
import {publicContext} from '../worker/context.js';
import {pathToFileURL} from 'node:url';
export const DATA_BRANCH='market-data';
export async function githubRequest(repository,token,path,method='GET',body,fetcher=fetch){
 if(!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(repository)||!path.startsWith('/')||path.includes('/../'))throw Error('REPOSITORIO_O_RUTA_INVALIDOS');
 const r=await fetcher('https://api.github.com/repos/'+repository+path,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok){const e=Error('GITHUB_HTTP_'+r.status);e.status=r.status;throw e;}return r.status===204?{}:r.json();
}
export function publicSummary(raw){
 const s=assemble(raw);if(!s.ticker.lastPr||s.structures['15m'].status!=='OK')throw Error('SIN_CAPTURA_PUBLICA_VALIDA');
 return {id:Math.floor(raw.received/60000)+':'+raw.symbol,received:raw.received,asof:s.sourceAsOf,symbol:raw.symbol,prices:(s.radarUniverse||s.universe).map(x=>({symbol:x.symbol,market:x.market||s.market,price:x.price,change:x.change})),watch:s.watchlist?.filter(x=>x.attention)||[],source:'BITGET_PUBLICO',accountData:false};
}
// Independently computed public feeds share one branch. Rebase their disjoint
// paths after a ref race; never force a push or rerun an inference to publish it.
export async function publishDataEntries(api,entries,message){
 for(let attempt=0;attempt<3;attempt++){
  let ref;try{ref=await api('/git/ref/heads/'+DATA_BRANCH);}catch(e){
   if(e.status!==404)throw e;const main=await api('/git/ref/heads/main');
   try{ref=await api('/git/refs','POST',{ref:'refs/heads/'+DATA_BRANCH,sha:main.object.sha});}catch(createError){if(createError.status===422)continue;throw createError;}
  }
  const parent=ref.object.sha,base=await api('/git/commits/'+parent);
  const tree=await api('/git/trees','POST',{base_tree:base.tree.sha,tree:entries});
  const commit=await api('/git/commits','POST',{message,tree:tree.sha,parents:[parent]});
  try{await api('/git/refs/heads/'+DATA_BRANCH,'PATCH',{sha:commit.sha,force:false});return commit.sha;}catch(e){if(![409,422].includes(e.status)||attempt===2)throw e;}
 }
 throw Error('CONFLICTO_PUBLICACION_PUBLICA');
}
export async function publishFeed({repository,token,raw,context=null,macro=null,error=null,fetcher=fetch,now=Date.now()}){
 if(!token)throw Error('TOKEN_DE_WORKFLOW_NO_DISPONIBLE');
 const api=(p,m,b)=>githubRequest(repository,token,p,m,b,fetcher),entries=[];
 const status={version:VERSION,universe:54,lastAttempt:now,state:error?'ERROR':'OK',source:'BITGET_PUBLICO',targetIntervalMinutes:5,codeRevision:process.env.GITHUB_SHA||null,runId:process.env.GITHUB_RUN_ID||null,errors:error?[String(error).slice(0,160)]:[],accountData:false};
 if(raw){const summary=publicSummary(raw);raw.version=VERSION;status.lastSuccess=raw.received;status.sourceAsOf=summary.asof;
  const day=new Date(raw.received).toISOString().slice(0,10),path='history/'+day+'.json';let history=[];
  try{const file=await api('/contents/'+path+'?ref='+DATA_BRANCH);history=JSON.parse(Buffer.from(file.content,'base64').toString('utf8')).records||[];}catch(e){if(e.status!==404)throw e;}
  history=history.filter(x=>x.id!==summary.id).concat(summary).slice(-400);
  entries.push({path:'latest.json',mode:'100644',type:'blob',content:JSON.stringify(raw)},{path,mode:'100644',type:'blob',content:JSON.stringify({day,records:history})});
 }
 if(context&&(context.macro?.value||context.calendar?.items?.length||context.news?.items?.length))entries.push({path:'context.json',mode:'100644',type:'blob',content:JSON.stringify(context)});
 if(macro?.metrics?.length===20)entries.push({path:'macro.json',mode:'100644',type:'blob',content:JSON.stringify({...macro,accountData:false})});
 entries.push({path:'status.json',mode:'100644',type:'blob',content:JSON.stringify(status)});
 const commit=await publishDataEntries(api,entries,error?'Registrar fallo de captura pública':'Actualizar captura pública de mercado');return {commit,status};
}
export async function main(){
 const repository=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;let raw;
 try{if(/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(repository||'')){try{const prior=await fetch('https://raw.githubusercontent.com/'+repository+'/market-data/latest.json',{signal:AbortSignal.timeout(10000)});if(prior.ok)primeCache(await prior.json());}catch{}}raw=await acquire('BTCUSDT');publicSummary(raw);}catch(e){if(token)await publishFeed({repository,token,error:e.message});throw e;}
 const [context,macro]=await Promise.all([publicContext(null),macroProvider(null,fetch,Date.now(),{preferMirror:false})]);
 const result=await publishFeed({repository,token,raw,context,macro});console.log(JSON.stringify({state:result.status.state,sourceAsOf:result.status.sourceAsOf,received:raw.received,commit:result.commit,branch:DATA_BRANCH,context:{macro:context.macro?.status,calendar:context.calendar?.status,news:context.news?.status}}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error('Captura pública fallida: '+e.message);process.exitCode=1;});
