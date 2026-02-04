import { getBinancePrices } from '../websocket/services/binanceTickerService.js';

// Global state for simulation
let account = {
    balance: 10000,
    equity: 10000,
    margin: 0,
    free_margin: 10000,
    margin_level: 0,
    profit: 0
};

let positions = [];
let history = [];
let ticketCounter = 5000000;

export const binanceSimulator = {
    getAccount: () => {
        const currentProfit = positions.reduce((sum, p) => sum + p.profit, 0);
        return {
            ...account,
            profit: currentProfit,
            equity: account.balance + currentProfit,
            free_margin: account.balance + currentProfit - account.margin
        };
    },

    getPositions: () => positions,

    getHistory: () => history,

    // Called by a timer to update PnL based on latest market prices
    updatePnL: () => {
        const prices = getBinancePrices();
        const priceMap = new Map(prices.map(p => [p.symbol, p.price]));

        positions.forEach(pos => {
            const currentPrice = priceMap.get(pos.symbol);
            if (currentPrice) {
                pos.current_price = currentPrice;
                const pnl = (pos.type === 'buy' ? 1 : -1) * (currentPrice - pos.open_price) * pos.volume;
                pos.profit = pnl;
            }
        });
    },

    openPosition: (symbol, type, volume, price) => {
        const ticket = ticketCounter++;
        const openPrice = price || getPriceForSymbol(symbol) || 0;

        const newPos = {
            ticket: ticket,
            symbol: symbol,
            type: type, // 'buy' or 'sell'
            volume: parseFloat(volume),
            open_price: openPrice,
            current_price: openPrice,
            sl: 0,
            tp: 0,
            profit: 0,
            time: Math.floor(Date.now() / 1000),
            magic: 8888, // Identification for Binance Demo
            source: 'BINANCE_DEMO'
        };

        positions.push(newPos);
        return newPos;
    },

    closePosition: (ticket) => {
        const index = positions.findIndex(p => p.ticket === ticket);
        if (index !== -1) {
            const pos = positions[index];
            positions.splice(index, 1);

            // Add to history
            const closedDeal = {
                ticket: pos.ticket,
                time: Math.floor(Date.now() / 1000),
                type: pos.type,
                entry: 'out',
                symbol: pos.symbol,
                volume: pos.volume,
                price: pos.current_price,
                profit: pos.profit,
                swap: 0,
                commission: 0,
                magic: pos.magic,
                source: 'BINANCE_DEMO'
            };

            history.unshift(closedDeal);
            account.balance += pos.profit;
            return true;
        }
        return false;
    }
};

function getPriceForSymbol(symbol) {
    const prices = getBinancePrices();
    const p = prices.find(x => x.symbol === symbol);
    return p ? p.price : 0;
}
