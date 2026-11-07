import {readFile,mkdir,writeFile} from 'node:fs/promises';
const paths=['worker/engine.js','worker/collector.js','worker/ui.js','worker/service.js'];
const chunks=await Promise.all(paths.map(p=>readFile(p,'utf8')));
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
chunks[3]=chunks[3].replace("'__BUILD_ENGINE_MODULE__'",JSON.stringify(chunks[0])).replace("'__BUILD_COLLECTOR_MODULE__'",JSON.stringify(chunks[1]));
const source=chunks.map(s=>s.replace(/^import .*from '\.\/[^']+';\n/gm,'')).join('\n');
await writeFile('dist/server/index.js',source);await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json','utf8'));
console.log('Built canonical engine + UI + service, without external dependencies.');
