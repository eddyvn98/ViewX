export const runtimeState = {
    bridgeOnline: false,
    bridgeRegistered: 0,
    bridgeRouteMisses: 0,
    wsClients: 0,
    wsDroppedRateLimit: 0,
    wsDroppedBackpressure: 0,
    wsBufferPressure: 0,
    broadcastLoopMsP95: 0,
    broadcastStageP95Ms: {
        price: 0,
        price_sources: 0,
        price_scope: 0,
        price_send: 0,
        candle: 0,
        candle_fetch: 0,
        candle_indicator: 0,
        candle_serialize_send: 0,
    },
};

export function setBridgeOnline(online) {
    runtimeState.bridgeOnline = Boolean(online);
}

export function setBridgeRegistered(count) {
    runtimeState.bridgeRegistered = Number.isFinite(count) ? Math.max(0, count) : 0;
}

export function incrementBridgeRouteMiss() {
    runtimeState.bridgeRouteMisses += 1;
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
const BROADCAST_STAGE_NAMES = new Set(Object.keys(runtimeState.broadcastStageP95Ms));
const broadcastStageSamples = new Map(
    Array.from(BROADCAST_STAGE_NAMES, (stage) => [stage, []]),
);

function calculateP95(samples) {
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((a, b) => a - b);
    const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
    return Math.round(sorted[index]);
}

function recordSample(samples, durationMs) {
    if (!Number.isFinite(durationMs) || durationMs < 0) return false;
    samples.push(durationMs);
    if (samples.length > MAX_BROADCAST_SAMPLES) samples.shift();
    return true;
}

export function recordBroadcastLoopDuration(durationMs) {
    if (!recordSample(broadcastLoopSamples, durationMs)) return;
    runtimeState.broadcastLoopMsP95 = calculateP95(broadcastLoopSamples);
}

export function recordBroadcastStageDuration(stage, durationMs) {
    if (!BROADCAST_STAGE_NAMES.has(stage)) return;
    const samples = broadcastStageSamples.get(stage);
    if (!recordSample(samples, durationMs)) return;
    runtimeState.broadcastStageP95Ms[stage] = calculateP95(samples);
}
