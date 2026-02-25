import { getBinancePrices } from "../services/binanceTickerService.js";
import { safeSend } from "../wsSend.js";
import { normalizeSymbol, setClientSymbolSubscriptions } from "../subscriptionIndex.js";

export function handleAuth({ ws, clients, mt5Prices, subscriptionIndex }, data) {
    const clientData = clients.get(ws);
    let requestedSymbols = [];
    if (clientData) {
        clientData.userId = data.userId || null;
        if (Array.isArray(data.symbols)) {
            const normalized = data.symbols.map((s) => normalizeSymbol(s)).filter(Boolean).slice(0, 300);
            clientData.symbols = setClientSymbolSubscriptions(subscriptionIndex, ws, normalized);
            requestedSymbols = clientData.symbols;
        }
    }

    // Immediately send current prices so the UI isn't empty on load
    const binanceData = getBinancePrices();
    const mt5Data = Array.from(mt5Prices.values());
    let combined = [...binanceData, ...mt5Data];

    if (requestedSymbols.length > 0) {
        const symbolSet = new Set(requestedSymbols);
        combined = combined.filter((item) => symbolSet.has(item.symbol));
    }

    if (combined.length > 0) {
        safeSend(ws, JSON.stringify({ topic: "priceUpdate", data: combined }), { nonCritical: true });
    }

    if (global.lastMt5State) {
        safeSend(ws, JSON.stringify({
            topic: "mt5_positions_update",
            account: global.lastMt5State.account,
            positions: global.lastMt5State.positions
        }));
    }

    if (global.mt5AvailableSymbols) {
        safeSend(ws, JSON.stringify({
            topic: "mt5_available_symbols",
            symbols: global.mt5AvailableSymbols
        }));
    }
}
