import { incrementWsDroppedBackpressure, setWsBufferPressure } from "../runtime-state.js";

const BACKPRESSURE_SKIP_BYTES = Number.parseInt(process.env.WS_BACKPRESSURE_SKIP_BYTES || "262144", 10);

export function safeSend(ws, payload, options = {}) {
    const { nonCritical = false } = options;
    if (!ws || ws.readyState !== ws.OPEN) return false;

    if (nonCritical && ws.bufferedAmount > BACKPRESSURE_SKIP_BYTES) {
        incrementWsDroppedBackpressure();
        setWsBufferPressure(Math.min(ws.bufferedAmount / BACKPRESSURE_SKIP_BYTES, 1));
        return false;
    }

    try {
        ws.send(payload);
        return true;
    } catch {
        return false;
    }
}
