# Corrección de datos y continuidad · 07/11/2026

Fuente de partida del Site: 4ce16e05d784de8f9dd3edad5d2a5bdf29d2dd31. La fuente original se conserva en Git. Se modificaron las implementaciones activas, sin crear wrappers por versión.

## VERIFICADO_LOCAL

82 pruebas Node aprobadas, build completado y Worker ESM válido. Incluyen pérdida de sesión, persistencia local, reintentos/concurrencia sin planes duplicados, separación SPOT/PERP, calendarios con horario de verano/invierno, FRED con unidades/fecha común y fuentes fallidas sin frescura falsa.

Bitget público: KAIO, RIF y CPOOL activos en SPOT y sin contrato PERP en la lectura de esta revisión. Historias mensuales SPOT: 6, 35 y 26 barras, respectivamente. El radar conserva las 54 filas y muestra acceso al mercado alternativo; no copia velas SPOT a PERP.

Fuentes oficiales consultadas realmente: WALCL, WTREGEN, RRPONTSYD, calendario iCal BLS y RSS Fed/BLS. El proxy Fed observado para 04/11/2026 fue 5790,745 mil millones USD. Se incluyen componentes, fórmula y fecha común; no equivale a liquidez mundial. La captura oficial del artefacto conserva los relojes originales y se marca vencida cuando corresponde. La consulta desde el servidor puede fallar; no se oculta el fallo detrás de una fecha nueva.

## VERIFICADO_NAVEGADOR

Chrome remoto, iframe de 360 px: no se observó desbordamiento horizontal; KAIO, RIF y CPOOL SPOT mostraron precio recibido y 499 velas 15m en cada consulta focal. Evidencia: docs/evidence/cpool-mobile-360.jpg. Los cuatro perfiles mostraron contexto y pendientes, incluso sin evento. Cambiar de moneda vacía datos del activo anterior mientras se consulta el nuevo.

Prueba de sesión 401 simulada exclusivamente en preview: plan de prueba guardado en el dispositivo, conservado tras recargar y sincronizado después de retirar la simulación. Dos pulsaciones de sincronizar conservaron un único plan. No se crearon planes de prueba en producción ni se enviaron órdenes.

El servidor del preview no pudo consultar fuentes externas en esta ejecución. La lectura de FRED/BLS se verificó separadamente desde el runtime; el render de estas fuentes y la captura fechada se comprueban también en el artefacto.

## PARCIAL / BLOQUEO_REAL

La lectura del historial privado de producción quedó bloqueada por revisión automática de autorización. No se afirma haberla verificado ni se elimina la autenticación del Site. La recuperación ofrece navegación superior normal a Sign in with ChatGPT.

La actualización de main de GitHub fue rechazada por revisión automática. PR preparado: https://github.com/bebe2020/bot-nuevo/pull/2 . El respaldo público programado context.json requiere fusionar ese cambio; no está activo por preparar un PR.

No hay agregación de liquidez mundial ni identidad de ballenas en el feed de mercado. Las operaciones grandes son una muestra pública de hasta 100 operaciones, con fecha y caducidad. El último pedido sobre «conncor» quedó incompleto y no se asumió una fórmula de indicador.

OBSERVADO_ANDROID: pendiente; Chrome remoto no es la validación física en el Samsung.
