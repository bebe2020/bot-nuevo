# Aceptación de cierre v1 · 20 puntos

Esta versión es independiente de SNIPER/L65. Un estado local, una observación en navegador y una prueba contra un proveedor en vivo son evidencias distintas. Los puntos ausentes no suman un porcentaje de acierto.

| ID | Capacidad | Criterio y límite |
|---|---|---|
| 01 | Datos y relojes | Rechazar NaN, geometría inválida, huecos y duplicados; conservar recepción/asof; no reetiquetar una captura vieja. |
| 02 | Instrumentos | Bitget USDT Futures y diez símbolos explícitos; metadatos públicos no prueban tarifas, margen o saldo personal. |
| 03 | Fractales F1/F2/F3 | Tres escalas según horizonte, con historia y cierres reales. |
| 04 | BOS/CHOCH | Ruptura de cierre contra pivotes confirmados; cambio de carácter es heurístico, no identidad institucional. |
| 05 | Liquidity hunter | Barrido de extremo previo con reclaim; pool estimado de precio, sin afirmar stops observados. |
| 06 | Oferta/demanda / OB | Zona candidata de vela opuesta, impulso y ruptura. Se conserva invalidación; no se llama OB canónico de SNIPER. |
| 07 | FVG | Gap de tres velas y estado mitigado en la serie cerrada disponible. |
| 08 | Dip/rally | Contexto LONG/SHORT visible; anticipación contratendencia separada de alineación. Sin señal obligatoria. |
| 09 | Volumen | Ratio sobre veinte velas previas, oscillator, CMF y proxy firmado; paridad con Python. |
| 10 | DOM | Spread, veinte niveles, imbalance de cantidades visibles; vencimiento a cinco segundos. No OFI ni absorción. |
| 11 | Trades | Delta nocional sobre muestra deduplicada con ventana real; no se llama CVD completo. |
| 12 | Funding | Tasa decimal, signo por lado, intervalo y próximo evento cuando existen; desconocido sin tasa. |
| 13 | OI | Snapshot y cambio con tiempo realmente transcurrido entre observaciones; no llamar 15m a 60s. |
| 14 | Perfiles | Datos compartidos, dos checklist direccionales. Moderado inicial propuesto; ultra sin L2 permanece no admitido. |
| 15 | Gestión | Entrada/SL y hasta tres TP estructurales; cálculo neto por cantidad y costes explícitos. Sin ejecutar órdenes ni inventar liquidación. |
| 16 | Horizontes | Scalp, diario, semanal, mensual, trimestre calendario y contexto de 36 meses; menos historia queda sin confirmar. |
| 17 | Ballenas | Prints grandes observados; identidad y cobertura global UNKNOWN. Necesita fuente on-chain/wallets para ampliación. |
| 18 | Macro | Breadth 24h de la muestra y proxy USD FRED con unidades y fecha. Liquidez global y token supply completos no observados. |
| 19 | Memoria | Capturas y planes JSON en almacenamiento durable, escritor con lease y deduplicación por minuto; captura bajo demanda. |
| 20 | Validación | Tests sintéticos, paridad, errores de feed, concurrencia, persistencia y caducidad. Navegador/proveedor requieren evidencia adicional. No certifica ventaja o rentabilidad. |

## Verificado localmente en este cambio

37 pruebas de Node aprobadas, más validación del artefacto ESM. Incluyen lectura pública simulada de 33 requests base de mercado por adquisición, hasta cuatro páginas históricas adicionales y tres fuentes macro, cuatro perfiles, dos llamadas concurrentes, lectura posterior de historial y registro de un plan sin fill.

## Pendiente de observación

Prueba en navegador de las cinco vistas a ancho móvil y lectura del historial después de recargar. El proveedor Bitget respondió desde el entorno de pruebas; desde el hosting devolvió HTTP 403 y FRED HTTP 520. El colector se ejecuta en el navegador y el servidor recalcula/guarda las capturas recibidas. Esta sección debe actualizarse con el resultado real; no cambiarla a aprobado solo porque exista una URL.

## Observación en navegador y proveedor

En Chrome se observaron las cuatro políticas, el horizonte trimestral con F1/F2/F3, gráfico de velas, una adquisición pública desde el navegador y la ficha de costes. La calculadora dio 20,38 de pérdida al stop y 39,56 netos para la alternativa a tercios en el fixture 100/90/110/120/130, cantidad 2 y comisiones 0,1% por lado; no se guardó ese caso como operación. Datos de mercado reales de BTC verificados en el entorno: 270 días, 39 semanas, 88 meses y DOM válido. Los resultados son observaciones de ese momento, no coberturas futuras garantizadas.

El hosting rechaza Bitget con HTTP 403. Por eso la versión publicada recibe capturas desde el navegador, recalcula y persiste; no anuncia un servicio de captura cerrado/24x7. FRED respondió HTTP 520 desde el hosting; liquidez USD/global queda sin observación válida.

Se observó la interfaz en un iframe de 360 px (contenido útil 345 px, scrollWidth=clientWidth, sin desbordamiento horizontal). Cinco vistas accesibles, cambio de perfiles, gráfico trimestral y calculadora probados. Esta prueba de viewport en Chrome no certifica hardware Android.
