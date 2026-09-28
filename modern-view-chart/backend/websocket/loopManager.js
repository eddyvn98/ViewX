import { broadcastPricesToSubscribers, broadcastChartCandles } from "./services/broadcastService.js";
import { binanceSimulator } from "../services/binanceSimulator.js";
import { collectInterestSymbolsFromIndex } from "./subscriptionIndex.js";
import { safeSend } from "./wsSend.js";
import { recordBroadcastLoopDuration } from "../runtime-state.js";
import { isRecipientForMt5Owner, resolveBridgeOwnerUserId } from "./mt5Scope.js";

function broadcastBinanceState(clients) {
    const payload = JSON.stringify({
        topic: "binance_positions_update",
        account: binanceSimulator.getAccount(),
        positions: binanceSimulator.getPositions(),
        history: binanceSimulator.getHistory(),
    });

    for (const [clientWs, meta] of clients.entries()) {
        if (meta?.isBridgeAuthenticated) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            safeSend(clientWs, payload, { nonCritical: true });
        }
    }
}

function startPriceBroadcast({ clients, mt5Prices, subscriptionIndex }, intervalMs) {
    let running = false;
    return setInterval(() => {
        if (running) return;
        running = true;
        const startAt = Date.now();

        Promise.resolve()
            .then(async () => {
                await Promise.all([
                    broadcastPricesToSubscribers({ clients, mt5Prices, subscriptionIndex }),
                    broadcastChartCandles({ clients, mt5Prices, subscriptionIndex }),
                ]);
            })
            .finally(() => {
                recordBroadcastLoopDuration(Date.now() - startAt);
                running = false;
            });
    }, Math.max(250, intervalMs));
}

function startBinanceBroadcast({ clients, intervalMs }) {
    return setInterval(() => {
        binanceSimulator.updatePnL();
        broadcastBinanceState(clients);
    }, Math.max(500, intervalMs));
}

function startInterestChecker({ clients, subscriptionIndex, bridgeSymbolsRefreshSec }) {
    const lastInterestHashByScope = new Map();
    return setInterval(() => {
        const bridgeSockets = [];
        for (const [ws, meta] of clients.entries()) {
            if (meta?.isBridgeAuthenticated && ws.readyState === ws.OPEN) bridgeSockets.push([ws, meta]);
        }
        if (bridgeSockets.length === 0) return;

        for (const [bridgeWs, bridgeMeta] of bridgeSockets) {
            const ownerUserId = resolveBridgeOwnerUserId(bridgeMeta);
            const scopeKey = ownerUserId || "__global__";
            const symbols = collectInterestSymbolsFromIndex(subscriptionIndex, (clientWs) => {
                const clientMeta = clients.get(clientWs);
                return isRecipientForMt5Owner(clientMeta, ownerUserId);
            });
            const hash = symbols.join("|");
            if (lastInterestHashByScope.get(scopeKey) === hash) continue;
            lastInterestHashByScope.set(scopeKey, hash);

            const payload = JSON.stringify({
                topic: "bridge_symbols_interest",
                symbols,
                source: "client_interest",
                updated_at: Date.now(),
            });

            safeSend(bridgeWs, payload);
        }
    }, Math.max(1, bridgeSymbolsRefreshSec) * 1000);
}

function startHeartbeat({ clients, heartbeatIntervalMs }) {
    return setInterval(() => {
        for (const [ws] of clients.entries()) {
            if (ws.readyState !== ws.OPEN) continue;
            if (ws.isAlive === false) {
                ws.terminate();
                continue;
            }
            ws.isAlive = false;
            try {
                ws.ping();
            } catch {
                ws.terminate();
            }
        }
    }, Math.max(5000, heartbeatIntervalMs));
}

export function startPeriodicTasks({
    clients,
    mt5Prices,
    subscriptionIndex,
    wsBroadcastIntervalMs,
    binanceBroadcastIntervalMs,
    bridgeSymbolsRefreshSec,
    heartbeatIntervalMs,
}) {
    const intervals = [
        startPriceBroadcast({ clients, mt5Prices, subscriptionIndex }, wsBroadcastIntervalMs),
        startBinanceBroadcast({ clients, intervalMs: binanceBroadcastIntervalMs }),
        startInterestChecker({ clients, subscriptionIndex, bridgeSymbolsRefreshSec }),
        startHeartbeat({ clients, heartbeatIntervalMs }),
    ];

    return () => {
        for (const id of intervals) {
            clearInterval(id);
        }
    };
}
