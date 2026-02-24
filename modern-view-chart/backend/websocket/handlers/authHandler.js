import { getBinancePrices } from "../services/binanceTickerService.js";

export function handleAuth({ ws, clients, mt5Prices }, data) {
    const clientData = clients.get(ws);
    let requestedSymbols = [];
    if (clientData) {
        clientData.userId = data.userId || null;
        if (Array.isArray(data.symbols)) {
            clientData.symbols = data.symbols.filter(Boolean).slice(0, 300);
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
        ws.send(JSON.stringify({ topic: "priceUpdate", data: combined }));
    }

    if (global.lastMt5State) {
        ws.send(JSON.stringify({
            topic: "mt5_positions_update",
            account: global.lastMt5State.account,
            positions: global.lastMt5State.positions
        }));
    }

    if (global.mt5AvailableSymbols) {
        ws.send(JSON.stringify({
            topic: "mt5_available_symbols",
            symbols: global.mt5AvailableSymbols
        }));
    }
}
