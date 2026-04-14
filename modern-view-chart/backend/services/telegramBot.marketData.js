export function createTelegramBotMarketData(deps) {
  const {
    normalizeSymbol,
    timeframeToFeedInterval,
    getScopedMt5Price,
    mt5Prices,
    getVietnamGoldQuotes,
    getVangTodayLatestQuotes,
    getVietnamGoldCandles,
    getVangTodayCandles,
    candleBuffers,
  } = deps;

  function symbolVariants(symbol) {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return [];
    const variants = new Set([normalized]);
    if (/M$/i.test(normalized)) {
      variants.add(`${normalized.slice(0, -1)}m`);
    }
    if (/m$/.test(normalized)) {
      variants.add(`${normalized.slice(0, -1)}M`);
    }
    return Array.from(variants);
  }

  function getScopedMt5PriceByVariants(ownerUserId, symbol) {
    for (const candidate of symbolVariants(symbol)) {
      const scoped = getScopedMt5Price(mt5Prices, ownerUserId, candidate);
      if (scoped?.price) return Number(scoped.price);
    }
    return 0;
  }

  function getLatestBufferedClose(symbol) {
    const keys = [];
    for (const candidate of symbolVariants(symbol)) {
      keys.push(
        `${candidate}|1m`,
        `${candidate}|1`,
        `${candidate}|5m`,
        `${candidate}|5`,
        `${candidate}|15m`,
        `${candidate}|15`,
        `${candidate}|1h`,
        `${candidate}|60`,
        `${candidate}|4h`,
        `${candidate}|240`,
        `${String(candidate).toLowerCase()}|1m`,
        `${String(candidate).toLowerCase()}|1`,
        `${String(candidate).toLowerCase()}|5m`,
        `${String(candidate).toLowerCase()}|5`,
        `${String(candidate).toLowerCase()}|15m`,
        `${String(candidate).toLowerCase()}|15`,
        `${String(candidate).toLowerCase()}|1h`,
        `${String(candidate).toLowerCase()}|60`,
        `${String(candidate).toLowerCase()}|4h`,
        `${String(candidate).toLowerCase()}|240`,
      );
    }
    for (const key of keys) {
      const buffer = Array.isArray(candleBuffers?.[key]) ? candleBuffers[key] : [];
      if (!buffer.length) continue;
      const latest = buffer[buffer.length - 1];
      const close = Number(latest?.close || 0);
      if (Number.isFinite(close) && close > 0) return close;
    }
    return 0;
  }

  async function fetchCurrentPrice(symbol, ownerUserId) {
    const normalizedSymbol = normalizeSymbol(symbol);
    const scopedPrice = getScopedMt5PriceByVariants(ownerUserId, normalizedSymbol);
    if (scopedPrice > 0) return scopedPrice;

    // MT5 symbols (for example XAUUSDM) might not have a fresh tick at alert-creation time.
    // Fallback to latest buffered candle close so Telegram can still show a current reference price.
    const bufferedClose = getLatestBufferedClose(normalizedSymbol);
    if (bufferedClose > 0) return bufferedClose;

    if (["SJCVN", "DOJIVN"].includes(normalizedSymbol)) {
      const quotes = await getVietnamGoldQuotes();
      const quote = quotes.find((item) => normalizeSymbol(item?.symbol) === normalizedSymbol);
      return Number(quote?.price || quote?.ask || quote?.bid || 0);
    }

    const vangQuotes = await getVangTodayLatestQuotes().catch(() => []);
    const vangQuote = Array.isArray(vangQuotes) ? vangQuotes.find((item) => normalizeSymbol(item?.symbol) === normalizedSymbol) : null;
    if (vangQuote?.sell || vangQuote?.buy) return Number(vangQuote.sell || vangQuote.buy || 0);

    try {
      const binanceSymbol = normalizedSymbol.endsWith("M")
        ? normalizedSymbol.slice(0, -1).replace(/USD$/, "USDT")
        : normalizedSymbol;
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(binanceSymbol)}`);
      if (!res.ok) return 0;
      const data = await res.json().catch(() => null);
      return Number(data?.price || 0);
    } catch {
      return 0;
    }
  }

  function toCloseCandles(buffer) {
    return (Array.isArray(buffer) ? buffer : [])
      .map((item) => ({
        time: Number(item?.time || 0),
        close: Number(item?.close || 0),
      }))
      .filter((item) => Number.isFinite(item.time) && Number.isFinite(item.close) && item.close > 0);
  }

  async function fetchCandles(symbol, timeframe, ownerUserId, count = 240) {
    const normalizedSymbol = normalizeSymbol(symbol);
    const { binance, stored } = timeframeToFeedInterval(timeframe);

    if (["SJCVN", "DOJIVN"].includes(normalizedSymbol)) {
      const candles = await getVietnamGoldCandles(normalizedSymbol, stored[stored.length - 1], count).catch(() => []);
      return Array.isArray(candles) ? candles : [];
    }

    const vangQuotes = await getVangTodayLatestQuotes().catch(() => []);
    const isVangToday = Array.isArray(vangQuotes) && vangQuotes.some((item) => normalizeSymbol(item?.symbol) === normalizedSymbol);
    if (isVangToday) {
      const candles = await getVangTodayCandles(normalizedSymbol, stored[stored.length - 1], "buy", String(count)).catch(() => []);
      return Array.isArray(candles) ? candles : [];
    }

    if (normalizedSymbol.endsWith("M") || getScopedMt5Price(mt5Prices, ownerUserId, normalizedSymbol)) {
      for (const candidate of stored) {
        const buffer = candleBuffers[`${normalizedSymbol}|${candidate}`] || candleBuffers[`${normalizedSymbol.toLowerCase()}|${candidate}`];
        const candles = toCloseCandles(buffer);
        if (candles.length >= 30) return candles.slice(-count);
      }
      return [];
    }

    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(normalizedSymbol)}&interval=${encodeURIComponent(binance)}&limit=${count}`,
      );
      if (!res.ok) return [];
      const raw = await res.json().catch(() => []);
      return Array.isArray(raw)
        ? raw.map((item) => ({
            time: Number(item?.[0] || 0),
            open: Number(item?.[1] || 0),
            high: Number(item?.[2] || 0),
            low: Number(item?.[3] || 0),
            close: Number(item?.[4] || 0),
            volume: Number(item?.[5] || 0),
          })).filter((item) => Number.isFinite(item.close) && item.close > 0)
        : [];
    } catch {
      return [];
    }
  }

  return { fetchCurrentPrice, fetchCandles };
}
