// Throttle history broadcasts to prevent spam
let lastHistoryBroadcast = 0;
let lastHistoryHash = null;
const HISTORY_THROTTLE_MS = 5000; // 5 seconds

export function handleMt5History({ ws, clients }, data) {
    if (!ws.isBridge) {
        ws.isBridge = true;
    }

    // Pass through all metadata from the bridge (is_chunk, chunk_index, total_chunks, is_last_chunk)
    const payload = JSON.stringify({
        ...data,
        topic: "mt5_history_deals" // Ensure topic is correct
    });

    // Throttle: Check if same data was sent recently
    const now = Date.now();
    const historyHash = JSON.stringify(data.data?.slice(0, 3).map(d => d.ticket)); // Hash first 3 tickets

    if (historyHash === lastHistoryHash && (now - lastHistoryBroadcast) < HISTORY_THROTTLE_MS) {
        return;
    }

    for (const [clientWs] of clients.entries()) {
        if (clientWs !== ws && clientWs.readyState === clientWs.OPEN) {
            clientWs.send(payload);
        }
    }

    lastHistoryBroadcast = now;
    lastHistoryHash = historyHash;
}
