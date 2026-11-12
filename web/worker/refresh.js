// One request per resource identity; failed jobs retry independently.
export class RefreshCoordinator{
 constructor({clock=()=>Date.now(),onChange=()=>{},concurrency=3}={}){this.clock=clock;this.onChange=onChange;this.concurrency=concurrency;this.active=0;this.queue=[];this.jobs=new Map();}
 async slot(){if(this.active>=this.concurrency)await new Promise(resolve=>this.queue.push(resolve));else this.active++;}
 release(){const next=this.queue.shift();if(next)next();else this.active--;}
 run(id,load,{ttl=300000,force=false}={}){
  let job=this.jobs.get(id);if(!job){job={id,state:'PENDING',nextCheck:0,runs:0};this.jobs.set(id,job);}
  if(job.promise)return job.promise;
  if(!force&&this.clock()<job.nextCheck)return Promise.resolve(job.value);
  job.state='QUEUED';this.onChange();
  job.promise=(async()=>{
   await this.slot();job.state='RUNNING';job.startedAt=this.clock();this.onChange();
   try{const value=await load();job.value=value;job.state=value?.status||'OK';job.lastSuccess=this.clock();job.nextCheck=this.clock()+ttl;job.error=null;return value;}
   catch(e){job.state='ERROR';job.error=e?.status===401?'SESION_VENCIDA':'CONSULTA_NO_DISPONIBLE';job.nextCheck=this.clock()+30000;throw e;}
   finally{job.runs++;job.finishedAt=this.clock();job.promise=null;this.release();this.onChange();}
  })();
  return job.promise;
 }
 snapshot(){return [...this.jobs.values()].map(({promise,value,...meta})=>({...meta,inFlight:!!promise}));}
}
