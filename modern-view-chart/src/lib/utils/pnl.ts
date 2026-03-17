import { SymbolInfo } from "../store/types";

export interface PnLParams {
    type: 'buy' | 'sell' | string;
    openPrice: number;
    currentPrice: number;
    volume: number;
    symbolInfo?: SymbolInfo;
    symbol?: string; // Add optional symbol for better fallback
}

/**
 * Calculates Profit/Loss based on MT5 standard formula.
 * Profit = (PriceDiff / TickSize) * TickValue * Volume
 */
export function calculatePnL({ type, openPrice, currentPrice, volume, symbolInfo, symbol: symbolParam }: PnLParams): number {
    const isLong = type.toLowerCase().includes('buy');
    const diff = isLong ? (currentPrice - openPrice) : (openPrice - currentPrice);

    // If we have precise symbol info, use it
    if (symbolInfo && symbolInfo.tick_size > 0 && symbolInfo.tick_value > 0) {
        // Validation: If tick_value is too small (like 0.01 for gold), 
        // it might be per-volume-unit instead of per-lot.
        // Standard MT5 tick_value is per 1.0 lot.
        const ticks = diff / symbolInfo.tick_size;
        const pnl = ticks * symbolInfo.tick_value * volume;

        // Custom correction for common misconfigurations (e.g. Gold showing 100x less)
        const sym = (symbolParam || symbolInfo.symbol || '').toUpperCase();
        if (sym.includes('XAU') && pnl < Math.abs(diff * volume * 10)) {
            // If PnL seems way too small for Gold (e.g. missing 100x multiplier), 
            // and it's a common USD pair, it's likely a tick_value / contract_size issue.
            // Many brokers use 100 contracts for Gold.
            if (pnl * 100 > Math.abs(diff * volume * 10)) {
                return pnl * 100;
            }
        }

        return pnl;
    }

    // Fallback logic if symbol info is missing
    const symbol = symbolParam || symbolInfo?.symbol || '';
    const pair = symbol.toUpperCase().replace('M', '');

    // Guess for Gold/Forex
    if (pair.includes('XAU') || pair.includes('GOLD')) {
        return diff * volume * 100; // Standard 100 contracts for Gold
    }

    if (pair.includes('JPY')) {
        return diff * volume * 100; // JPY Pip is 0.01, so 100x multiplier
    }

    if (pair.includes('BTC') || pair.includes('ETH')) {
        return diff * volume; // Crypto often 1:1
    }

    if (pair.includes('USD') || pair.includes('EUR') || pair.includes('GBP')) {
        return diff * volume * 100000; // Standard Forex (1 lot = 100k)
    }

    return diff * volume; // Safest basic fallback
}

export function formatPnL(val: number): string {
    const prefix = val >= 0 ? '+' : '-';
    const absVal = Math.abs(val);
    return `${prefix}${absVal.toFixed(2)} USD`;
}
