# Bybit V5 en Bot Nuevo (personal) — 2026-11-16

## Alcance implementado en esta rama

- Exclusivamente `bebe2020/bot-nuevo`; no se modifica el repositorio comercial SNIPER/Océano.
- Adaptador `web/worker/bybit-public.js` con lista blanca de seis rutas públicas oficiales: `instruments-info`, `tickers`, `kline`, `orderbook`, `recent-trade`, `open-interest`.
- Endpoint de lectura `GET /api/bybit-public?symbol=BTCUSDT&market=PERP`. Admite únicamente los 54 símbolos canónicos y `SPOT` o `PERP`. Mercado PERP corresponde a categoría Bybit `linear` y contratos `LinearPerpetual` cotizados en USDT.
- La pestaña **Conexiones** del tablero consulta este endpoint y muestra precio observado, símbolo, mercado y reloj de fuente. La lectura se limita a una consulta cada 30 segundos por selección.
- OHLCV 15m de Bybit preservado en orden ascendente; `closed` se calcula sin tratar la vela abierta como confirmación. Volumen en moneda base y turnover en USDT se distinguen.
- Funding e intervalo real, OI y timestamp, libro con timestamp, trades con lado de agresor; las fallas parciales quedan explícitas y nunca se reemplazan por datos inventados.
- `accountData:false`, `orders:false`, `auth:NO_REQUERIDA`. No se utiliza ni se guarda API Key/API Secret en código, navegador, GitHub ni la rama de capturas.
- Cinco pruebas con fixtures para contrato REST, integridad OHLCV, ausencia de instrumentos, fallo parcial y prohibición de endpoint privado.

## Lo que NO equivale a una integración operativa completa

- La terminal principal todavía usa el colector y WebSocket público Bitget existentes. La nueva lectura Bybit está separada hasta pasar cobertura de las 54 monedas, sincronización y reemplazo coordinado del transporte de precios; no se mezclan las dos cotizaciones como si fueran una misma sede.
- No se consultan saldos, órdenes propias, posiciones, ni se envían órdenes reales. La clave Bybit creada por el usuario **no se usa**: su secreto fue compartido en una captura y no debe reutilizarse en una conexión privada.
- No declara 54 pares activos en Bybit: cada consulta verifica la disponibilidad del contrato correspondiente.
- Este cambio requiere fusión y despliegue antes de aparecer en la web publicada; las pruebas de fixture no certifican operación en vivo del tablero.

## Referencia

- Docs oficiales REST: https://bybit-exchange.github.io/docs/v5/market/kline y https://bybit-exchange.github.io/docs/v5/market/instrument
- WebSocket público oficial: https://bybit-exchange.github.io/docs/v5/ws/connect
