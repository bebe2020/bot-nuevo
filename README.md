# bot-nuevo

Scanner de volumen y libro para perpetuos lineales USDT. Enriquece datos públicos; no crea órdenes, no consulta cuentas y no define un porcentaje de riesgo por cuenta.

## Componentes

- `bot_nuevo/scanner.py`: análisis local de snapshots existentes, sin HTTP ni dependencias externas.
- `bot_nuevo/reader.py`: adaptador opcional para un cliente CCXT público ya disponible. Rechaza clientes con claves, deduplica símbolos y consulta tickers en lote cuando el exchange lo permite.
- `bot_nuevo/aggressive.py`: política v3 agresiva sobre los mismos snapshots, con checklist separado por lado y zonas candidatas fechadas.
- `tests/test_scanner.py`: pruebas reproducibles con datos sintéticos; no representan backtesting ni rentabilidad.

## Cambios respecto a SCANNER PRO v2

Se excluyen velas abiertas y se valida continuidad, geometría y frescura. El volumen relativo compara la última vela cerrada con las veinte anteriores. CMF conserva en su denominador el volumen de velas planas. Los datos ausentes quedan `UNKNOWN`, nunca se convierten en un cero inventado.

El volumen firmado por color de vela se llama `signed_candle_volume_proxy`: no es delta de operaciones agresoras. El imbalance conserva signo y profundidad observada; una foto de cantidades visibles no demuestra persistencia, ejecuciones ni ausencia de spoofing.

La fórmula original se conserva como `attention_score`, una medida de actividad, **sin señal de compra/venta**. Sus valores absolutos pueden destacar presión bajista. Los filtros de rango y liquidez quedan explícitos; un score puede existir aunque un filtro falle. El consumidor debe comprobarlos. No hay ranking operativo, sizing, stop, take profit ni ejecución. No sustituye un coordinador de señales.

## Integración

Preferir `analyze_snapshot(symbol, ticker, ohlcv, book, now_ms=..., venue=..., market=...)` cuando ya hay datos en caché. Recibe OHLCV y libro normalizados como CCXT. La política predeterminada es 15 minutos, 20 niveles y antigüedad máxima del libro de 5 segundos. Un reloj de libro ausente se considera desconocido. La profundidad parcial no recibe score completo.

Si hace falta adquirir datos, `collect_public(exchange, symbols)` recibe un cliente público CCXT con rate limiting habilitado. Solicita 50 niveles y analiza los 20 primeros. Una política de cierre distinta requiere un `timeframe` coincidente. Devuelve todos los símbolos, incluidos errores explícitos; limitar a seis filas es una decisión de presentación. No repetir adquisiciones por perfil.

Las cantidades OHLCV y del libro conservan las unidades del exchange. El proxy de volumen no permite comparar contratos diferentes sin normalización de unidades. El umbral de liquidez usa `quoteVolume` en USDT; si falta, el filtro queda desconocido.

## Validación y límites

`python -m unittest discover -s tests`

Núcleo y adaptador verificados con fixtures y un cliente simulado. La integración CCXT/Bitget en vivo todavía requiere una prueba de contrato con la versión y permisos de red del entorno de despliegue. No hay servicio desplegado ni interfaz añadida en este cambio.

## Perfil AGRESIVO v3

`collect_public(exchange, symbols, profile="AGRESIVO")` conserva una adquisición por símbolo. Si los snapshots ya existen, usar `analyze_aggressive` directamente sin nuevas consultas. La lista de diez monedas del ejemplo no limita el universo recibido; TOP_N=8 solo corresponde a presentación.

Política `v3-aggressive-1`: liquidez mínima 200.000 USDT, rango máximo 5,5%, climax desde 2,2 veces el volumen previo. Conserva los pesos del score v3 y publica cada aporte. El mayor peso al libro no convierte cantidades visibles en operaciones ejecutadas.

El checklist conserva diez condiciones y los cortes 6/10 y 4/10, pero evalúa LONG y SHORT por separado. Informa puntos y desconocidos. Seis puntos con presión opuesta, datos incompletos o filtros incumplidos no se publican como confluencia alta. Son reglas correlacionadas; los puntos no estiman probabilidad, ventaja estadística o riesgo por cuenta. La falta de alineación no elimina zonas tempranas ni es un veto de admisión de un coordinador externo.

`directional_proxy` combina imbalance, CMF y volumen por color de vela. Se etiqueta como proxy; no es OFI, CVD ni delta real. La absorción queda UNKNOWN: OHLCV y una foto del libro no prueban negociación contra liquidez pasiva ni reposición.

El detector de zonas **cambia explícitamente la regla del código v3 suministrado**: busca la última vela opuesta entre las tres anteriores a un impulso cerrado, con cuerpo >48% del rango, volumen >1,45 veces sus veinte velas anteriores y cierre que rompe el extremo de las cinco velas previas. La zona usa el rango completo de la vela opuesta, sin redondear precios a cuatro decimales. Es un candidato heurístico local; no reemplaza los order blocks canónicos de SNIPER.

Cada candidato publica origen, cierre de detección, método e invalidación. Después del impulso se etiqueta UNTESTED, RETESTED o INVALIDATED. Una mecha de vela cerrada que cruza el borde distal invalida definitivamente ese evento dentro de la serie recibida. La vela abierta no confirma estructura; el coordinador de una operación necesitaría controlar precio e invalidación intrabar por separado. El promedio del volumen de detección nunca incluye velas futuras.

Esta evaluación es de ventana y no mantiene Diario ni estado entre reinicios. Los IDs de evento son locales al snapshot; para persistirlos se deben combinar con venue, mercado, símbolo y timeframe. No configura leverage, compras, SL ni TP.

Referencia técnica oficial: https://docs.ccxt.com/docs/manual . La vela corriente puede estar incompleta y algunos exchanges no incluyen timestamp del libro; ambos casos se tratan explícitamente.
