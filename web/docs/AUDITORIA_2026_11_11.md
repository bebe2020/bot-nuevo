# Auditoría y correcciones · bot-nuevo · 11/11/2026

Proyecto personal `bebe2020/bot-nuevo`. Este trabajo no modifica los motores del proyecto comercial SNIPER. Contraste con el documento de requisitos del 9 de noviembre y con las tandas de capturas de este chat. Fecha de cierre de evidencias: 11/11/2026, aproximadamente 13:35 Argentina.

## Fallos corregidos

1. MODERADO admitía `CONFIRMADA` con flujo `UNKNOWN`. Ahora MODERADO y CONSERVADOR requieren contexto a favor, gatillo cerrado, flujo positivo observado, precio reciente y geometría completa. AGRESIVO conserva contratendencia explícita, pero tampoco confirma flujo desconocido.
2. Se revalidan las evidencias de fichas cacheadas: un tick nuevo no rejuvenece CMF, libro, trades ni estructura antiguos. Se comprueban símbolo y mercado. Libro: 5 segundos; muestra de trades: 60 segundos; velas/contexto: cierres alineados de cada temporalidad, con hasta diez segundos de gracia al nuevo cierre. Se conservó la política protocolo-2.1 de la versión concurrente, con namespace de eventos 2.0. La invalidación y caducidad conservan prioridad.
3. La geometría requiere entrada/stop positivos, tick conocido y tres objetivos ordenados del lado correcto. Los objetivos provienen de las temporalidades de ese horizonte; un plan diario no incorpora un pivote mensual solo por estar cerca.
4. Una tarea antigua que termina después de iniciar otra con el mismo identificador ya no marca finalizada la ejecución nueva. Los errores de acceso/configuración de proveedores tampoco se muestran como una conexión operativa.
5. SoSoValue se incorpora con conector exclusivamente servidor, cobertura de 20 series y UI. Sin `SOSOVALUE_API_KEY`, devuelve `CONFIG_REQUIRED`, valores nulos y 0/20; no hay clave configurada en el sitio en esta revisión.

Las reglas siguen siendo una implementación propia explícita. No equivalen a haber importado íntegramente el protocolo del motor comercial. Tampoco son rentabilidad, probabilidad ni fill certificados.

## Automatización: configuración frente a ejecución observada

PR #2 fusionado por autorización del usuario: `3d679c7419d6f1be6315193746dd7f0e94b0240d`. Conserva los documentos y el CLI de Python que ya estaban en main.

- Kronos: cron horario al minuto 17 UTC. Primera ejecución tras el merge: https://github.com/bebe2020/bot-nuevo/actions/runs/43058496795 . Conclusión `success`, incluida publicación. Generación agregada 11/11/2026 16:29:50 UTC / 13:29:50 Argentina. 54 instrumentos únicos, motor `PYTORCH_REAL_CPU`; publicación de datos `94bc0190a6c1a8e8d84516f34807c7e0dc5c5fe4`. 128 velas cerradas de entrada, 16 pasos de 15 minutos y 3 trayectorias. No es intervalo de confianza calibrado.
- Feed: https://github.com/bebe2020/bot-nuevo/actions/runs/43058496515 . Publicó captura nueva válida, `accountData:false`, alrededor de 13:28 Argentina.
- Se revisaron 34 ejecuciones devueltas por GitHub desde 09/11 16:00 UTC: 16 fallidas antiguas de la verificación SPOT/PERP, luego 9 verificaciones correctas, 8 capturas correctas y 1 Kronos correcto. Las fallidas pertenecen a commits anteriores; no a esta versión final.
- De las capturas, solo 7 fueron disparadas por horario. El mayor hueco entre inicios programados observados fue **7 h 57 min 43 s**. Aunque el workflow declara cada 5 minutos, esta evidencia NO acredita vigilancia continua ni recuperación completa de extremos intradía. Un websocket abierto tampoco la acredita.
- Pendiente operacional: un colector persistente con supervisión y alertas de huecos si se exige captura continua. No se presenta GitHub Actions como SLA de cinco minutos. Los estados viejos se degradan y conservan sus relojes.

## Revisión del chat recuperado de Grok

Documento leído: https://docs.google.com/document/d/18klDPxR7QRZsk1JzOxipthPF8VTE-Ro6_aIFGCoc9WA . Se revisaron las versiones de Python contenidas en el documento, sin ejecutar ese código ni modificar el original.

| Hallazgo | Decisión |
| --- | --- |
| Declara 54 pero lista 29 símbolos y cambia parte del universo | Conservar el catálogo canónico de este proyecto |
| OI devuelve el nivel junto con cambio `None` | No presentarlo como variación medida |
| La «EMA» de contexto es una media simple | Mantener cálculo EMA real |
| Velas en curso y CMF sin cobertura convertido a cero | Usar cierres y conservar UNKNOWN |
| Delta por signo de vela y detección simplificada de OB | Exponer como proxy, sin llamarlo CVD de agresores o SMC íntegro |
| Cuenta descartes normales como errores y corta tras 8 | No copiar ese cortacircuito; una moneda descartada no impide analizar las restantes |
| Confianza arbitraria, apalancamiento fijo, beneficios sin validación | No convertirlos en probabilidades ni órdenes |
| Bucle, JSON, funding, DOM ponderado, CMF y varios marcos | Ya cubiertos en buena parte por módulos existentes |

Ideas útiles todavía incompletas: variación de OI por intervalos medidos para todo el universo; prima entre mercados y fuerza relativa contra BTC con timestamps/ventanas/unidades sincronizados. El activo focal ya calcula diferencia de OI entre observaciones; no hay serie homogénea de ese cambio para las 54.

## Los cinco módulos: alcance real y faltantes

| Captura solicitada | Disponible | Pendiente |
| --- | --- | --- |
| Robot de trading con IA | Consola 3D, estados de fuentes/reglas, correlaciones y enlace a inferencia Kronos real | Agente de decisión LLM y evaluación de resultados; no inventar llamadas a Claude/GPT |
| Pulpo 3D | Ocho brazos procedurales articulados; rotar/arrastrar, separar piezas y abrir nodos de datos | No es reconstrucción fiel del modelo industrial de la captura; no tiene simulación física validada |
| Predictor Kronos | Inferencia real de Kronos-mini para 54, ya con primera ejecución horaria publicada | Backtest fuera de muestra, calibración y vigilancia de futuras ejecuciones; un éxito no prueba continuidad |
| Sistema automatizado | Scanner 54, fichas por mercado/horizonte y simulador local explícito | Ejecución desatendida y conciliación de órdenes/fills no implementadas; ninguna orden real enviada |
| Equipo de agentes | Monitor de trabajos reales HTTP/RPC/reglas con duración y registro | Orquestación de agentes de IA autónomos no implementada |

Otros pendientes de la especificación integral: matriz completa corto/medio/largo para cada horizonte y perfil; trimestre/ciclo con protocolo de entrada ejecutable (hoy son radares estructurales); L2 continuo para ULTRAAGRESIVO; mapa completo de liquidaciones verificadas; backtesting neto con comisiones, slippage y funding; cobertura on-chain comparable de las 54. La acumulación/distribución actual es un proxy OHLCV con evidencias, no identidad institucional.

## SoSoValue: qué significa «20» en esta entrega

La documentación oficial expone más gráficos; no se encontró un paquete oficial único denominado «los 20 indicadores». Se seleccionan 20 series concretas, documentadas abajo. Son fundamentos/estado agregado cripto y BTC; no sustituyen la macro mundial de acciones, bonos, divisas y materias primas.

- Base API: https://openapi.sosovalue.com/openapi/v1 . La clave se configura en runtime como `SOSOVALUE_API_KEY`, nunca en navegador, Git, URL ni manifiesto. Acceso del proveedor: https://sosovalue.com/developer/dashboard . No enviar claves por chat.
- Fuente del contrato: https://sosovalue-1.gitbook.io/sosovalue-api-doc/9.-analysis-charts/list y `/chart-data`.
- 18 solicitudes agrupadas por tanda para 20 métricas; caché compartida de 30 minutos y lease para evitar tandas duplicadas. 401/403/429 detienen las restantes. No se intenta eludir límites.
- Selección de la última fila que contiene la métrica y fecha válida; claves literales, incluidas puntuaciones. No se usa el precio overlay ni se rellenan ausentes con cero. Cero publicado sí se conserva.
- Funding/staking se convierten de fracción a porcentaje una vez. Cada serie conserva su reloj; días sin negociación no se crean como flujos cero. ETF admite una antigüedad visible de hasta cinco días por cierres/fin de semana; no equivale a dato de hoy.
- Verificación con contratos sintéticos y endpoint sin clave. **No se verificó una respuesta autenticada de SoSoValue en producción**, porque no hay clave.

| # | Serie | Gráfico y clave | Unidad |
| --- | --- | --- | --- |
| 1 | Capitalización cripto | total_crypto_market_cap / total_crypto_market_cap | USD |
| 2 | Capitalización altcoins | altcoin_market_cap_volume / altcoin_market_cap | USD |
| 3 | Miedo y codicia cripto | fgi_indicator / crypto_fear_&_greed_index | 0–100 |
| 4 | Valoración BTC · AHR999 | ahr_999_indicator / ahr999 | ratio |
| 5 | Interés abierto BTC · total | futures_open_interest / all | USD |
| 6 | Interés abierto BTC · CME | futures_open_interest / cme | USD |
| 7 | Funding BTC · Bybit | funding_rate / bybit | % |
| 8 | Long/short BTC · Binance 4h | binance_btcusdt_futures_long_short_ratio_4h / long/short_ratio | ratio |
| 9 | Hashrate BTC | btc_hashrate / btc_hashrate | unidad del proveedor |
| 10 | Dificultad de minería BTC | btc_mining_difficulty / btc_mining_difficulty | dificultad |
| 11 | Transacciones BTC | btc_transactions / number_of_transactions | transacciones |
| 12 | Direcciones activas BTC | btc_active_addresses / number_of_active_addresses | direcciones |
| 13 | Direcciones nuevas BTC | btc_new_addresses / number_of_new_addresses | direcciones |
| 14 | Capitalización stablecoins | stablecoin_total_market_cap / mcap | USD |
| 15 | Flujo neto stablecoins fiat | fiat_backed_stablecoins_usd_pegged_mcap_net_inflows / fiat_backed_stablecoins_net_inflows | USD |
| 16 | Porcentaje de ETH en staking | eth_staking_ratio / staking | % |
| 17 | Entradas USD al mercado cripto | usd_inflows_into_cryptocurrency_markets / daily_net_inflows | USD |
| 18 | TVL agregado por tipos de red | tvl_of_different_type_of_chain / all | USD |
| 19 | Flujo diario ETF BTC · EE.UU. | total_crypto_spot_btc_eth_etf_fund_flow_1d / bitcoin_daily_total_net_inflow | USD |
| 20 | Flujo diario ETF ETH · EE.UU. | total_crypto_spot_btc_eth_etf_fund_flow_1d / ethereum_daily_total_net_inflow | USD |

## Macro y capitales todavía incompletos

Hay referencias para oro, TLT/IEF, DXY, SP500, BTC; rendimientos nominales 2/10/30 años, M2 estadounidense, proxy Fed y stablecoins globales. No basta para inferir «adónde rota todo el capital». Faltan integración y fechas homogéneas de Nasdaq/QQQ, VIX, EURUSD, petróleo, tipos reales/TIPS, NFCI/crédito HY, global M2 convertido a USD, TOTAL2/TOTAL3/BTC.D, SSR, releases macro estructurados y supply/unlocks/fees por activo. TVL o retorno relativo no son un flujo neto intermercado.

## Validación de esta revisión

137 pruebas Node aprobadas (103 previas, 12 de admisión/cache/target/tareas, 13 de la integración concurrente de frescura y publicación, y 9 del conector SoSoValue). Build ESM y validación del artefacto correctos. Navegador Chrome: 20 tarjetas y aviso de configuración visibles; marco de 360px con ancho útil de 345px y scrollWidth de 345px, sin desborde del documento. No es una prueba en el Android físico. Solo se consultan endpoints públicos de mercado en producción; historial y planes privados no se inspeccionan.

## Conciliación de edición concurrente

Antes de publicar avanzó la fuente nativa a `3b0e7907d390d30dac214dca16be2dec983234f3` (versión 10). Se fusionó su control de cierres calendario, banner de frescura, hash de build y reintentos de publicación con SoSoValue, aislamiento de objetivos por horizonte y control de tareas de esta revisión. No se forzó ni sobrescribió el historial.
