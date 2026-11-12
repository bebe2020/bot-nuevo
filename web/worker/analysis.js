// Keep the OHLCV calculation off the UI thread. Reset rejects obsolete selections.
import {assemble} from '/collector.js';
export class Analyzer{
 constructor(create=()=>new Worker('/analysis-worker.js',{type:'module'})){this.create=create;this.worker=null;this.pending=new Map();this.nextId=0;}
 reset(){this.worker?.terminate();this.worker=null;for(const p of this.pending.values())p.reject(Error('ANALISIS_CANCELADO'));this.pending.clear();}
 run(raw,previous=null){
  if(!this.worker){
   try{this.worker=this.create();this.worker.onmessage=({data})=>{const p=this.pending.get(data.id);if(!p)return;this.pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.value);};this.worker.onerror=()=>this.reset();}
   catch{return Promise.resolve().then(()=>assemble(raw,previous));}
  }
  const id=++this.nextId;
  return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});try{this.worker.postMessage({id,raw,previous});}catch(e){this.pending.delete(id);reject(e);}});
 }
}
