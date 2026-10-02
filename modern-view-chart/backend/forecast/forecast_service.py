import json
import math
import os
import statistics
import sys
from typing import Any, Dict, List, Optional

_TIMESFM_MODEL = None
_TIMESFM_REPO = None
_TIMESFM_HORIZON = None


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
        "h1": 8,
        "240": 12,
        "4h": 12,
        "h4": 12,
        "1440": 10,
        "1d": 10,
        "d": 10,
        "d1": 10,
        "10080": 8,
        "1w": 8,
        "w": 8,
        "w1": 8,
        "43200": 3,
        "1mo": 3,
        "1mth": 3,
    }
    return defaults.get(normalized, 8)


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def calculate_atr(candles: List[Dict[str, Any]], period: int = 14) -> float:
    """Calculate Wilder-style ATR from OHLC candles for trading-scale context."""
    rows = []
    for item in candles or []:
        if not isinstance(item, dict):
            continue
        high = safe_float(item.get("high") if item.get("high") is not None else item.get("h"))
        low = safe_float(item.get("low") if item.get("low") is not None else item.get("l"))
        close = safe_float(item.get("close") if item.get("close") is not None else item.get("c"))
        if high is None or low is None or close is None or high < low:
            continue
        rows.append((high, low, close))

    if len(rows) < 2:
        return 0.0

    true_ranges = []
    previous_close = rows[0][2]
    for high, low, close in rows[1:]:
        true_ranges.append(max(high - low, abs(high - previous_close), abs(low - previous_close)))
        previous_close = close

    if not true_ranges:
        return 0.0
    window = true_ranges[-max(1, min(period, len(true_ranges))):]
    return float(statistics.mean(window))


def calculate_timesfm_confidence(
    current_price: float,
    target_price: float,
    terminal_lower: float,
    terminal_upper: float,
) -> float:
    """Directional clarity of the model interval, not trade win probability."""
    current = safe_float(current_price)
    target = safe_float(target_price)
    lower = safe_float(terminal_lower)
    upper = safe_float(terminal_upper)
    if current is None or target is None or lower is None or upper is None:
        return 35.0

    low, high = sorted((lower, upper))
    half_width = max((high - low) / 2.0, abs(current) * 1e-6, 1e-9)
    move = target - current
    signal_ratio = min(abs(move) / half_width, 1.0)

    if move > 0:
        directional_margin = low - current
    elif move < 0:
        directional_margin = current - high
    else:
        directional_margin = 0.0

    if directional_margin > 0:
        return round(clamp(75.0 + signal_ratio * 15.0, 35.0, 90.0), 2)

    return round(clamp(40.0 + signal_ratio * 30.0, 35.0, 70.0), 2)


def classify_forecast_edge(
    current_price: float,
    target_price: float,
    terminal_lower: float,
    terminal_upper: float,
    atr_value: float,
) -> Dict[str, Any]:
    """Normalize forecast size by ATR so small moves are treated as noise."""
    current = safe_float(current_price)
    target = safe_float(target_price)
    lower = safe_float(terminal_lower)
    upper = safe_float(terminal_upper)
    atr = safe_float(atr_value)

    if current is None or target is None or lower is None or upper is None:
        return {
            "direction": "sideways",
            "edge": "noise",
            "edge_score": 0.0,
            "move_atr": 0.0,
            "interval_span_atr": 0.0,
            "signal_to_noise": 0.0,
        }

    low, high = sorted((lower, upper))
    fallback_scale = max(abs(current) * 0.001, 1e-9)
    atr = atr if atr is not None and atr > 0 else fallback_scale
    move = target - current
    signed_move_atr = move / atr
    move_atr = abs(signed_move_atr)
    interval_span_atr = (high - low) / atr
    half_width = max((high - low) / 2.0, atr * 0.5, 1e-9)
    signal_to_noise = abs(move) / half_width
    interval_crosses_current = low <= current <= high

    if move_atr < 0.5:
        edge = "noise"
    elif move_atr < 1.0:
        edge = "weak"
    elif move_atr < 1.5:
        edge = "moderate"
    else:
        edge = "strong"

    if move_atr < 0.5 or (interval_crosses_current and signal_to_noise < 0.75):
        direction = "sideways"
    else:
        direction = "bullish" if move > 0 else "bearish" if move < 0 else "sideways"

    return {
        "direction": direction,
        "edge": edge,
        "edge_score": round(clamp((move_atr / 1.5) * 100.0, 0.0, 100.0), 2),
        "move_atr": round(signed_move_atr, 4),
        "interval_span_atr": round(interval_span_atr, 4),
        "signal_to_noise": round(signal_to_noise, 4),
    }

def build_heuristic_forecast(closes: List[float], horizon: int, atr_value: Optional[float] = None) -> Dict[str, Any]:
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
    atr = safe_float(atr_value)
    if atr is None or atr <= 0:
        atr = max(mean_abs_delta, price_scale * 0.001)

    edge = classify_forecast_edge(
        current_price,
        target_price,
        lower_band[-1],
        upper_band[-1],
        atr,
    )
    clarity = calculate_timesfm_confidence(
        current_price,
        target_price,
        lower_band[-1],
        upper_band[-1],
    )
    model_band_low = min(lower_band)
    model_band_high = max(upper_band)
    baseline_half_span = atr * math.sqrt(max(horizon, 1))
    atr_baseline_low = current_price - baseline_half_span
    atr_baseline_high = current_price + baseline_half_span
    practical_band_low = min(model_band_low, atr_baseline_low)
    practical_band_high = max(model_band_high, atr_baseline_high)

    return {
        "engine": "heuristic",
        "horizon": horizon,
        "forecast": [round(point, 8) for point in forecast],
        "lower_band": [round(point, 8) for point in lower_band],
        "upper_band": [round(point, 8) for point in upper_band],
        "current_price": round(current_price, 8),
        "target_price": round(target_price, 8),
        "delta_pct": round(delta_pct, 4),
        "direction": edge["direction"],
        "confidence": clarity,
        "directional_clarity": clarity,
        "atr14": round(float(atr), 8),
        "move_atr": edge["move_atr"],
        "interval_span_atr": edge["interval_span_atr"],
        "signal_to_noise": edge["signal_to_noise"],
        "edge": edge["edge"],
        "edge_score": edge["edge_score"],
        "band_low": round(float(model_band_low), 8),
        "band_high": round(float(model_band_high), 8),
        "atr_baseline_low": round(float(atr_baseline_low), 8),
        "atr_baseline_high": round(float(atr_baseline_high), 8),
        "practical_band_low": round(float(practical_band_low), 8),
        "practical_band_high": round(float(practical_band_high), 8),
    }

def maybe_run_timesfm(
    closes: List[float],
    horizon: int,
    atr_value: Optional[float] = None,
) -> Optional[Dict[str, Any]]:
    enabled_val = os.getenv("TIMESFM_ENABLED", "0")
    if str(enabled_val).strip().lower() not in {"1", "true", "yes", "on"}:
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
        global _TIMESFM_HORIZON
        # TimesFM remains a univariate close-price model. OHLC-derived ATR is
        # used only to judge whether its projected move is large enough to matter.
        repo_id = str(os.getenv("TIMESFM_REPO", "google/timesfm-2.5-200m-pytorch")).strip()
        if repo_id == "google/timesfm-3.0-pytorch":
            print("[timesfm] TimesFM 3.0 weights are not licensed for production; using 2.5 checkpoint.", file=sys.stderr)
            repo_id = "google/timesfm-2.5-200m-pytorch"

        max_horizon = max(32, int(math.ceil(max(1, int(horizon)) / 16) * 16))

        if _TIMESFM_MODEL is None or _TIMESFM_REPO != repo_id or _TIMESFM_HORIZON != max_horizon:
            _TIMESFM_REPO = repo_id
            _TIMESFM_HORIZON = max_horizon
            try:
                _TIMESFM_MODEL = timesfm.TimesFM_2p5_200M_torch.from_pretrained(
                    repo_id,
                    local_files_only=True,
                    torch_compile=False,
                )
            except Exception:
                _TIMESFM_MODEL = timesfm.TimesFM_2p5_200M_torch.from_pretrained(
                    repo_id,
                    local_files_only=False,
                    torch_compile=False,
                )
            _TIMESFM_MODEL.compile(
                timesfm.ForecastConfig(
                    max_context=512,
                    max_horizon=max_horizon,
                    per_core_batch_size=1,
                    normalize_inputs=True,
                    use_continuous_quantile_head=True,
                )
            )

        point_forecast, quantile_forecast = _TIMESFM_MODEL.forecast(
            inputs=[np.array(closes, dtype=np.float32)],
            horizon=horizon,
        )
        points = point_forecast[0][:horizon].tolist()
        quantiles = quantile_forecast[0][:horizon].tolist() if len(quantile_forecast) > 0 else []
        if not points:
            return None

        lower_band = []
        upper_band = []
        for index, point in enumerate(points):
            row = quantiles[index] if index < len(quantiles) else []
            if len(row) >= 2:
                lower_band.append(float(row[0]))
                upper_band.append(float(row[-1]))
            else:
                lower_band.append(float(point))
                upper_band.append(float(point))

        current_price = closes[-1]
        target_price = float(points[-1])
        delta_pct = ((target_price - current_price) / max(abs(current_price), 1e-9)) * 100.0
        atr = safe_float(atr_value)
        if atr is None or atr <= 0:
            recent = closes[-min(len(closes), 20):]
            deltas = [abs(recent[index] - recent[index - 1]) for index in range(1, len(recent))]
            atr = statistics.mean(deltas) if deltas else max(abs(current_price) * 0.001, 1e-9)

        edge = classify_forecast_edge(
            current_price,
            target_price,
            lower_band[-1],
            upper_band[-1],
            atr,
        )
        clarity = calculate_timesfm_confidence(
            current_price,
            target_price,
            lower_band[-1],
            upper_band[-1],
        )

        model_band_low = min(lower_band)
        model_band_high = max(upper_band)
        baseline_half_span = atr * math.sqrt(max(horizon, 1))
        atr_baseline_low = current_price - baseline_half_span
        atr_baseline_high = current_price + baseline_half_span
        practical_band_low = min(model_band_low, atr_baseline_low)
        practical_band_high = max(model_band_high, atr_baseline_high)

        return {
            "engine": "timesfm",
            "horizon": horizon,
            "forecast": [round(float(point), 8) for point in points],
            "lower_band": [round(float(point), 8) for point in lower_band],
            "upper_band": [round(float(point), 8) for point in upper_band],
            "current_price": round(float(current_price), 8),
            "target_price": round(float(target_price), 8),
            "delta_pct": round(float(delta_pct), 4),
            "direction": edge["direction"],
            # Backwards-compatible field name. This is directional clarity,
            # not probability that a trade will win.
            "confidence": clarity,
            "directional_clarity": clarity,
            "atr14": round(float(atr), 8),
            "move_atr": edge["move_atr"],
            "interval_span_atr": edge["interval_span_atr"],
            "signal_to_noise": edge["signal_to_noise"],
            "edge": edge["edge"],
            "edge_score": edge["edge_score"],
            "band_low": round(float(model_band_low), 8),
            "band_high": round(float(model_band_high), 8),
            "atr_baseline_low": round(float(atr_baseline_low), 8),
            "atr_baseline_high": round(float(atr_baseline_high), 8),
            "practical_band_low": round(float(practical_band_low), 8),
            "practical_band_high": round(float(practical_band_high), 8),
        }
    except Exception as exc:
        print(f"[timesfm] fallback to heuristic: {exc}", file=sys.stderr)
        return None

def process_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    candles = payload.get("candles") or []
    closes = []
    for item in candles:
        if not isinstance(item, dict):
            continue
        close = safe_float(item.get("close") if item.get("close") is not None else item.get("c"))
        if close is not None and close > 0:
            closes.append(close)

    if len(closes) < 20:
        return {
            "status": "error",
            "code": "insufficient_candles",
            "message": "Need at least 20 valid candles",
        }

    atr_value = calculate_atr(candles)
    chart = payload.get("chart") or {}
    timeframe = str(chart.get("timeframe") or chart.get("interval") or "").strip()
    requested_horizon = safe_int(payload.get("horizon"))
    horizon = requested_horizon if requested_horizon and requested_horizon > 0 else horizon_from_timeframe(timeframe)

    result = maybe_run_timesfm(closes, horizon, atr_value)
    if result is None:
        result = build_heuristic_forecast(closes, horizon, atr_value)

    return {"status": "ok", "result": result}

def run_worker() -> int:
    enabled_val = os.getenv("TIMESFM_ENABLED", "0")
    if str(enabled_val).strip().lower() in {"1", "true", "yes", "on"}:
        try:
            warmup_closes = [100.0 + (step * 0.1) for step in range(30)]
            maybe_run_timesfm(warmup_closes, 8)
            print("[timesfm-worker] model pre-warmed into memory", file=sys.stderr)
        except Exception as exc:
            print(f"[timesfm-worker] pre-warm warning: {exc}", file=sys.stderr)

    sys.stdout.write(json.dumps({"status": "ready"}) + "\n")
    sys.stdout.flush()

    for line in sys.stdin:
        raw_line = line.strip()
        if not raw_line:
            continue
        try:
            payload = json.loads(raw_line)
            req_id = payload.get("req_id")
            response = process_payload(payload)
            if req_id is not None:
                response["req_id"] = req_id
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()
        except Exception as exc:
            sys.stdout.write(
                json.dumps({"status": "error", "code": "worker_payload_error", "message": str(exc)}) + "\n"
            )
            sys.stdout.flush()

    return 0


def main() -> int:
    if "--worker" in sys.argv:
        return run_worker()

    try:
        payload = json.load(sys.stdin)
    except Exception as exc:
        json.dump({"status": "error", "code": "invalid_payload", "message": str(exc)}, sys.stdout)
        return 1

    response = process_payload(payload)
    json.dump(response, sys.stdout)
    return 0 if response.get("status") == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
