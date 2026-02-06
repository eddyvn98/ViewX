import { getBinancePrices } from "../services/binanceTickerService.js";

export function handleAuth({ ws, clients, mt5Prices }, data) {
    const clientData = clients.get(ws);
    if (clientData) {
        clientData.userId = data.userId || null;
    }

    // Immediately send current prices so the UI isn't empty on load
    const binanceData = getBinancePrices();
    const mt5Data = Array.from(mt5Prices.values());
    const combined = [...binanceData, ...mt5Data];

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
}
