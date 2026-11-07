# Bot Nuevo · terminal personal de liquidez v1

Aplicación de lectura pública de Bitget USDT Futures con radar, fractales, perfiles, funding, historial en nube y calculadora manual de SL/TP1/TP2/TP3/R:R. Sin claves de exchange, cuentas privadas ni envío de órdenes.

## Fuente canónica de esta versión web

- `worker/engine.js`: cálculos puros y políticas versionadas. Compartidos por servidor y pruebas.
- `worker/collector.js`: adquisición REST pública compartida por navegador y pruebas.
- `worker/service.js`: servidor HTTP y persistencia de objetos JSON. Un lease condicional mantiene una sola adquisición en vuelo. No contiene credenciales.
- `worker/ui.js`: interfaz HTML responsive; no recalcula señales con reglas divergentes. Su gráfico usa las velas recibidas.
- `scripts/build.mjs`: empaqueta esas fuentes en un Worker ESM sin dependencias de terceros. `dist` es un resultado reproducible, no otra implementación.

La versión web consulta REST público de Bitget desde el navegador. El servidor recalcula la captura recibida y guarda el historial. El nodo de hosting devolvió HTTP 403 desde Bitget; no se depende de ese acceso para actualizar. El código Python/CCXT del repositorio anterior se conserva como referencia y adaptador opcional, sin declararlo integración CCXT en vivo. Dos fixtures de paridad verifican los indicadores de volumen del motor web contra el núcleo Python previo. Los nuevos módulos y la UI tienen pruebas independientes.

## Alcance de datos

Universo inicial: los diez símbolos del scanner suministrado por el usuario. No se presenta como el universo de 54 activos de SNIPER. Fuente, venue y mercado permanecen explícitos. Se adquieren tickers, contratos, velas, libro, operaciones, OI y funding. Los fallos quedan UNKNOWN; no desaparece la moneda por un error.

Temporalidades de entrada: 5m, 15m, 1H, 4H, 1D UTC, 1W UTC y 1M UTC. Se excluyen velas abiertas; trimestres son grupos calendario completos de tres meses. Ciclo de tres años requiere al menos 36 meses cerrados. No se inventa historia de tokens nuevos ni una fase futura del ciclo.

Estructura y zonas son heurísticas explícitas: fractal de dos velas por lado, ruptura de cierre, barrido de los veinte extremos previos con reclaim, FVG de tres velas, última vela contraria antes de impulso/ruptura. Los pools de liquidez son estimaciones por estructura de precio, no órdenes stop observadas ni mapas de liquidaciones reales.

## Perfiles y riesgo

AGRESIVO y CONSERVADOR usan los umbrales suministrados, con correcciones de causalidad y dirección. MODERADO es una propuesta intermedia inicial, no calibrada, con redondeo conservador del conteo de puntos. CONSERVADOR compara 4H/1D; MODERADO compara 1H/4H. ULTRAAGRESIVO se muestra sin admisión: falta L2 continuo. Ningún perfil selecciona capital, apalancamiento o riesgo por cuenta.

Las propuestas de entrada requieren un barrido con cierre/reclaim vigente. El stop propuesto usa el extremo con un buffer explícito de 0,1 ATR; no es una regla canónica de SNIPER. Los objetivos provienen de pivotes observados de los TF adquiridos. Si no hay tres objetivos, faltan; no se dibujan tres precios solo para completar una ficha. No se afirma que la entrada se llenó ni que un TP ocurrió después del fill.

La calculadora recibe cantidad y comisiones explícitas. Distingue salida total en cada TP de una alternativa a tercios. Funding se trata como flujo de caja variable de un escenario; no se anualiza ni proyecta automáticamente al futuro. No estima liquidación sin parámetros reales de cuenta. Los planes guardados son `PLAN_MANUAL_SIN_FILL`, nunca trades rentables certificados.

## Historial y caducidad

Un objeto inmutable por activo/minuto consultado guarda un resumen; `latest/<símbolo>` conserva el último payload completo. El historial no depende de localStorage ni del teléfono. Las preferencias de pantalla no contienen secretos. El lease usa comparación de ETag para evitar doble escritor; solicitudes concurrentes reciben la captura previa sin cambiar su fecha.

La pantalla consulta cada 30 segundos mientras está abierta y puede pausarse. El libro caduca a los 5 segundos: tanto la API como la vista retiran su admisión vigente al vencer. Hay caché de adquisición de 30 s y macro de 1 h. No se presenta como streaming L2, HFT ni captura 24/7 con el navegador cerrado. No hay una tarea periódica conectada en esta entrega.

## Fuentes parciales

- Operaciones grandes: hasta cien prints recientes, con ID y dirección publicados por la API. No identifica ballenas, propietarios o un CVD completo. La absorción sigue UNKNOWN.
- Liquidez USD: WALCL/1000 − WTREGEN/1000 − RRPONTSYD, en miles de millones de USD y fecha común. WALCL es nivel de miércoles, WTREGEN promedio semanal y RRP dato diario. Es un proxy de la Fed, no liquidez global. HTML, falta de componente o fechas incompatibles no se convierten en cero.
- Token supply, identidades on-chain, mapa real de liquidaciones y estadística de rentabilidad no tienen una fuente completa conectada. El panel de cobertura muestra esos límites.
- Plugins del chat y cuotas de modelos no se transfieren a un backend. No hay proveedores IA habilitados ni llamadas a modelos por tick.

## Ejecutar comprobaciones

`node --test tests/*.test.js`

`node scripts/build.mjs`

`node scripts/validate-artifact.mjs`

El preview interno se inicia con `sites-preview start <checkout>`. El modo de fixtures es exclusivo del servidor local, requiere `.local/fixture-mode` y pone una advertencia de simulación en pantalla; no se incluye en el Worker publicado.

## Aceptación

Ver `docs/ACEPTACION_20.md`. Una versión web funcional no equivale a tener todos los feeds, una estrategia estadísticamente certificada o una cuenta de trading autorizada.

La lectura histórica usa hasta tres páginas diarias/semanales para reunir cobertura suficiente, sin saltar el extremo temporal entre páginas. Prueba pública real de BTC: 270 días, 39 semanas y 88 meses en la corrida de verificación; la cobertura se vuelve a medir en cada adquisición. El proxy macro del hosting devolvió HTTP 520 y queda UNKNOWN.
