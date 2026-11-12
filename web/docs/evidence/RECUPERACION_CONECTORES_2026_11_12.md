# Recuperación de conectores y coordinación · bot personal

Repositorio personal: bebe2020/bot-nuevo. Se conserva el comercial separado y sin cambios.

## Defectos comprobados

- La publicación15 tenía cero variables de API en el servidor. No equivalía a que el usuario no tuviera las claves.
- La búsqueda anterior no había abierto los motores comprimidos dentro del comercial. El motor Océano original sí contenía FRED, SoSoValue, CoinGecko y CoinGlass. Se extrajeron por AST y descompresión de literales, sin ejecutar el programa.
- La fuente completa L66 revisada tiene SHA256 `7bc72e6fe65dddd18a037d47a6ed6925a0b03b0edc7e6d12ad2288a4494d4db8`; el motor Océano interno, `103ead40918faf52a34043fb82f6f4a99384bad386aa8959d549991913ef5a4c`.
- Las fuentes se actualizaban con relojes independientes y algunas dependían de abrir su pestaña. El botón de reconectar solo reiniciaba precios.
- El panorama de Océano no reunía los veinte indicadores macro, SoSoValue y las confluencias del activo. Sin tesis, el panel integral descartaba el contexto y volumen que sí existían.

## Corrección

- Cuatro secretos recuperados en el servidor privado, revisión de entorno1. Ningún valor se incorporó al código o a los archivos publicados de GitHub.
- FRED usa ahora su API autenticada con fechas y valores negativos preservados; CoinGecko recibe su encabezado solo en el dominio exacto. SoSoValue usa su clave de servidor existente.
- Un coordinador comparte consultas por recurso/activo/mercado, limita a tres las simultáneas, reintenta errores y actualiza fuentes aun sin abrir sus pestañas. No inicia órdenes.
- Actualizar análisis completo y reconectar coordinan fuentes, precios y escaneo. Una actualización en curso comparte su promesa.
- Océano reúne régimen descriptivo, amplitud reciente, liquidez Fed, dominancia, oro/bonos/dólar/acciones, cobertura FRED20, SoSoValue20 y las mismas confluencias del protocolo para la selección actual.
- Se mantienen los139 elementos identificados de la interfaz publicada11, incluyendo gráficos, indicadores, cuatro radares, cinco laboratorios, controles y diario; no se borraron módulos para esta reparación. Los radares extensos se despliegan a pedido.
- El diagnóstico distingue una clave encontrada de acceso válido. También interpreta errores lógicos dentro de HTTP200.

## Comprobaciones reales del12/11/2026

- FRED: acceso200;19/20 series vigentes, una vencida. Proxy Fed5811,672 mil millones USD a fecha común2026-11-04; no representa M2 global.
- SoSoValue: acceso200/código0;16/20 vigentes, una vencida y tres sin el campo numérico. Se conservaron vacías; no se usó el precio BTC superpuesto como sustituto.
- CoinGecko: endpoint de mercado BTC200 con la clave recuperada.
- CoinGlass: HTTP200 con código lógico401. La clave se encontró pero el acceso es rechazado; no se declara operativo ni se compró otro plan.
- Escaneo del código y build: cero coincidencias con los cuatro valores secretos recuperados.
-180 pruebas Node aprobadas en la candidata, incluidas siete regresiones sobre coordinación, concurrencia, credenciales y contratos de proveedor. Build y validación ESM aprobados.
- QA de navegador: cambio a CPOOL/SPOT/MODERADO/ACUMULACION, coincidencia de la ficha integral entre Océano y Protocolo y navegación directa verificada. La sesión física de Android no se ha comprobado aquí.

## Límites pendientes

La recuperación de APIs no completa por sí sola M2 global, unlocks/emisiones, todos los datos on-chain o validación fuera de muestra. Los cinco laboratorios conservan su alcance real: geometría y trabajos medidos, Kronos ejecutado y simulación; no son cinco agentes de IA autónomos ni un sistema de órdenes reales.

Las quince versiones anteriores del sitio siguen en su historial. Comparar su fuente permite recuperar cambios concretos; no se afirma que toda diferencia visual o funcional histórica haya quedado resuelta.

## Verificación del servidor

La primera publicación de esta reparación, versión16, reveló una incompatibilidad real: Cloudflare Workers no admite `redirect: error`, aunque Node sí lo acepta. Las llamadas autenticadas fallaban antes de enviar una solicitud. Se corrigió a `manual`, conservando el rechazo de redirecciones por estado HTTP y evitando reenviar las claves. Se invalida la caché de diagnóstico producida con el modo anterior. Referencia primaria: https://developers.cloudflare.com/workers/runtime-apis/request/ . La conectividad real requiere nueva comprobación después del despliegue corregido.

La prueba móvil también mostró demoras de interacción: se calculaba en el hilo de interfaz y se repintaban tablas ocultas. El cálculo ahora usa un Web Worker; al cambiar de activo se cancelan sus trabajos anteriores. Se actualiza la vista abierta. La navegación mínima responde antes de terminar de cargar los módulos; el botón de actualización completa se habilita al quedar listo su controlador.

## Cierre verificado en producción

Versión17, desplegada12/11/2026 13:21:55UTC. Fuente Sites `511de7b32fd3d15365718d13602b1426f8751022`; build `aeebacdb857f3cb4daedd47cf6a47ea173501363ec01286f62d471120dd436f6`. Las cuatro rutas verificadas devolvieron HTTP200. El diagnóstico muestra FRED/SoSoValue/CoinGecko OK y CoinGlass AUTH_REQUIRED con código lógico401. FRED19/20 vigentes; SoSoValue16/20 vigentes, TVL vencido y transactions/active/new sin métrica. El servidor usa la revisión1 de secretos.

Prueba Chrome360px: ancho de contenido345 igual al viewport interno345, sin desbordamiento; cinco pestañas de laboratorio visibles al seleccionarlas. Navegación a Terminal durante la actualización completa, con radar26/54 y ficha CPOOL SPOT, sin error de aplicación. Se observaron contexto diario/semanal/mensual y CMF/volumen en el protocolo aun sin tesis.

El fallo de `redirect:error` del despliegue16 se resolvió antes de cerrar. La versión17 usa `manual` y rechaza respuestas3xx; una regresión específica reproduce esa restricción de Workers.180 pruebas aprobadas, build y validación ESM aprobados.
