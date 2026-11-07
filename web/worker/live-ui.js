import {LiveFeed,quoteState,tickerMessage} from './live.js';
export function attachLive({symbols,getSelected,getSnapshot,format,date,quotePoll,onWake=()=>{},onPaint=()=>{}}){
 const byId=id=>document.getElementById(id),quotes=new Map(),trails=new Map(),invalidated=new Set();let active=true,received=0,wsMessages=0,changes=0,polling=false,connection='CONECTANDO',lastRestError='';
 function accept(q){if(!active)return;const old=quotes.get(q.symbol);if(old&&q.ts<old.ts)return;if(old&&q.ts===old.ts&&q.price===old.price)return;q.direction=old?Math.sign(q.price-old.price):0;quotes.set(q.symbol,q);received++;if(q.source==='WS')wsMessages++;if(old&&old.price!==q.price)changes++;const trail=trails.get(q.symbol)||[];if(trail.length&&Math.floor(trail.at(-1).ts/1000)===Math.floor(q.ts/1000))trail[trail.length-1]=q;else trail.push(q);trails.set(q.symbol,trail.slice(-120));}
 const feed=new LiveFeed({symbols,onQuote:accept,onState:s=>{connection=s.state;paint();}});
 async function fallback(){if(!active||polling||quoteState(quotes.get(getSelected()))==='EN_VIVO')return;polling=true;try{const result=await quotePoll();if(!active)return;for(const row of result){const symbol=row.symbol??row.instId;if(!symbols.includes(symbol))continue;const q=tickerMessage(JSON.stringify({arg:{instType:'USDT-FUTURES',channel:'ticker',instId:symbol},data:[row]}),symbols,Date.now());if(q?.kind==='QUOTE')accept({...q,source:'REST'});}lastRestError='';}catch(e){lastRestError=String(e.message).slice(0,120);}finally{polling=false;paint();}}
 function paint(){
  const symbol=getSelected(),q=quotes.get(symbol),state=active?quoteState(q):'PAUSADO';
  byId('liveStatus').textContent=state==='EN_VIVO'?'● EN VIVO · WebSocket':state==='REST_3S'?'● ACTUALIZACIÓN REST · 3 s':state==='PAUSADO'?'PAUSADO':state==='DATOS_VENCIDOS'?'SIN DATOS RECIENTES · reconectando':'CONECTANDO · esperando precio';
  byId('liveStatus').className='pill '+(['EN_VIVO','REST_3S'].includes(state)?'good':'warn');byId('liveStatus').dataset.state=state;
  byId('liveSymbol').textContent=symbol;byId('livePrice').textContent=q?format(q.price):'N/D';byId('livePrice').className='live-price '+(q?.direction>0?'good':q?.direction<0?'bad':'');
  byId('liveTime').textContent=q?'Exchange '+date(q.ts)+' · recibido hace '+Math.max(0,Math.floor((Date.now()-q.received)/1000))+' s':'Sin precio recibido todavía';
  byId('liveCount').textContent=received+' actualizaciones válidas · '+wsMessages+' WS · '+changes+' cambios de precio';byId('liveCount').dataset.messages=String(received);byId('liveCount').dataset.wsMessages=String(wsMessages);byId('liveCount').dataset.changes=String(changes);
  byId('liveConnection').textContent=active?connection+(lastRestError?' · REST: '+lastRestError:''):'Conexión pausada';
  byId('liveSpread').textContent=q?.bid>0&&q?.ask>=q?.bid?'Bid '+format(q.bid)+' · Ask '+format(q.ask)+' · spread '+format((q.ask/q.bid-1)*100,5)+' %':'Esperando bid / ask';
  const trail=trails.get(symbol)||[],svg=byId('liveTrace');if(trail.length>1){const lo=Math.min(...trail.map(x=>x.price)),hi=Math.max(...trail.map(x=>x.price)),dt=trail.at(-1).ts-trail[0].ts||1,range=hi-lo||1;svg.setAttribute('viewBox','0 0 720 90');svg.innerHTML='<polyline fill="none" stroke="#57e2bd" stroke-width="2" vector-effect="non-scaling-stroke" points="'+trail.map(x=>((x.ts-trail[0].ts)/dt*710+5)+','+(hi===lo?45:80-(x.price-lo)/range*70)).join(' ')+'"/>';}
  for(const card of document.querySelectorAll('.coin[data-symbol]')){const x=quotes.get(card.dataset.symbol);if(!x)continue;const price=card.querySelector('.price');price.textContent=format(x.price);price.classList.toggle('good',x.direction>0);price.classList.toggle('bad',x.direction<0);let stamp=card.querySelector('.live-quote-stamp');if(!stamp){stamp=document.createElement('small');stamp.className='live-quote-stamp';card.append(stamp);}stamp.textContent=(active?quoteState(x):'PAUSADO')+' · '+new Date(x.ts).toLocaleTimeString('es-AR');}
  const snap=getSnapshot();if(snap?.plans&&q){for(const el of document.querySelectorAll('.idea-live-validity')){const plan=(snap.plans[el.dataset.horizon]||[]).find(x=>x.id===el.dataset.plan);if(!plan)continue;const invalid=(plan.side==='LONG'?q.price<=plan.stop:q.price>=plan.stop);if(invalid)invalidated.add(plan.id);el.dataset.invalidated=invalidated.has(plan.id)?'1':'0';el.textContent=el.dataset.invalidated==='1'?'INVALIDADA POR PRECIO OBSERVADO':'Verificación con último precio: '+state;el.className='idea-live-validity '+(el.dataset.invalidated==='1'?'bad':'muted');}}
  if(q)onPaint(q);
 }
 const paintTimer=setInterval(paint,1000),pollTimer=setInterval(fallback,3000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&active){if(quoteState(quotes.get(getSelected()))!=='EN_VIVO')feed.restart();fallback();onWake();}});
 window.addEventListener('online',()=>{if(active){feed.restart();fallback();onWake();}});
 byId('reconnectLive').onclick=()=>{if(!active){byId('pause').click();return;}feed.restart();fallback();onWake();};
 feed.start();fallback();paint();
 return {getQuote:s=>quotes.get(s),getMetrics:()=>({received,wsMessages,changes,connection}),paint,start(){active=true;feed.start();fallback();paint();},stop(){active=false;feed.stop();paint();},dispose(){active=false;feed.stop();clearInterval(paintTimer);clearInterval(pollTimer);}};
}
