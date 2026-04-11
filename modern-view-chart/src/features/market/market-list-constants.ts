export type DataSource = 'BINANCE' | 'MT5' | 'VN_GOLD';
export type SourceTab = 'ALL' | 'BINANCE' | 'MT5' | 'VN_GOLD';

export const SOURCE_TABS: SourceTab[] = ['ALL', 'BINANCE', 'MT5', 'VN_GOLD'];

export const DEFAULT_BINANCE_SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
];

export const DEFAULT_VN_GOLD_SYMBOLS = ['SJCVN', 'DOJIVN'];
