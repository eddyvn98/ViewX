import unittest

from forecast_service import calculate_atr, calculate_timesfm_confidence, classify_forecast_edge, horizon_from_timeframe


class ForecastTimeframeTests(unittest.TestCase):
    def test_canonical_timeframes_use_expected_forecast_horizons(self):
        self.assertEqual(horizon_from_timeframe("60"), 8)
        self.assertEqual(horizon_from_timeframe("240"), 12)
        self.assertEqual(horizon_from_timeframe("1440"), 10)
        self.assertEqual(horizon_from_timeframe("10080"), 8)

    def test_legacy_day_week_timeframes_remain_compatible(self):
        self.assertEqual(horizon_from_timeframe("D"), 10)
        self.assertEqual(horizon_from_timeframe("W"), 8)

    def test_timesfm_confidence_tracks_model_quantile_uncertainty(self):
        clear_direction = calculate_timesfm_confidence(
            current_price=100.0,
            target_price=110.0,
            terminal_lower=108.0,
            terminal_upper=112.0,
        )
        uncertain_direction = calculate_timesfm_confidence(
            current_price=100.0,
            target_price=110.0,
            terminal_lower=80.0,
            terminal_upper=140.0,
        )
        sideways = calculate_timesfm_confidence(
            current_price=100.0,
            target_price=100.1,
            terminal_lower=99.0,
            terminal_upper=101.0,
        )

        self.assertGreaterEqual(clear_direction, 75.0)
        self.assertLess(uncertain_direction, 55.0)
        self.assertLess(sideways, 55.0)

    def test_atr_uses_full_ohlc_range(self):
        candles = [
            {"high": 101.0, "low": 99.0, "close": 100.0},
            {"high": 104.0, "low": 100.0, "close": 103.0},
            {"high": 106.0, "low": 102.0, "close": 105.0},
        ]
        atr = calculate_atr(candles, period=14)
        self.assertGreater(atr, 3.0)

    def test_small_timesfm_move_is_classified_as_noise_in_atr_units(self):
        edge = classify_forecast_edge(
            current_price=100.0,
            target_price=100.3,
            terminal_lower=99.4,
            terminal_upper=100.8,
            atr_value=1.0,
        )
        self.assertEqual(edge["direction"], "sideways")
        self.assertEqual(edge["edge"], "noise")
        self.assertLess(abs(edge["move_atr"]), 0.5)

    def test_large_timesfm_move_can_keep_directional_bias(self):
        edge = classify_forecast_edge(
            current_price=100.0,
            target_price=102.0,
            terminal_lower=101.0,
            terminal_upper=103.0,
            atr_value=1.0,
        )
        self.assertEqual(edge["direction"], "bullish")
        self.assertEqual(edge["edge"], "strong")
        self.assertGreaterEqual(edge["move_atr"], 1.5)


if __name__ == "__main__":
    unittest.main()
