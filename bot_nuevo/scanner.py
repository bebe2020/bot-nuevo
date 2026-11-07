"""Enriquecer snapshots existentes. Este módulo realiza cero llamadas HTTP."""
from dataclasses import dataclass, asdict
import math


@dataclass(frozen=True)
class Policy:
    timeframe_ms: int = 900_000
    levels: int = 20
    min_quote_volume: float = 300_000
    max_range_pct: float = 4.5
    max_book_age_ms: int = 5_000

    def __post_init__(self):
        if self.timeframe_ms <= 0 or self.levels <= 0 or self.max_book_age_ms < 0:
            raise ValueError("Política temporal/profundidad inválida")
        if not math.isfinite(self.min_quote_volume) or self.min_quote_volume < 0:
            raise ValueError("Umbral de volumen inválido")
        if not math.isfinite(self.max_range_pct) or self.max_range_pct < 0:
            raise ValueError("Umbral de rango inválido")


def number(x):
    try:
        n = float(x)
    except (ValueError, TypeError):
        return None
    return n if math.isfinite(n) else None


def metric(value=None, status="UNKNOWN", reason=None, **meta):
    return {"value": value, "status": status, "reason": reason, **meta}


def closed_bars(raw, timeframe_ms, now_ms):
    bars = []
    for row in raw:
        if len(row) < 6:
            raise ValueError("OHLCV incompleto")
        v = [number(x) for x in row[:6]]
        if any(x is None for x in v):
            raise ValueError("OHLCV no numérico/finito")
        ts, op, hi, lo, cl, vol = v
        if ts < 0 or ts != int(ts) or ts > now_ms or min(op, hi, lo, cl) <= 0 or vol < 0:
            raise ValueError("OHLCV inválido o futuro")
        if not (lo <= min(op, cl) <= max(op, cl) <= hi):
            raise ValueError("Geometría OHLC inválida")
        if ts + timeframe_ms <= now_ms:
            bars.append([int(ts), op, hi, lo, cl, vol])
    bars.sort(key=lambda r: r[0])
    if any(b[0] - a[0] != timeframe_ms for a, b in zip(bars, bars[1:])):
        raise ValueError("Hueco o duplicado en la serie cerrada")
    return bars


def volume_metrics(bars):
    if len(bars) < 30:
        return {name: metric(reason="HISTORIA_INSUFICIENTE") for name in
                ("volume_ratio", "volume_oscillator_pct", "climax", "cmf", "signed_candle_volume_proxy", "range_pct")}
    volumes = [b[5] for b in bars]
    baseline = sum(volumes[-21:-1]) / 20  # veinte velas ANTERIORES al evento
    ratio = volumes[-1] / baseline if baseline > 0 else None
    avg20 = sum(volumes[-20:]) / 20
    oscillator = ((sum(volumes[-5:]) / 5) / avg20 - 1) * 100 if avg20 > 0 else None
    denominator = sum(volumes[-20:])
    numerator = sum((0 if hi == lo else (2 * cl - hi - lo) / (hi - lo)) * vol
                    for _, op, hi, lo, cl, vol in bars[-20:])
    cmf = numerator / denominator if denominator > 0 else None
    delta = sum((1 if b[4] > b[1] else -1 if b[4] < b[1] else 0) * b[5] for b in bars[-10:])
    values = {"volume_ratio": ratio, "volume_oscillator_pct": oscillator,
              "climax": ratio >= 2.5 if ratio is not None else None, "cmf": cmf,
              "signed_candle_volume_proxy": delta,
              "range_pct": (max(b[2] for b in bars[-10:]) - min(b[3] for b in bars[-10:])) / bars[-1][4] * 100}
    return {k: metric(v, "OK" if v is not None else "UNKNOWN",
                      None if v is not None else "VOLUMEN_BASE_CERO") for k, v in values.items()}


def book_metric(book, policy, now_ms):
    ts = number(book.get("timestamp"))
    if ts is None or ts < 0 or ts > now_ms:
        return metric(reason="RELOJ_LIBRO_AUSENTE_O_FUTURO")
    if now_ms - ts > policy.max_book_age_ms:
        return metric(status="STALE", reason="LIBRO_VENCIDO", asof_ms=int(ts))
    sides = []
    for key in ("bids", "asks"):
        levels = book.get(key) or []
        if any(len(x) < 2 or number(x[0]) is None or number(x[1]) is None
               or float(x[0]) <= 0 or float(x[1]) < 0 for x in levels):
            return metric(reason="NIVELES_LIBRO_INVALIDOS")
        sides.append(sorted([(float(x[0]), float(x[1])) for x in levels], reverse=key == "bids")[:policy.levels])
    bids, asks = sides
    if not bids or not asks or bids[0][0] > asks[0][0]:
        return metric(reason="LIBRO_VACIO_O_CRUZADO")
    bw = sum(q / (i + 1) for i, (_, q) in enumerate(bids))
    aw = sum(q / (i + 1) for i, (_, q) in enumerate(asks))
    if bw + aw <= 0:
        return metric(reason="LIBRO_SIN_CANTIDAD")
    status = "OK" if min(len(bids), len(asks)) >= policy.levels else "PARTIAL"
    return metric((bw - aw) / (bw + aw), status,
                  None if status == "OK" else "PROFUNDIDAD_PARCIAL",
                  asof_ms=int(ts), observed_levels=[len(bids), len(asks)],
                  spread_pct=(asks[0][0] / bids[0][0] - 1) * 100,
                  method="cantidades visibles ponderadas por rango 1/(i+1); una foto, no OFI ni persistencia")


def analyze_snapshot(symbol, ticker, ohlcv, book, *, now_ms, venue, market, policy=None):
    policy = policy or Policy()
    result = {"symbol": symbol, "venue": venue, "market": market, "evaluated_ms": now_ms,
              "policy": asdict(policy), "execution": "NOT_SUPPORTED", "http_requests": 0}
    try:
        bars = closed_bars(ohlcv, policy.timeframe_ms, now_ms)
        values = volume_metrics(bars)
        if bars:
            result["ohlcv_closed_asof_ms"] = bars[-1][0] + policy.timeframe_ms
            expected = now_ms // policy.timeframe_ms * policy.timeframe_ms
            if result["ohlcv_closed_asof_ms"] < expected:
                values = {k: metric(v["value"], "STALE", "SERIE_VENCIDA") for k, v in values.items()}
    except (ValueError, TypeError) as e:
        result["data_error"] = str(e)
        values = volume_metrics([])
    values["book_rank_imbalance"] = book_metric(book, policy, now_ms)
    quote_volume = number(ticker.get("quoteVolume"))
    if quote_volume is not None and quote_volume < 0:
        quote_volume = None
    values["quote_volume_24h"] = metric(quote_volume, "OK" if quote_volume is not None and quote_volume >= 0 else "UNKNOWN")
    volume_ok = None if quote_volume is None else quote_volume >= policy.min_quote_volume
    range_value = values["range_pct"]
    range_ok = range_value["value"] <= policy.max_range_pct if range_value["status"] == "OK" else None
    result["filters"] = {"quote_volume": volume_ok, "range": range_ok}
    required = [values[k] for k in ("volume_ratio", "volume_oscillator_pct", "climax", "cmf", "range_pct", "book_rank_imbalance")]
    if all(v["status"] == "OK" for v in required):
        vr, vo, climax, cmf, rg, ob = [v["value"] for v in required]
        result["attention_score"] = vr * 2 + abs(vo) * .03 + (1.5 if climax else 0) + abs(cmf) * 8 + abs(ob) * 12 + rg * .4
    else:
        result["attention_score"] = None
    result["direction_components"] = {k: values[k] for k in ("cmf", "signed_candle_volume_proxy", "book_rank_imbalance")}
    result["metrics"] = values
    result["signal"] = "NO_TRADE_SIGNAL"  # magnitud/actividad no es dirección ni gatillo
    return result
