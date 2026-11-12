# Actualización del bot personal con el sitio cerrado

Sitio privado: Bot Nuevo · Radar de liquidez. Repositorio: bebe2020/bot-nuevo. No intervenir SNIPER comercial. No se consultan cuentas ni se envían órdenes.

En cada ejecución del trabajo enlazado:

1. Obtener el sitio con Sites y su acceso de servicio vigente. No guardar ni mostrar el token. Usarlo solo con este sitio en `OAI-Sites-Authorization: Bearer …`.
2. Consultar `/api/cloud` y `/api/kronos?symbol=BTCUSDT&market=PERP`. El éxito de un workflow anterior no prueba frescura actual.
3. Si la captura de mercado tiene más de diez minutos o Kronos más de sesenta, buscar sus últimas ejecuciones en GitHub (`GET /repos/bebe2020/bot-nuevo/actions/runs`). Los nombres son «Captura pública de mercado» y «Inferencias públicas Kronos-mini». Si la correspondiente ejecución ya está en curso, no duplicarla. Si no, obtener sus jobs con `github.fetch_workflow_run_jobs` y reejecutar el job `collect` o `infer` con `github.rerun_workflow_job`. Esta ruta de escritura se verificó durante la reparación; conserva el código de esa ejecución. Preferir la ejecución del HEAD actual cuando exista.
4. Hacer POST `/api/background-refresh`, con `X-Bot-Write: 1`, mediante el acceso de servicio. El servidor lee sus propios secretos de FRED/SoSoValue/CoinGecko; ningún secreto va en el prompt ni en GitHub. Actualiza y persiste macro, SoSoValue, fundamentos, DeFi y mercados con una exclusión de ejecución concurrente. Este endpoint no ejecuta PyTorch.
5. Consultar GET `/api/background-status` y leer de nuevo las fechas de `/api/cloud` y Kronos después de completar los jobs. Mantener UNKNOWN/STALE/PARTIAL cuando corresponda; no sustituir fechas de datos por la hora de la tarea. Un reinicio solicitado no equivale a un recálculo terminado.
6. No publicar versiones por una actualización de datos. Conservar las capturas anteriores ante fallos y registrar el resultado. Informar al usuario solo ante un fallo persistente que necesite su intervención; no generar recomendaciones ni informes de trading en estas ejecuciones.

El horario nominal de GitHub no es garantía de cadencia. El trabajo enlazado se usa como comprobación y respaldo horario; los precios con el panel abierto siguen su WS/REST independiente. Una tarea creada acredita programación, no acredita todavía su futura ejecución.
