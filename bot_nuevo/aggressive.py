"""Perfil v3 sobre snapshots públicos. Heurísticas explícitas, sin ejecución."""
from .scanner import Policy, analyze_snapshot, closed_bars, metric


AGGRESSIVE_POLICY = Policy(min_quote_volume=200_000, max_range_pct=5.5)
VERSION = "v3-aggressive-1"
THRESHOLDS = {"volume_ratio": 1.35, "climax_ratio": 2.2, "cmf": .05,
              "book": .15, "proxy_flow_book": .12, "proxy_flow_cmf": .03,
              "zone_volume_ratio": 1.45, "zone_body_fraction": .48,
              "zone_lookback": 25, "structure_lookback": 5,
              "origin_lookback": 3, "checklist_range_pct": 4.2,
              "oscillator_pct": 8, "attention_score": 5.5,
              "high_points": 6, "medium_points": 4}


def order_block_candidates(bars, timeframe_ms):
    """Última vela contraria antes de impulso con ruptura cerrada de 5 velas.

    El volumen del impulso se compara solo con sus veinte velas previas.
    Es una definición heurística local; no certifica un OB institucional/SMC.
    """
    if len(bars) < 30:
        return metric(reason="HISTORIA_INSUFICIENTE")
    candidates = []
    for i in range(max(20, len(bars) - THRESHOLDS["zone_lookback"]), len(bars)):
        ts, op, hi, lo, cl, vol = bars[i]
        baseline = sum(b[5] for b in bars[i-20:i]) / 20
        if (baseline <= 0 or hi == lo or vol / baseline <= THRESHOLDS["zone_volume_ratio"]
                or abs(cl-op) / (hi-lo) <= THRESHOLDS["zone_body_fraction"]):
            continue
        prior = bars[i-THRESHOLDS["structure_lookback"]:i]
        side = ("LONG" if cl > op and cl > max(b[2] for b in prior) else
                "SHORT" if cl < op and cl < min(b[3] for b in prior) else None)
        if side is None:
            continue
        origin = next((b for b in reversed(bars[max(0, i-THRESHOLDS["origin_lookback"]):i])
                       if (b[4] < b[1] if side == "LONG" else b[4] > b[1])), None)
        if origin is None:
            continue
        zone_low, zone_high = origin[3], origin[2]
        invalidated_ms = None
        retested_ms = None
        for later in bars[i+1:]:
            broken = later[3] < zone_low if side == "LONG" else later[2] > zone_high
            if broken:
                invalidated_ms = later[0] + timeframe_ms
                break
            if later[3] <= zone_high and later[2] >= zone_low and retested_ms is None:
                retested_ms = later[0] + timeframe_ms
        candidates.append({"side": side, "zone_low": zone_low, "zone_high": zone_high,
                           "origin_ms": origin[0], "detected_ms": ts + timeframe_ms,
                           "event_id": f"{VERSION}:{side}:{origin[0]}:{ts}",
                           "volume_ratio_at_detection": vol / baseline,
                           "state": "INVALIDATED" if invalidated_ms is not None else
                                    "RETESTED" if retested_ms is not None else "UNTESTED",
                           "retested_ms": retested_ms, "invalidated_ms": invalidated_ms,
                           "invalidation_basis": "MECHA_DE_VELA_CERRADA",
                           "confirmation": "HEURISTIC_CANDIDATE"})
    return metric(candidates, "OK", method="opuesta_3_impulso_BOS5_volumen_previo20")


def directional_proxy(metrics):
    keys = ("book_rank_imbalance", "signed_candle_volume_proxy", "cmf")
    if any(metrics[k]["status"] != "OK" for k in keys):
        return metric(reason="COMPONENTE_AUSENTE_VENCIDO_O_PARCIAL")
    ob, delta, cmf = [metrics[k]["value"] for k in keys]
    ob_limit, cmf_limit = THRESHOLDS["proxy_flow_book"], THRESHOLDS["proxy_flow_cmf"]
    signs = [1 if ob > ob_limit else -1 if ob < -ob_limit else 0,
             1 if delta > 0 else -1 if delta < 0 else 0,
             1 if cmf > cmf_limit else -1 if cmf < -cmf_limit else 0]
    value = ("LONG" if signs == [1, 1, 1] else "SHORT" if signs == [-1, -1, -1]
             else "MIXED" if 1 in signs and -1 in signs else "NEUTRAL")
    return metric(value, "OK", method="proxy: libro visible + color de velas + CMF; no flujo ejecutado")


def _condition(m, predicate):
    if m["status"] != "OK":
        return {"status": "UNKNOWN", "passed": None, "source_status": m["status"], "reason": m.get("reason")}
    passed = bool(predicate(m["value"]))
    return {"status": "PASS" if passed else "CONFLICT", "passed": passed}


def directional_checklist(result, side):
    if side not in {"LONG", "SHORT"}:
        raise ValueError("Lado inválido")
    m = result["metrics"]
    sign = 1 if side == "LONG" else -1
    zone = m["order_block_candidates"]
    flow = m["directional_proxy"]
    items = {
        "volume": _condition(m["volume_ratio"], lambda x: x >= THRESHOLDS["volume_ratio"]),
        "climax": _condition(m["climax"], bool),
        "cmf_aligned": _condition(m["cmf"], lambda x: sign*x >= THRESHOLDS["cmf"]),
        "book_aligned": _condition(m["book_rank_imbalance"], lambda x: sign*x >= THRESHOLDS["book"]),
        "candidate_zone": _condition(zone, lambda xs: any(x["side"] == side and x["state"] != "INVALIDATED" for x in xs)),
        "proxy_aligned": _condition(flow, lambda x: x == side),
        "absorption": {"status": "UNKNOWN", "passed": None, "reason": "REQUIERE_OPERACIONES_EJECUTADAS_Y_SECUENCIA_DE_LIBRO"},
        "range": _condition(m["range_pct"], lambda x: x <= THRESHOLDS["checklist_range_pct"]),
        "oscillator": _condition(m["volume_oscillator_pct"], lambda x: x > THRESHOLDS["oscillator_pct"]),
        "attention": _condition(metric(result["attention_score"], "OK" if result["attention_score"] is not None else "UNKNOWN"), lambda x: x >= THRESHOLDS["attention_score"]),
    }
    points = sum(x["passed"] is True for x in items.values())
    agreement = ("UNKNOWN" if flow["status"] != "OK" else "PASS" if flow["value"] == side else
                 "CONFLICT" if flow["value"] in {"LONG", "SHORT", "MIXED"} else "NOT_APPLICABLE")
    filters = list(result["filters"].values())
    admission = "CONFLICT" if False in filters else "UNKNOWN" if None in filters else "PASS"
    label = ("fuera_de_filtros" if admission == "CONFLICT" else "datos_incompletos" if admission == "UNKNOWN" or agreement == "UNKNOWN"
             else "conflicto_direccional" if agreement == "CONFLICT" else "sin_alineacion" if agreement != "PASS"
             else "alta" if points >= THRESHOLDS["high_points"] else "media" if points >= THRESHOLDS["medium_points"] else "baja")
    return {"side": side, "points": points, "max": 10, "unknown": sum(x["passed"] is None for x in items.values()),
            "items": items, "directional_agreement": agreement, "data_filters": admission,
            "confluence": label, "interpretation": "reglas correlacionadas; no probabilidad ni señal de entrada"}


def analyze_aggressive(symbol, ticker, ohlcv, book, *, now_ms, venue, market, policy=None):
    policy = policy or AGGRESSIVE_POLICY
    result = analyze_snapshot(symbol, ticker, ohlcv, book, now_ms=now_ms, venue=venue, market=market, policy=policy)
    result.update(profile="AGRESIVO", profile_policy_version=VERSION, profile_thresholds=dict(THRESHOLDS))
    m = result["metrics"]
    m["climax"] = metric(m["volume_ratio"]["value"] >= THRESHOLDS["climax_ratio"], "OK") if m["volume_ratio"]["status"] == "OK" else metric(reason="VOLUMEN_NO_VIGENTE", source_status=m["volume_ratio"]["status"])
    keys = ("volume_ratio", "volume_oscillator_pct", "climax", "cmf", "book_rank_imbalance", "range_pct")
    if all(m[k]["status"] == "OK" for k in keys):
        vr, osc, climax, cmf, ob, rg = [m[k]["value"] for k in keys]
        result["attention_contributions"] = {"volume": vr*1.8, "oscillator": abs(osc)*.04,
                                             "climax": 1.8 if climax else 0, "cmf": abs(cmf)*9,
                                             "book": abs(ob)*16, "range": rg*.3}
        result["attention_score"] = sum(result["attention_contributions"].values())
    else:
        result["attention_score"] = None
        result["attention_contributions"] = None
    if m["range_pct"]["status"] == "OK":
        m["order_block_candidates"] = order_block_candidates(closed_bars(ohlcv, policy.timeframe_ms, now_ms), policy.timeframe_ms)
    else:
        m["order_block_candidates"] = metric(reason="SERIE_NO_VIGENTE_O_INVALIDA")
    m["directional_proxy"] = directional_proxy(m)
    m["absorption"] = metric(reason="NO_OBSERVABLE_CON_UNA_FOTO_DOM_Y_OHLCV")
    result["checklists"] = {side: directional_checklist(result, side) for side in ("LONG", "SHORT")}
    return result
