export const WS_URL_FROM_ENV = process.env.NEXT_PUBLIC_WS_URL || "";
export const STRATEGY_ENGINE_ENABLED = process.env.NEXT_PUBLIC_STRATEGY_ENGINE_ENABLED === "true";

export const BINANCE_DISCOVERY_SYMBOLS = [
    "BTCUSDT",
    "ETHUSDT",
    "BNBUSDT",
    "SOLUSDT",
    "XRPUSDT",
    "DOGEUSDT",
    "ADAUSDT",
    "AVAXUSDT",
    "DOTUSDT",
    "LINKUSDT",
];

export const TICKER_BUFFER_MS = 500;
export const CANDLE_BUFFER_MS = 250;
export const POSITION_BUFFER_MS = 1200;
export const SYMBOL_INTEREST_DEBOUNCE_MS = 700;
export const FOREGROUND_RESYNC_DEBOUNCE_MS = 150;
export const BACKFILL_THROTTLE_MS = 5000;
