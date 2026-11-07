export class TaskMonitor{
 constructor(onChange=()=>{}){this.onChange=onChange;this.tasks=new Map();this.events=[];}
 begin(id,label,engine='DATOS_Y_REGLAS'){const task={id,label,engine,state:'RUNNING',started:performance.now(),startedAt:Date.now(),runs:(this.tasks.get(id)?.runs||0)+1};this.tasks.set(id,task);this.emit(id,'Inicio');return task;}
 finish(id,summary='',state='OK'){const t=this.tasks.get(id);if(!t)return;t.state=state;t.durationMs=performance.now()-t.started;t.finishedAt=Date.now();t.summary=summary;this.emit(id,summary);}
 emit(id,message){const t=this.tasks.get(id);this.events.unshift({at:Date.now(),id,state:t?.state,message});this.events=this.events.slice(0,60);this.onChange(this);}
 async run(id,label,fn,engine){this.begin(id,label,engine);try{const value=await fn();this.finish(id,value?.status||'Respuesta recibida',['STALE','PARTIAL','UNKNOWN','NO_INFERENCE'].includes(value?.status)?value.status:'OK');return value;}catch(e){this.finish(id,e.message,'ERROR');throw e;}}
 snapshot(){return {tasks:[...this.tasks.values()],events:this.events};}
}
const LAB_COLORS={OK:'#00ffc3',RUNNING:'#00ddff',ERROR:'#ff327c',STALE:'#ffdb55',UNKNOWN:'#8693b0'};
export class WireScene{
 constructor(canvas,{mode='brain',nodes=[],onSelect=()=>{}}={}){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.mode=mode;this.nodes=nodes;this.onSelect=onSelect;this.yaw=.3;this.pitch=-.1;this.exploded=false;this.auto=false;this.active=false;this.hit=[];
  canvas.addEventListener('pointerdown',e=>{this.drag={x:e.clientX,y:e.clientY,yaw:this.yaw,pitch:this.pitch,moved:false};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!this.drag)return;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(Math.abs(dx)+Math.abs(dy)>4)this.drag.moved=true;this.yaw=this.drag.yaw+dx/140;this.pitch=Math.max(-1.3,Math.min(1.3,this.drag.pitch+dy/140));this.paint();});
  canvas.addEventListener('pointerup',e=>{if(this.drag&&!this.drag.moved){const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;const node=this.hit.find(n=>Math.hypot(n.x-x,n.y-y)<30);if(node)this.onSelect(node.id);}this.drag=null;});
  this.resizeObserver=new ResizeObserver(()=>this.paint());this.resizeObserver.observe(canvas);this.paint();
 }
 setNodes(nodes){this.nodes=nodes;this.paint();}
 setExploded(value){this.exploded=value;this.paint();}
 setActive(value){this.active=value;if(value)this.paint();if(!value&&this.raf){cancelAnimationFrame(this.raf);this.raf=null;}}
 rotate(value){this.auto=value;this.setActive(this.active);}
 project([x,y,z]){const a=this.yaw,c=Math.cos(a),s=Math.sin(a),x1=x*c-z*s,z1=x*s+z*c,p=this.pitch,y1=y*Math.cos(p)-z1*Math.sin(p),z2=y*Math.sin(p)+z1*Math.cos(p),k=1/(4.2+z2);return {x:this.w/2+x1*k*this.scale,y:this.h/2+y1*k*this.scale,z:z2};}
 stroke(points,color='#16485c',width=.7){const c=this.ctx;c.beginPath();points.forEach((p,i)=>{const q=this.project(p);if(i)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);});c.strokeStyle=color;c.lineWidth=width;c.stroke();}
 brain(){
  for(let lat=-7;lat<=7;lat++){
   const phi=lat*Math.PI/16,points=[];for(let i=0;i<=90;i++){const t=i*Math.PI*2/90,r=1+.055*Math.sin(9*t+phi*4);points.push([Math.cos(phi)*Math.cos(t)*r*1.35,Math.sin(phi)*1.1,Math.cos(phi)*Math.sin(t)*r]);}this.stroke(points,lat%2?'#154457':'#1c6779');
  }
  for(let j=0;j<20;j++){const t=j*Math.PI*2/20,points=[];for(let i=0;i<=45;i++){const p=-Math.PI/2+i*Math.PI/45,r=1+.06*Math.sin(p*10+t*5);points.push([Math.cos(p)*Math.cos(t)*r*1.35,Math.sin(p)*1.1,Math.cos(p)*Math.sin(t)*r]);}this.stroke(points,'#1e3853');}
 }
 octopus(){
  const c=this.ctx,parts=[];
  for(let arm=0;arm<8;arm++){const a=arm*Math.PI/4;
   for(let i=0;i<7;i++){const t=i/7,nt=(i+.87)/7,point=u=>{const r=.37+1.45*u+(this.exploded?i*.10:0);return [Math.cos(a)*r,.02+u*.65+Math.sin(u*Math.PI)*.38,Math.sin(a)*r+Math.sin(u*Math.PI)*.18];},p=point(t),q=point(nt),r=.11*(1-t)+.025;
    parts.push({p,q,r,arm,z:this.project(p).z});
   }
  }
  for(const part of parts.sort((a,b)=>b.z-a.z)){const {p,q,r,arm}=part,aa=this.project(p),bb=this.project(q),w=Math.max(2,this.scale*r/(4.2+aa.z)),angle=Math.atan2(bb.y-aa.y,bb.x-aa.x),nx=-Math.sin(angle)*w,ny=Math.cos(angle)*w;
   const g=c.createLinearGradient(aa.x+nx,aa.y+ny,aa.x-nx,aa.y-ny);g.addColorStop(0,'#34556c');g.addColorStop(.30,'#d7e2e9');g.addColorStop(.55,'#8fa6b8');g.addColorStop(1,'#19364d');c.fillStyle=g;c.beginPath();c.moveTo(aa.x+nx,aa.y+ny);c.lineTo(bb.x+nx*.8,bb.y+ny*.8);c.lineTo(bb.x-nx*.8,bb.y-ny*.8);c.lineTo(aa.x-nx,aa.y-ny);c.closePath();c.fill();
   c.strokeStyle='#c5ddeb66';c.lineWidth=.7;c.stroke();c.beginPath();c.arc(aa.x,aa.y,w*.85,0,Math.PI*2);c.fillStyle='#092235';c.fill();c.strokeStyle=arm%2?'#b675ed':'#00cad8';c.lineWidth=1.4;c.stroke();
  }
  const center=this.project([0,-.35,0]),radius=this.scale*.56/(4.2+center.z),body=c.createRadialGradient(center.x-radius*.35,center.y-radius*.4,radius*.08,center.x,center.y,radius);body.addColorStop(0,'#dbe7f0');body.addColorStop(.52,'#91a8bd');body.addColorStop(.86,'#34536d');body.addColorStop(1,'#112237');c.fillStyle=body;c.beginPath();c.arc(center.x,center.y,radius,0,Math.PI*2);c.fill();
  for(let lat=-3;lat<=3;lat++){const phi=lat*Math.PI/8,points=[];for(let i=0;i<=70;i++){const a=i*Math.PI*2/70;points.push([.563*Math.cos(phi)*Math.cos(a),-.35+.563*Math.sin(phi),.563*Math.cos(phi)*Math.sin(a)]);}this.stroke(points,'#0c223966',1);}
  const eye=this.project([.14,-.30,-.54]),er=radius*.27;c.beginPath();c.arc(eye.x,eye.y,er,0,Math.PI*2);c.fillStyle='#061623';c.fill();c.strokeStyle='#00ddff';c.lineWidth=3;c.stroke();c.beginPath();c.arc(eye.x,eye.y,er*.52,0,Math.PI*2);c.fillStyle='#00ddff55';c.fill();c.beginPath();c.arc(eye.x-er*.15,eye.y-er*.15,er*.2,0,Math.PI*2);c.fillStyle='#c6fbff';c.fill();
 }

 paint(){
  if(!this.ctx)return;const rect=this.canvas.getBoundingClientRect();this.w=rect.width||360;this.h=rect.height||390;const ratio=Math.min(devicePixelRatio||1,1.5),w=Math.round(this.w*ratio),h=Math.round(this.h*ratio);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}const c=this.ctx;c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,this.w,this.h);c.fillStyle='#050917';c.fillRect(0,0,this.w,this.h);this.scale=Math.min(this.w,this.h)*1.45;
  for(let x=0;x<this.w;x+=30){c.strokeStyle='#101d34';c.beginPath();c.moveTo(x,0);c.lineTo(x,this.h);c.stroke();}for(let y=0;y<this.h;y+=30){c.beginPath();c.moveTo(0,y);c.lineTo(this.w,y);c.stroke();}
  if(this.mode==='octopus')this.octopus();else this.brain();this.hit=[];
  const coordinates=this.nodes.map((node,i)=>{const angle=i*Math.PI*2/Math.max(1,this.nodes.length);return node.position||[Math.cos(angle)*(this.mode==='octopus'?1.75:1.3),this.mode==='octopus'?.8:Math.sin(angle)*.8,Math.sin(angle)*.9];});
  for(let i=1;i<coordinates.length;i++)this.stroke([coordinates[0],coordinates[i]],'#275a79',.8);
  this.nodes.forEach((node,i)=>{const q=this.project(coordinates[i]),color=LAB_COLORS[node.state]||LAB_COLORS.UNKNOWN;c.beginPath();c.arc(q.x,q.y,6,0,Math.PI*2);c.fillStyle=color;c.shadowColor=color;c.shadowBlur=12;c.fill();c.shadowBlur=0;c.font='10px ui-monospace, monospace';const label=node.label||node.id;c.fillStyle='#d5e7fc';c.fillText(label,Math.max(3,Math.min(this.w-label.length*6,q.x+9)),q.y-7);this.hit.push({...q,id:node.id});});
  c.font='10px ui-monospace,monospace';c.fillStyle='#7f96b3';c.fillText('ARRASTRAR · GIRAR / TOCAR · ABRIR MÓDULO',10,this.h-12);
  if(this.active&&this.auto&&!this.drag){this.yaw+=.004;if(this.raf)cancelAnimationFrame(this.raf);this.raf=requestAnimationFrame(()=>{this.raf=null;this.paint();});}
 }
 destroy(){this.resizeObserver.disconnect();if(this.raf)cancelAnimationFrame(this.raf);}
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
