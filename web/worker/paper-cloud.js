import {UNIVERSE} from './engine.js';

const PAPER_KEY='paper/book-v1.json';
const states=['SIM_PENDIENTE','SIM_ABIERTA','SIM_CERRADA','SIM_CANCELADA'];
const immutable=p=>JSON.stringify([p.id,p.sourceId,p.symbol,p.market,p.side,p.entry,p.stop,p.targets,p.quantity,p.fee,p.armedAt]);

export function validatePaperRecords(records) {
  if(!Array.isArray(records)||records.length>500) throw Error('PAPER_LIBRO_INVALIDO');
  const ids=new Set(),sources=new Set();
  for(const p of records) {
    const sign=p.side==='LONG'?1:p.side==='SHORT'?-1:0;
    if(!/^[a-z0-9-]{8,80}$/i.test(p.id)||typeof p.sourceId!=='string'||p.sourceId.length>1500||ids.has(p.id)||sources.has(p.sourceId)||!UNIVERSE.includes(p.symbol)||!['SPOT','PERP'].includes(p.market)||!sign||p.market==='SPOT'&&p.side==='SHORT'||!states.includes(p.state)) throw Error('PAPER_IDENTIDAD_INVALIDA');
    if(![p.entry,p.stop,p.quantity,p.armedAt].every(v=>Number.isFinite(v)&&v>0)||sign*(p.entry-p.stop)<=0||!Array.isArray(p.targets)||p.targets.length!==3||!p.targets.every((v,i)=>Number.isFinite(v)&&v>0&&sign*(v-p.entry)>0&&(!i||sign*(v-p.targets[i-1])>0))||!Number.isFinite(p.fee)||p.fee<0||p.fee>1||!Number.isFinite(p.net)||!Number.isFinite(p.remaining)||p.remaining<0||p.remaining>p.quantity||!Number.isInteger(p.targetIndex)||p.targetIndex<0||p.targetIndex>3||!Array.isArray(p.events)||p.events.length>20) throw Error('PAPER_GEOMETRIA_INVALIDA');
    if(p.events.some((e,i)=>!Number.isFinite(e.at)||e.at<p.armedAt||i&&e.at<p.events[i-1].at||typeof e.type!=='string'||e.type.length>100||!Number.isFinite(e.price)||e.price<=0)) throw Error('PAPER_EVENTO_INVALIDO');
    ids.add(p.id);sources.add(p.sourceId);
  }
  return records;
}

export function mergePaperRecords(local,remote) {
  const merged=new Map(remote.map(p=>[p.sourceId,p]));
  for(const p of local) {
    const old=merged.get(p.sourceId);
    if(!old){merged.set(p.sourceId,p);continue;}
    if(immutable(old)!==immutable(p)) throw Error('PAPER_CONFLICTO_DE_GEOMETRIA');
    const shorter=p.events.length<=old.events.length?p:old,longer=shorter===p?old:p;
    if(shorter.events.some((e,i)=>JSON.stringify(e)!==JSON.stringify(longer.events[i]))) throw Error('PAPER_CONFLICTO_DE_EVENTOS');
    // Terminal state and its event history always win over a delayed device.
    merged.set(p.sourceId,longer.events.length>shorter.events.length?longer:(old.lastAsOf||0)>(p.lastAsOf||0)?old:p);
  }
  return [...merged.values()].sort((a,b)=>b.armedAt-a.armedAt);
}

export async function readPaper(bucket) {
  if(!bucket) throw Error('ALMACENAMIENTO_NO_CONECTADO');
  const file=await bucket.get(PAPER_KEY);
  return file?await file.json():{version:0,records:[],account:'NO_VERIFICADA',mode:'PAPER'};
}

export async function savePaper(bucket,payload) {
  if(!bucket) throw Error('ALMACENAMIENTO_NO_CONECTADO');
  validatePaperRecords(payload.records);
  const file=await bucket.get(PAPER_KEY),old=file?await file.json():{version:0,records:[]};
  if(payload.baseVersion!==old.version) return {conflict:true,book:old};
  const records=mergePaperRecords(payload.records,old.records);
  const next={version:old.version+1,records,updatedAt:Date.now(),account:'NO_VERIFICADA',mode:'PAPER',method:'TICKS_OBSERVADOS_CON_NAVEGADOR_ABIERTO; HUECOS_NO_RECONSTRUIDOS'};
  const written=await bucket.put(PAPER_KEY,JSON.stringify(next),{onlyIf:file?{etagMatches:file.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
  return written?{conflict:false,book:next}:{conflict:true,book:await readPaper(bucket)};
}
