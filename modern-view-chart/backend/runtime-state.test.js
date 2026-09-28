import test from "node:test";
import assert from "node:assert/strict";
import {
    runtimeState,
    recordBroadcastLoopDuration,
    recordBroadcastStageDuration,
} from "./runtime-state.js";

test("broadcast loop p95 tracks rolling samples", () => {
    for (const value of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) {
        recordBroadcastLoopDuration(value);
    }
    assert.equal(runtimeState.broadcastLoopMsP95, 100);
});

test("broadcast stage p95 records known stages and ignores unknown ones", () => {
    for (const value of [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]) {
        recordBroadcastStageDuration("candle_indicator", value);
    }
    assert.equal(runtimeState.broadcastStageP95Ms.candle_indicator, 50);

    const before = { ...runtimeState.broadcastStageP95Ms };
    recordBroadcastStageDuration("not_a_stage", 999);
    assert.deepEqual(runtimeState.broadcastStageP95Ms, before);
});

test("broadcast stage metrics reject invalid durations", () => {
    const before = runtimeState.broadcastStageP95Ms.price;
    recordBroadcastStageDuration("price", -1);
    recordBroadcastStageDuration("price", Number.NaN);
    assert.equal(runtimeState.broadcastStageP95Ms.price, before);
});
