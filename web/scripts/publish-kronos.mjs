import {readFile} from 'node:fs/promises';
import {githubRequest,DATA_BRANCH} from './cloud-feed.mjs';
import {validateKronosCapture} from '../worker/providers.js';
const capture=validateKronosCapture(JSON.parse(await readFile(process.argv[2],'utf8'))),repository=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;
if(!token)throw Error('TOKEN_DE_WORKFLOW_NO_DISPONIBLE');
const api=(path,method='GET',body)=>githubRequest(repository,token,path,method,body);
let ref;try{ref=await api('/git/ref/heads/'+DATA_BRANCH);}catch(e){if(e.status!==404)throw e;const main=await api('/git/ref/heads/main');ref=await api('/git/refs','POST',{ref:'refs/heads/'+DATA_BRANCH,sha:main.object.sha});}
const prior=await api('/git/commits/'+ref.object.sha),tree=await api('/git/trees','POST',{base_tree:prior.tree.sha,tree:[{path:'kronos.json',mode:'100644',type:'blob',content:JSON.stringify(capture)}]}),commit=await api('/git/commits','POST',{message:'Publicar 54 inferencias reales Kronos-mini',parents:[ref.object.sha],tree:tree.sha});
await api('/git/refs/heads/'+DATA_BRANCH,'PATCH',{sha:commit.sha,force:false});console.log(JSON.stringify({valid:54,engine:capture.engine,commit:commit.sha}));
