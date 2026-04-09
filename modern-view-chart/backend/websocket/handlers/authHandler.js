import { getBinancePrices } from "../services/binanceTickerService.js";
import { safeSend } from "../wsSend.js";
import { normalizeSymbol, setClientSymbolSubscriptions } from "../subscriptionIndex.js";
import { getScopedMt5Prices, getScopedMt5State, getScopedMt5Symbols } from "../mt5Scope.js";

export function handleAuth({ ws, clients, mt5Prices, subscriptionIndex }, data) {
    const clientData = clients.get(ws);
    let requestedSymbols = [];
    if (clientData) {
        if (Array.isArray(data.symbols)) {
            const normalized = data.symbols.map((s) => normalizeSymbol(s)).filter(Boolean).slice(0, 300);
            clientData.symbols = setClientSymbolSubscriptions(subscriptionIndex, ws, normalized);
            requestedSymbols = clientData.symbols;
        }
    }

    // Immediately send current prices so the UI isn't empty on load
    const binanceData = getBinancePrices();
    const mt5Data = getScopedMt5Prices(mt5Prices, clientData?.userId || null);
    let combined = [...binanceData, ...mt5Data];

    if (requestedSymbols.length > 0) {
        const symbolSet = new Set(requestedSymbols);
        combined = combined.filter((item) => symbolSet.has(item.symbol));
    }

    if (combined.length > 0) {
        safeSend(ws, JSON.stringify({ topic: "priceUpdate", data: combined }), { nonCritical: true });
    }

    const scopedMt5State = getScopedMt5State(clientData?.userId || null);
    if (scopedMt5State) {
        safeSend(ws, JSON.stringify({
            topic: "mt5_positions_update",
            account: scopedMt5State.account,
            positions: scopedMt5State.positions,
            orders: scopedMt5State.orders || []
        }));
    }

    const scopedMt5Symbols = getScopedMt5Symbols(clientData?.userId || null);
    if (scopedMt5Symbols.length > 0) {
        safeSend(ws, JSON.stringify({
            topic: "mt5_available_symbols",
            symbols: scopedMt5Symbols
        }));
    }
}
