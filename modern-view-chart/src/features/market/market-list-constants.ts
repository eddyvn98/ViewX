export type DataSource = 'BINANCE' | 'MT5';
export type SourceTab = 'ALL' | 'BINANCE' | 'MT5';

export const SOURCE_TABS: SourceTab[] = ['ALL', 'BINANCE', 'MT5'];

export const DEFAULT_BINANCE_SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
];
