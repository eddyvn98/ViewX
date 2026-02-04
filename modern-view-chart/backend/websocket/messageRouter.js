import { handleAuth } from "./handlers/authHandler.js";
import { handleSubscribeCandle } from "./handlers/subscribeHandler.js";
import { handleMt5Update } from "./handlers/mt5UpdateHandler.js";
import { handleMt5Positions } from "./handlers/mt5PositionsHandler.js";
import { handleMt5Candles } from "./handlers/mt5CandlesHandler.js";
import { handleMt5History } from "./handlers/mt5HistoryHandler.js";
import { handleMt5SymbolInfo } from "./handlers/mt5SymbolInfoHandler.js";
import { handleMt5Command } from "./handlers/mt5CommandHandler.js";
import { handleBinanceHistory } from "./handlers/binanceHistoryHandler.js";
import { handleBinanceCommand } from "./handlers/binanceCommandHandler.js";
import { handleAlertCommand } from "./handlers/alertCommandHandler.js";
import { handleAlertTriggered } from "./handlers/alertTriggeredHandler.js";
import { handleStrategySignal } from "./handlers/strategySignalHandler.js";

export function setupMessageRouter(clients, mt5Prices) {
    return async (ws, msg) => {
        try {
            const data = JSON.parse(msg.toString());
            const context = { ws, clients, mt5Prices };
            const msgTopic = data.topic || data.event || data.type;

            switch (msgTopic) {
                case "auth":
                    handleAuth(context, data);
                    break;
                case "subscribeCandle":
                    handleSubscribeCandle(context, data);
                    break;
                case "mt5_update":
                    handleMt5Update(context, data);
                    break;
                case "mt5_positions_update":
                    handleMt5Positions(context, data);
                    break;
                case "mt5_history_deals":
                    handleMt5History(context, data);
                    break;
                case "mt5_symbol_info":
                    handleMt5SymbolInfo(context, data);
                    break;
                case "request_analysis": // Forward analysis request to Strategy Engine
                case "request_optimization": // Forward optimization request to Strategy Engine
                    // Re-use Mt5Command broadcaster or simple broadcast
                    // Simple broadcast to all clients (Engine will pick it up)
                    const payload = JSON.stringify(data);
                    for (const [clientWs] of clients.entries()) {
                        if (clientWs.readyState === clientWs.OPEN) clientWs.send(payload);
                    }
                    break;
                case "mt5_candles":
                case "mt5_candles_at": // Reuse handler for historical request
                    handleMt5Candles(context, data);
                    break;
                case "mt5_command":
                    handleMt5Command(context, data);
                    break;
                case "alert_command":
                    handleAlertCommand(context, data);
                    break;
                case "alert_triggered":
                    handleAlertTriggered(context, data);
                    break;
                case "get_binance_candles":
                    handleBinanceHistory(context, data);
                    break;
                case "binance_command":
                    handleBinanceCommand(context.ws, data);
                    break;
                case "strategy_signal":
                    handleStrategySignal(context, data);
                    break;
                default:
                    console.warn(`Unknown message topic: ${msgTopic}`);
            }
        } catch (err) {
            console.error("❌ WS message error:", err.message);
        }
    };
}
