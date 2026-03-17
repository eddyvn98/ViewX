import { safeSend } from "../wsSend.js";

const virtualState = {
    balance: 10000,
    positions: [],
    history: [],
    ticketCounter: 9000000,
};

function resolvePrice(symbol, mt5Prices) {
    const mt5 = mt5Prices?.get?.(symbol);
    if (mt5 && Number.isFinite(Number(mt5.price))) return Number(mt5.price);
    return 0;
}

function emitState(ws) {
    const account = {
        balance: virtualState.balance,
        equity: virtualState.balance + virtualState.positions.reduce((sum, p) => sum + Number(p.profit || 0), 0),
        margin: 0,
        free_margin: virtualState.balance,
        margin_level: 0,
        profit: virtualState.positions.reduce((sum, p) => sum + Number(p.profit || 0), 0),
    };

    safeSend(ws, JSON.stringify({
        topic: "mt5_positions_update",
        account,
        positions: virtualState.positions.map((p) => ({
            ticket: p.ticket,
            symbol: p.symbol,
            type: p.type,
            volume: p.volume,
            price_open: p.open_price,
            price_current: p.current_price,
            sl: p.sl || 0,
            tp: p.tp || 0,
            profit: p.profit || 0,
            time: p.time,
            magic: p.magic || 0,
            source: "MT5",
        })),
        orders: [],
    }));
}

export function handleVirtualTradeCommand({ ws, mt5Prices }, data) {
    const command = String(data?.command || "").trim().toLowerCase();
    if (!command) return;

    if (command === "order" || command === "place_order" || command === "buy" || command === "sell") {
        const side = command === "buy" || command === "sell" ? command : String(data?.type || data?.order_type || "").trim().toLowerCase() || "buy";
        const symbol = String(data?.symbol || "").trim();
        const volume = Number.parseFloat(String(data?.volume ?? data?.quantity ?? "0")) || 0.01;
        const fallbackPrice = resolvePrice(symbol, mt5Prices);
        const openPrice = Number.parseFloat(String(data?.price || "0")) > 0 ? Number(data.price) : fallbackPrice;
        const ticket = virtualState.ticketCounter++;
        virtualState.positions.push({
            ticket,
            symbol,
            type: side === "sell" ? "sell" : "buy",
            volume,
            open_price: openPrice,
            current_price: openPrice,
            sl: Number(data?.sl || 0) || 0,
            tp: Number(data?.tp || 0) || 0,
            profit: 0,
            time: Math.floor(Date.now() / 1000),
            magic: 0,
        });

        safeSend(ws, JSON.stringify({ topic: "mt5_order_result", status: "success", ticket }));
        emitState(ws);
        return;
    }

    if (command === "modify") {
        const ticket = Number(data?.ticket);
        const pos = virtualState.positions.find((p) => p.ticket === ticket);
        if (!pos) return;
        if (data?.sl !== undefined) pos.sl = Number(data.sl) || 0;
        if (data?.tp !== undefined) pos.tp = Number(data.tp) || 0;
        safeSend(ws, JSON.stringify({ topic: "mt5_order_result", status: "success", ticket }));
        emitState(ws);
        return;
    }

    if (command === "close" || command === "delete") {
        const ticket = Number(data?.ticket);
        const idx = virtualState.positions.findIndex((p) => p.ticket === ticket);
        if (idx < 0) return;
        const pos = virtualState.positions[idx];
        pos.current_price = resolvePrice(pos.symbol, mt5Prices) || pos.current_price;
        pos.profit = ((pos.type === "buy" ? 1 : -1) * (pos.current_price - pos.open_price) * pos.volume) || 0;
        virtualState.balance += pos.profit;
        virtualState.history.unshift({
            ticket: pos.ticket,
            symbol: pos.symbol,
            volume: pos.volume,
            profit: pos.profit,
            time: Math.floor(Date.now() / 1000),
            source: "MT5",
        });
        virtualState.positions.splice(idx, 1);
        safeSend(ws, JSON.stringify({ topic: "mt5_order_result", status: "success", ticket }));
        emitState(ws);
    }
}
