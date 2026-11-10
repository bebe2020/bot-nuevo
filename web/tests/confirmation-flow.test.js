import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateIdea} from '../worker/protocol.js';

const NOW=Date.UTC(2026,10,10,5,0,0);
const snapshot=()=>({
  symbol:'BTCUSDT',market:'PERP',venue:'BYBIT',received:NOW,currentPrice:100,
  structures:{
    '15m':{status:'OK',value:{regime:'LONG',asof:NOW}},
    '1H':{status:'OK',value:{regime:'LONG',asof:NOW}},
    '4H':{status:'OK',value:{regime:'LONG',asof:NOW}}
  },
  closed:{'15m':[]},book:{status:'UNKNOWN'},trades:{status:'UNKNOWN'}
});
const idea={id:'test-k2',horizon:'DIARIO',side:'LONG',family:'BARRIDO_RECLAIM',
  formed:NOW-60000,entry:100,stop:90,targets:[105,110,115],tick:.01};

test('K2 UNKNOWN: ni MODERADO ni AGRESIVO pueden etiquetar CONFIRMADA',()=>{
  const s=snapshot();
  for(const profile of ['MODERADO','AGRESIVO']){
    const e=evaluateIdea(s,idea,profile,NOW);
    assert.equal(e.keys.K1.state,'PASS');
    assert.equal(e.keys.K2.state,'UNKNOWN');
    assert.equal(e.keys.K3.state,'PASS');
    assert.notEqual(e.admission,'CONFIRMADA');
    assert.equal(e.kind,'ANTICIPADA');
    assert.equal(e.phase,'GATILLO_CERRADO');
  }
  assert.equal(evaluateIdea(s,idea,'MODERADO',NOW).admission,'CONDICIONAL');
  assert.equal(evaluateIdea(s,idea,'AGRESIVO',NOW).admission,'ANTICIPADA');
});

test('Libro vencido: se mantiene K2 UNKNOWN incluso con desequilibrio favorable',()=>{
  const s=snapshot();
  s.book={status:'OK',asof:NOW-10000,value:{imbalance:.9}};
  for(const profile of ['MODERADO','AGRESIVO']){
    const e=evaluateIdea(s,idea,profile,NOW);
    assert.equal(e.keys.K2.state,'UNKNOWN');
    assert.notEqual(e.admission,'CONFIRMADA');
  }
});

test('Libro fresco en contra: AGRESIVO conserva anticipación contraria, no disparo',()=>{
  const s=snapshot();
  s.book={status:'OK',asof:NOW,value:{imbalance:-.2}};
  assert.equal(evaluateIdea(s,idea,'AGRESIVO',NOW).admission,'ANTICIPADA_CON_FLUJO_CONTRARIO');
  assert.equal(evaluateIdea(s,idea,'MODERADO',NOW).admission,'CONDICIONAL');
});

test('K2 positivo: guardas permiten CONFIRMADA sin alterar geometría de la idea',()=>{
  const s=snapshot();
  s.book={status:'OK',asof:NOW,value:{imbalance:.2}};
  for(const profile of ['MODERADO','AGRESIVO']){
    const e=evaluateIdea(s,idea,profile,NOW);
    assert.equal(e.keys.K2.state,'PASS');
    assert.equal(e.admission,'CONFIRMADA');
    assert.equal(e.kind,'DISPARO_CANDIDATO');
  }
});
