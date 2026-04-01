import { setBridgeOnline } from "../../runtime-state.js";
import { bridgeRegistry, resolveBridgeKey } from "../bridgeRegistry.js";

export function handleMt5Positions({ ws, clients, routeTarget }, data) {
    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;

    setBridgeOnline(true);
    const scopedState = {
        account: data.account,
        positions: data.positions,
        orders: data.orders || [],
        mt5_source: data.mt5_source || "MT5",
    };
    const routeKey = resolveBridgeKey(routeTarget || senderMeta);
    if (routeKey) {
        if (!global.mt5StateByRoute) global.mt5StateByRoute = new Map();
        const storageKey = `${routeKey.userId}::${routeKey.accountId}::${routeKey.terminalId}`;
        global.mt5StateByRoute.set(storageKey, scopedState);
    }

    const payload = JSON.stringify({
        topic: "mt5_positions_update",
        account: scopedState.account,
        positions: scopedState.positions,
        orders: scopedState.orders,
        mt5_source: scopedState.mt5_source,
    });

    const recipients = bridgeRegistry.getTargetClientSockets(clients, routeTarget || senderMeta, { excludeWs: ws });
    for (const clientWs of recipients) {
        clientWs.send(payload);
    }
}
