export function getBinanceRestBaseUrl() {
    const raw = String(process.env.BINANCE_REST_BASE_URL || 'https://api.binance.com').trim();
    return raw.replace(/\/$/, '');
}

export function buildBinanceRestUrl(pathname) {
    return new URL(String(pathname || ''), `${getBinanceRestBaseUrl()}/`);
}
