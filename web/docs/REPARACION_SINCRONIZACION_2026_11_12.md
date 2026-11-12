# Reparación de sincronización · bot personal

Repositorio: `bebe2020/bot-nuevo`. Sitio: Bot Nuevo · Radar de liquidez. El repositorio comercial no se modifica.

## Fallos comprobados y correcciones

| Fallo anterior | Cambio |
|---|---|
| Pulpo y escenas 3D decorativas sin utilidad operativa | Eliminados de la interfaz y del código. Quedan cuatro vistas de análisis con fuentes, inferencias, scanner y procesos reales. |
| Cabecera, tablas y módulos mezclaban capturas y cotizaciones de distinta edad | Modelo compartido por instrumento, mercado, perfil, horizonte y base de retorno. La observación más reciente gana; cada fuente conserva su fecha. |
| Botones de horizonte dentro del protocolo no actualizaban otras vistas | Un único controlador cambia cabecera, fractales, protocolo y tabla automática. |
| Retornos 3h/7d/30d y descuento conservaban el precio anterior | Se recalculan con el mismo precio visible sobre sus referencias históricas. Para capturas antiguas la referencia se reconstruye algebraicamente del retorno observado; no se inventan velas. |
| Señales descriptivas y colores sobrevivían al vencimiento de las velas | Envejecimiento de estructuras, acumulación, distribución y lecturas. Un tick reciente no renueva las velas ni confirma una entrada. |
| Actualizar todo omitía on-chain y podía dejar respuestas del activo anterior | Consulta de todas las dependencias, invalidación al cambiar activo y descarte de respuestas de otra identidad. Libro y trades comparten las consultas en curso. |
| Mensajes con mismo precio/hora perdían cambios de funding | Deduplicación del contenido completo de la cotización. |
| Una respuesta UNKNOWN acreditaba éxito | Se distingue última respuesta de último éxito de datos. |
| Se daba por ejecutado un cron por estar escrito | Estado persistente de ejecución, fuente y cobertura; nueva ruta de actualización en segundo plano y procedimiento horario de respaldo. Programar no acredita ejecución futura. |

| El inicio de un barrido parcial sustituía velas de otras monedas por pendientes | Se conservan únicamente las series aún no consultadas, con sus fechas originales; errores reales y mercados distintos no heredan datos positivos. |

## Evidencia

- Suite Node: 195 pruebas aprobadas; incluye rechazo de cotizaciones anteriores, aislamiento SPOT/PERP, vencimiento de velas, selección compartida, recálculo de retornos y descuento, funding y escritura de fondo. Build y validación del Worker correctos.
- Chrome, viewport móvil de 360px: navegación durante adquisición; cambio CPOOL SPOT a BTC PERP y ETH PERP; perfil AGRESIVO y horizonte semanal compartidos; invalidación del on-chain anterior; Kronos correspondiente a la selección; controles de consulta por fuente. La previsualización local no contiene las claves privadas del servidor.
- Se reejecutaron y completaron correctamente los jobs reales de captura e inferencia: `43226801945` intento 2 y `43174111809` intento 2. La lectura posterior de la rama `market-data` confirmó una captura nueva y 54 resultados de Kronos, calculados alrededor de las 14:48 UTC del 12/11/2026.
- La prueba del botón de actualización incluye on-chain y Kronos, además de macro, mercados, DeFi, fundamentos y conectores. La cobertura parcial se mantiene visible.
- El resultado de publicación, la comprobación del escritor en producción y el identificador de la tarea enlazada se registran en la entrega de GitHub después de verificarlos. Este documento no acredita por adelantado esos resultados.

## Causa de las afirmaciones anteriores incorrectas

Se presentó como integración terminada lo que solo tenía componentes probados por separado. Se confundieron endpoint disponible con cobertura suficiente, cron configurado con ejecución observada y visualización decorativa con proceso operativo. La comunicación omitió esas diferencias. Esta entrega separa evidencia local, ejecución real y trabajo pendiente.

## Límites que permanecen

- K4 fundamental continúa parcial; faltan unlocks, emisión, usuarios y catalizadores completos. No equivale a valoración fundamental automática.
- M2/liquidez mundial agregada sigue sin una serie conectada verificable. El proxy Fed es de Estados Unidos.
- CoinGlass rechaza la clave recuperada; no se compró un plan ni se sustituyó por datos ficticios.
- On-chain depende de cobertura e identidad de cada red; ausencia de muestra no prueba ausencia de actividad ni de ballenas.
- El panel abierto recibe precios WS/REST. El refresco integral de velas de 54 activos tarda más que un tick y muestra progreso y fechas por fuente. El horario nominal de GitHub tuvo retrasos; el respaldo horario no promete una captura cada cinco minutos.
- Kronos conserva modelo, entrada y fecha de ejecución. Sus trayectorias no son probabilidades calibradas ni anticipación garantizada. La evaluación fuera de muestra y la observación física en Samsung siguen pendientes.
- El código no lee cuentas privadas ni envía órdenes. PAPER requiere presupuesto y comisiones configurados; el formulario manual sigue siendo opcional.

No se certifica que todo el proyecto esté terminado por haber aprobado esta suite.
