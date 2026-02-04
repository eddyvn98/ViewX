import { SymbolInfo } from "../store/types";

export interface PnLParams {
    type: 'buy' | 'sell' | string;
    openPrice: number;
    currentPrice: number;
    volume: number;
    symbolInfo?: SymbolInfo;
}

/**
 * Calculates Profit/Loss based on MT5 standard formula.
 * Profit = (PriceDiff / TickSize) * TickValue * Volume
 */
export function calculatePnL({ type, openPrice, currentPrice, volume, symbolInfo }: PnLParams): number {
    const isLong = type.toLowerCase().includes('buy');
    const diff = isLong ? (currentPrice - openPrice) : (openPrice - currentPrice);

    if (symbolInfo && symbolInfo.tick_size > 0 && symbolInfo.tick_value > 0) {
        const ticks = diff / symbolInfo.tick_size;
        return ticks * symbolInfo.tick_value * volume;
    }

    // Fallback logic if symbol info is missing
    // We try to guess based on common asset types or just use a safer 1:1 if unknown
    const symbol = symbolInfo?.symbol || '';

    // Guess for Forex (often 100,000 contract size, tick value 1.00 for 1 lot at 0.0001/0.001)
    // Most standard forex: 1 lot move of 1 pip (0.0001) = 10$
    // So 1 unit move (1.0) = 100,000$ per lot.
    const forexPairs = ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDCHF', 'USDCAD'];
    const pair = symbol.toUpperCase().replace('M', ''); // remove suffix if any

    if (forexPairs.includes(pair) || symbol.includes('USD')) {
        // If it looks like BTCUSD or similar, we should check if it's crypto
        if (symbol.includes('BTC') || symbol.includes('ETH')) {
            return diff * volume; // Crypto often 1:1 (1 unit change = 1$ profit per lot)
        }
        return diff * volume * 100; // Legacy / Forex fallback
    }

    return diff * volume; // Safest basic fallback
}

export function formatPnL(val: number): string {
    const prefix = val >= 0 ? '+' : '-';
    const absVal = Math.abs(val);
    return `${prefix}$${absVal.toFixed(2)}`;
}
