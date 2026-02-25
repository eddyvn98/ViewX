export const runtimeState = {
    bridgeOnline: false,
    wsClients: 0,
    wsDroppedRateLimit: 0,
    wsDroppedBackpressure: 0,
    wsBufferPressure: 0,
    broadcastLoopMsP95: 0,
};

export function setBridgeOnline(online) {
    runtimeState.bridgeOnline = Boolean(online);
}

export function setWsClients(count) {
    runtimeState.wsClients = Number.isFinite(count) ? count : 0;
}

export function incrementWsDroppedRateLimit() {
    runtimeState.wsDroppedRateLimit += 1;
}

export function incrementWsDroppedBackpressure() {
    runtimeState.wsDroppedBackpressure += 1;
}

export function setWsBufferPressure(value) {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    runtimeState.wsBufferPressure = normalized;
}

const broadcastLoopSamples = [];
const MAX_BROADCAST_SAMPLES = 120;

export function recordBroadcastLoopDuration(durationMs) {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    broadcastLoopSamples.push(durationMs);
    if (broadcastLoopSamples.length > MAX_BROADCAST_SAMPLES) {
        broadcastLoopSamples.shift();
    }

    if (broadcastLoopSamples.length === 0) {
        runtimeState.broadcastLoopMsP95 = 0;
        return;
    }

    const sorted = [...broadcastLoopSamples].sort((a, b) => a - b);
    const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
    runtimeState.broadcastLoopMsP95 = Math.round(sorted[index]);
}
