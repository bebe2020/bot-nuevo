# RADAR EXPLOSIÓN SPOT + PAPER TRADING — 08/11/2026

**Proyecto:** exclusivamente `bebe2020/bot-nuevo`. Este módulo experimental no altera el proyecto comercial ni genera órdenes reales.

- `EXPLOSION_SPOT` es un radar separado de `MICRO_PIVOTE`. Ventanas **1, 4, 14, 24 y 36 horas** sobre velas **SPOT** cerradas; nunca se usa una vela PERP para simular liquidez SPOT.
- La captura GitHub actual tiene datos principalmente PERP; por tanto **no se publican señales SPOT confirmadas** sin una captura SPOT genuina. Beta, market cap, FDV, desbloqueos, spread y volumen spot deben proceder de fuentes verificadas con hora y TTL.
- Los objetivos +30%, +50%, +80% son **escenarios de precio**, no probabilidades ni pronósticos.
- `worker/explosion-paper.js` contiene funciones puras de radar y registro de operaciones simuladas. Para abrir una operación requiere **fillEvidence** explícito y sellos de tiempo; no convierte una alerta en compra. SPOT permite solo LONG; PERP LONG/SHORT. Calcula comisiones, funding y slippage al cerrar. El PnL real permanece 0.
- **No hay automatización de fills ni persistencia de diario en esta rama**: falta adaptar una fuente SPOT verificada, definir replay sin lookahead y agregar almacenamiento idempotente. No etiquetar una entrada histórica como ejecutada por el bot si no hay evidencia.
- Las simulaciones de futuros x3/x5/x7/x10 son comparaciones de margen/exposición; el apalancamiento no multiplica el PnL sobre el mismo nominal.
- Antes de integración UI: tests de barras cerradas, lag, gaps, market type, comisiones, stops/TP simultáneos, funding, fallos de API, liquidez, duplicados y reproducción histórica.

**Meta de laboratorio:** +4.000 USDT netos *simulados*, sin fecha prometida, sin capital real, con control de drawdown y exposición agregada.
