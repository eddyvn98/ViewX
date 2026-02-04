// websocket.js
import { WebSocketServer } from "ws";
import { RSI } from "technicalindicators";
import fetch from "node-fetch";
import { calcBollingerBands } from "./services/indicators.js";

const clients = new Map();
const mt5Prices = new Map(); // Store latest MT5 prices

export default function initWebSocket(server) {
  const wss = new WebSocketServer({ server });

  setInterval(broadcastPricesToSubscribers, 3000);
  setInterval(broadcastChartCandles, 1000); // Reduced to 1s for better responsiveness

  wss.on("connection", (ws) => {
    clients.set(ws, { userId: null, symbols: [], chart: null });

    ws.on("message", (msg) => {
      try {
        const raw = msg.toString();
        const data = JSON.parse(raw);
        // ...
        // Handle MT5 Bridge data
        if (data.type === "mt5_update") {
          mt5Prices.set(data.symbol, {
            symbol: data.symbol,
            price: data.price,
            ask: data.ask,
            change: 0,
            source: 'MT5',
            serverTime: data.time
          });

          // Optional: Immediate broadcast for MT5 prices
          const payload = JSON.stringify({ type: "priceUpdate", data: [mt5Prices.get(data.symbol)] });
          for (const [clientWs] of clients.entries()) {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(payload);
            }
          }

          // IMMEDIATE CANDLE UPDATE FOR MT5
          broadcastCandleForSymbol(data.symbol, data.price);
        }

        // ... auth and subscribe logic ...

        // Detect Bridge
        if ((data.type === "mt5_update" || data.type === "mt5_positions_update") && !ws.isBridge) {
          ws.isBridge = true;
          console.log("✅ MT5 Bridge Connected!");
          broadcastBridgeStatus(true);
        }

        // Handle MT5 Bridge data

        if (data.type === "auth") {
          clients.get(ws).userId = data.userId || null;

          // Send cached MT5 state immediately after auth
          if (global.lastMt5State) {
            ws.send(JSON.stringify({
              type: "mt5_positions_update",
              account: global.lastMt5State.account,
              positions: global.lastMt5State.positions
            }));
          }
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

        // Handle MT5 Positions Update from Bridge
        if (data.type === "mt5_positions_update") {
          // Cache the latest state
          global.lastMt5State = {
            account: data.account,
            positions: data.positions,
            orders: data.orders || []
          };

          const payload = JSON.stringify({
            type: "mt5_positions_update",
            account: data.account,
            positions: data.positions,
            orders: data.orders || []
          });
          for (const [clientWs] of clients.entries()) {
            // Only send to non-bridge clients
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(payload);
            }
          }
        }

        // Handle MT5 Candles Response from Bridge
        if (data.type === "mt5_candles") {
          // Forward to all non-bridge clients
          const payload = JSON.stringify(data);
          for (const [clientWs] of clients.entries()) {
            if (clientWs.readyState === clientWs.OPEN && !clientWs.isBridge) {
              clientWs.send(payload);
            }
          }
        }

        // Handle Commands from Frontend to Bridge
        if (data.type === "mt5_command") {
          // Find the bridge connection (we could tag it on connection)
          // For now, broadcast to all but in production we'd target the bridge
          for (const [clientWs] of clients.entries()) {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify(data));
            }
          }
        }

        // Handle Binance History Request
        if (data.type === "get_binance_candles") {
          fetchBinanceHistory(data.symbol, data.interval).then(candles => {
            if (candles) {
              ws.send(JSON.stringify({
                type: "mt5_candles",
                symbol: data.symbol,
                candles: candles
              }));
            }
          });
        }
      } catch (err) {
        console.error("❌ WS parse error:", err.message);
      }
    });

    ws.on("close", () => {
      if (ws.isBridge) {
        console.log("❌ MT5 Bridge Disconnected!");
        broadcastBridgeStatus(false);
      }
      clients.delete(ws);
    });
  });
}

function broadcastBridgeStatus(online) {
  const payload = JSON.stringify({ type: "bridgeStatus", online });
  for (const [clientWs] of clients.entries()) {
    if (clientWs.readyState === clientWs.OPEN) {
      clientWs.send(payload);
    }
  }
}

async function broadcastPricesToSubscribers() {
  const allSymbols = null;
  try {
    const allPrices = await fetchPrices(allSymbols);

    for (const [ws] of clients.entries()) {
      if (ws.readyState !== ws.OPEN) continue;

      if (allPrices.length > 0) {
        // Merge MT5 prices into the update
        const mt5Data = Array.from(mt5Prices.values());
        const combinedPrices = [...allPrices, ...mt5Data];
        ws.send(JSON.stringify({ type: "priceUpdate", data: combinedPrices }));
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
    source: 'BINANCE'
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

async function broadcastCandleForSymbol(symbolTarget, priceRaw = null) {
  const groups = groupClientsByChart();

  // Find groups matching this symbol
  const keys = Object.keys(groups).filter(k => k.startsWith(`${symbolTarget}|`));

  for (const key of keys) {
    const [symbol, interval] = key.split("|");

    // Optimization: If we have raw price from MT5, use it directly to construct candle 
    // instead of fetching (though fetchLatestCandle handles cache lookup too)
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

    // Only add if time changed or it's the latest update? 
    // Actually for realtime we just want to push the "current" candle state.
    // The buffer logic usually tracks *closed* candles or history. 
    // Here we just push the current tick as a "live" candle update.

    // We update the buffer's last element if it's the same time, or push new?
    // Simplified logic: Just push to buffer to calc indicators, assuming buffer handles "ticks" or "closed candles"?
    // The original logic just pushed everything. Let's keep it simple:
    buffer.push({ time: candle.time, close: candle.close });
    if (buffer.length > 100) buffer.shift();

    const closes = buffer.map((c) => c.close);
    const rsiArr = RSI.calculate({ period: 14, values: closes });
    const rsiValue = rsiArr[rsiArr.length - 1];

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

    console.log(`📡 Broadcasting candleUpdate for ${symbol}|${interval} to ${groups[key].length} clients. Time: ${candle.time}`);

    for (const ws of groups[key]) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    }
  }
}

async function broadcastChartCandles() {
  const groups = groupClientsByChart();
  // Get unique symbols to update
  const uniqueSymbols = new Set(Object.keys(groups).map(k => k.split("|")[0]));

  for (const symbol of uniqueSymbols) {
    await broadcastCandleForSymbol(symbol);
  }
}

async function fetchLatestCandle(symbol, interval) {
  // Check MT5 Cache first
  if (mt5Prices.has(symbol) || symbol.endsWith('m')) {
    const p = mt5Prices.get(symbol);
    if (!p) return null;

    // Calculate candle open time based on interval
    // Use MT5 server time (milliseconds) instead of Date.now()
    const minutes = parseInt(interval) || 15;
    const secondsPerCandle = minutes * 60;

    // If we have MT5 serverTime, use it; otherwise fallback to Date.now()
    const nowSeconds = p.serverTime
      ? Math.floor(p.serverTime / 1000)
      : Math.floor(Date.now() / 1000);

    const candleTime = Math.floor(nowSeconds / secondsPerCandle) * secondsPerCandle;

    return {
      symbol, interval,
      candle: {
        time: candleTime,
        open: p.price,
        high: p.price,
        low: p.price,
        close: p.price,
        volume: 0
      }
    };
  }

  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const raw = await res.json();

    // Validate response format
    if (!Array.isArray(raw) || raw.length === 0 || !Array.isArray(raw[0])) return null;

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
    // console.error("❌ Fetch candle error", e.message);
    return null;
  }
}

async function fetchBinanceHistory(symbol, interval) {
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=500`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const raw = await res.json();

    if (!Array.isArray(raw)) return [];

    return raw.map(k => ({
      time: k[0] / 1000,
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));
  } catch (err) {
    console.error("❌ Error fetching Binance history:", err.message);
    return [];
  }
}
