import {readFile} from 'node:fs/promises';
import {githubRequest,publishDataEntries} from './cloud-feed.mjs';
import {validateKronosCapture} from '../worker/providers.js';
const capture=validateKronosCapture(JSON.parse(await readFile(process.argv[2],'utf8'))),repository=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;
if(!token)throw Error('TOKEN_DE_WORKFLOW_NO_DISPONIBLE');
const api=(path,method='GET',body)=>githubRequest(repository,token,path,method,body);
const commit=await publishDataEntries(api,[{path:'kronos.json',mode:'100644',type:'blob',content:JSON.stringify(capture)}],'Publicar 54 inferencias reales Kronos-mini');
console.log(JSON.stringify({valid:54,engine:capture.engine,commit}));
