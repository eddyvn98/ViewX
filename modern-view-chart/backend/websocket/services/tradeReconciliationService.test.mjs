import test from "node:test";
import assert from "node:assert/strict";
import { tradeReconciliationService } from "./tradeReconciliationService.js";

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

test("claimOutgoing blocks duplicate while pending", () => {
    const routeTarget = { userId: "u1", accountId: "a1", terminalId: "t1" };
    const first = tradeReconciliationService.claimOutgoing({
        topic: "mt5_command",
        command: "buy",
        requestId: "req-dup-1",
        routeTarget,
        symbol: "EURUSD",
    });
    assert.equal(first.shouldForward, true);

    const second = tradeReconciliationService.claimOutgoing({
        topic: "mt5_command",
        command: "buy",
        requestId: "req-dup-1",
        routeTarget,
        symbol: "EURUSD",
    });
    assert.equal(second.shouldForward, false);
    assert.equal(second.reason, "pending");
});

test("resolveFromBridgeResult can resolve by route+command+symbol when request_id missing", () => {
    const routeTarget = { userId: "u2", accountId: "a2", terminalId: "t2" };
    const claimed = tradeReconciliationService.claimOutgoing({
        topic: "mt5_command",
        command: "sell",
        requestId: "req-no-id-ack",
        routeTarget,
        symbol: "XAUUSD",
    });
    assert.equal(claimed.shouldForward, true);

    const resolved = tradeReconciliationService.resolveFromBridgeResult({
        topic: "mt5_command",
        command: "sell",
        requestId: "",
        routeTarget,
        symbol: "XAUUSD",
    });
    assert.equal(resolved?.requestId, "req-no-id-ack");
});

test("ambiguous state can be retried deterministically", async () => {
    const routeTarget = { userId: "u3", accountId: "a3", terminalId: "t3" };
    const requestId = `req-amb-${Date.now()}`;
    const first = tradeReconciliationService.claimOutgoing({
        topic: "mt5_command",
        command: "buy",
        requestId,
        routeTarget,
        symbol: "BTCUSD",
    });
    assert.equal(first.shouldForward, true);

    await wait(Math.max(20, Number.parseInt(process.env.WS_RECON_SWEEP_INTERVAL_MS || "25", 10)));
    tradeReconciliationService.sweepExpired(Date.now() + Number.parseInt(process.env.WS_RECON_ACK_TIMEOUT_MS || "12000", 10) + 1);

    const retry = tradeReconciliationService.claimOutgoing({
        topic: "mt5_command",
        command: "buy",
        requestId,
        routeTarget,
        symbol: "BTCUSD",
    });
    assert.equal(retry.shouldForward, true);
    assert.equal(retry.reason, "retry_ambiguous");
});

