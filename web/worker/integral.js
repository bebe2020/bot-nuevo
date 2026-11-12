import {capitalRegime} from './macro.js';

// Independent of technical entry admission: missing fundamentals are not a veto
// and technical confirmation must not be labelled integral confirmation.
export function integralConfluence({idea=null,evaluation=null,cross=null,providers=null,macro=null,symbol},now=Date.now()) {
  const regime=capitalRegime(cross,now),side=idea?.side;
  const direction=regime.state==='RIESGO_FAVORABLE'?'LONG':regime.state==='RIESGO_DEFENSIVO'?'SHORT':null;
  const asset=providers?.defi?.assets?.find(x=>x.symbol===symbol);
  const marketFresh=asset?.marketAsOf<=now&&now-asset.marketAsOf<86400000;
  const tvlFresh=['OK','PARTIAL'].includes(providers?.defi?.status)&&providers.defi.received<=now&&now-providers.defi.received<900000;
  const technical=evaluation?.keys||{};
  const keys={
    K1:{label:'Macro Océano',state:side&&direction?(side===direction?'PASS':'CONFLICT'):'UNKNOWN',reason:regime.state.replaceAll('_',' '),coverage:macro?.coverage??null},
    K2:{label:'Estructura',state:technical.K1?.state||'UNKNOWN',reason:technical.K1?.reason||'Esperar estructura fechada del horizonte.'},
    K3:{label:'Flujo',state:technical.K2?.state||'UNKNOWN',reason:technical.K2?.reason||'Falta flujo direccional vigente.'},
    K4:{label:'Fundamentales',state:'UNKNOWN',reason:'Faltan tokenomics/unlocks, actividad y catalizadores completos.',
      observations:{marketCap:marketFresh?asset?.marketCap??null:null,fdv:marketFresh?asset?.fdv??null:null,tvl:tvlFresh?asset?.principalTVL??null:null,marketAsOf:marketFresh?asset?.marketAsOf:null,tvlAsOf:tvlFresh?providers.defi.received:null},
      missing:['UNLOCKS_FECHADOS','EMISION_Y_QUEMAS','USUARIOS_Y_FEES','CATALIZADORES_VERIFICADOS']}
  };
  return {keys,regime,technicalAdmission:evaluation?.admission??'SIN_TESIS',state:'CONFLUENCIA_PARCIAL',
    note:'La confirmación técnica no certifica confluencia fundamental ni rentabilidad.',evaluatedAt:now};
}
