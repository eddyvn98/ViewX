export const TELEGRAM_REQUIRED_MODULES = ["telegram_notify", "telegram_control"];
export const WATCHLIST_FALLBACK = ["XAUUSDm", "BTCUSDm", "EURUSDm"];
export const TIMEFRAME_OPTIONS = ["1m", "5m", "15m", "1h", "4h"];
export const SYMBOL_LIMIT = 6;
export const RSI_PERIOD_OPTIONS = [7, 14, 21];
export const RSI_THRESHOLD_OPTIONS = [20, 30, 50, 70, 80];
export const MA_TYPES = ["EMA", "HMA"];
export const MA_FAST_PERIODS = [9, 20, 55];
export const MA_SLOW_PERIODS = [20, 50, 200];
export const INDICATOR_TYPES = ["PRICE", "RSI", "EMA", "SMA", "HMA", "MACD", "ATR", "ADX", "STOCHASTIC", "BOLLINGERBANDS"];
export const INDICATOR_COMPARE_OPERATORS = [">", "<", "crosses_above", "crosses_below"];
export const BOT_SCAN_INTERVAL_MS = Math.max(
  15_000,
  Number.parseInt(process.env.TELEGRAM_BOT_SCAN_INTERVAL_MS || "30000", 10) || 30_000,
);
