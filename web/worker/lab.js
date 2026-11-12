export class TaskMonitor{
 constructor(onChange=()=>{}){this.onChange=onChange;this.tasks=new Map();this.events=[];}
 begin(id,label,engine='DATOS_Y_REGLAS'){const task={id,label,engine,state:'RUNNING',started:performance.now(),startedAt:Date.now(),runs:(this.tasks.get(id)?.runs||0)+1};this.tasks.set(id,task);this.emit(id,'Inicio');return task;}
 finish(run,summary='',state='OK'){const id=typeof run==='string'?run:run.id,t=this.tasks.get(id);if(!t||typeof run==='object'&&t!==run)return;t.state=state;t.durationMs=performance.now()-t.started;t.finishedAt=Date.now();t.summary=summary;this.emit(id,summary);}
 emit(id,message){const t=this.tasks.get(id);this.events.unshift({at:Date.now(),id,state:t?.state,message});this.events=this.events.slice(0,60);this.onChange(this);}
 async run(id,label,fn,engine){const task=this.begin(id,label,engine);try{const value=await fn();this.finish(task,value?.status||'Respuesta recibida',['STALE','PARTIAL','UNKNOWN','NO_INFERENCE','CONFIG_REQUIRED','AUTH_REQUIRED','RATE_LIMITED','COLLECTING'].includes(value?.status)?value.status:'OK');return value;}catch(e){this.finish(task,e.message,'ERROR');throw e;}}
 snapshot(){return {tasks:[...this.tasks.values()],events:this.events};}
}
export function correlationGraph(rows,limit=100){
 const good=rows.filter(x=>Array.isArray(x.bars)&&x.bars.length>=30),edges=[];
 const returns=r=>new Map(r.bars.slice(-97).slice(1).map((b,i)=>[Number(b[0]),Math.log(Number(b[4])/Number(r.bars.slice(-97)[i][4]))]));
 const maps=good.map(returns);
 for(let i=0;i<good.length;i++)for(let j=i+1;j<good.length;j++){
  const pairs=[...maps[i]].filter(([t])=>maps[j].has(t)).map(([t,a])=>[a,maps[j].get(t)]);if(pairs.length<24)continue;
  const ma=pairs.reduce((s,p)=>s+p[0],0)/pairs.length,mb=pairs.reduce((s,p)=>s+p[1],0)/pairs.length,va=pairs.reduce((s,p)=>s+(p[0]-ma)**2,0),vb=pairs.reduce((s,p)=>s+(p[1]-mb)**2,0);if(!va||!vb)continue;
  const rho=pairs.reduce((s,p)=>s+(p[0]-ma)*(p[1]-mb),0)/Math.sqrt(va*vb);if(Math.abs(rho)>=.6)edges.push({a:good[i].symbol,b:good[j].symbol,rho,n:pairs.length});
 }
 return edges.sort((a,b)=>Math.abs(b.rho)-Math.abs(a.rho)).slice(0,limit);
}
const labEsc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function forecastSVG(forecast,bars=[]){
 if(!forecast?.points?.length)return '';
 const history=bars.filter(r=>r[0]+900000<=forecast.inputAsOf).slice(-48).map(r=>({time:r[0],mean:r[4],low:r[4],high:r[4]})),all=[...history,...forecast.points];
 const prices=all.flatMap(x=>[x.low,x.high]).filter(Number.isFinite),min=Math.min(...prices),max=Math.max(...prices),lo=min-(max-min)*.08,hi=max+(max-min)*.08,w=800,h=320,pad=46,x=i=>pad+(w-2*pad)*i/Math.max(1,all.length-1),y=p=>pad+(h-2*pad)*(hi-p)/(hi-lo||1),path=points=>points.map(([a,b],i)=>(i?'L':'M')+a.toFixed(2)+' '+b.toFixed(2)).join(' ');
 const start=history.length,band=[...forecast.points.map((p,i)=>[x(start+i),y(p.high)]),...forecast.points.map((p,i)=>[x(start+i),y(p.low)]).reverse()];
 return '<svg class="forecast-chart" role="img" aria-label="Serie histórica y proyección ejecutada de Kronos" viewBox="0 0 800 320"><rect width="800" height="320" fill="#050b19"/>'+[0,.25,.5,.75,1].map(r=>{const p=lo+(hi-lo)*r;return '<line x1="46" x2="754" y1="'+y(p)+'" y2="'+y(p)+'" stroke="#182941"/><text x="2" y="'+y(p)+'" fill="#8ba8c9" font-size="10">'+labEsc(p.toPrecision(6))+'</text>';}).join('')+'<path d="'+path(history.map((p,i)=>[x(i),y(p.mean)]))+'" fill="none" stroke="#00edbd" stroke-width="2"/><path d="'+path(band)+' Z" fill="#00cfff" opacity=".17"/><path d="'+path(forecast.points.map((p,i)=>[x(start+i),y(p.mean)]))+'" fill="none" stroke="#00dfff" stroke-width="2" stroke-dasharray="6 3"/><line x1="'+x(start)+'" x2="'+x(start)+'" y1="20" y2="290" stroke="#e57bff" stroke-dasharray="4 4"/><text x="50" y="25" fill="#00edbd" font-size="12">HISTORIA CERRADA</text><text x="'+Math.min(610,x(start)+8)+'" y="25" fill="#00dfff" font-size="12">KRONOS · '+forecast.sampleCount+' TRAYECTORIAS</text></svg>';
}
