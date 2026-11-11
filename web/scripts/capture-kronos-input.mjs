import {catalog,supported,frameData,mapLimit} from '../worker/collector.js';
import {UNIVERSE as SYMBOLS,closed} from '../worker/engine.js';
import {writeFile} from 'node:fs/promises';
const out=process.argv[2];if(!out)throw Error('Especificar archivo de salida');
const [perp,spot]=await Promise.all([catalog('PERP'),catalog('SPOT')]);
const now=Date.now();
const items=await mapLimit(SYMBOLS,4,async symbol=>{
 const market=supported(perp.data.find(x=>x.symbol===symbol),'PERP')?'PERP':supported(spot.data.find(x=>x.symbol===symbol),'SPOT')?'SPOT':null;
 if(!market)return {symbol,state:'SIN_INSTRUMENTO'};
 try{const f=await frameData(symbol,'15m',fetch,market),bars=closed(f.data,'15m',Date.now()).slice(-128);return {symbol,market,venue:'BITGET',tf:'15m',bars,received:f.received};}
 catch(e){return {symbol,market,state:'ERROR',error:e.message};}
});
await writeFile(out,JSON.stringify({source:'BITGET_PUBLICO',started:now,received:Date.now(),items}));
console.log(JSON.stringify({items:items.length,valid:items.filter(x=>x.bars?.length>=96).length,out}));
