import { setBridgeOnline } from "../../runtime-state.js";
import { bridgeRegistry } from "../bridgeRegistry.js";

// Throttle history broadcasts to prevent spam
let lastHistoryBroadcast = 0;
let lastHistoryHash = null;
const HISTORY_THROTTLE_MS = 5000; // 5 seconds

export function handleMt5History({ ws, clients, routeTarget }, data) {
    const senderMeta = clients.get(ws);
    if (!senderMeta?.isBridgeAuthenticated) return;

    setBridgeOnline(true);

    // Pass through all metadata from the bridge (is_chunk, chunk_index, total_chunks, is_last_chunk)
    const payload = JSON.stringify({
        ...data,
        topic: "mt5_history_deals" // Ensure topic is correct
    });

    // Throttle: Check if same data was sent recently
    const now = Date.now();
    const historyTickets = Array.isArray(data.data)
        ? data.data.slice(0, 3).map((d) => d?.ticket).filter((ticket) => ticket !== undefined && ticket !== null)
        : [];
    const historyHash = JSON.stringify(historyTickets); // Hash first 3 tickets

    if (historyHash === lastHistoryHash && (now - lastHistoryBroadcast) < HISTORY_THROTTLE_MS) {
        return;
    }

    const recipients = bridgeRegistry.getTargetClientSockets(clients, routeTarget || senderMeta, { excludeWs: ws });
    for (const clientWs of recipients) {
        clientWs.send(payload);
    }

    lastHistoryBroadcast = now;
    lastHistoryHash = historyHash;
}
