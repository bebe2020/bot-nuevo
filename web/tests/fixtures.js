import {UNIVERSE,FRAMES} from '../worker/engine.js';
export class MemoryBucket {
 constructor(){this.objects=new Map();this.sequence=0;}
 async get(key){const x=this.objects.get(key);return x?{...x,json:async()=>JSON.parse(x.text)}:null;}
 async put(key,text,options={}){const old=this.objects.get(key),c=options.onlyIf;if(c?.etagDoesNotMatch==='*'&&old||c?.etagMatches&&old?.etag!==c.etagMatches)return null;const x={key,text,etag:String(++this.sequence),customMetadata:options.customMetadata||{}};this.objects.set(key,x);return {etag:x.etag};}
 async list({prefix='',limit=1000}={}){const values=[...this.objects.values()].filter(x=>x.key.startsWith(prefix)).sort((a,b)=>a.key.localeCompare(b.key));return {objects:values.slice(0,limit).map(({key,etag,customMetadata})=>({key,etag,customMetadata})),truncated:values.length>limit};}
}
export function candles(tf,now=Date.now(),count=100){
 const d=new Date(now),start=tf==='1Mutc'?Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-count,1):Math.floor(now/FRAMES[tf])*FRAMES[tf]-count*FRAMES[tf];
 return Array.from({length:count},(_,i)=>{const ts=tf==='1Mutc'?Date.UTC(new Date(start).getUTCFullYear(),new Date(start).getUTCMonth()+i,1):start+i*FRAMES[tf],p=100+Math.sin(i/3)*2+i*.01;return [ts,p,p+1,p-1,p+.3,10];});
}
export function fakeFetch(log=[]){return async url=>{
 const u=new URL(url);log.push(u.toString());const now=Date.now(),path=u.pathname.split('/').at(-1),symbol=u.searchParams.get('symbol')||'BTCUSDT';
 if(u.hostname==='fred.stlouisfed.org'){const id=u.searchParams.get('id'),date=new Date(now-3*86400000).toISOString().slice(0,10);return new Response('observation_date,'+id+'\n'+date+','+(id==='WALCL'?6000000:id==='WTREGEN'?800000:100));}
 const tick=s=>({symbol:s,lastPr:'103',change24h:'0.01',quoteVolume:'10000000',usdtVolume:'10000000',ts:String(now)});
 let data;if(path==='tickers')data=UNIVERSE.map(tick);else if(path==='ticker')data=[tick(symbol)];
 else if(path==='contracts'||path==='symbols')data=UNIVERSE.map(s=>({symbol:s,baseCoin:s.replace('USDT',''),quoteCoin:'USDT',status:'online',symbolStatus:'normal',minTradeNum:'0.001',sizeMultiplier:'0.001',minTradeUSDT:'5',pricePlace:'1',priceEndStep:'1',makerFeeRate:'0.0002',takerFeeRate:'0.0006'}));
 else if(path==='current-fund-rate')data=UNIVERSE.map(s=>({symbol:s,fundingRate:'0.0001',fundingRateInterval:'4',nextUpdate:String(now+3600000)}));
 else if(path==='candles'||path==='history-candles')data=candles(({'1min':'1m','5min':'5m','15min':'15m','30min':'30m','1h':'1H','4h':'4H','6h':'6H','12h':'12H'})[u.searchParams.get('granularity')]||u.searchParams.get('granularity'),now,Number(u.searchParams.get('limit')||100));
 else if(path==='merge-depth'||path==='orderbook')data={ts:String(now),bids:Array.from({length:20},(_,i)=>[102.9-i*.1,2]),asks:Array.from({length:20},(_,i)=>[103.1+i*.1,1])};
 else if(path==='fills')data=[{tradeId:'a',price:'103',size:'2',side:'buy',ts:String(now-1000)},{tradeId:'b',price:'103',size:'1',side:'sell',ts:String(now-500)}];
 else if(path==='open-interest')data={openInterestList:[{symbol,size:'1000'}],ts:String(now)};
 else return new Response('not found',{status:404});
 return Response.json({code:'00000',requestTime:now,data});
};}
