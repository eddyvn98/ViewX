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

export interface StrategyRisk {
    sl: number; // pips or points
    tp: number;
    trailing: boolean;
    slSource?: 'fixed' | 'HA_Low' | 'HA_High';
    tpSource?: 'fixed' | 'HA_Low' | 'HA_High';
    trailingSource?: 'HA_Low' | 'HA_High';
    lotSize?: number;
    maxTrades?: number;
    cooldownMinutes?: number;
}

export interface Strategy {
    id: string;
    name: string;
    entry: ConditionGroup;
    exit?: ConditionGroup;
    risk: StrategyRisk;
    active: boolean;
    symbol?: string;
    timeframe?: string;
    positionMode: PositionMode;
    executionMode: 'virtual' | 'real';
    entryType: 'market' | 'stop';
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
    type: "BUY" | "SELL" | "EXIT";
    symbol: string;
    strategyId: string;
    timestamp: number;
    price: number;
    risk: StrategyRisk;
    confidence?: number;
    aiAnalysis?: AiResponse;
}
// 0-100

export interface VirtualPosition {
    id: string;
    strategyId: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    entryPrice: number;
    sl: number;
    tp: number;
    lotSize: number;
    timestamp: number;
    status: 'open' | 'closed' | 'pending';
    exitPrice?: number;
    pnl?: number;
}
