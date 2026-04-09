import { setBridgeOnline } from "../../runtime-state.js";
import { isRecipientForMt5Owner, resolveBridgeOwnerUserId, setScopedMt5State } from "../mt5Scope.js";

export function handleMt5Positions({ ws, clients }, data) {
    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;
    const ownerUserId = resolveBridgeOwnerUserId(senderMeta);

    setBridgeOnline(true);
    setScopedMt5State(ownerUserId, {
        account: data.account,
        positions: data.positions,
        orders: data.orders || []
    });

    const payload = JSON.stringify({
        topic: "mt5_positions_update",
        account: data.account,
        positions: data.positions,
        orders: data.orders || []
    });

    for (const [clientWs, meta] of clients.entries()) {
        if (!isRecipientForMt5Owner(meta, ownerUserId)) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
        }
    }
}
