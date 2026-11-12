import {ageFundamentals} from './fundamental-facts.js';
import {capitalRegime} from './macro.js';

// Independent of technical entry admission: missing fundamentals are not a veto
// and technical confirmation must not be labelled integral confirmation.
export function integralConfluence({idea=null,evaluation=null,cross=null,providers=null,macro=null,fundamentals=null,symbol},now=Date.now()) {
  const regime=capitalRegime(cross,now),side=idea?.side;
  const direction=regime.state==='RIESGO_FAVORABLE'?'LONG':regime.state==='RIESGO_DEFENSIVO'?'SHORT':null;
  const asset=providers?.defi?.assets?.find(x=>x.symbol===symbol);
  const marketFresh=asset?.marketAsOf<=now&&now-asset.marketAsOf<86400000;
  const tvlFresh=['OK','PARTIAL'].includes(providers?.defi?.status)&&providers.defi.received<=now&&now-providers.defi.received<900000;
  const fundamentalAsset=ageFundamentals(fundamentals,now).assets.find(x=>x.symbol===symbol);
  const f=id=>fundamentalAsset?.facts.find(x=>x.id===id),fv=id=>['OK','PARTIAL'].includes(f(id)?.state)?f(id).value:null;
  const technical=evaluation?.keys||{};
  const keys={
    K1:{label:'Macro Océano',state:side&&direction?(side===direction?'PASS':'CONFLICT'):'UNKNOWN',reason:regime.state.replaceAll('_',' '),coverage:macro?.coverage??null},
    K2:{label:'Estructura',state:technical.K1?.state||'UNKNOWN',reason:technical.K1?.reason||'Esperar estructura fechada del horizonte.'},
    K3:{label:'Flujo',state:technical.K2?.state||'UNKNOWN',reason:technical.K2?.reason||'Falta flujo direccional vigente.'},
    K4:{label:'Fundamentales',state:'UNKNOWN',reason:(fundamentalAsset?.coverage.observed||0)+' / 14 métricas observadas. Faltan unlocks, emisión, usuarios y catalizadores completos.',coverage:fundamentalAsset?.coverage,facts:fundamentalAsset?.facts||[],
      observations:{marketCap:fundamentals?fv('MARKET_CAP'):marketFresh?asset?.marketCap??null:null,fdv:fundamentals?fv('FDV'):marketFresh?asset?.fdv??null:null,tvl:fundamentals?fv('TVL'):tvlFresh?asset?.principalTVL??null:null,marketAsOf:fundamentals?f('MARKET_CAP')?.asof:marketFresh?asset?.marketAsOf:null,tvlReceived:fundamentals?f('TVL')?.received:tvlFresh?providers.defi.received:null},
      missing:['UNLOCKS_FECHADOS','EMISION_Y_QUEMAS','USUARIOS_ACTIVOS','CATALIZADORES_VERIFICADOS']}
  };
  return {keys,regime,technicalAdmission:evaluation?.admission??'SIN_TESIS',state:'CONFLUENCIA_PARCIAL',
    note:'La confirmación técnica no certifica confluencia fundamental ni rentabilidad.',evaluatedAt:now};
}
