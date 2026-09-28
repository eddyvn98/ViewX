import { setBridgeOnline } from "../../runtime-state.js";
import { isRecipientForMt5Scope, resolveBridgeMt5Scope, setScopedMt5State, scopeMetadata } from "../mt5Scope.js";

export function handleMt5Positions({ ws, clients }, data) {
    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;
    const mt5Scope = resolveBridgeMt5Scope(senderMeta);

    setBridgeOnline(true);
    setScopedMt5State(mt5Scope, {
        account: data.account,
        positions: data.positions,
        orders: data.orders || []
    });

    const payload = JSON.stringify({
        topic: "mt5_positions_update",
        account: data.account,
        positions: data.positions,
        orders: data.orders || [],
        source: mt5Scope.source,
        mt5_scope: scopeMetadata(mt5Scope),
    });

    for (const [clientWs, meta] of clients.entries()) {
        if (!isRecipientForMt5Scope(meta, mt5Scope)) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
        }
    }
}
