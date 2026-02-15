export interface Ticker {
    symbol: string;
    price: number;
    change: number;
    changeValue: number;
    volume: number;
    source?: 'BINANCE' | 'MT5';
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
    source: 'BINANCE' | 'MT5';
    group?: 'A' | 'B' | 'C' | 'D' | 'none'; // Symbol Linking Group
    timezone?: string; // e.g., "Asia/Ho_Chi_Minh"
    chartType: 'candles' | 'heikin_ashi' | 'smart_candles';
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

export type RightSidebarTab = 'market' | 'indicators' | 'strategy' | 'trade';

export interface IndicatorConfig {
    id: string;
    type: 'EMA' | 'HMA' | 'RSI' | 'Signals' | 'SIGNALS' | 'SMA' | 'WMA' | 'MACD' | 'MARKET_STRUCTURE' | 'MarketStructure' | 'BREAKOUT_RAYS' | 'BreakoutRays' | 'TREND_LINES' | 'TrendLines';
    params: Record<string, any>;
    color: string;
    visible: boolean;
    lineWidth: number;
    pane: 'main' | 'rsi' | 'subchart';
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
