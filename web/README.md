# Bot Nuevo · Terminal 54

Proyecto personal independiente de SNIPER/Océano. Motor numérico compartido, transporte público y una interfaz sobre el mismo contrato de datos; no modifica ni incorpora el lanzador L65.

La ampliación más reciente y sus límites están en [MODULOS_2026_11_07.md](docs/MODULOS_2026_11_07.md). Incluye el protocolo automático de las 54, indicadores, DeFi/on-chain/Hyperliquid, activos cruzados y los cinco módulos solicitados.

## Base de implementación

- Universo exacto de 54 activos y taxonomía multietiqueta recuperados del archivo canónico `sniper_narrativas_54.json` revisado el 16/10/2026. Ninguna sustitución por monedas de mayor volumen. Catálogo Bitget SPOT/PERP actual comprobado cada hora; transporte público por debajo de ocho solicitudes por segundo y un solo reintento 429 respetando Retry-After (hasta diez segundos); las filas sin instrumento permanecen visibles.
- Precios WebSocket públicos para los instrumentos activos; fallback REST explícito. Reconexión y heartbeat; source timestamp separado de recepción y de velas cerradas. Sin controles de pausa o actualización en el flujo principal.
- TradingView Lightweight Charts 5.1.0, servido localmente: velas, escala de precios, crosshair/zoom, EMA9/21/50/100/200, volumen y RSI Wilder14 en paneles separados. Fibonacci causal, OB/FVG y POC/VAH/VAL aproximados con controles de visibilidad. La vela provisional usa precios recibidos y queda fuera de las confirmaciones e indicadores cerrados.
- Trece temporalidades nativas/derivadas y trimestre calendario: 1m,5m,15m,30m,1H,2H,4H,6H,8H,12H,1Dutc,1Wutc,1Mutc,3M. 8H se deriva de 4H; 2H SPOT de 1H; semanas del radar se agregan desde días completos alineados al lunes UTC. Se rechazan huecos. No se inventa EMA200 con 199 barras.
- Descubrimiento 54, mapa de calor (24h, caída desde máximo mensual observado, RSI4H), filtros por sector y descuento, matriz de estructura. Caída/descuento no equivalen a acumulación ni a un ATH global certificado.
- Reglas explícitas de barrido/reclaim, retesteo tras ruptura y anticipación Fibonacci. Micro, scalp, diario, semanal y mensual; trimestre/ciclo son contexto estructural. Cuatro perfiles evalúan hechos y geometría compartidos. Ultra permanece sin admisión operativa sin L2 continuo.
- Protocolo K1 contexto/K2 evidencia de flujo y proxies/K3 evento cerrado/K4 geometría. Se conserva anticipación con conflictos explicados; flujo contrario no se vende como confirmación. Ningún score representa probabilidad de acierto.
- Entrada, stop, tres objetivos disponibles y R:R bruto; calculadora de costes/R:R neto y planes manuales durables. Los objetivos Fibonacci proyectados se distinguen del extremo observado. Identidad de evento/stop estable y revisión de geometría incluye objetivos; las invalidaciones intrabar observadas se conservan localmente. Los registros reales no imputan fills ni PnL; el módulo adicional de seguimiento simulado etiqueta explícitamente sus resultados hipotéticos.
- Océano: sectores por conjuntos únicos de símbolos, medianas 24h/7d/30d con cobertura, cuatro radares trimestral/ciclo SPOT/PERP. FRED aporta el proxy USD WALCL−TGA−RRP con unidades y fecha común. Se leen el calendario oficial BLS y comunicados Fed/BLS; los fallos conservan el último dato fechado y se explican. Se agrega stock global USD de stablecoins y fuerza relativa de activos cruzados; M2 mundial agregado continúa sin fuente verificada.
- GitHub Actions: capturas públicas programadas con objetivo de cinco minutos en `market-data`; reusa las velas que siguen siendo válidas sin alterar sus relojes. El horario puede demorarse o suspenderse por las reglas de GitHub. La pantalla muestra el último éxito real. No almacena cada tick con el navegador cerrado.

## Arquitectura única

| Archivo | Responsabilidad |
| --- | --- |
| worker/universe.js | Universo/taxonomía curados, independientes del mercado disponible |
| worker/engine.js | Validación OHLCV, estructura, perfiles base y economía de salidas |
| worker/indicators.js | Series EMA/RSI/MACD/OBV/VWAP, Fibonacci y perfil por rango |
| worker/protocol.js | Protocolos, geometría, evaluación de perfiles y narrativa determinista |
| worker/collector.js | Catálogo/adquisición/caché por venue-mercado-símbolo-TF; snapshot único |
| worker/live.js | Transporte WS público, relojes, heartbeat y reconexión |
| worker/app.js + chart.js | Controlador de pantalla y gráfico interactivo |
| worker/ui.js + terminal.css | Estructura visual y estilos responsive |
| worker/service.js | Validación/persistencia R2 y API privada |

Sin monkey patches, wrappers por versión, SQLite ni claves de exchange. El programa Python original permanece como proyecto distinto. Los registros privados se conservan al cambiar de versión; SPOT/PERP usan claves separadas. El Diario conserva una copia de observaciones y planes en el navegador, muestra recuperación de sesión ante HTTP 401 y sincroniza planes mediante IDs idempotentes. Las observaciones antiguas de la copia local permanecen en ese navegador; no se presentan como sincronizadas a la nube.

## Validación

`npm ci`, `npm test`, `npm run build`, `npm run validate`. El build incluye activos cliente y Worker ESM. No depende de un CDN para dibujar el gráfico.

Primera adquisición real observada: 54 filas, 51 PERP activos en Bitget, 14 temporalidades de BTC válidas. Catálogos actuales SPOT y PERP no garantizan 54/52 instrumentos del inventario histórico. El detalle y las causas por activo son la evidencia de cobertura.

La primera lectura completa necesita calentar cachés y puede tomar aproximadamente un minuto en esta ejecución; depende de red/cobertura. Primero aparece el activo focal y después progresa el radar. Los precios WS siguen actualizándose durante ese trabajo. El caché reduce consultas posteriores; no se promete una latencia universal.

## Límites que siguen abiertos

No replica las 60 estrategias ni todos los exportadores del SNIPER original. Las tres familias implementadas son reglas explícitas nuevas, sin equivalencia estadística certificada con aquel motor. No hay ejecución de órdenes, cuenta/leverage/sizing personal configurados, mapa de liquidaciones observado, identidad de ballenas, cobertura global de liquidez/supply ni IA predictiva validada. Homónimos requieren vincular proyecto y contrato, no solo ticker. Una fuente FRED inaccesible conserva el último válido con su fecha; sin observación válida queda UNKNOWN. La captura oficial incluida en el artefacto nunca cambia sus fechas y vence explícitamente.

Los plugins del chat se usan para desarrollar/verificar (GitHub, Firecrawl y pruebas de navegador). No transfieren automáticamente sesiones, créditos o claves al sitio. Indicadores, reglas y narrativa se calculan sin llamadas a modelos: no consumen tokens de IA por captura. Integrar un proveedor de modelos requeriría su conexión y cuotas reales; no se afirma que haya tokens gratuitos habilitados.

## Licencia del gráfico

TradingView Lightweight Charts™. Copyright (с) 2025 TradingView, Inc. https://www.tradingview.com/ . Apache-2.0; licencia y aviso preservados. Los datos del gráfico provienen de Bitget.

## Corrección de datos del 07/11/2026

KAIO, RIF y CPOOL se verificaron activos en SPOT y ausentes en PERP en la consulta pública de esta revisión. El catálogo se vuelve a comprobar: no es una exclusión permanente. Tienen 6, 35 y 26 meses SPOT observados en esa consulta; el precio no depende de completar 36 meses de ciclo.

El estado y la aceptación de este cambio están en `docs/CIERRE_DATOS_2026_11_07.md`. El respaldo programado `context.json` está preparado en el PR 2 de GitHub; requiere fusionarlo antes de afirmar que ya funciona en la rama de producción del colector.
