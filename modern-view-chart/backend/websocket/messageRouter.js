import { handleAuth } from "./handlers/authHandler.js";
import { handleSubscribeCandle, handleSubscribeSymbols } from "./handlers/subscribeHandler.js";
import { handleMt5Update } from "./handlers/mt5UpdateHandler.js";
import { handleMt5Positions } from "./handlers/mt5PositionsHandler.js";
import { handleMt5Candles } from "./handlers/mt5CandlesHandler.js";
import { handleMt5History } from "./handlers/mt5HistoryHandler.js";
import { handleMt5SymbolInfo } from "./handlers/mt5SymbolInfoHandler.js";
import { handleMt5Command, handleMt5OrderResult } from "./handlers/mt5CommandHandler.js";
import { handleBinanceHistory } from "./handlers/binanceHistoryHandler.js";
import { handleBinanceCommand } from "./handlers/binanceCommandHandler.js";
import { handleAlertCommand } from "./handlers/alertCommandHandler.js";
import { handleAlertTriggered } from "./handlers/alertTriggeredHandler.js";
import { handleStrategySignal } from "./handlers/strategySignalHandler.js";
import { handleMt5SymbolsAvailable } from "./handlers/mt5SymbolsHandler.js";
import { handleVirtualTradeCommand } from "./handlers/virtualTradeHandler.js";
import { handleVnGoldCandles } from "./handlers/vnGoldCandlesHandler.js";
import { safeSend } from "./wsSend.js";
import { logInfo } from "../logger.js";
import { hasRequiredRole } from "../auth/roles.js";
import { emergencyConfig } from "../config/emergency.js";

const STRATEGY_ENGINE_ENABLED = ((process.env.STRATEGY_ENGINE_ENABLED || "0").trim() === "1");
const AI_ENABLED = ((process.env.AI_ENABLED || "0").trim() === "1");
const REQUIRED_TRADE_ROLE = (process.env.WS_REQUIRE_ROLE_FOR_TRADING || "trader").trim().toLowerCase();
const BRIDGE_TOPICS = new Set([
    "mt5_update",
    "mt5_positions_update",
    "mt5_symbols_available",
    "mt5_candles",
    "mt5_candles_at",
    "mt5_history_deals",
    "mt5_symbol_info",
    "mt5_order_result",
    "alert_triggered",
]);

function emitWsError(ws, code, detail) {
    safeSend(ws, JSON.stringify({ topic: "error", code, ...(detail ? { detail } : {}) }));
}

function isTradingCommandAllowed(meta) {
    if (!meta) return false;
    if (meta.authType === "service") return true;
    return hasRequiredRole(meta.role || "viewer", REQUIRED_TRADE_ROLE);
}

const MT5_READ_ONLY_COMMANDS = new Set([
    "get_candles",
    "get_candles_at",
    "get_history",
    "get_symbol_info",
    "get_positions",
    "get_orders",
    "get_account",
]);

const BINANCE_READ_ONLY_COMMANDS = new Set(["get_account"]);

function normalizeCommandName(command) {
    return String(command || "")
        .trim()
        .toLowerCase();
}

function isReadOnlyMt5Command(command) {
    return MT5_READ_ONLY_COMMANDS.has(normalizeCommandName(command));
}

function isReadOnlyBinanceCommand(command) {
    return BINANCE_READ_ONLY_COMMANDS.has(normalizeCommandName(command));
}

export function setupMessageRouter(clients, mt5Prices, subscriptionIndex, bridgeRegistry) {
    return async (ws, msg) => {
        try {
            const data = JSON.parse(msg.toString());
            const senderMeta = clients.get(ws);
            if (!senderMeta) return;

            const context = { ws, clients, mt5Prices, subscriptionIndex, bridgeRegistry };
            const msgTopic = data.topic || data.event || data.type;
            if (typeof msgTopic !== "string" || !msgTopic) return;

            if (BRIDGE_TOPICS.has(msgTopic) && !senderMeta.isBridgeAuthenticated) {
                emitWsError(ws, "forbidden", "bridge_topic_requires_authenticated_bridge");
                return;
            }

            switch (msgTopic) {
                case "auth":
                    handleAuth(context, data);
                    break;
                case "subscribeCandle":
                    handleSubscribeCandle(context, data);
                    break;
                case "subscribeSymbols":
                    handleSubscribeSymbols(context, data);
                    break;
                case "app_ping":
                    safeSend(ws, JSON.stringify({ topic: "app_pong", echoedAt: Date.now(), sentAt: data.sentAt || null }));
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
                case "mt5_order_result":
                    handleMt5OrderResult(context, data);
                    break;
                case "request_analysis":
                case "request_optimization": {
                    if (!AI_ENABLED) {
                        emitWsError(ws, "service_unavailable", "ai_temporarily_disabled");
                        break;
                    }
                    if (!STRATEGY_ENGINE_ENABLED) {
                        logInfo("strategy_engine.disabled_topic_ignored", { topic: msgTopic });
                        break;
                    }
                    const payload = JSON.stringify(data);
                    for (const [clientWs] of clients.entries()) {
                        if (clientWs.readyState === clientWs.OPEN) safeSend(clientWs, payload);
                    }
                    break;
                }
                case "mt5_candles":
                case "mt5_candles_at":
                    handleMt5Candles(context, data);
                    break;
                case "mt5_command":
                    if (emergencyConfig.enabled && emergencyConfig.blockTrading && !isReadOnlyMt5Command(data.command)) {
                        emitWsError(ws, "service_unavailable", "emergency_mode_trading_blocked");
                        return;
                    }
                    if (!isReadOnlyMt5Command(data.command) && !isTradingCommandAllowed(senderMeta)) {
                        handleVirtualTradeCommand(context, data);
                        return;
                    }
                    handleMt5Command(context, data);
                    break;
                case "alert_command":
                    if (emergencyConfig.enabled && emergencyConfig.blockTrading) {
                        emitWsError(ws, "service_unavailable", "emergency_mode_trading_blocked");
                        return;
                    }
                    if (!isTradingCommandAllowed(senderMeta)) {
                        emitWsError(ws, "forbidden", "trading_role_required");
                        return;
                    }
                    handleAlertCommand(context, data);
                    break;
                case "alert_triggered":
                    handleAlertTriggered(context, data);
                    break;
                case "get_binance_candles":
                    handleBinanceHistory(context, data);
                    break;
                case "get_vn_gold_candles":
                    await handleVnGoldCandles(context, data);
                    break;
                case "binance_command":
                    if (emergencyConfig.enabled && emergencyConfig.blockTrading && !isReadOnlyBinanceCommand(data.command)) {
                        emitWsError(ws, "service_unavailable", "emergency_mode_trading_blocked");
                        return;
                    }
                    if (!isReadOnlyBinanceCommand(data.command) && !isTradingCommandAllowed(senderMeta)) {
                        handleVirtualTradeCommand(context, data);
                        return;
                    }
                    handleBinanceCommand(context.ws, data);
                    break;
                case "strategy_signal":
                    if (!STRATEGY_ENGINE_ENABLED) {
                        logInfo("strategy_engine.disabled_topic_ignored", { topic: msgTopic });
                        break;
                    }
                    handleStrategySignal(context, data);
                    break;
                case "mt5_symbols_available":
                    handleMt5SymbolsAvailable(context, data);
                    break;
                default:
                    logInfo("ws.topic.unknown", { topic: msgTopic });
            }
        } catch (error) {
            logInfo("ws.message.error", { error: error?.message || String(error) });
        }
    };
}
