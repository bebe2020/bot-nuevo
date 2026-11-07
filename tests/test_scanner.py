import copy
import unittest
from bot_nuevo.scanner import Policy, analyze_snapshot
from bot_nuevo.reader import collect_public


TF = 900_000
NOW = 30 * TF + 1_000


def candles():
    return [[i * TF, 10, 12, 8, 11, 10] for i in range(30)]


def book():
    return {"timestamp": NOW, "bids": [[9.9, 2], [9.8, 1]], "asks": [[10.1, 2], [10.2, 1]]}


def analyze(bars=None, ob=None, ticker=None):
    return analyze_snapshot("X/USDT:USDT", ticker if ticker is not None else {"quoteVolume": 500_000},
                            candles() if bars is None else bars, book() if ob is None else ob,
                            now_ms=NOW, venue="fixture", market="linear_swap_USDT", policy=Policy(levels=2))


class ScannerTests(unittest.TestCase):
    def test_open_candle_does_not_change_closed_volume(self):
        a = analyze()
        bars = candles() + [[30 * TF, 10, 12, 8, 11, 1_000_000]]
        self.assertEqual(a["metrics"], analyze(bars)["metrics"])

    def test_event_volume_excluded_from_baseline(self):
        bars = candles(); bars[-1][5] = 100
        self.assertEqual(analyze(bars)["metrics"]["volume_ratio"]["value"], 10)

    def test_flat_candle_keeps_volume_in_cmf_denominator(self):
        bars = candles(); bars[-1] = [29 * TF, 10, 10, 10, 10, 100]
        self.assertAlmostEqual(analyze(bars)["metrics"]["cmf"]["value"], 95 / 290)

    def test_missing_history_is_unknown(self):
        self.assertIsNone(analyze(candles()[:10])["metrics"]["cmf"]["value"])

    def test_missing_quote_volume_is_not_zero(self):
        result = analyze(ticker={})
        self.assertIsNone(result["filters"]["quote_volume"])
        self.assertEqual(result["metrics"]["quote_volume_24h"]["status"], "UNKNOWN")

    def test_zero_volume_does_not_invent_pressure(self):
        bars = candles()
        for b in bars: b[5] = 0
        self.assertIsNone(analyze(bars)["metrics"]["cmf"]["value"])

    def test_stale_book_not_admitted_to_attention_score(self):
        ob = book(); ob["timestamp"] -= 6_000
        result = analyze(ob=ob)
        self.assertEqual(result["metrics"]["book_rank_imbalance"]["status"], "STALE")
        self.assertIsNone(result["attention_score"])

    def test_partial_depth_is_labeled(self):
        ob = book(); ob["asks"] = ob["asks"][:1]
        self.assertEqual(analyze(ob=ob)["metrics"]["book_rank_imbalance"]["status"], "PARTIAL")

    def test_bearish_magnitude_is_not_buy(self):
        bars = candles()
        for b in bars: b[4] = 9
        ob = book(); ob["asks"] = [[10.1, 20], [10.2, 10]]
        result = analyze(bars, ob)
        self.assertLess(result["metrics"]["cmf"]["value"], 0)
        self.assertLess(result["metrics"]["book_rank_imbalance"]["value"], 0)
        self.assertGreater(result["attention_score"], 0)
        self.assertEqual(result["signal"], "NO_TRADE_SIGNAL")

    def test_gap_duplicate_and_nan_are_rejected(self):
        for modification in ("gap", "duplicate", "nan"):
            bars = candles()
            if modification == "gap": del bars[12]
            elif modification == "duplicate": bars.append(copy.deepcopy(bars[12]))
            else: bars[10][5] = float("nan")
            self.assertIn("data_error", analyze(bars))

    def test_adapter_rejects_timeframe_mismatch_before_http(self):
        with self.assertRaises(ValueError):
            collect_public(object(), [], timeframe="1h")

    def test_adapter_deduplicates_symbols_and_retains_failures(self):
        class Exchange:
            id = "fixture"; has = {"fetchTickers": True}
            def __init__(self): self.calls = []
            def load_markets(self): self.calls.append("markets")
            def market(self, symbol): return {"swap": True, "linear": True, "quote": "USDT"}
            def fetch_tickers(self, symbols): self.calls.append("tickers"); return {s: {"quoteVolume": 500000} for s in symbols}
            def fetch_ohlcv(self, symbol, tf, limit):
                self.calls.append("bars:" + symbol)
                if symbol == "BAD": raise ValueError("fixture")
                return candles()
            def fetch_order_book(self, symbol, limit): self.calls.append("book"); return book()
            def milliseconds(self): return NOW
        ex = Exchange(); result = collect_public(ex, ["OK", "OK", "BAD"], policy=Policy(levels=2))
        self.assertEqual(len(result), 2)
        self.assertEqual(ex.calls.count("tickers"), 1)
        self.assertEqual(ex.calls.count("bars:OK"), 1)
        self.assertEqual(result[1]["status"], "UNKNOWN")


if __name__ == "__main__": unittest.main()
