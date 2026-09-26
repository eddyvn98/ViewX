import unittest

from forecast_service import calculate_timesfm_confidence, horizon_from_timeframe


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


if __name__ == "__main__":
    unittest.main()
