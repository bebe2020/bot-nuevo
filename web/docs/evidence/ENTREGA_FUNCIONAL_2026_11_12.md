# Entrega funcional personal · 12/11/2026

Proyecto exclusivo: bebe2020/bot-nuevo. El comercial SNIPER/Océano no se modificó.

## Publicación y fuente

- Sitio privado: https://bot-nuevo-liquidez.stablepiece.chatgpt.site
- Versión 14. Fuente Sites: e53f57acc29ae6b046eab084429dbd0aa00c4517.
- Despliegue appgdep_6af56e4ce2f08191b4b424117971039c: succeeded.
- Huella del código compilado: 273884f2327eea4d96a88632abab276f8964a952970ea354ca29bc65893ce0dd.
- Protocolo 2.2; IDs geométricos conservan el namespace anterior para no rearmar eventos.

## Implementado y verificado localmente

1. MICRO_PIVOTE solo PERP: productor, evaluación de fichas antiguas, selector y PAPER rechazan SPOT.
2. EXPLOSION SPOT: evento cerrado, RVOL >=2 y CMF positivo; no admite una caída aislada como señal. ACUMULACION SPOT exige el proxy diario y una geometría de su horizonte. Ambas son reglas explícitas sin calibración estadística.
3. Veinte series macro FRED, con unidad, frecuencia, fecha, variación entre observaciones y cálculo interanual mensual cuando hay historia. Consulta real: 19 vigentes, una vencida. El parser ya no descarta NFCI o curvas negativas.
4. Proxy USD con WALCL y TGA de miércoles WDTGAL, más RRP de la misma fecha, con conversión de millones a miles de millones. No se presenta como liquidez mundial.
5. Referencias ampliadas a Nasdaq Composite/100, EUR/USD, WTI y Brent; precios, rendimientos y fechas separados. Régimen descriptivo de acciones/dólar a 20 sesiones, sin afirmación de flujo causal.
6. Confluencia K1 macro, K2 estructura, K3 flujo, K4 fundamentos. Se conserva el detalle técnico de admisión; confirmación técnica no significa fundamentos completos. Los campos sin fuente siguen UNKNOWN.
7. Acumulación/distribución por 15m, 4H y diario. Cobertura y cierre de cada diagnóstico visibles; sigue siendo proxy OHLCV, sin identidad institucional.
8. Libro PAPER único en protocolo, laboratorio y diario, con persistencia R2 y copia local. Revisión optimista, protección por origen, reconciliación de eventos y conflictos explícitos entre dispositivos. No se reconstruyen fills de períodos sin observación.
9. Kronos-mini real ejecutado para 54 activos: 54 válidos, CPU, 42,98 segundos, generado 12/11/2026 04:25:48 Argentina. No es backtest ni probabilidad calibrada.
10. Interfaz con colores más vivos y panorama macro antes del activo. Chrome remoto: prueba en contenedor de 360px, sin overflow horizontal del documento, selector SPOT cambia micro a explosión y muestra 20 tarjetas macro.

## Comprobaciones

- 153/153 pruebas Node aprobadas, sin fallos ni omitidas.
- Build y validación del Worker ESM aprobados.
- API del paquete: health 200/protocolo2.2, macro 200/19 de20 vigentes, PAPER 200/libro vacío de prueba.
- Concurrencia de dos POST PAPER: uno 200 y otro 409; no hay sobreescritura silenciosa.
- Replay PAPER preserva un cierre frente a una copia anterior y rechaza eventos divergentes.
- Inferencia Kronos validada con el contrato de identidad, relojes, horizonte y 54 resultados.
- Validación visual en Chrome remoto; no equivale a prueba física en Samsung.

## Datos programados

El workflow público conserva el objetivo de cinco minutos para mercado y una hora para Kronos. Se añade publicación de macro.json con la captura y lectura de respaldo desde el sitio, manteniendo las fechas originales. El tiempo máximo de captura pasa a seis minutos por las nuevas series.

La continuidad 24/7 no queda certificada: GitHub puede demorar ejecuciones. El panel muestra edad/retraso de captura y edad del recálculo Kronos por separado de la vigencia de la proyección. PAPER sigue ticks con el navegador abierto; no es ejecución de exchange ni servicio desatendido de fills.

## Pendientes reales

- SoSoValue autenticado (no hay clave configurada); no se confunde con las 20 series FRED.
- Liquidez global multibanco/M2 con monedas y fechas comparables.
- Tokenomics/unlocks, usuarios, fees y catalizadores completos para los 54 activos.
- L2/OFI/CVD continuo, liquidaciones observadas y cobertura on-chain completa.
- Trimestre/ciclo siguen como radares estructurales, no entradas tácticas completas.
- Evaluación fuera de muestra de reglas y Kronos, calibración de costos y rentabilidad.
- Ejecución real, posiciones privadas y reconciliación de cuenta no implementadas en este alcance.
- PR antiguas #3/#4/#6 requieren comparación de diferencias; no se fusionaron a ciegas.

No se leyeron cuentas privadas de exchanges ni se enviaron órdenes.

## Corrección tras observar producción

FRED respondió de forma distinta desde Worker: se observó menor cobertura directa en la primera publicación. La implementación activa ahora prefiere el espejo público reciente y validado del colector cuando está disponible, conservando asof y received de cada observación. El colector programado consulta FRED directamente para evitar un bucle de republicación del espejo. La captura automática y su CI del commit 0034e763 terminaron con success.

Se eliminó del repositorio de publicación el starter worker/index.js que no participaba en la aplicación. La huella calculada desde las fuentes activas de GitHub y Sites coincide: 273884f2327eea4d96a88632abab276f8964a952970ea354ca29bc65893ce0dd. Producción tras corregir el transporte: health y macro HTTP200, protocolo2.2 y cobertura19/20; Kronos HTTP200,54/54,ON_TIME en la comprobación. La ausencia de una serie se mantiene visible.
