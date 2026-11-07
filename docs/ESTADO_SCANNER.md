# Estado verificable del scanner

Fecha: 7 de noviembre de 2026. Fuente inicial: rama feat/scanner-snapshots-validos, commit a133267923109cee3d380c2e66ac02b786b77ca5, más código SCANNER PRO v3 suministrado por el usuario en este chat.

- IMPLEMENTADO: núcleo público de snapshots y perfil AGRESIVO versionado; checklist por lado; candidato de zona con ruptura cerrada, causalidad e invalidación; score desglosado y proxies etiquetados.
- VERIFICADO_LOCAL: 30 pruebas unitarias de snapshots, adaptador simulado y perfil; velas abiertas, datos ausentes/vencidos, presión mixta con seis puntos, caso positivo de alineación, simetría long/short, causalidad y no reactivación de evento invalidado.
- PARCIAL: adaptador CCXT sin prueba de contrato en vivo; no está certificado el comportamiento Bitget de una versión CCXT instalada. Sin backtesting ni certificación estadística.
- OBSERVADO_ANDROID: no verificado en este cambio.
- BLOQUEO_REAL para anunciar un servicio operativo: falta validar y conectar una adquisición pública real en el entorno de despliegue. No se requieren claves de trading para esa prueba.

Se conserva la implementación base y se actualiza el mismo PR. El siguiente paso técnico es la prueba de contrato de datos públicos, con errores y timestamps reales, antes de incorporar la salida al coordinador. No se modificó SNIPER, tesis-bot, el bot Telegram ni ninguna cuenta de exchange.
