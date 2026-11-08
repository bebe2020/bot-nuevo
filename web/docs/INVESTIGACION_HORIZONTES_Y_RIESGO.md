# Marco de investigación y criterios de integración — 2026-11-08

## Contratos confirmados por el usuario
- SPOT y PERP: SEMANAL, MENSUAL, TRIMESTRAL y CICLO_3_ANOS (36 meses).
- EXPLOSION_SPOT: 1, 4, 14, 24, 36 horas, independiente del MICROPIVOTE.
- MICROPIVOTE: scalping PERP 1m/5m/15m, x10/x20/x30/x50 **solo laboratorio**, sin ejecución real.
- Diario PAPER para SPOT LONG y PERP LONG/SHORT. Beneficio neto simulado objetivo +4.000 USDT; no promesa de alcanzarlo.

## Fundamentos y límites de extrapolación
1. Moskowitz, Ooi & Pedersen (2012), *Time Series Momentum*, Journal of Financial Economics, DOI 10.1016/j.jfineco.2011.11.003. Estudia 58 instrumentos líquidos de futuros tradicionales; evidencia de momentum a 1–12 meses. **No demuestra** rentabilidad en microcaps cripto ni scalping x50.
2. Kim, Tse & Wald (2016), *Time Series Momentum and Volatility Scaling*, Financial Markets and Portfolio Management, DOI 10.1016/j.finmar.2016.05.003. La escala por volatilidad explica parte del alpha atribuido a momentum. Incluir comparador sin y con volatility targeting.
3. *Cryptocurrency factor momentum* (2023), Quantitative Finance, DOI 10.1080/14697688.2023.2269999. Estudia más de 3.900 monedas, tamaño y volatilidad importan. No usar beta sola para elegir oportunidades.
4. Li, Shin & Wang (2025), *Cryptocurrency Pump-and-Dump Schemes*, Journal of Financial and Quantitative Analysis, DOI 10.1017/S0022109025000201. Los pumps coordinados pueden revertir rápidamente y perjudicar a terceros. Radar defensivo: detectar manipulación, bloquear activos con alertas de integridad; no facilitar coordinación de pumps.
5. Bitget, *Futures — Leverage and Risk Management*: https://www.bitget.com/support/articles/360058821652. Liquidación depende de mark price, mantenimiento y riesgo de la posición.

## Puertas de producción
- Fuente SPOT verificable para cada símbolo; ticker, profundidad, volumen, capitalización, FDV, desbloqueos y hora. Sin evidencia: UNKNOWN, nunca confirmar explosión.
- Datos PERP independientes; historial suficiente para 36 meses (no inventar historia de tokens jóvenes).
- Comparar precios de señal vs fill simulado por regla determinista sin lookahead, usando bid/ask o barras de menor temporalidad. Si stop y TP se tocan en la misma barra, aplicar peor caso o estado AMBIGUOUS.
- No asumir que x50 tiene stop ejecutable; calcular riesgo de liquidación con mark price, maintenance tier, costes y latencia. Sin fuente: solo laboratorio.
- Probar estrategia con walk-forward, separación train/test, costes realistas, sesgo de supervivencia, purged cross-validation y comparación con buy-and-hold/volatility targeting.
- Integrar a interfaz y R2 solo tras tests y revisión; mantener realMoneyUsd=0 y prohibir API privada de órdenes.
- Conservar 54 símbolos del universo original, no cambiar su lista por las monedas preferidas. Cobertura explícita de SPOT/PERP y de disponibilidad histórica.
