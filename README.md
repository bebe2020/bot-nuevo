# Bot Nuevo · Terminal 54

Aplicación activa en `web/`: terminal personal de liquidez con universo canónico de 54 activos, precios WebSocket, gráfico TradingView Lightweight Charts, EMA/RSI/volumen/Fibonacci, descubrimiento/mapa de calor, cuatro radares SPOT/PERP, narrativas, anticipadas, disparos candidatos y protocolo K1–K4.

[Ver el tablero privado](https://bot-nuevo-liquidez.stablepiece.chatgpt.site/) · [Arquitectura y límites](web/README.md) · [Aceptación](web/docs/ACEPTACION_54.md)

El scanner Python original de este repositorio se conserva como referencia. No es el servidor del tablero ni el SNIPER L65. El motor web actual tiene código único por responsabilidad y un contrato común; no usa monkey patches ni wrappers por versión.

Datos públicos Bitget y caché por mercado/símbolo/TF. El catálogo decide disponibilidad actual; 54 activos del universo no implica que Bitget tenga 54 pares SPOT y 54 PERP. La primera lectura real observó 51 contratos PERP. No se sustituye un mercado con otro.

GitHub Actions conserva datos públicos en la rama `market-data` con objetivo de cinco minutos, sujeto a demoras de GitHub. El navegador recibe los precios en vivo y dibuja/analiza sin llamar a modelos de IA. No se publican cuentas, claves ni planes privados en esta rama.

No envía órdenes ni certifica rentabilidad. Faltan la portabilidad/validación de las 60 estrategias del programa antiguo, L2 continuo, homónimos por contrato y fuentes globales de flujos/ballenas/supply/noticias. Véase el alcance explícito en la documentación.
