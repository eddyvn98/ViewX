import { setBridgeOnline } from "../../runtime-state.js";
import { bridgeRegistry } from "../bridgeRegistry.js";

export function handleMt5Positions({ ws, clients, routeTarget }, data) {
    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;

    setBridgeOnline(true);
    global.lastMt5State = {
        account: data.account,
        positions: data.positions,
        orders: data.orders || []
    };

    const payload = JSON.stringify({
        topic: "mt5_positions_update",
        account: data.account,
        positions: data.positions,
        orders: data.orders || []
    });

    const recipients = bridgeRegistry.getTargetClientSockets(clients, routeTarget || senderMeta, { excludeWs: ws });
    for (const clientWs of recipients) {
        clientWs.send(payload);
    }
}
