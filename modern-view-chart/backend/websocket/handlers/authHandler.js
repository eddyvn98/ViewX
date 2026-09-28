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

    // Immediately send current prices so the UI isn't empty on load, but only
    // materialize the symbols this client actually needs. Walking the full Binance
    // market for every reconnect can stall the shared broadcast loop during ramp-up.
    const initialSymbols = requestedSymbols.length > 0
        ? requestedSymbols
        : (subscriptionIndex.coreSymbols || []);
    const symbolSet = new Set(initialSymbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean));
    const binanceData = getBinancePrices(initialSymbols);
    const mt5Data = getScopedMt5Prices(mt5Prices, clientData?.userId || null)
        .filter((item) => symbolSet.size === 0 || symbolSet.has(normalizeSymbol(item?.symbol)));
    const combined = [...binanceData, ...mt5Data];

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
