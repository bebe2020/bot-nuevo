# Bot Nuevo · radar personal de liquidez

Aplicación web de lectura pública de Bitget USDT Futures, independiente de SNIPER/L65.

## Abrir

https://bot-nuevo-liquidez.stablepiece.chatgpt.site/

Sitio privado: entrar con la cuenta ChatGPT propietaria. Incluye radar, fractales F1/F2/F3, cuatro políticas visibles, funding, contexto, SL/TP1/TP2/TP3/R:R, historial y una matriz de veinte controles. No consulta cuentas de exchange ni envía órdenes.

## Implementación activa

La fuente web está en `web/worker/`. El colector consulta Bitget desde el navegador y el servidor recalcula y guarda cada captura en almacenamiento durable. Usa un solo motor versionado; los indicadores no consumen tokens de modelos IA.

Bitget devolvió HTTP 403 desde el nodo de hosting. La API pública permite consultas CORS desde el navegador; se verificó una actualización real y guardado desde Chrome. Los precios de diez activos ahora se reciben por WebSocket mientras la pantalla está abierta. GitHub Actions conserva capturas públicas en la rama market-data con un objetivo de cinco minutos aunque la pantalla esté cerrada; el horario puede demorarse. Los tickers no sustituyen un libro L2 continuo.

Ver [documentación web](web/README.md), [aceptación de veinte puntos](web/docs/ACEPTACION_20.md) y [captura móvil de QA](web/docs/mobile-qa.jpg).

## Validación

37 pruebas de Node aprobadas: `cd web` y `node --test tests/*.test.js`. Incluyen paridad numérica con el núcleo Python anterior, adquisición, caducidad, concurrencia, ingesta, persistencia y riesgo neto. Artefacto ESM validado. Interfaz revisada a 360 px; no certifica hardware Android.

Lectura pública real de BTC verificada: 270 días, 39 semanas y 88 meses en la corrida de cierre. Es cobertura de una observación, no una garantía futura.

## Límites explícitos

- MODERADO: propuesta intermedia inicial, sin calibración estadística. ULTRAAGRESIVO: no admitido sin L2 continuo.
- Operaciones grandes de la muestra no identifican ballenas. Liquidez global, supply completo e identidades on-chain carecen de una fuente completa conectada.
- FRED respondió HTTP 520 desde el hosting: su proxy USD queda UNKNOWN. Nunca pasa a cero ni a un contexto favorable.
- Los planes guardados son manuales, sin fills observados. No hay rentabilidad certificada ni liquidación calculada con una cuenta real.
- Los plugins del chat no se transfieren automáticamente al servidor. No hay proveedores de inferencia habilitados.

## Python anterior

`bot_nuevo/` conserva el núcleo Python de snapshots y el adaptador CCXT opcional, con sus treinta pruebas locales: `python -m unittest discover -s tests`. Su conexión CCXT/Bitget en vivo no se da por verificada por la prueba REST del motor web.
