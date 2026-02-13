
/**
 * Utility functions for time-based trading logic.
 */

export type SessionName = 'London' | 'NewYork' | 'Asian' | 'Tokyo' | 'Sydney';

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
