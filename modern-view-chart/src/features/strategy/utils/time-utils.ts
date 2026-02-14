
/**
 * Utility functions for time-based trading logic.
 */

export type SessionName = 'London' | 'NewYork' | 'Asian' | 'Tokyo' | 'Sydney';


/**
 * Normalizes timeframe strings from various sources (MT5, Bot Settings, etc.)
 * Standard format: '1m', '5m', '15m', '30m', '1h', '2h', '4h', '1d'
 */
export function normalizeTF(tf: string | undefined): string {
    if (!tf) return '';
    const lower = tf.toLowerCase().trim();

    // Numeric minutes to string
    const mins = parseInt(lower);
    if (!isNaN(mins) && /^\d+$/.test(lower)) {
        if (mins === 60) return '1h';
        if (mins === 120) return '2h';
        if (mins === 240) return '4h';
        if (mins === 1440) return '1d';
        return mins + 'm';
    }

    // Standard mappings for H/D
    if (lower === 'h1' || lower === '1h') return '1h';
    if (lower === 'h2' || lower === '2h') return '2h';
    if (lower === 'h4' || lower === '4h') return '4h';
    if (lower === 'd1' || lower === '1d') return '1d';

    // Handle m1, m5 formats (MT5 style)
    if (lower.startsWith('m') && !lower.endsWith('m')) {
        const val = lower.substring(1);
        if (/^\d+$/.test(val)) return val + 'm';
    }

    // Ensure '1m', '5m' etc are returned as is if already correct
    return lower;
}

/**
 * Returns the trading session for a given UTC timestamp.
 * Based on approximate London/NY hours.
 */
export function getTradingSession(timestamp: number): SessionName {
    const hour = new Date(timestamp).getUTCHours();

    // Core session logic (Simplified for consistency)
    if (hour >= 8 && hour < 14) return 'London';
    if (hour >= 14 && hour < 21) return 'NewYork';
    if (hour >= 21 || hour < 8) return 'Asian';

    return 'Asian';
}
