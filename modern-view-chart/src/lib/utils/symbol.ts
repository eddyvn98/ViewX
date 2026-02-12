
/**
 * Chuẩn hóa tên Symbol để đảm bảo đồng bộ giữa Tickers, Chart và Orders.
 * Ví dụ: BTCUSDM -> BTCUSDm, XAUUSD.m -> XAUUSDm
 */
export function normalizeSymbol(symbol: string | undefined): string {
    if (!symbol) return '';

    // console.log(`[Symbol] Normalizing: ${symbol}`); // DEBUG LOG
    let s = symbol.trim();

    // Convert to uppercase for base comparison, but keep the suffix logic
    // Common suffixes: .m, m, .M, M, .h, h, .H, H
    if (s.toLowerCase().endsWith('m') || s.toLowerCase().endsWith('.m')) {
        s = s.replace(/\.?m$/i, 'm');
    } else if (s.toLowerCase().endsWith('h') || s.toLowerCase().endsWith('.h')) {
        s = s.replace(/\.?h$/i, 'h');
    }

    return s;
}


/**
 * So sánh 2 symbol không phân biệt hoa thường và đuôi mở rộng phổ biến
 */
export function isSameSymbol(s1: string | undefined, s2: string | undefined): boolean {
    if (!s1 || !s2) return false;
    return normalizeSymbol(s1).toLowerCase() === normalizeSymbol(s2).toLowerCase();
}
