import http from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
import worker from '../worker/service.js';
import {collect} from '../worker/service.js';
import {fakeFetch} from '../tests/fixtures.js';
const root=resolve('.local/store');mkdirSync(root,{recursive:true});
const path=k=>resolve(root,Buffer.from(k).toString('base64url')+'.json');
const bucket={
 async get(k){try{const x=JSON.parse(readFileSync(path(k),'utf8'));return {...x,json:async()=>JSON.parse(x.text)};}catch(e){if(e.code==='ENOENT')return null;throw e;}},
 async put(k,text,opts={}){let old;try{old=JSON.parse(readFileSync(path(k),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}const c=opts.onlyIf;if(c?.etagDoesNotMatch==='*'&&old||c?.etagMatches&&old?.etag!==c.etagMatches)return null;const x={key:k,text,etag:crypto.randomUUID(),customMetadata:opts.customMetadata||{}};const tmp=path(k)+'.tmp';writeFileSync(tmp,JSON.stringify(x));renameSync(tmp,path(k));return {etag:x.etag};},
 async list({prefix='',limit=1000}={}){const all=readdirSync(root).filter(p=>p.endsWith('.json')).map(p=>JSON.parse(readFileSync(resolve(root,p),'utf8'))).filter(x=>x.key.startsWith(prefix)).sort((a,b)=>a.key.localeCompare(b.key));return {objects:all.slice(0,limit),truncated:all.length>limit};}
};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://'+req.headers.host),chunks=[];for await(const c of req)chunks.push(c);
 const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(','):v);
 const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
 let r;const fixture=existsSync('.local/fixture-mode');
 if(url.pathname==='/engine.js'||url.pathname==='/collector.js')r=new Response(readFileSync('worker'+url.pathname,'utf8'),{headers:{'Content-Type':'application/javascript'}});
 else if(url.pathname==='/__qa/mobile')r=new Response('<!doctype html><html><head><title>QA móvil · 360px</title></head><body style="margin:0;background:#27364a"><iframe title="Bot Nuevo 360px" src="/?paused=1" style="display:block;width:360px;height:840px;border:0;margin:auto"></iframe></body></html>',{headers:{'Content-Type':'text/html'}});
 else if(fixture&&url.pathname==='/api/snapshot')r=Response.json({...await collect(bucket,url.searchParams.get('symbol')||'BTCUSDT',fakeFetch()),dataMode:'SYNTHETIC_TEST_ONLY'});
 else r=await worker.fetch(request,{BUCKET:bucket});
 if(fixture&&url.pathname==='/'){r=new Response((await r.text()).replace('Proyecto personal · Bitget Futures','PRUEBA SINTÉTICA · NO USAR PRECIOS').replace('Conectando con fuentes públicas','PRUEBA SINTÉTICA · conectando fixtures'),{headers:r.headers,status:r.status});}
 res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
 }catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}});
const portAt=process.argv.indexOf('--port');
server.listen(Number(portAt>=0?process.argv[portAt+1]:process.env.PORT||5173),'0.0.0.0',()=>console.log('Bot Nuevo preview ready'));
