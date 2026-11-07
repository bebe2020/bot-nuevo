import copy
import unittest
from bot_nuevo.aggressive import AGGRESSIVE_POLICY, analyze_aggressive, order_block_candidates
from bot_nuevo.scanner import Policy, analyze_snapshot
from bot_nuevo.reader import collect_public


TF = 900_000


def series():
    bars = [[i*TF, 100, 102, 98, 101, 10] for i in range(30)]
    bars[28] = [28*TF, 101, 102, 98, 99, 10]
    bars[29] = [29*TF, 100, 106, 99, 105, 30]
    return bars


def analyze(bars=None, *, bearish_book=False, quote_volume=250_000, book_age=0):
    bars = series() if bars is None else bars
    now = (max(b[0] for b in bars) // TF + 1)*TF + 1_000
    price = bars[-1][4]
    book = {"timestamp": now-book_age, "bids": [[price-.1, 1 if bearish_book else 20]],
            "asks": [[price+.1, 20 if bearish_book else 1]]}
    return analyze_aggressive("X/USDT:USDT", {"quoteVolume": quote_volume}, bars, book,
                              now_ms=now, venue="fixture", market="linear_swap_USDT",
                              policy=Policy(levels=1, min_quote_volume=200_000, max_range_pct=5.5))


class AggressiveTests(unittest.TestCase):
    def test_profile_thresholds_and_attention_breakdown(self):
        r = analyze()
        self.assertEqual(AGGRESSIVE_POLICY.min_quote_volume, 200_000)
        self.assertEqual(AGGRESSIVE_POLICY.max_range_pct, 5.5)
        self.assertTrue(r["filters"]["quote_volume"])
        self.assertAlmostEqual(r["attention_score"], sum(r["attention_contributions"].values()))
        self.assertEqual(r["signal"], "NO_TRADE_SIGNAL")

    def test_aligned_proxy_has_separate_long_short_checklists(self):
        r = analyze()
        # La serie tiene rango >5.5%; el filtro sigue explícito aunque haya alineación.
        self.assertEqual(r["metrics"]["directional_proxy"]["value"], "LONG")
        self.assertEqual(r["checklists"]["LONG"]["directional_agreement"], "PASS")
        self.assertEqual(r["checklists"]["SHORT"]["directional_agreement"], "CONFLICT")
        self.assertNotEqual(r["checklists"]["SHORT"]["confluence"], "alta")

    def test_mixed_pressure_never_labeled_high_confluence(self):
        bars = [[t, o+900, h+900, l+900, c+900, v] for t,o,h,l,c,v in series()]
        r = analyze(bars, bearish_book=True)
        self.assertEqual(r["metrics"]["directional_proxy"]["value"], "MIXED")
        self.assertGreaterEqual(r["checklists"]["LONG"]["points"], 6)
        for checklist in r["checklists"].values():
            self.assertEqual(checklist["directional_agreement"], "CONFLICT")
            self.assertNotEqual(checklist["confluence"], "alta")

    def test_high_confluence_exists_when_direction_and_filters_agree(self):
        bars = [[t, o+900, h+900, l+900, c+900, v] for t,o,h,l,c,v in series()]
        r = analyze(bars)
        self.assertEqual(r["checklists"]["LONG"]["confluence"], "alta")
        self.assertEqual(r["checklists"]["LONG"]["unknown"], 1)
        self.assertEqual(r["signal"], "NO_TRADE_SIGNAL")

    def test_aggressive_climax_uses_22_not_base_25(self):
        bars = series(); bars[-1][5] = 22
        self.assertTrue(analyze(bars)["metrics"]["climax"]["value"])
        base = analyze_snapshot("X", {}, bars, {}, now_ms=30*TF+1_000, venue="fixture", market="linear_swap_USDT")
        self.assertFalse(base["metrics"]["climax"]["value"])

    def test_stale_series_does_not_publish_current_candidate_zone(self):
        now = 31*TF+1_000
        r = analyze_aggressive("X", {"quoteVolume": 500_000}, series(),
                               {"timestamp": now, "bids": [[104.9, 20]], "asks": [[105.1, 1]]},
                               now_ms=now, venue="fixture", market="linear_swap_USDT", policy=Policy(levels=1))
        self.assertEqual(r["metrics"]["range_pct"]["status"], "STALE")
        self.assertEqual(r["metrics"]["order_block_candidates"]["status"], "UNKNOWN")
        self.assertIsNone(r["attention_score"])

    def test_absorption_is_unknown_not_invented_from_balanced_dom(self):
        r = analyze()
        self.assertEqual(r["metrics"]["absorption"]["status"], "UNKNOWN")
        self.assertIsNone(r["checklists"]["LONG"]["items"]["absorption"]["passed"])

    def test_stale_book_does_not_become_neutral_flow(self):
        r = analyze(book_age=6_000)
        self.assertEqual(r["metrics"]["directional_proxy"]["status"], "UNKNOWN")
        self.assertIsNone(r["attention_score"])

    def test_missing_volume_cannot_admit_profile(self):
        r = analyze(quote_volume=None)
        self.assertIsNone(r["filters"]["quote_volume"])
        self.assertNotEqual(r["checklists"]["LONG"]["confluence"], "alta")

    def test_zone_requires_closed_break_not_only_large_green_candle(self):
        bars = series(); bars[-1] = [29*TF, 100, 102, 99.9, 101.8, 200]
        self.assertEqual(order_block_candidates(bars, TF)["value"], [])

    def test_zone_origin_is_opposite_and_detection_clock_is_causal(self):
        zone = order_block_candidates(series(), TF)["value"][-1]
        self.assertEqual(zone["side"], "LONG")
        self.assertEqual((zone["zone_low"], zone["zone_high"]), (98, 102))
        self.assertEqual(zone["origin_ms"], 28*TF)
        self.assertEqual(zone["detected_ms"], 30*TF)
        self.assertEqual(zone["state"], "UNTESTED")

    def test_zone_retest_and_invalidation_are_terminal_and_dated(self):
        bars = series()+[[30*TF, 104, 105, 101, 103, 10]]
        zone = order_block_candidates(bars, TF)["value"][0]
        self.assertEqual(zone["state"], "RETESTED")
        bars += [[31*TF, 103, 104, 97, 99, 10], [32*TF, 100, 103, 99, 102, 10]]
        zone = order_block_candidates(bars, TF)["value"][0]
        self.assertEqual(zone["state"], "INVALIDATED")
        self.assertEqual(zone["invalidated_ms"], 32*TF)

    def test_bearish_zone_is_symmetric(self):
        bars = [[t, 200-o, 200-l, 200-h, 200-c, v] for t,o,h,l,c,v in series()]
        zone = order_block_candidates(bars, TF)["value"][0]
        self.assertEqual(zone["side"], "SHORT")
        self.assertEqual((zone["zone_low"], zone["zone_high"]), (98, 102))

    def test_future_volume_does_not_rewrite_detection_strength(self):
        bars = series()
        first = order_block_candidates(bars, TF)["value"][0]
        later = order_block_candidates(bars+[[30*TF, 105, 106, 104, 105, 1_000_000]], TF)["value"][0]
        self.assertEqual(first["event_id"], later["event_id"])
        self.assertEqual(first["volume_ratio_at_detection"], later["volume_ratio_at_detection"])

    def test_open_bar_cannot_create_zone_or_change_checklist(self):
        bars = series()
        now = 30*TF+1_000
        book = {"timestamp": now, "bids": [[104.9, 20]], "asks": [[105.1, 1]]}
        kwargs = dict(now_ms=now, venue="fixture", market="linear_swap_USDT", policy=Policy(levels=1))
        a = analyze_aggressive("X", {"quoteVolume": 500_000}, bars, book, **kwargs)
        b = analyze_aggressive("X", {"quoteVolume": 500_000}, bars+[[30*TF, 105, 200, 90, 199, 1_000_000]], book, **kwargs)
        self.assertEqual(a["metrics"], b["metrics"])
        self.assertEqual(a["checklists"], b["checklists"])

    def test_invalid_series_leaves_zone_unknown(self):
        bars = series(); del bars[5]
        r = analyze(bars)
        self.assertEqual(r["metrics"]["order_block_candidates"]["status"], "UNKNOWN")

    def test_base_profile_stays_unchanged(self):
        # Enriquecer agresivo no muta el snapshot ni el resultado base.
        bars = series(); original = copy.deepcopy(bars)
        analyze(bars)
        self.assertEqual(bars, original)
        r = analyze_snapshot("X", {}, bars, {}, now_ms=30*TF+1_000, venue="fixture", market="linear_swap_USDT")
        self.assertNotIn("checklists", r)
        self.assertEqual(r["policy"]["min_quote_volume"], 300_000)

    def test_reader_applies_profile_with_one_acquisition(self):
        class Exchange:
            id = "fixture"; has = {"fetchTickers": True}
            def __init__(self): self.calls = []
            def load_markets(self): self.calls.append("markets")
            def market(self, symbol): return {"swap": True, "linear": True, "quote": "USDT"}
            def fetch_tickers(self, symbols): self.calls.append("tickers"); return {"X": {"quoteVolume": 250_000}}
            def fetch_ohlcv(self, symbol, tf, limit): self.calls.append("ohlcv"); return series()
            def fetch_order_book(self, symbol, limit):
                self.calls.append("book")
                return {"timestamp": 30*TF+1_000, "bids": [[104.9, 20]], "asks": [[105.1, 1]]}
            def milliseconds(self): return 30*TF+1_000
        ex = Exchange(); r = collect_public(ex, ["X", "X"], profile="AGRESIVO")
        self.assertEqual(r[0]["profile"], "AGRESIVO")
        self.assertEqual(r[0]["policy"]["min_quote_volume"], 200_000)
        self.assertEqual(ex.calls, ["markets", "tickers", "ohlcv", "book"])


if __name__ == "__main__": unittest.main()
