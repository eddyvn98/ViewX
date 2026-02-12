
export type IndicatorType = "RSI" | "EMA" | "SMA" | "MACD" | "HMA" | "HA";

export interface Indicator {
    type: IndicatorType;
    params: number[]; // e.g., [14] for RSI, [12, 26, 9] for MACD
    field?: string; // e.g., "macd", "signal", "histogram" for MACD
}

export type Comparator = ">" | "<" | ">=" | "<=" | "crosses_above" | "crosses_below";

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

export interface Strategy {
    id: string;
    name: string;
    side: 'BUY' | 'SELL';
    entry: ConditionGroup;

    exit?: ConditionGroup;
    cancelConditions?: ConditionGroup; // For pending orders
    risk: StrategyRisk;
    active: boolean;
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
}

export interface SignalStats {
    overallWinrate: number;
    winrateByVolatility: Record<string, number>;
    winrateBySession: Record<string, number>;
    sampleSize: number;
}

export interface AiResponse {
    confidence: number;
    riskLevel: 'low' | 'medium' | 'high';
    reasoning: string[];
}

export interface StrategySignal {
    type: "BUY" | "SELL" | "EXIT" | "CANCEL";
    symbol: string;
    strategyId: string;
    timestamp: number;
    price: number;
    risk: StrategyRisk;
    confidence?: number;
    aiAnalysis?: AiResponse;
}


export interface VirtualPosition {
    id: string;
    strategyId: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    entryPrice: number;
    sl: number;
    tp: number;
    lotSize: number;
    quantity?: number; // Backend alias for lotSize
    timestamp: number;
    status: 'open' | 'closed' | 'pending';
    exitPrice?: number;
    exitTimestamp?: number;
    exitReason?: string; // e.g. "TP", "SL", "Signal", "Manual"
    pnl?: number;
}
