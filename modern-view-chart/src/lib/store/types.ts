export type MarketDataSource = 'BINANCE' | 'MT5' | 'MT5_PERSONAL' | 'VN_GOLD';

export interface SymbolDescriptor {
    symbol: string;
    source: MarketDataSource;
    accountLogin?: string | null;
    terminalId?: string | null;
    broker?: string | null;
    description?: string;
    path?: string;
    digits?: number;
    type?: string;
}

export interface ForecastData {
    timestamp: number;
    symbol: string;
    interval: string;
    source: MarketDataSource;
    points: number[];
    lower_band: number[];
    upper_band: number[];
    engine: 'timesfm' | 'heuristic';
    confidence: number;
    horizon: number;
}

export interface Ticker {
    symbol: string;
    price: number;
    change: number;
    changeValue: number;
    volume: number;
    source?: MarketDataSource;
    bid?: number;
    ask?: number;
    displayName?: string;
    serverTime?: number; // Server-side timestamp in milliseconds
}

export interface Candle {
    time: number; // Unix timestamp
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

export interface AccountInfo {
    balance: number;
    equity: number;
    margin: number;
    free_margin: number;
    margin_level: number;
    profit: number;
    login?: string | number;
    server?: string;
    name?: string;
    company?: string;
    currency?: string;
}

export interface Position {
    ticket: number;
    symbol: string;
    type: string;
    volume: number;
    open_price: number;
    current_price: number;
    sl: number;
    tp: number;
    profit: number;
    time: number;
    entry_time?: number;
    sl_time?: number;
    tp_time?: number;
    magic: number;
    source?: string;
}

export interface Order {
    ticket: number;
    symbol: string;
    type: string;
    volume: number;
    price_open: number;
    current_price: number;
    sl: number;
    tp: number;
    time: number;
    entry_time?: number;
    sl_time?: number;
    tp_time?: number;
    magic: number;
    source?: string;
}

export interface HistoryDeal {
    ticket: number;
    order: number;
    time: number;
    type: string; // buy, sell, balance
    entry: string; // in, out, in/out
    symbol: string;
    volume: number;
    price: number;
    profit: number;
    swap: number;
    commission: number;
    magic: number;
    source?: string;
}

export interface ChartInstance {
    id: string;
    symbol: string;
    interval: string;
    source: MarketDataSource;
    accountLogin?: string | null;
    terminalId?: string | null;
    broker?: string | null;
    group?: 'A' | 'B' | 'C' | 'D' | 'none'; // Symbol Linking Group
    timezone?: string; // e.g., "Asia/Ho_Chi_Minh"
    chartType: 'candles' | 'heikin_ashi' | 'smart_candles';
    candleColors?: {
        candles: { up: string; down: string };
        heikin_ashi: { up: string; down: string };
        smart_candles: { up: string; down: string };
    };
    candleUpColor?: string;
    candleDownColor?: string;
    isSubchartVisible?: boolean;
    subchartHeightPct?: number;
    viewport?: {
        contextKey?: string;
        logicalRange?: {
            from: number;
            to: number;
        };
        mainPriceRange?: {
            from: number;
            to: number;
        };
        subPriceRange?: {
            from: number;
            to: number;
        };
        savedAt?: number;
    };
    forecast?: ForecastData;
}

export interface ChartTab {
    id: string;
    name: string;
    charts: Record<string, ChartInstance>;
    activeChartId: string | null;
    maximizedChartId: string | null;
    layoutMode: string; // e.g., '1x1', '2x2', or custom NxM
    rows: number;
    cols: number;
}

export interface FavoriteTimeframe {
    id: string; // e.g., "1", "15", "1h", "1d"
    label: string; // e.g., "1m", "15m", "1h", "1d"
    category: 'MINUTE' | 'HOUR' | 'DAY' | 'WEEK_MONTH';
}

export interface SymbolInfo {
    symbol: string;
    contract_size: number;
    tick_value: number;
    tick_size: number;
    digits: number;
    swap_long: number;
    swap_short: number;
    currency_profit: string;
    currency_margin: string;
}

export type RightSidebarTab = 'market' | 'layer' | 'strategy' | 'trade';

export interface IndicatorConfig {
    id: string;
    type: string;
    params: Record<string, unknown>;
    styles?: Record<string, unknown>; // Flexible styling (e.g., macd: { color: 'red' })
    color: string; // Primary/Legacy color
    visible: boolean;
    lineWidth: number; // Legacy, move to styles soon
    pane: 'main' | 'rsi' | 'subchart';
}

export type DrawingTool = 'none' | 'fib-retracement' | 'fib-extension' | 'trend-line' | 'horizontal-line' | 'vertical-line' | 'crosshair' | 'rectangle';

export interface DrawingPoint {
    time: number;
    price: number;
}

export interface DrawingConfig {
    id: string;
    type: DrawingTool;
    points: DrawingPoint[];
    symbol?: string;
    interval?: string;
    source?: 'BINANCE' | 'MT5' | 'VN_GOLD';
    color: string;
    visible: boolean;
    locked?: boolean;
    lineWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    params?: Record<string, unknown>;
}

export interface Alert {
    id: string;
    symbol: string;
    price: number;
    active: boolean;
    note?: string;
    type: 'crossing' | 'greater' | 'less';
    direction?: 'bullish' | 'bearish';
    createdAt: number;
}
