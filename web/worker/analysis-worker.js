import {assemble} from '/collector.js';
self.onmessage=({data})=>{
 try{self.postMessage({id:data.id,value:assemble(data.raw,data.previous)});}
 catch(e){self.postMessage({id:data.id,error:e.message||'ANALISIS_NO_DISPONIBLE'});}
};
