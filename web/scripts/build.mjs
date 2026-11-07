import {readFile,mkdir,writeFile} from 'node:fs/promises';
const paths=['worker/engine.js','worker/collector.js','worker/live.js','worker/live-ui.js','worker/ui.js','worker/service.js'];
const chunks=await Promise.all(paths.map(p=>readFile(p,'utf8')));
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
const service=paths.indexOf('worker/service.js');
for(const [marker,path] of Object.entries({ENGINE:'worker/engine.js',COLLECTOR:'worker/collector.js',LIVE:'worker/live.js',LIVE_UI:'worker/live-ui.js'}))chunks[service]=chunks[service].replace("'__BUILD_"+marker+"_MODULE__'",JSON.stringify(chunks[paths.indexOf(path)]));
const source=chunks.map(s=>s.replace(/^import .*from '\.\/[^']+';\n/gm,'')).join('\n');
await writeFile('dist/server/index.js',source);await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json','utf8'));
console.log('Built canonical engine + UI + service, without external dependencies.');
