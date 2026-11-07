"""Adaptador de lectura CCXT opcional; nunca consulta cuentas ni crea órdenes."""
from .scanner import Policy, analyze_snapshot
from .aggressive import AGGRESSIVE_POLICY, analyze_aggressive


def collect_public(exchange, symbols, *, timeframe="15m", policy=None, profile="BASE"):
    """Una tanda; cliente CCXT sin claves. Reutilizar analyze_snapshot si ya hay caché."""
    if any(getattr(exchange, name, None) for name in ("apiKey", "secret", "password")):
        raise ValueError("Este adaptador solo admite un cliente público sin claves")
    if profile not in {"BASE", "AGRESIVO"}:
        raise ValueError("Perfil no implementado")
    policy = policy or (AGGRESSIVE_POLICY if profile == "AGRESIVO" else Policy())
    analyze = analyze_aggressive if profile == "AGRESIVO" else analyze_snapshot
    durations = {"m": 60_000, "h": 3_600_000, "d": 86_400_000, "w": 604_800_000}
    if (len(timeframe) < 2 or not timeframe[:-1].isdigit() or timeframe[-1] not in durations
            or int(timeframe[:-1]) * durations[timeframe[-1]] != policy.timeframe_ms):
        raise ValueError("Timeframe y política de cierre deben coincidir")
    symbols = list(dict.fromkeys(symbols))
    exchange.load_markets()
    tickers = None
    bulk_error = None
    if exchange.has.get("fetchTickers"):
        try:
            tickers = exchange.fetch_tickers(symbols)
        except Exception as exc:
            bulk_error = type(exc).__name__
            tickers = {}  # no repetir una petición fallida por cada perfil
    results = []
    for symbol in symbols:
        try:
            market = exchange.market(symbol)
            if not market.get("swap") or not market.get("linear") or market.get("quote") != "USDT":
                raise ValueError("Requiere perpetuo lineal USDT inequívoco")
            ticker = tickers.get(symbol, {}) if tickers is not None else exchange.fetch_ticker(symbol)
            bars = exchange.fetch_ohlcv(symbol, timeframe, limit=60)
            # Bitget expone profundidades discretas: pedir 50 y analizar las 20 primeras.
            book = exchange.fetch_order_book(symbol, limit=50)
            result = analyze(symbol, ticker, bars, book, now_ms=exchange.milliseconds(),
                                      venue=exchange.id, market="linear_swap_USDT", policy=policy)
            result.pop("http_requests", None)  # el análisis es local; este adaptador sí adquirió datos
            result["acquisition"] = {"bulk_ticker_error": bulk_error, "orderbook_limit_requested": 50}
        except Exception as exc:
            result = {"symbol": symbol, "venue": exchange.id, "status": "UNKNOWN",
                      "reason": type(exc).__name__, "signal": "NO_TRADE_SIGNAL"}
        results.append(result)
    return results  # no perder el resto de monedas por TOP_N=6
