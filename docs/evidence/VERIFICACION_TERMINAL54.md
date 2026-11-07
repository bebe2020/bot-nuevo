# Verificación de Terminal 54

Fecha: 2026-11-07. Proyecto: [bebe2020/bot-nuevo](https://github.com/bebe2020/bot-nuevo).

Aplicación: https://bot-nuevo-liquidez.stablepiece.chatgpt.site/ (acceso privado conservado).

## Publicación comprobada

- Código GitHub: e21c551a261262889cad878645fa3037ead54db1.
- Fuente Sites: 4ce16e05d784de8f9dd3edad5d2a5bdf29d2dd31.
- Despliegue Sites: appgdep_6aeef93589c08191a0c0625bbd53e0df, succeeded.
- [Captura de mercado en GitHub Actions](https://github.com/bebe2020/bot-nuevo/actions/runs/42362840252): success.
- API de producción: health, cloud, snapshot, history y módulos JavaScript respondieron HTTP 200.
- Versión terminal-2.0; protocolo-2.0; universo 54; almacenamiento activo; órdenes false.
- Datos observados: sourceAsOf 2026-11-07T10:11:27.104Z, receivedAt 2026-11-07T10:11:27.156Z.
- Snapshot PERP: 54 filas, 51 contratos activos, cuatro radares; las 14 temporalidades focales de BTC devolvieron OK, incluida 1Wutc.
- Historial observado: 120 filas, 106 procedentes del colector público de GitHub.
- La captura anterior había recibido un HTTP 429 en semanal. El transporte ahora limita su frecuencia y permite un único reintento acotado; esta nueva lectura semanal fue válida.
- Cron configurado con objetivo de cinco minutos. Las ejecuciones observadas de esta verificación fueron por push; no se garantiza puntualidad de GitHub Actions. La aplicación marca datos vencidos y usa cotización pública WS/REST mientras está abierta.

## Verificación local y visual

- 66 pruebas Node: 66 pasaron, cero fallos; compilación Worker ESM válida.
- Navegador de escritorio: 54 tarjetas y 54 filas; filtros de descuento y sector; cuatro radares y 29 sectores activos en la muestra.
- Gráfico con 499 velas, siete series EMA/RSI/volumen y seis referencias Fibonacci; se comprobaron toggles y cambio 15m/4H.
- SPOT/PERP y cuatro perfiles comprobados. No se mezclan sus velas ni se crea un SHORT SPOT.
- Vista móvil simulada: ancho de contenido 345 px y scrollWidth 345 px, sin desborde horizontal. No constituye prueba física en Android.
- Calculadora y guardado manual probados con valores sintéticos únicamente en preview local. No se escribieron planes de prueba en producción.
- [Evidencia visual de escritorio](terminal54-chart.jpg): captura de la aplicación en preview con datos públicos reales, no resultado de una operación.

## Alcance y límites

Se implementaron tres familias de reglas: barrido/reclaim, continuación/retest y anticipo Fibonacci. No se portaron ni validaron las 60 estrategias históricas. El score y la confluencia no son probabilidades de éxito ni certificación estadística.

No se conectaron cuentas de exchange, ejecución de órdenes, mapa real de liquidaciones, datos de ballenas, flujos institucionales, noticias automáticas ni modelos predictivos externos. La identidad contrato/proyecto de homónimos requiere verificación adicional. Los datos ausentes se presentan como desconocidos.

Indicadores, filtros y narrativa de reglas se calculan sin llamadas a modelos de IA por captura. Los conectores de la conversación no aportan automáticamente sus sesiones o créditos a la aplicación.

## Integridad de los módulos servidos

- app.js: 31.543 bytes, SHA256 a5ad31dcd37c6f65084ee93773723188c937156051372d49fcd5ccfc3dd3e319.
- vendor/lightweight-charts.js: 189.377 bytes, SHA256 896aa8f75f7d5a5d083cf50961ab44f4f9d3e098cf24d18d8cae78f656aef56f.
