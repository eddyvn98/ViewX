
/**
 * Utility functions for market calculations (Pips, PnL, Multipliers)
 * Shared between Backtest and Live Strategy components.
 */

export function getPipMultiplier(symbol: string): number {
    const s = symbol.toUpperCase();
    if (s.includes('XAU')) return 10;   // Gold: 0.1 price move = 1 pip
    if (s.includes('JPY')) return 100;  // JPY: 0.01 price move = 1 pip
    return 10000;                       // Forex: 0.0001 price move = 1 pip
}

export function getPnLMultiplier(symbol: string): number {
    const s = symbol.toUpperCase();
    if (s.includes('XAU')) return 100;  // Gold standard lot (100 oz)
    if (s.includes('JPY')) return 100;  // JPY pairs often use 100 multiplier for PnL against balance
    return 100000;                      // Standard Forex lot (100,000 units)
}

export function getPriceOffset(symbol: string): number {
    const s = symbol.toUpperCase();
    if (s.includes('XAU')) return 0.3;
    if (s.includes('JPY')) return 0.01;
    return 0.0001;
}

export function calculateStandardPnL(
    type: 'BUY' | 'SELL',
    entryPrice: number,
    exitPrice: number,
    lotSize: number,
    symbol: string
): number {
    const multiplier = getPnLMultiplier(symbol);
    if (type === 'BUY') {
        return (exitPrice - entryPrice) * lotSize * multiplier;
    } else {
        return (entryPrice - exitPrice) * lotSize * multiplier;
    }
}
