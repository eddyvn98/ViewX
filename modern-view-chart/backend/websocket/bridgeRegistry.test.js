import test from "node:test";
import assert from "node:assert/strict";
import { createBridgeRegistry } from "./bridgeRegistry.js";

function makeSocket() {
    return {
        OPEN: 1,
        readyState: 1,
        closeCalls: [],
        close(code, reason) {
            this.closeCalls.push({ code, reason });
            this.readyState = 3;
        },
    };
}

function makeMeta(overrides = {}) {
    return {
        isBridgeAuthenticated: true,
        authType: "user",
        userId: "user-1",
        clientMode: "pro_extension",
        bridgeAccountLogin: "10001",
        bridgeTerminalId: "terminal-a",
        bridgeBroker: "Broker A",
        ...overrides,
    };
}

test("routes exact Pro bridge by user, account and terminal", () => {
    const registry = createBridgeRegistry();
    const ws = makeSocket();
    registry.register(ws, makeMeta());

    const matched = registry.resolve({
        userId: "user-1",
        accountLogin: "10001",
        terminalId: "terminal-a",
    });
    assert.equal(matched.record?.ws, ws);
    assert.equal(matched.reason, "matched");

    const crossUser = registry.resolve({
        userId: "user-2",
        accountLogin: "10001",
    });
    assert.equal(crossUser.record, null);
    assert.equal(crossUser.reason, "not_found");
});

test("requires account selection when one user has multiple extension accounts", () => {
    const registry = createBridgeRegistry();
    registry.register(makeSocket(), makeMeta({
        bridgeAccountLogin: "10001",
        bridgeTerminalId: "terminal-a",
    }));
    const second = makeSocket();
    registry.register(second, makeMeta({
        bridgeAccountLogin: "10002",
        bridgeTerminalId: "terminal-b",
    }));

    const ambiguous = registry.resolve({ userId: "user-1" });
    assert.equal(ambiguous.record, null);
    assert.equal(ambiguous.reason, "ambiguous");
    assert.equal(ambiguous.candidateCount, 2);

    const selected = registry.resolve({ userId: "user-1", accountLogin: "10002" });
    assert.equal(selected.record?.ws, second);
});

test("reconnecting same bridge identity replaces the stale socket", () => {
    const registry = createBridgeRegistry();
    const first = makeSocket();
    const second = makeSocket();

    registry.register(first, makeMeta());
    const result = registry.register(second, makeMeta());

    assert.equal(result.replaced?.ws, first);
    assert.equal(first.closeCalls.length, 1);
    assert.equal(first.closeCalls[0].code, 4007);
    assert.equal(registry.resolve({ userId: "user-1", accountLogin: "10001" }).record?.ws, second);
});

test("legacy global service bridge remains routable without account metadata", () => {
    const registry = createBridgeRegistry();
    const service = makeSocket();
    registry.register(service, makeMeta({
        authType: "service",
        userId: null,
        clientMode: "service_bridge",
        bridgeAccountLogin: null,
        bridgeTerminalId: null,
    }));

    const matched = registry.resolve({ userId: null });
    assert.equal(matched.record?.ws, service);
    assert.equal(registry.hasForUser(null), true);
});
