// websocket.js
import { WebSocketServer } from "ws";
import { RSI } from "technicalindicators";
import fetch from "node-fetch";
import { calcBollingerBands } from "./services/indicators.js";

const clients = new Map();

export default function initWebSocket(server) {
  const wss = new WebSocketServer({ server });

  setInterval(broadcastPricesToSubscribers, 3000);
  setInterval(broadcastChartCandles, 3000);

  wss.on("connection", (ws) => {
    clients.set(ws, { userId: null, symbols: [], chart: null });

    ws.on("message", (msg) => {
      try {
        const raw = msg.toString();
        const data = JSON.parse(raw);

        if (data.type === "auth") {
          clients.get(ws).userId = data.userId || null;
        }

        if (data.type === "subscribeCandle") {
          clients.get(ws).chart = {
            symbol: data.symbol,
            interval: data.interval,
          };

          if (data.candles && Array.isArray(data.candles)) {
            const key = `${data.symbol}|${data.interval}`;
            candleBuffers[key] = data.candles.map(c => ({
              time: c.time,
              close: c.close
            }));
          }
        }
      } catch (err) {
        console.error("❌ WS parse error:", err.message);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });
  });
}

async function broadcastPricesToSubscribers() {
  const allSymbols = null;
  try {
    const allPrices = await fetchPrices(allSymbols);

    for (const [ws] of clients.entries()) {
      if (ws.readyState !== ws.OPEN) continue;

      if (allPrices.length > 0) {
        ws.send(JSON.stringify({ type: "priceUpdate", data: allPrices }));
      }
    }
  } catch (err) {
    console.error("❌ Error broadcasting prices:", err.message);
  }
}

async function fetchPrices(symbols) {
  symbols = ["BTCUSDT", "ETHUSDT", "ADAUSDT", "BNBUSDT", "XRPUSDT", "SUIUSDT"];

  const requests = symbols.map((symbol) =>
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`).then(
      (r) => r.json()
    )
  );

  const results = await Promise.all(requests);

  return results.map((item) => ({
    symbol: item.symbol,
    price: parseFloat(item.lastPrice),
    change: parseFloat(item.priceChangePercent),
  }));
}

function groupClientsByChart() {
  const groups = {};
  for (const [ws, { chart }] of clients.entries()) {
    if (!chart) continue;
    const key = `${chart.symbol}|${chart.interval}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(ws);
  }
  return groups;
}

const candleBuffers = {};
async function broadcastChartCandles() {
  const groups = groupClientsByChart();

  for (const key of Object.keys(groups)) {
    const [symbol, interval] = key.split("|");
    const data = await fetchLatestCandle(symbol, interval);
    if (!data) continue;

    const candle = {
      time: data.candle.time,
      open: data.candle.open,
      high: data.candle.high,
      low: data.candle.low,
      close: data.candle.close,
    };

    if (!candleBuffers[key]) candleBuffers[key] = [];
    const buffer = candleBuffers[key];
    buffer.push({ time: candle.time, close: candle.close });
    if (buffer.length > 100) buffer.shift();

    const closes = buffer.map((c) => c.close);
    const rsiArr = RSI.calculate({ period: 14, values: closes });
    const rsiValue = rsiArr[rsiArr.length - 1];

    // Tính Bollinger Bands nếu đủ nến
    let bollinger = null;
    if (buffer.length >= 20) {
      const bands = calcBollingerBands(buffer, 20, 2);
      if (bands.length > 0) {
        bollinger = bands[bands.length - 1];
      }
    }

    const payload = JSON.stringify({
      type: "candleUpdate",
      data: {
        ...candle,
        symbol,
        interval,
        rsi: rsiValue,
        bollinger: bollinger,
      },
    });

    for (const ws of groups[key]) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    }
  }
}

const INTERVAL_MAP = {
    '1': '1m',
    '3': '3m',
    '5': '5m',
    '10': '10m',
    '15': '15m',
    '30': '30m',
    '60': '1h',
    '120': '2h',
    '240': '4h',
    '1440': '1d',
    'D': '1d',
    '1D': '1d',
    'D1': '1d',
    '10080': '1w',
    'W': '1w',
    '1W': '1w',
    'W1': '1w',
    '43200': '1M',
    'M': '1M',
    '1M': '1M',
    'MN1': '1M',
    '1mo': '1M',
    '525600': '1M',
    'Y': '1M',
    '1Y': '1M',
    'Y1': '1M',
};

async function fetchLatestCandle(symbol, interval) {
  try {
    const binanceInterval = INTERVAL_MAP[interval] || INTERVAL_MAP[String(interval).toUpperCase()] || '1m';
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=1`;
    const res = await fetch(url);
    const raw = await res.json();
    const [time, open, high, low, close, volume] = raw[0];
    return {
      symbol,
      interval,
      candle: {
        time: time / 1000,
        open: +open,
        high: +high,
        low: +low,
        close: +close,
        volume: +volume,
      },
    };
  } catch (e) {
    console.error("❌ Fetch candle error", e.message);
    return null;
  }
}
