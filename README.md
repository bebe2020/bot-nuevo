# bot-nuevo

Scanner de volumen y libro para perpetuos lineales USDT. Enriquece datos públicos; no crea órdenes, no consulta cuentas y no define un porcentaje de riesgo por cuenta.

## Componentes

- `bot_nuevo/scanner.py`: análisis local de snapshots existentes, sin HTTP ni dependencias externas.
- `bot_nuevo/reader.py`: adaptador opcional para un cliente CCXT público ya disponible. Rechaza clientes con claves, deduplica símbolos y consulta tickers en lote cuando el exchange lo permite.
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
