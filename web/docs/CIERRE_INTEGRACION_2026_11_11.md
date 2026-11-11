# Integración de la terminal · 11/11/2026

Alcance: proyecto personal `bebe2020/bot-nuevo`, separado del comercial. Se revisaron main `be7ec7d`, la fuente publicada `eea10a1`, las ramas PR2, PR3, PR4 y PR6, la especificación integral del 09/11, issue 5 y la auditoría del 09/11.

IMPLEMENTADO: consolidar la variante publicada de PR2 con Kronos, cinco laboratorios, indicadores, DeFi, Hyperliquid, on-chain, macro y diario; integrar la corrección de PR6. No sustituir esos módulos por la interfaz simplificada de otra rama. PR3/PR4 permanecen separadas: sus reglas PAPER y explosión requieren validación e integración propia.

IMPLEMENTADO: política `protocolo-2.1`. MODERADO y CONSERVADOR requieren contexto, gatillo cerrado, flujo positivo vigente y geometría válida. AGRESIVO conserva contratendencia y anticipación; no convierte K2 UNKNOWN en confirmación. ULTRAAGRESIVO mantiene la exigencia de L2. Las evaluaciones guardadas y las filas no seleccionadas se revalidan con el reloj actual. Una cotización vencida impide el disparo candidato. No cambia SL/entrada/TP ni el namespace de los eventos previos.

IMPLEMENTADO: frescura por cierre propio de cada temporalidad, semanas UTC de lunes y meses calendario, con hasta diez segundos de gracia al nuevo cierre. Una vela 1H válida a HH:30 no vence por una regla global de dos minutos. CMF cerrado puede aportar evidencia independiente mientras sea válido; DOM/delta vencidos, ausentes, futuros o no numéricos no cuentan. La fase de evento cerrado es distinta de la admisión del perfil.

IMPLEMENTADO: banner permanente de captura de fondo con estado, edad y retraso. El servidor y el cliente recalculan la caducidad sin renovar el timestamp de éxito. Se distingue cotización abierta por WS/REST de captura programada. API health y Conexiones muestran la huella SHA256 de las fuentes compiladas para contrastar versión y despliegue.

IMPLEMENTADO: activar en main el workflow horario Kronos-mini preparado en PR2, con grupo de cómputo distinto de market-feed. Los publicadores rebasan hasta tres veces ante una carrera por la rama market-data, conservando archivos ajenos y sin force. El workflow integrado valida instalación, tests, build y Worker ESM. Son datos públicos, sin claves de exchange ni planes privados.

VERIFICADO_LOCAL: pruebas numéricas/contratos previas y regresiones adicionales de estados, timestamps, temporalidades, fuentes vencidas/futuras, geometría y carreras de publicación. Resultados exactos de build/tests y verificación publicada se registran al cerrar la entrega.

PARCIAL: el cron de GitHub expresa una cadencia objetivo, no garantiza ejecución cada cinco minutos ni cada hora. Se observaron retrasos de varias horas antes de esta corrección. El banner no repara el scheduler externo ni equivale a un colector continuo. Una inferencia Kronos vencida no se presenta como actual; el modelo sigue sin calibración fuera de muestra. Las fuentes macro conservan cobertura parcial. No se certifican ventaja, fills, rentabilidad, identidad de ballenas ni las 60 estrategias históricas.

Siguiente hito: completar macro Océano y matriz de fuentes/frecuencias de la especificación integral, luego integrar las modalidades SPOT/PERP pendientes sobre un único libro PAPER. Ninguna operación real forma parte de esta entrega.
