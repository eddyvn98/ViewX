import { Candle } from '@/lib/store/types';

export interface IndicatorData {
    time: number;
    value: number;
}

export interface HACandle extends Candle {
    ha_open: number;
    ha_high: number;
    ha_low: number;
    ha_close: number;
}

export interface MACDResult {
    macd: number[];
    signal: number[];
    histogram: number[];
}

export type IndicatorType =
    | "RSI"
    | "EMA"
    | "SMA"
    | "MACD"
    | "HMA"
    | "HA"
    | "ATR"
    | "BollingerBands"
    | "BOLLINGER_BANDS"
    | "Stochastic"
    | "STOCHASTIC"
    | "SuperTrend"
    | "SUPERTREND"
    | "VWAP"
    | "Ichimoku"
    | "ICHIMOKU"
    | "ADX"
    | "SAR"
    | "OrderBlock"
    | "FVG"
    | "BreakoutRays"
    | "BREAKOUT_RAYS"
    | "TrendLines"
    | "TREND_LINES"
    | "MarketStructure"
    | "MARKET_STRUCTURE"
    | "Fibonacci"
    | "FIBONACCI"
    | "FibonacciExtension"
    | "FIBONACCI_EXTENSION"
    | "SIGNALS"
    | "Signals"
    | (string & {});

export interface Indicator {
    type: IndicatorType;
    params: number[]; // e.g., [14] for RSI, [12, 26, 9] for MACD
    field?: string; // e.g., "macd", "signal", "histogram" for MACD
}

export type Comparator = ">" | "<" | ">=" | "<=" | "==" | "crosses_above" | "crosses_below";

export interface Condition {
    id: string;
    left: Indicator;
    comparator: Comparator;
    right: Indicator | number;
}

export interface ConditionGroup {
    operator: "AND" | "OR";
    conditions: (Condition | ConditionGroup)[];
}

export type PositionMode = "single_position" | "hedge" | "scale_in";

export type SLTPMode = 'fixed' | 'candle' | 'indicator' | 'percentage' | 'amount' | 'winrate';
export type LotMode = 'fixed' | 'percentage' | 'amount';

export interface LotConfig {
    mode: LotMode;
    value: number;
}

export interface SLTPConfig {
    mode: SLTPMode;
    value?: number;          // Fixed points, %, or amount
    candleOffset?: number;    // How many candles back from entry
    candleField?: 'high' | 'low' | 'close' | 'open';
    indicator?: Indicator;    // For indicator-based SL/TP
    offset?: number;          // Additional points/pips offset
}

export interface StrategyRisk {
    sl?: number | SLTPConfig;
    tp?: number | SLTPConfig;
    stopLoss?: number | SLTPConfig; // Alias for sl (used in BacktestRunner)
    takeProfit?: number | SLTPConfig; // Alias for tp
    trailing: boolean;
    slSource?: 'HA_Low' | 'HA_High' | 'Candle_Low' | 'Candle_High';
    trailingSource?: 'HA_Low' | 'HA_High';
    lotSize: number | LotConfig;
    maxTrades?: number;
    cooldownMinutes?: number;
}

export type StrategyDirection = 'BUY' | 'SELL';

export interface StrategyLeg {
    entry: ConditionGroup;
    trigger?: ConditionGroup;
    exit?: ConditionGroup;
    cancelConditions?: ConditionGroup;
    risk: StrategyRisk;
    entryType?: 'market' | 'stop' | 'limit';
    entryPrice?: SLTPConfig;
    positionMode?: PositionMode;
    lockMatrixScopeWhileOpen?: boolean;
}

export interface Strategy {
    id: string;
    name: string;
    side?: 'BUY' | 'SELL';
    entry?: ConditionGroup;
    trigger?: ConditionGroup;
    exit?: ConditionGroup;
    cancelConditions?: ConditionGroup; // For pending orders
    risk?: StrategyRisk;
    buy?: StrategyLeg;
    sell?: StrategyLeg;
    enabledDirections?: StrategyDirection[];
    active: boolean;
    aiGuard?: boolean; // AI Monitoring for live signals
    symbol?: string;
    timeframe?: string;
    positionMode: PositionMode;
    executionMode: 'virtual' | 'real';
    entryType: 'market' | 'stop' | 'limit';
    entryPrice?: SLTPConfig;
    magic?: number;
    comment?: string;
    sessions?: ("London" | "NewYork" | "Tokyo" | "Sydney")[];
    lastSignalTime?: number; // Internal tracking
    lockMatrixScopeWhileOpen?: boolean;
}

export interface SignalStats {
    overallWinrate: number;
    buyWinrate: number;
    sellWinrate: number;
    recentWinrate: number; // Last 10 trades
    avgMae: number;
    avgMfe: number;
    winrateByVolatility: Record<string, number>;
    winrateBySession: Record<string, number>;
    trendWinrate: number;
    rangeWinrate: number;
    recentPerformance: {
        wins: number;
        losses: number;
        total: number;
    };
    sampleSize: number;
}

export interface LogicMemory {
    sessionBias: Record<string, number>; // Adjust confidence by session performance
    maeThresholds: Record<string, number>; // Critical MAE levels learned
    efficiencyTarget: number;
}

export interface PerformanceMetrics {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalProfit: number;
    totalLoss: number;
    netProfit: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    avgMae: number;
    avgMfe: number;
    avgConfidence: number;
    sessionStats: Record<string, { winRate: number; totalTrades: number }>;
    memory: LogicMemory;
    maxDrawdown: number;
    equityCurve: { time: number; value: number }[];
}

export interface AiResponse {
    confidence: number;
    riskLevel: 'low' | 'medium' | 'high';
    reasoning: string[];
    suggestedFix?: {
        field: string;
        value: unknown;
        reason: string;
    };
}

export interface StrategySignal {
    type: "BUY" | "SELL" | "EXIT" | "CANCEL";
    symbol: string;
    strategyId: string;
    timestamp: number;
    barTime?: number;
    price: number;
    timeframe?: string;
    source?: 'MT5' | 'BINANCE';
    matrixScopeKey?: string;
    risk: StrategyRisk;
    direction?: StrategyDirection;
    confidence?: number;
    aiAnalysis?: AiResponse;
    context?: TradeContext;
}


export interface TradeContext {
    // 1. Environment (The "Weather")
    session: 'London' | 'NewYork' | 'Tokyo' | 'Sydney' | 'Asian' | 'Close';
    volatility_atr?: number;
    spread_at_entry?: number;

    // 2. Multi-Timeframe Context (The "Big Picture")
    mtf?: {
        h1_trend?: 'UP' | 'DOWN' | 'SIDEWAYS';
        h1_rsi?: number;
        h4_trend?: 'UP' | 'DOWN' | 'SIDEWAYS';
    };

    // 3. Market Dynamics (The "Fuel")
    volume_analysis?: {
        value: number;
        relative_to_avg: number; // e.g., 1.5x average
        is_climax?: boolean;
    };

    // 4. Pre-Trade Snapshot (The "Trigger")
    // Stores actual values of indicators used in rules at the moment of entry
    indicators_snapshot: Record<string, unknown>;

    // 5. In-Trade Metrics (The "Journey")
    mae?: number; // Max Adverse Excursion (Max drawdown in pips/points)
    mfe?: number; // Max Favorable Excursion (Max profit in pips/points)
    duration_candles?: number;

    // 6. Post-Trade Analysis
    post_exit_price_10c?: number; // Price after 10 candles
    exit_reason?: 'SL' | 'TP' | 'SIGNAL' | 'MANUAL';
    post_exit?: Record<string, unknown>;
}

export interface VirtualPosition {
    id: string;
    strategyId: string;
    symbol: string;
    timeframe?: string;
    source?: 'MT5' | 'BINANCE';
    matrixScopeKey?: string;
    openedBarTime?: number;
    type: 'BUY' | 'SELL';
    entryPrice: number;
    sl: number;
    tp: number;
    lotSize: number;
    quantity?: number; // Backend alias for lotSize
    timestamp: number;
    entry_time?: number;
    sl_time?: number;
    tp_time?: number;
    status: 'open' | 'closed' | 'pending';
    exitPrice?: number;
    exitTimestamp?: number;
    exitReason?: string; // e.g. "TP", "SL", "Signal", "Manual"
    pnl?: number;
    metadata?: TradeContext;
    confidence?: number; // AI Confidence Score (0-100)
    isHistorical?: boolean; // Tag for backtest results
}
