import { binanceTradingService } from '../../services/binanceTradingService.js';
// NOTE: To use Simulator, swap this import back to '../../services/binanceSimulator.js'

export async function handleBinanceCommand(ws, data) {
    try {
        const { command, symbol, quantity, price, ticket } = data; // ticket is effectively orderId here
        const requestId = data?.request_id || data?.requestId || null;

        console.log(`📥 Binance Command (REAL): ${command} ${symbol || ''}`);

        if (command === 'buy' || command === 'sell') {
            // Determine Order Type: LIMIT if price is set, otherwise MARKET
            const type = price && parseFloat(price) > 0 ? 'LIMIT' : 'MARKET';

            const result = await binanceTradingService.placeOrder(
                symbol,
                command,
                type,
                quantity,
                price
            );

            ws.send(JSON.stringify({
                topic: 'binance_order_result',
                status: 'success',
                request_id: requestId,
                data: result
            }));

            // Immediately fetch update
            await broadcastBinanceUpdate(ws);
        }
        else if (command === 'close') {
            // For Binance Spot, "close" usually means selling the asset, but here we treat 'ticket' as Order ID to cancel
            // Or if it's a position, we might need a SELL order.
            // Assuming 'ticket' is orderId for PENDING orders.
            // For OPEN positions, we need to know the amount to sell.

            // Simplification: If ticket exists, try to cancel order.
            if (ticket) {
                await binanceTradingService.cancelOrder(symbol, ticket);
                ws.send(JSON.stringify({
                    topic: 'binance_order_result',
                    status: 'success',
                    request_id: requestId,
                    message: `Order ${ticket} cancelled`
                }));
            }
            await broadcastBinanceUpdate(ws);
        }
        else if (command === 'get_account') {
            await broadcastBinanceUpdate(ws);
        }

    } catch (error) {
        console.error('Binance Command Error:', error.message);
        ws.send(JSON.stringify({
            topic: 'binance_error',
            request_id: data?.request_id || data?.requestId || null,
            message: error.response?.data?.msg || error.message
        }));
    }
}

async function broadcastBinanceUpdate(ws) {
    try {
        const accountInfo = await binanceTradingService.getAccountInfo();
        // We might want to fetch open orders or trades here too to map to "Positions"
        const openOrders = await binanceTradingService.getOpenOrders(); // Optional: pass symbol

        // Map Binance structure to our Position/Account structure
        const mappedAccount = {
            balance: parseFloat(accountInfo.balances.find(b => b.asset === 'USDT')?.free || 0),
            equity: parseFloat(accountInfo.balances.find(b => b.asset === 'USDT')?.free || 0), // Approx
            margin: 0,
            free_margin: parseFloat(accountInfo.balances.find(b => b.asset === 'USDT')?.free || 0),
            margin_level: 0,
            profit: 0 // Need comprehensive calculation
        };

        const mappedPositions = openOrders.map(o => ({
            ticket: o.orderId,
            symbol: o.symbol,
            type: o.side.toLowerCase(),
            volume: parseFloat(o.origQty),
            open_price: parseFloat(o.price),
            current_price: parseFloat(o.price), // Placeholder
            sl: 0, tp: 0,
            profit: 0,
            time: Math.floor(o.time / 1000),
            magic: 0,
            source: 'BINANCE_DEMO'
        }));

        ws.send(JSON.stringify({
            topic: "binance_positions_update",
            account: mappedAccount,
            positions: mappedPositions,
            history: [] // Implement fetchTradeHistory if needed
        }));
    } catch (e) {
        console.error("Failed to broadcast binance update", e);
    }
}
