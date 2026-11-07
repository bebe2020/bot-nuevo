// Transporte público: un mensaje recibido no confirma una operación ni un setup.
export const LIVE_VERSION='live-1.0';
export const BITGET_WS='wss://ws.bitget.com/v2/ws/public';
const liveNumber=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
export function tickerMessage(text,symbols,received=Date.now()){
 if(text==='pong')return {kind:'PONG'};
 let m;try{m=JSON.parse(text);}catch{return null;}
 if(m.event==='error')return {kind:'ERROR',message:String(m.msg||m.code||'SUSCRIPCION_RECHAZADA').slice(0,140)};
 if(m.event)return {kind:'ACK'};
 const a=m.arg||{},symbol=a.instId??a.symbol;
 if(String(a.instType).toUpperCase()!=='USDT-FUTURES'||(a.channel??a.topic)!=='ticker'||!symbols.includes(symbol)||!Array.isArray(m.data))return null;
 const r=m.data[0]||{},price=liveNumber(r.lastPr??r.lastPrice),ts=liveNumber(r.ts??m.ts);
 if(price===null||price<=0||ts===null||!Number.isInteger(ts)||ts<0||ts>received+5000)return null;
 return {kind:'QUOTE',symbol,price,ts,received,source:'WS',bid:liveNumber(r.bidPr??r.bid1Price),ask:liveNumber(r.askPr??r.ask1Price),change:liveNumber(r.change24h??r.price24hPcnt),fundingRate:liveNumber(r.fundingRate),nextFunding:liveNumber(r.nextFundingTime)};
}
export function quoteState(quote,now=Date.now()){
 if(!quote)return 'ESPERANDO_DATOS';
 if(now-quote.received>5000||now-quote.ts>5000||quote.ts>now+5000)return 'DATOS_VENCIDOS';
 return quote.source==='WS'?'EN_VIVO':'REST_3S';
}
export class LiveFeed {
 constructor({symbols,socketFactory=url=>new WebSocket(url),now=Date.now,setIntervalFn=setInterval,clearIntervalFn=clearInterval,setTimeoutFn=setTimeout,clearTimeoutFn=clearTimeout,onQuote=()=>{},onState=()=>{}}){
  Object.assign(this,{symbols,socketFactory,now,setIntervalFn,clearIntervalFn,setTimeoutFn,clearTimeoutFn,onQuote,onState});this.quotes=new Map();this.messages=0;this.priceChanges=0;this.generation=0;this.attempt=0;this.stopped=true;this.state='DESCONECTADO';
 }
 notify(state,detail=''){this.state=state;this.onState({state,detail,at:this.now(),messages:this.messages});}
 start(){if(!this.stopped)return;this.stopped=false;this.connect();}
 connect(){
  if(this.stopped)return;const generation=++this.generation;this.notify(this.attempt?'RECONECTANDO':'CONECTANDO');
  let socket;try{socket=this.socketFactory(BITGET_WS);}catch(e){this.notify('SIN_CONEXION',String(e.message));this.retry();return;}this.socket=socket;this.lastFrame=this.now();
  socket.onopen=()=>{if(this.stopped||generation!==this.generation)return;this.lastFrame=this.now();this.notify('CONECTADO_ESPERANDO_PRECIOS');socket.send(JSON.stringify({op:'subscribe',args:this.symbols.map(instId=>({instType:'USDT-FUTURES',channel:'ticker',instId}))}));this.pingTimer=this.setIntervalFn(()=>{if(this.stopped||generation!==this.generation)return;if(this.now()-this.lastFrame>65000){socket.close();return;}if(socket.readyState===1)socket.send('ping');},25000);};
  socket.onmessage=e=>{if(this.stopped||generation!==this.generation)return;this.lastFrame=this.now();const q=tickerMessage(e.data,this.symbols,this.now());if(!q)return;if(q.kind==='ERROR'){this.notify('ERROR_SUSCRIPCION',q.message);this.stopped=true;this.clearTimers();socket.close();return;}if(q.kind!=='QUOTE')return;const old=this.quotes.get(q.symbol);if(old&&q.ts<old.ts)return;if(old&&q.ts===old.ts&&q.price===old.price)return;this.quotes.set(q.symbol,q);this.messages++;if(old&&q.price!==old.price)this.priceChanges++;this.attempt=0;this.notify('RECIBIENDO');this.onQuote(q,{messages:this.messages,priceChanges:this.priceChanges});};
  socket.onerror=()=>{if(!this.stopped&&generation===this.generation)this.notify('ERROR_CONEXION');};
  socket.onclose=()=>{if(this.stopped||generation!==this.generation)return;this.clearTimers();this.notify('DESCONECTADO');this.retry();};
 }
 retry(){if(this.stopped)return;const delay=Math.min(30000,1000*2**Math.min(this.attempt++,5));this.retryTimer=this.setTimeoutFn(()=>{this.retryTimer=null;this.connect();},delay);}
 clearTimers(){if(this.pingTimer!==null&&this.pingTimer!==undefined)this.clearIntervalFn(this.pingTimer);if(this.retryTimer!==null&&this.retryTimer!==undefined)this.clearTimeoutFn(this.retryTimer);this.pingTimer=null;this.retryTimer=null;}
 stop(){this.stopped=true;this.generation++;this.clearTimers();const s=this.socket;this.socket=null;if(s)s.close();this.notify('PAUSADO');}
 restart(){this.stop();this.start();}
}
