# Estado actual · bot personal

Fuente canónica: bebe2020/bot-nuevo, rama main. Sitio privado: https://bot-nuevo-liquidez.stablepiece.chatgpt.site · versión17.

Última reparación: [Recuperación de conectores y coordinación](evidence/RECUPERACION_CONECTORES_2026_11_12.md).

Entrega anterior: [Fundamentos públicos](evidence/FUNDAMENTALES_2026_11_12.md). Antecedente: [Protocolo, macro y PAPER](evidence/ENTREGA_FUNCIONAL_2026_11_12.md).

Implementado y verificado: protocolo2.2 con micro PERP y modos SPOT; macro20 series FRED; confluencias separadas; PAPER único; cinco laboratorios; fundamentos14 campos×54 con observaciones parciales, identidades y relojes. 180 pruebas Node y build válidos; revisión móvil360px en Chrome. La observación física de Samsung sigue pendiente.

No confundir cobertura con confirmación: K4 fundamental sigue parcial, sin valoración automática ni rentabilidad certificada. SoSoValue tiene acceso verificado con su clave recuperada; M2 global sigue pendiente. El código no envía órdenes reales ni lee una cuenta privada de exchange.

Siguiente trabajo: completar los insumos pendientes de K4 y fuentes de liquidez/flujo; terminar la matriz trimestral/ciclo; evaluar reglas y Kronos fuera de muestra. Antes de editar, leer la entrega más reciente y HEAD; no reconstruir desde un chat ni reutilizar el comercial como si fuera este bot.

Verificado en producción12/11/2026 13:22UTC: FRED19/20 vigentes mediante API autenticada; SoSoValue16/20 vigentes, una vencida y tres ausentes; CoinGecko acceso válido; CoinGlass clave recuperada pero código401. Los secretos permanecen en el servidor privado.

La interfaz conserva los139 elementos identificados en la fuente11; coordina consultas automáticas y navegación inicial. El cálculo OHLCV corre en Web Worker, con cancelación de selecciones anteriores; se repinta la vista activa. La prueba Chrome360px permitió navegar durante un escaneo en curso. No certifica la observación física de Android.
