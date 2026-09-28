import { setBridgeOnline } from "../../runtime-state.js";
import { isRecipientForMt5Scope, resolveBridgeMt5Scope, scopeMetadata } from "../mt5Scope.js";

// Throttle history broadcasts to prevent spam
const lastHistoryBroadcastByScope = new Map();
const lastHistoryHashByScope = new Map();
const HISTORY_THROTTLE_MS = 5000; // 5 seconds

export function handleMt5History({ ws, clients }, data) {
    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;
    const mt5Scope = resolveBridgeMt5Scope(senderMeta);

    setBridgeOnline(true);

    // Pass through all metadata from the bridge (is_chunk, chunk_index, total_chunks, is_last_chunk)
    const payload = JSON.stringify({
        ...data,
        topic: "mt5_history_deals",
        source: mt5Scope.source,
        mt5_scope: scopeMetadata(mt5Scope),
    });

    // Throttle: Check if same data was sent recently
    const now = Date.now();
    const historyHash = JSON.stringify(data.data?.slice(0, 3).map(d => d.ticket)); // Hash first 3 tickets

    const lastHistoryHash = lastHistoryHashByScope.get(mt5Scope.scopeId);
    const lastHistoryBroadcast = lastHistoryBroadcastByScope.get(mt5Scope.scopeId) || 0;
    if (historyHash === lastHistoryHash && (now - lastHistoryBroadcast) < HISTORY_THROTTLE_MS) {
        return;
    }

    for (const [clientWs, meta] of clients.entries()) {
        if (clientWs === ws) continue;
        if (!isRecipientForMt5Scope(meta, mt5Scope)) continue;
        if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
        }
    }

    lastHistoryBroadcastByScope.set(mt5Scope.scopeId, now);
    lastHistoryHashByScope.set(mt5Scope.scopeId, historyHash);
}
