# Contrato operativo separado — BOT NUEVO PERSONAL
Fecha: 2026-11-09 (America/Argentina/Buenos_Aires).
Repositorio exclusivo: `bebe2020/bot-nuevo`.
**No modificar ni fusionar código del proyecto comercial `bebe2020/SNIPER-SMC-OCEANO-54`.**

## Separación funcional obligatoria

| Sistema | Mercado | Lado | Apalancamiento | Horizontes | Capital |
| --- | --- | --- | --- | --- | --- |
| SPOT_EXPLOSIVO | SPOT | Compra / venta por tramos; nunca short | x1 | 1h, 4h, 14h, 24h, 36h | Contado |
| SPOT_SWING | SPOT | Acumulación/venta | x1 | Semanal, mensual, trimestral, ciclo 3 años | Contado |
| PERP_INTRADIA | Futuros USDT | LONG / SHORT bidireccional | x20 / x30 | Micropivote 1m/5m/15m, scalping, diario | Margen, funding, mark price |
| PERP_SWING | Futuros USDT | LONG / SHORT bidireccional | x3 / x5 | Semanal, mensual, trimestral | Margen, funding, mark price |

`CICLO_3_ANOS` aplicado a futuros es contexto de 36 meses, no un supuesto holding perpetuo de tres años. Cada contrato limita las combinaciones admitidas. La temporalidad de señal no sustituye la validación multitemporal.

## SPOT explosivo: plan de laboratorio por tramos
- Tres niveles de **compra límite hipotética**, configurables por el usuario, necesariamente decrecientes: 40% / 35% / 25% del presupuesto. Stop por debajo de los tres niveles.
- Cuatro **ventas hipotéticas** del 25% del inventario adquirido, al +30% / +50% / +80% / +100% sobre el promedio de entrada; los porcentajes son *escenarios exploratorios*, no probabilidad de explosión ni rentabilidad objetivo acreditada. Cuando comienza una venta parcial se cancelan todas las compras todavía pendientes.
- Si un precio publicado cruza el stop, el PAPER usa el precio observado para simular el peor gap; no simula un llenado anterior falso. Sin ticks futuros al armado, no hay entradas.
- Se aplican fee y slippage supuestos. No se dispone de fills reales de cuenta, datos de prioridad de cola, latencia certificada ni garantía de ejecución.
- Radar de **54 símbolos del universo** y temporalidades 1/4/14/24/36h mediante barras SPOT 1h cerradas, sin reciclar velas PERP. RVOL, capitalización circulante y FDV (CoinGecko con marca temporal, <=24h), spread live si existe. Profundidad e impacto son campos pendientes. Clasificar por cap real, no por precio ni por percentil de volumen.
- **Nunca interpretar +30/+100% como señal de compra.** Señales requieren libro, volumen, spreads, cambios de estructura, riesgo de manipulación y confirmación de cierres.

## PERP intradía LONG/SHORT
- Señales separadas para Micro Pivote, scalp, diario. x20 y x30 **únicamente en PAPER** hasta validar mark price, mantenimiento, tiers, funding, liquidez y stops.
- Límite inicial del laboratorio: 0,5% del capital por operación, 20% máximo del capital como margen inicial, stop a menos del 75% del umbral teórico 100/leverage (esto no es cálculo de liquidación real).
- El sizing usa precio de entrada, stop, comisión y slippage; salidas de ejemplo 1R/2R/3R. LONG y SHORT se contabilizan con signo inverso. Sin orden real.
- Si falta cotización reciente (5 s), el plan se bloquea.

## PERP swing LONG/SHORT
- x3 o x5; horizontes semanal, mensual y trimestral; 1% máximo de capital a riesgo teórico por operación en laboratorio. Se evalúa contexto mensual, trimestral y ciclo, y riesgo de funding prolongado.
- Stop y TPs separados del intradía. No replicar stop de scalping en swing.

## Fuente y control de datos
- SPOT y PERP se adquieren y etiquetan por separado. Si el activo existe solo en PERP, **no aparece como SPOT operable**.
- Velas horarias: una vela cerrada no vence a los dos minutos; se compara con el siguiente cierre esperado. Libros y quotes requieren segundos de frescura.
- Capitalización sin edad certificada => UNKNOWN; no se usa volumen para inventar clases MICRO / BAJA / MEDIA.
- Volúmenes, ticker, DOM/L2, OI y funding llevan identificador de exchange, símbolo y `asof`.
- Ni la detección de una caída ni un objetivo de +100% equivalen a un fill o probabilidad.

## Diario y pruebas
- Un único `PaperBook` existente administra estrategias PERP y SPOT; no bifurcar diarios. Registro local en `localStorage`, exportable a JSON desde Android. PnL PERP no acredita funding, mark-to-liquidation ni fills ejecutables; está marcado como PAPER.
- El seguimiento de ticks **solo ocurre mientras el navegador ejecuta la aplicación**; no es un servicio 24/7 ni almacén central.
- Idempotencia, timestamps posteriores al armado, prioridades de stop, cancelaciones de tramos, ventas parciales, fees, slippage y LONG/SHORT deben pasar pruebas. El replay histórico fuera de muestra y almacenamiento persistente de servidor siguen pendientes.
- Regla antes de un futuro despliegue de dinero real: backtest sin anticipación, walk-forward, costes realistas, drawdown, sesgo de supervivencia, seguridad de claves y verificación con un exchange real, todo certificado. Actualmente `realOrdersEnabled=false`.

## Meta del usuario (laboratorio, no rendimiento prometido)
Capital supuesto 710 USDT, aspiración de ganancia neta 3.500 USDT, capital final 4.210 USDT. Exigiría +492,96% neto. Ninguna señal o sistema garantiza esos beneficios y el uso de x20/x30 puede consumir rápidamente el margen.

## Conservación del trabajo y reglas de merge
- PR #2 `fix/mercados-diario-macro-20261107`: módulos avanzados DeFi, on-chain, Kronos, Hyperliquid, laboratorio 3D y PaperBook; base del presente desarrollo.
- PR #3 `feature/radar-explosion-paper-20261108`: intento alternativo antiguo; **no fusionar ambos libros PAPER**. Su radar se reimplementa limpiamente.
- PR #4 `feature/operativa-separada-20261109` apunta a PR #2. Mantener en borrador hasta CI y pruebas E2E navegador Android, no asegurar que esté publicado por crear el PR.
- El proyecto comercial está aislado.

## Referencias externas
- Bitget (oficial), *Futures — Leverage and Risk Management*, mark price y margen de mantenimiento: https://www.bitget.com/es/support/articles/360058821652
- Bitget (oficial), TP/SL parcial para futuros: https://www.bitget.com/es/support/articles/12560603846567
- Li, Shin y Wang (2025), *Cryptocurrency Pump-and-Dump Schemes*, Journal of Financial and Quantitative Analysis: https://doi.org/10.1017/S0022109025000201 — pumps y reversiones rápidas.
- Hamrick et al. (2021), *An examination of the cryptocurrency pump-and-dump ecosystem*: https://doi.org/10.1016/j.ipm.2021.102506 — manipulación y sesgo de selección.
- Moskowitz, Ooi y Pedersen (2012), *Time Series Momentum*: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2089463 — evidencia en futuros tradicionales (no certifica retornos de cripto ni x30).
- Bailey, Borwein, López de Prado y Zhu (2015), *The Probability of Backtest Overfitting*: https://papers.ssrn.com/sol3/Papers.cfm?abstract_id=2326253 — validación fuera de muestra.
