import json
import math
import os
import statistics
import sys
from typing import Any, Dict, List, Optional

_TIMESFM_MODEL = None
_TIMESFM_REPO = None


def safe_float(value: Any) -> Optional[float]:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return number


def safe_int(value: Any) -> Optional[int]:
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        return None
    return number


def horizon_from_timeframe(timeframe: str) -> int:
    normalized = str(timeframe or "").strip().lower()
    defaults = {
        "1": 12,
        "1m": 12,
        "5": 12,
        "5m": 12,
        "15": 10,
        "15m": 10,
        "30": 8,
        "30m": 8,
        "60": 8,
        "1h": 8,
        "240": 6,
        "4h": 6,
        "1d": 5,
        "d": 5,
    }
    return defaults.get(normalized, 8)


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def build_heuristic_forecast(closes: List[float], horizon: int) -> Dict[str, Any]:
    current_price = closes[-1]
    recent_window = closes[-min(len(closes), 20):]
    lookback = min(len(closes), 12)
    base_slope = (closes[-1] - closes[-lookback]) / max(lookback - 1, 1)
    recent_deltas = [recent_window[index] - recent_window[index - 1] for index in range(1, len(recent_window))]
    mean_abs_delta = statistics.mean([abs(delta) for delta in recent_deltas]) if recent_deltas else 0.0
    price_scale = max(abs(current_price), 1e-9)
    volatility_ratio = mean_abs_delta / price_scale
    smoothed_slope = base_slope * 0.65

    forecast = []
    lower_band = []
    upper_band = []

    for step in range(1, horizon + 1):
        drift = smoothed_slope * step
        taper = 1.0 - ((step - 1) / max(horizon, 1)) * 0.25
        price = current_price + drift * taper
        uncertainty = mean_abs_delta * (1.2 + step * 0.35)
        forecast.append(price)
        lower_band.append(price - uncertainty)
        upper_band.append(price + uncertainty)

    target_price = forecast[-1]
    delta_pct = ((target_price - current_price) / price_scale) * 100.0

    direction = "sideways"
    if delta_pct > 0.18:
        direction = "bullish"
    elif delta_pct < -0.18:
        direction = "bearish"

    confidence = clamp(78.0 - volatility_ratio * 6500.0, 35.0, 82.0)
    band_low = min(lower_band)
    band_high = max(upper_band)

    return {
        "engine": "heuristic",
        "horizon": horizon,
        "forecast": [round(point, 8) for point in forecast],
        "lower_band": [round(point, 8) for point in lower_band],
        "upper_band": [round(point, 8) for point in upper_band],
        "current_price": round(current_price, 8),
        "target_price": round(target_price, 8),
        "delta_pct": round(delta_pct, 4),
        "direction": direction,
        "confidence": round(confidence, 2),
        "band_low": round(band_low, 8),
        "band_high": round(band_high, 8),
    }


def maybe_run_timesfm(closes: List[float], horizon: int) -> Optional[Dict[str, Any]]:
    enabled_val = os.getenv("TIMESFM_ENABLED", "0")
    if str(enabled_val).strip().lower() not in {"1", "true", "yes", "on"}:
        # print(f"[timesfm] not enabled (val={enabled_val})", file=sys.stderr)
        return None
    try:
        import numpy as np
        import timesfm
    except Exception as e:
        print(f"[timesfm] import failed: {e}", file=sys.stderr)
        return None

    try:
        global _TIMESFM_MODEL
        global _TIMESFM_REPO
        repo_id = str(os.getenv("TIMESFM_REPO", "google/timesfm-1.0-200m-pytorch")).strip()
        
        # Detect backend
        backend = "cpu"
        try:
            import torch
            if torch.cuda.is_available():
                backend = "cuda"
        except ImportError:
            pass

        if _TIMESFM_MODEL is None:
            _TIMESFM_REPO = repo_id
            _TIMESFM_MODEL = timesfm.TimesFm(
                hparams=timesfm.TimesFmHparams(
                    backend=backend,
                    per_core_batch_size=1,
                    horizon_len=max(128, int(horizon)),
                ),
                checkpoint=timesfm.TimesFmCheckpoint(
                    huggingface_repo_id=repo_id,
                ),
            )
        elif _TIMESFM_REPO != repo_id:
            _TIMESFM_REPO = repo_id
            _TIMESFM_MODEL = timesfm.TimesFm(
                hparams=timesfm.TimesFmHparams(
                    backend=backend,
                    per_core_batch_size=1,
                    horizon_len=max(128, int(horizon)),
                ),
                checkpoint=timesfm.TimesFmCheckpoint(
                    huggingface_repo_id=repo_id,
                ),
            )

        point_forecast, quantile_forecast = _TIMESFM_MODEL.forecast(
            inputs=[np.array(closes, dtype=float)],
            freq=[0],
            normalize=True,
        )
        points = point_forecast[0][:horizon].tolist()
        quantiles = quantile_forecast[0][:horizon].tolist() if len(quantile_forecast) > 0 else []
        lower_band = []
        upper_band = []
        for row in quantiles[:horizon]:
            if isinstance(row, list) and len(row) >= 9:
                lower_band.append(float(row[0])) # 0.1 quantile
                upper_band.append(float(row[-1])) # 0.9 quantile
            else:
                lower_band.append(float(points[len(lower_band)]))
                upper_band.append(float(points[len(upper_band)]))
        current_price = closes[-1]
        target_price = float(points[-1])
        delta_pct = ((target_price - current_price) / max(abs(current_price), 1e-9)) * 100.0
        direction = "sideways"
        if delta_pct > 0.18:
            direction = "bullish"
        elif delta_pct < -0.18:
            direction = "bearish"
        return {
            "engine": "timesfm",
            "horizon": horizon,
            "forecast": [round(float(point), 8) for point in points],
            "lower_band": [round(float(point), 8) for point in lower_band],
            "upper_band": [round(float(point), 8) for point in upper_band],
            "current_price": round(float(current_price), 8),
            "target_price": round(float(target_price), 8),
            "delta_pct": round(float(delta_pct), 4),
            "direction": direction,
            "confidence": 74.0,
            "band_low": round(float(min(lower_band)), 8),
            "band_high": round(float(max(upper_band)), 8),
        }
    except Exception as exc:
        print(f"[timesfm] fallback to heuristic: {exc}", file=sys.stderr)
        return None


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception as exc:
        json.dump({"status": "error", "code": "invalid_payload", "message": str(exc)}, sys.stdout)
        return 1

    candles = payload.get("candles") or []
    closes = [safe_float(item.get("close")) for item in candles if isinstance(item, dict)]
    closes = [value for value in closes if value is not None]
    if len(closes) < 20:
        json.dump(
            {"status": "error", "code": "insufficient_candles", "message": "Need at least 20 valid candles"},
            sys.stdout,
        )
        return 1

    chart = payload.get("chart") or {}
    timeframe = str(chart.get("timeframe") or chart.get("interval") or "").strip()
    requested_horizon = safe_int(payload.get("horizon"))
    horizon = requested_horizon if requested_horizon and requested_horizon > 0 else horizon_from_timeframe(timeframe)

    result = maybe_run_timesfm(closes, horizon)
    if result is None:
        result = build_heuristic_forecast(closes, horizon)

    json.dump({"status": "ok", "result": result}, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
