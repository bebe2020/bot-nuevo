# Estado vigente

El cierre funcional v1 está documentado en `web/docs/ACEPTACION_20.md` y `web/README.md`. La implementación activa del tablero está en `web/worker/`; el núcleo Python se conserva como referencia/adaptador opcional. No confundir su prueba local con una prueba CCXT en vivo.

IMPLEMENTADO / VERIFICADO_LOCAL: versión web, cuatro políticas sobre datos compartidos, historial, riesgo y cobertura; 37 pruebas Node y validación ESM. OBSERVADO_NAVEGADOR: adquisición REST real, perfiles, fractales, calculadora y viewport móvil sin desbordamiento horizontal.

PARCIAL: L2 continuo, identidades de ballenas, liquidez global y supply completo; estadística de rentabilidad no certificada. BLOQUEO_REAL de fetch desde hosting: Bitget HTTP 403 y FRED HTTP 520. La captura Bitget se realiza desde el navegador y el servidor valida y persiste. No hay captura 24/7 con navegador cerrado ni órdenes reales.
