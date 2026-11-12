# Entrega 19 · sincronización y ejecución de fondo

Proyecto personal: bebe2020/bot-nuevo. SNIPER comercial no se modificó.

Cambios, causas y límites: [Reparación de sincronización](../REPARACION_SINCRONIZACION_2026_11_12.md). Procedimiento ejecutable: [Automatización](../AUTOMATIZACION.md).

## Publicación intermedia comprobada

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

## Cierre adicional: versión 19

Una nueva comprobación detectó que iniciar otro barrido podía reemplazar velas de otras monedas por PENDIENTE antes de volver a consultarlas. Ahora se conservan únicamente las series no consultadas de la misma identidad/mercado. Se respetan errores nuevos y fechas originales. Al terminar la adquisición, sus resultados reemplazan esa conservación temporal.

- Fuente nativa final: 1162730ce8996e9c6c7d7b74e06b98a808fdbd76.
- Versión 19, despliegue appgdep_6af60089f4208191bbd29b7d3a6d32c0: succeeded, 12/11/2026 18:08:27 UTC. Secretos revisión 1.
- /api/health confirmó huella 554a4f783300ec6c401fe2e69a5743a91b6c0d6a281ccc0ba909b6c87c801652 y cuatro módulos.
- 195/195 pruebas locales, build y validación correctos; tres casos nuevos cubren conservación parcial, errores reales y aislamiento de mercados.
- Chrome móvil: precio de cabecera y fila ETH coincidentes (2.016,93 en la lectura), selección ETH/PERP/MODERADO/SEMANAL igual en ambas vistas, botón de refresco habilitado tras completar y error de aplicación vacío. Ancho de documento y contenido iguales; tablas con su propio desplazamiento.
- La CI de GitHub del commit 602cdef33d093271a98a263c1b1e61620549dfc9 terminó correctamente (run 43275825188). El nuevo commit conserva el código final de versión 19; su CI debe verificarse después de guardarlo.
- Captura run 43275825325: success. Lectura posterior /api/cloud: OK, lastSuccess=1794506666844 (12/11/2026 18:04:26 UTC).
- Inferencia run 43263035337: success. Lectura posterior de Kronos ETH: generatedAt=1794506559161, 54/54 resultados válidos y antigüedad de 6 minutos al comprobar.
- GET /api/background-status conserva exactamente el resultado escrito a las 18:01 UTC. El respaldo horario sigue habilitado y enlazado al sitio. Todavía no se observó su primera ejecución programada.

El escritor no cambió entre las versiones 18 y 19; se conserva su comprobación de escritura real y lectura posterior. Los faltantes enumerados arriba siguen abiertos.
