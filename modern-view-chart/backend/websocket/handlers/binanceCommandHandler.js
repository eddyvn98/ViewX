import { binanceTradingService } from "../../services/binanceTradingService.js";
import { logInfo, logWarn } from "../../logger.js";
import { tradeReconciliationService } from "../services/tradeReconciliationService.js";
// NOTE: To use Simulator, swap this import back to '../../services/binanceSimulator.js'

const TRADE_COMMANDS = new Set(["buy", "sell", "close"]);

function normalizeCommand(command) {
    return String(command || "").trim().toLowerCase();
}

function logTradeAudit(data, routeTarget, outcome, reason = null) {
    const command = normalizeCommand(data?.command);
    if (!TRADE_COMMANDS.has(command)) return;

    const payload = {
        topic: "binance_command",
        command,
        request_id: data?.request_id || data?.requestId || null,
        user_id: routeTarget?.userId || null,
        account_id: routeTarget?.accountId || null,
        outcome,
    };
    if (reason) payload.reason = reason;

    const logger = outcome === "error" || outcome === "rejected" ? logWarn : logInfo;
    logger("ws.trade.audit", payload);
}

function buildErrorEnvelope({ code, message, requestId, command, retryable = false }) {
    return {
        code,
        message,
        source: "binance_command_handler",
        retryable,
        request_id: requestId || null,
        command: normalizeCommand(command),
    };
}

export async function handleBinanceCommand(ws, data, { routeTarget = null } = {}) {
    try {
        const { command, symbol, quantity, price, ticket } = data;
        const requestId = data?.request_id || data?.requestId || null;
        const normalizedCommand = normalizeCommand(command);

        if (normalizedCommand === "buy" || normalizedCommand === "sell") {
            const type = price && parseFloat(price) > 0 ? "LIMIT" : "MARKET";

            const result = await binanceTradingService.placeOrder(
                symbol,
                normalizedCommand,
                type,
                quantity,
                price,
            );

            ws.send(
                JSON.stringify({
                    topic: "binance_order_result",
                    status: "success",
                    request_id: requestId,
                    data: result,
                }),
            );
            tradeReconciliationService.markImmediateResult({
                topic: "binance_command",
                command: normalizedCommand,
                requestId,
                routeTarget,
                status: "acknowledged",
            });
            logTradeAudit(data, routeTarget, "success");
            await broadcastBinanceUpdate(ws);
        } else if (normalizedCommand === "close") {
            if (ticket) {
                await binanceTradingService.cancelOrder(symbol, ticket);
                ws.send(
                    JSON.stringify({
                        topic: "binance_order_result",
                        status: "success",
                        request_id: requestId,
                        message: `Order ${ticket} cancelled`,
                    }),
                );
            }
            tradeReconciliationService.markImmediateResult({
                topic: "binance_command",
                command: normalizedCommand,
                requestId,
                routeTarget,
                status: "acknowledged",
            });
            logTradeAudit(data, routeTarget, "success");
            await broadcastBinanceUpdate(ws);
        } else if (normalizedCommand === "get_account") {
            await broadcastBinanceUpdate(ws);
        } else {
            logTradeAudit(data, routeTarget, "rejected", "unsupported_command");
            ws.send(
                JSON.stringify({
                    topic: "binance_error",
                    code: "unsupported_command",
                    request_id: requestId,
                    command: normalizedCommand,
                    message: `Unsupported command: ${normalizedCommand || "unknown"}`,
                    error: buildErrorEnvelope({
                        code: "unsupported_command",
                        message: `Unsupported command: ${normalizedCommand || "unknown"}`,
                        requestId,
                        command: normalizedCommand,
                        retryable: false,
                    }),
                }),
            );
        }
    } catch (error) {
        const requestId = data?.request_id || data?.requestId || null;
        const normalizedCommand = normalizeCommand(data?.command);
        const upstreamMessage = error?.response?.data?.msg || error?.message || "Unknown upstream error";
        logTradeAudit(
            data,
            routeTarget,
            "error",
            upstreamMessage,
        );
        ws.send(
            JSON.stringify({
                topic: "binance_error",
                code: "upstream_error",
                request_id: requestId,
                command: normalizedCommand,
                message: upstreamMessage,
                error: buildErrorEnvelope({
                    code: "upstream_error",
                    message: upstreamMessage,
                    requestId,
                    command: normalizedCommand,
                    retryable: true,
                }),
            }),
        );
        tradeReconciliationService.markImmediateResult({
            topic: "binance_command",
            command: normalizedCommand,
            requestId,
            routeTarget,
            status: "ambiguous",
        });
    }
}

async function broadcastBinanceUpdate(ws) {
    try {
        const accountInfo = await binanceTradingService.getAccountInfo();
        const openOrders = await binanceTradingService.getOpenOrders();

        const mappedAccount = {
            balance: parseFloat(accountInfo.balances.find((b) => b.asset === "USDT")?.free || 0),
            equity: parseFloat(accountInfo.balances.find((b) => b.asset === "USDT")?.free || 0),
            margin: 0,
            free_margin: parseFloat(accountInfo.balances.find((b) => b.asset === "USDT")?.free || 0),
            margin_level: 0,
            profit: 0,
        };

        const mappedPositions = openOrders.map((o) => ({
            ticket: o.orderId,
            symbol: o.symbol,
            type: o.side.toLowerCase(),
            volume: parseFloat(o.origQty),
            open_price: parseFloat(o.price),
            current_price: parseFloat(o.price),
            sl: 0,
            tp: 0,
            profit: 0,
            time: Math.floor(o.time / 1000),
            magic: 0,
            source: "BINANCE_DEMO",
        }));

        ws.send(
            JSON.stringify({
                topic: "binance_positions_update",
                account: mappedAccount,
                positions: mappedPositions,
                history: [],
            }),
        );
    } catch (e) {
        logWarn("ws.binance_update.broadcast_failed", { error: e?.message || String(e) });
    }
}
