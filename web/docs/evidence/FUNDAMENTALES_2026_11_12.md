# Fundamentos públicos · 12/11/2026

Proyecto personal bebe2020/bot-nuevo. Continúa desde main 59fad581d5a5249017cb3237122507a5005ac11e y Site v14. No modifica el comercial.

## Publicación

- Sitio: https://bot-nuevo-liquidez.stablepiece.chatgpt.site
- Versión 15; fuente Sites f6318e05d9f4c8f0cf29e56f000b4c11791f70f6.
- Despliegue appgdep_6af5769e55e08191a17a3377bacef02c: succeeded.
- Huella de fuentes activas ccea2a5dbd002b6c298b6af2e9531fe994d1a712dabfcdbffa3178cdcefa8c0c, idéntica en la copia preparada para GitHub y el paquete Sites.

## Cambios implementados

- Nuevo panel Fundamentales 54: capitalización, FDV, circulante/total/máximo, proporción circulante, FDV/capitalización, TVL, fees e ingresos 24h/7d, volumen DEX y volumen del activo en Hyperliquid PERP/USDC.
- 54 identidades y 14 campos por activo, incluso cuando faltan fuentes. No se suman versiones de protocolos ni se resuelven homónimos por volumen. Las fees y el TVL muestran la versión de protocolo correspondiente; pueden ser versiones diferentes.
- Bitcoin y otras redes admiten sus fees nativas identificadas como red. No son ganancias de tenedores.
- Datos CoinGecko globales: capitalización, dominancia BTC/ETH, volumen y miedo/codicia. Capitalización sin BTC y sin BTC/ETH son cálculos de ese agregado; no los índices oficiales TOTAL2/TOTAL3 de TradingView.
- K4 muestra cobertura y datos fundamentales; conserva UNKNOWN como confluencia direccional mientras faltan unlocks, emisión, usuarios y catalizadores. Tener 14 campos observados no certifica infravaloración.
- Los informes DeFi sin fecha propia se muestran PARTIAL con recepción y limitación temporal. No se les asigna una fecha de cierre inventada.
- Estado, fecha de fuente y recepción sobreviven al caché y a fallos. Cero reportado se conserva como cero; null permanece desconocido.
- Captura programada publica fundamentals.json; el sitio puede consultar ese espejo fechado. El capturador vuelve a fuentes primarias y no republica indefinidamente su propio espejo.
- Endpoint de derivados de DeFiLlama respondió HTTP402 y fue retirado de las peticiones automáticas. El campo de volumen perpetuo utiliza Hyperliquid público e indica su sede/mercado. No se compró un plan ni se agregó una fuente paga.

## Evidencia

- Captura real: 54/54 activos con observaciones; 544/756 campos observados, 366 con fecha propia y 178 reportes sin fecha propia. 212 campos siguen ausentes en esa captura.
- Ejemplos de cobertura: BTC12/14, AAVE13/14, HYPE14/14, CPOOL12/14, KAIO12/14 y RIF6/14. Cobertura de datos no es una señal ni una probabilidad.
- 170/170 pruebas Node aprobadas, build y Worker ESM válidos. Casos: identidad padre/hijo, homónimos, unidades de dominancia, reportes sin fecha, datos futuros/vencidos, caída de proveedores, espejo, fuente primaria y separación Hyperliquid/Bitget.
- Navegador: 54 filas, búsqueda HYPE, detalle KAIO/HYPE con 14 tarjetas; contenedor móvil360px sin overflow horizontal del documento. Validación Chrome remoto, no Samsung físico.
- La versión conserva el protocolo2.2 y los IDs de las tesis previas. Cuenta NO_VERIFICADA, órdenes reales deshabilitadas.

## Pendientes

SoSoValue autenticado; liquidez global multimoneda; unlocks/emisión/usuarios/catalizadores; flujo L2 continuo y liquidaciones observadas; entradas trimestrales/ciclo completas; validación fuera de muestra y costos; ejecución real reconciliada. La cadencia objetivo de GitHub no equivale a un SLA24/7. PAPER necesita el panel abierto para observar ticks.
