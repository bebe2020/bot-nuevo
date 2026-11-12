import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// Browser import URLs are served at the site root; substitute only for this Node harness.
const code=(await readFile(new URL('../worker/analysis.js',import.meta.url),'utf8')).replace("from '/collector.js'","from '"+new URL('../worker/collector.js',import.meta.url).href+"'");
const {Analyzer}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
class WorkerHarness{postMessage(message){this.message=message;}terminate(){this.terminated=true;}reply(value){this.onmessage({data:{id:this.message.id,value}});}}
test('Cambio de selección cancela el cálculo anterior y no acepta su respuesta tardía',async()=>{
 const workers=[],analyzer=new Analyzer(()=>{const w=new WorkerHarness();workers.push(w);return w;});
 const a=analyzer.run({symbol:'BTCUSDT'}),cancelled=assert.rejects(a,/ANALISIS_CANCELADO/);analyzer.reset();await cancelled;
 const b=analyzer.run({symbol:'CPOOLUSDT'});workers[0].reply({symbol:'BTCUSDT'});workers[1].reply({symbol:'CPOOLUSDT'});
 assert.equal((await b).symbol,'CPOOLUSDT');assert.equal(workers[0].terminated,true);assert.equal(analyzer.pending.size,0);
});
test('Una excepción de cálculo se propaga y el siguiente trabajo puede completar',async()=>{
 const worker=new WorkerHarness(),analyzer=new Analyzer(()=>worker),a=analyzer.run({});
 worker.onmessage({data:{id:worker.message.id,error:'VELA_INVALIDA'}});await assert.rejects(a,/VELA_INVALIDA/);
 const b=analyzer.run({symbol:'ETHUSDT'});worker.reply({symbol:'ETHUSDT'});assert.equal((await b).symbol,'ETHUSDT');
});
