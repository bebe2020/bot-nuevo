import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const serverPaths=['worker/universe.js','worker/market-contract.js','worker/engine.js','worker/indicators.js','worker/freshness.js','worker/technicals.js','worker/auto-protocol.js','worker/protocol.js','worker/collector.js','worker/ui.js','worker/context.js','worker/providers.js','worker/sosovalue.js','worker/macro.js','worker/paper-cloud.js','worker/service.js'];
const clientFiles=['macro.js','integral.js','paper-cloud.js','universe.js','market-contract.js','engine.js','indicators.js','freshness.js','technicals.js','auto-protocol.js','protocol.js','collector.js','live.js','chart.js','journal.js','lab.js','paper.js','panels.js','app.js','terminal.css'];
const assets={};for(const file of clientFiles)assets['/'+file]={body:await readFile('worker/'+file,'utf8'),type:file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8'};
assets['/vendor/lightweight-charts.js']={body:await readFile('node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.mjs','utf8'),type:'application/javascript; charset=utf-8'};
const sourceFiles=[...(await readdir('worker')).map(f=>'worker/'+f),...(await readdir('scripts')).filter(f=>f.endsWith('.mjs')).map(f=>'scripts/'+f),'package.json','package-lock.json'].sort();
const digest=createHash('sha256');for(const file of sourceFiles)digest.update(file+'\0').update(await readFile(file)).update('\0');
const buildInfo={sourceSHA256:digest.digest('hex'),builtAt:new Date().toISOString(),scope:'worker_scripts_dependency_lock'};
const chunks=await Promise.all(serverPaths.map(p=>readFile(p,'utf8')));chunks[chunks.length-1]=chunks.at(-1).replace("'__BUILD_PUBLIC_ASSETS__'",JSON.stringify(assets)).replace("'__BUILD_INFO__'",JSON.stringify(buildInfo));
const capture=JSON.parse(await readFile('worker/context-capture.json','utf8'));
chunks[serverPaths.indexOf('worker/context.js')]=chunks[serverPaths.indexOf('worker/context.js')].replace("'__BUILD_PUBLIC_CONTEXT_CAPTURE__'",JSON.stringify(capture));
for(const [marker,file] of [['__BUILD_PROVIDER_CAPTURE__','worker/provider-capture.json'],['__BUILD_KRONOS_CAPTURE__','worker/kronos-capture.json'],['__BUILD_MACRO_CAPTURE__','worker/macro-capture.json']]){const i=serverPaths.indexOf(marker==='__BUILD_MACRO_CAPTURE__'?'worker/macro.js':'worker/providers.js');let seed={};try{seed=JSON.parse(await readFile(file,'utf8'));}catch{}chunks[i]=chunks[i].replace("'"+marker+"'",JSON.stringify(seed));}
const source=chunks.map(s=>s.replace(/^import .*from '\.\/[^']+';\n/gm,'').replace(/^export \{[^}]+\};$/gm,'')).join('\n');await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});await writeFile('dist/server/index.js',source);await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json','utf8'));console.log('Built terminal 54, pure analytics and self-hosted chart assets.');

await writeFile('dist/build-info.json',JSON.stringify(buildInfo,null,2));
