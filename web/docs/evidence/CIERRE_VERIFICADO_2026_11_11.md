# Cierre verificado · 11/11/2026

Proyecto personal: bebe2020/bot-nuevo. Comercial excluido. Se preservaron los cambios concurrentes de main 1b7829e9d16ee78f54ff18f7f38855f5f563671e en lugar de reemplazarlos con otra rama. La rama preparada localmente no se forzó sobre main.

## Fuente y publicación

- Site privado: https://bot-nuevo-liquidez.stablepiece.chatgpt.site/
- Versión guardada 11, fuente 29012651f0506abe6ae42492656d782eba266261.
- Despliegue: appgdep_6af49a4c9fe08191af943e2d18c1635e.
- API health: HTTP 200, protocolo-2.1, 54 activos, cinco laboratorios, orders=false.
- Huella SHA256 de worker/scripts/dependencias compilados: c95cb39745cf735e2d6fc47baa53ba0ca614d56992da9416c743a689b15c3331. Coincide entre la compilación local de la fuente guardada y producción.
- 137/137 pruebas Node sobre esa fuente, sin fallos; build y validación ESM correctos.

## Lectura publicada

- Feed HTTP 200: OK al verificar; fuente 2026-11-11T16:40:58.197Z, recepción 2026-11-11T16:40:58.282Z; revisión de datos 1b7829e, run 43060617130.
- Snapshot BTC PERP: 54 filas, 193 hipótesis detectadas en esa captura. Cantidad de hipótesis no significa operaciones ejecutables ni fills.
- Kronos BTC PERP: HTTP 200, OK, NeoQuasar/Kronos-mini / PYTORCH_REAL_CPU; generado 2026-11-11T16:42:29.790Z, válido hasta 2026-11-11T20:30:00.000Z. Predicción experimental sin probabilidad calibrada; no es orden ni certificación de ventaja.
- SoSoValue: HTTP 200, CONFIG_REQUIRED, 20 seleccionadas / 0 observadas. No se configuró ni expuso ninguna clave.
- No se leyeron planes privados, posiciones o cuentas de exchanges ni se enviaron órdenes.

## Navegador y alcance

Se comprobó la variante con datos públicos: precio con reloj propio, banner cloud, 499 velas y 23 canvas del gráfico, MODERADO/PERP/SEMANAL y MENSUAL con estados K1–K4 explícitos y admisión condicional en las muestras observadas. SoSoValue mostró 20 tarjetas y la causa de ausencia de datos. Las verificaciones de navegador son de Chrome remoto, no del Android físico.

El workflow de CI añadido a main instala dependencias y ejecuta tests, build y validación de Worker ESM al cambiar web o workflows. Kronos conserva su grupo independiente de captura de mercado. Los publicadores rebasan carreras de rama de datos sin force.

No se fusionan automáticamente PR3/PR4: el siguiente hito sigue siendo macro y modalidades sobre un único ledger PAPER. El cron expresa cadencia objetivo; las observaciones antiguas tuvieron demoras de horas y no se garantiza colector 24/7. Fuentes globales, liquidaciones, L2, identidad de ballenas, las 60 estrategias y validación fuera de muestra permanecen parciales o pendientes.
