# Actualización en vivo · 2026-11-07

- WebSocket público Bitget v2, ticker USDT-FUTURES para 10 activos. Sin login, claves ni canales privados.
- Reloj de fuente y recepción, descarte de mensajes viejos/futuros/duplicados, ping/pong y reconexión con espera progresiva.
- Estado EN VIVO solo con precio WS de menos de 5 s. Fallback REST identificado, cada 3 s si WS no entrega. Pausa ignora paquetes tardíos; reanudar reconecta.
- Traza de precios de la sesión y superposición en gráfico. Velas cerradas y admisión de estrategias conservan relojes separados.
- Colector GitHub Actions independiente del navegador, objetivo cada 5 min. El horario de GitHub puede demorarse. Rama market-data con latest.json, status.json e historia diaria compacta.
- Dos ejecuciones reales completadas: 42350808602 y 42351467004; ambas success. Precios nuevos y relojes distintos conservados. Cron habilitado después de la primera prueba.
- Prueba Chrome: 4.835 mensajes WS y 37 cambios reales observados. Pausa mantuvo 1.220 actualizaciones durante 17 s; reconexión volvió a recibir. No se generaron ticks sintéticos.
- 51 pruebas Node y validación ESM. Cobertura: fuente/reloj, reconexión, pausa, publicación sin tokens en datos, captura vencida sin admisión, errores sin frescura falsa.

La persistencia programada no equivale a guardar cada tick con la pantalla cerrada. No hay órdenes, protección activa ni identidad de ballenas observada. Las limitaciones analíticas de la entrega v1 se mantienen.
