# Entrega 18 · sincronización y ejecución de fondo

Proyecto personal: bebe2020/bot-nuevo. SNIPER comercial no se modificó.

Cambios, causas y límites: [Reparación de sincronización](../REPARACION_SINCRONIZACION_2026_11_12.md). Procedimiento ejecutable: [Automatización](../AUTOMATIZACION.md).

## Publicación comprobada

- Sitio privado https://bot-nuevo-liquidez.stablepiece.chatgpt.site, versión 18.
- Fuente nativa: 03c960d323b270722ee33ae3609efa01879af2eb.
- Despliegue appgdep_6af5d566d7b88191b35d38777c9b93d1: succeeded, 12/11/2026 15:04:24 UTC.
- /api/health: HTTP 200; labModules=4; featureSet=seleccion-y-datos-compartidos-20261112.
- Huella de worker, scripts y dependencias: a53ea951f9c8b7b46995bae2f50681c78a355cf9e573d8036cb614fe8571d834.
- Secretos del servidor: revisión 1 conservada. No se copian a este repositorio.

## Escritura desatendida real y lectura posterior

Se ejerció POST /api/background-refresh usando el acceso de servicio vigente de este sitio y X-Bot-Write: 1. Después GET /api/background-status devolvió el mismo resultado persistido.

Inicio 12/11/2026 18:00:50 UTC, fin 18:01:11 UTC. Estado PARTIAL, accountData=false.

| Fuente | Estado observado |
|---|---|
| FRED | PARTIAL: 19/20 vigentes y 1 vencida |
| SoSoValue | PARTIAL: 16/20 vigentes y 1 vencida; restantes ausentes |
| Fundamentos | PARTIAL: 44/54 activos con observaciones; no acredita K4 completo |
| DeFi | PARTIAL |
| Mercados intercapitales | STALE; se conserva fecha anterior |

HTTP 200 acredita una respuesta; la cobertura anterior describe los datos realmente disponibles. No se ha convertido PARTIAL en OK.

## Cadencia y respaldo

Se verificó que los workflows horarios/5 minutos de GitHub tuvieron huecos mayores que su objetivo. A las 18:00 UTC la captura tenía fecha 16:20 y Kronos ETH 16:51; por eso no se afirma continuidad de cinco minutos.

Ya se habían completado los reintentos reales de captura/inferencia alrededor de 14:48 UTC y la lectura de market-data confirmó 54 resultados. El nuevo reintento de inferencia del run 43263035337 se solicitó durante esta entrega; su solicitud no acredita finalización.

Tarea de respaldo enlazada al sitio: Automation_8afa8f6b2d9c81918ed286e12c52f59d, «Actualizar bot personal», habilitada. Horario RRULE:FREQ=HOURLY, zona America/Argentina/Buenos_Aires. Próxima ejecución devuelta al crearla: 12/11/2026 16:02:02 -03:00. last_run_time=null en esa comprobación. La programación guardada no prueba todavía ejecución futura.

La tarea comprueba frescura, relanza los jobs collect/infer si están vencidos y no hay uno activo, actualiza proveedores y vuelve a leer fechas/estado. No republica código por refrescar datos.

## Validación y límites

192 pruebas Node aprobadas, build y validación correctos. Chrome 360px: cambio de activo/mercado, perfil y horizonte compartidos; invalidación de respuestas on-chain anteriores; cuatro vistas de análisis sin pulpo; consultas on-chain/Kronos incluidas en actualizar todo.

No se presenta esa suite como prueba de que todo el bot esté terminado. Permanecen incompletos K4, M2 mundial agregado, cobertura on-chain por red y validación fuera de muestra. CoinGlass sigue rechazando la clave. No hay lectura de cuentas ni ejecución real de órdenes. La cobertura física en Samsung no está certificada.
