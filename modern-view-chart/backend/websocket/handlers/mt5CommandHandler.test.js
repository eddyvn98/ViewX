import test from "node:test";
import assert from "node:assert/strict";
import {
    handleMt5Command,
    handleMt5OrderResult,
    resetMt5WriteRequestTrackingForTests,
} from "./mt5CommandHandler.js";

function makeSocket() {
    return {
        OPEN: 1,
        readyState: 1,
        bufferedAmount: 0,
        sent: [],
        send(payload) {
            this.sent.push(JSON.parse(payload));
        },
    };
}

function setup() {
    resetMt5WriteRequestTrackingForTests();
    const clientWs = makeSocket();
    const bridgeWs = makeSocket();
    const clients = new Map([
        [clientWs, {
            userId: "user-1",
            selectedMt5AccountLogin: "10001",
            selectedMt5TerminalId: "terminal-a",
            selectedMt5Broker: "Broker A",
            isBridgeAuthenticated: false,
        }],
        [bridgeWs, {
            userId: "user-1",
            authType: "user",
            isBridgeAuthenticated: true,
            clientMode: "pro_extension",
            bridgeAccountLogin: "10001",
            bridgeTerminalId: "terminal-a",
            bridgeBroker: "Broker A",
        }],
    ]);
    const bridgeRegistry = {
        resolve({ userId, accountLogin, terminalId }) {
            if (userId === "user-1" && accountLogin === "10001" && terminalId === "terminal-a") {
                return {
                    record: {
                        ws: bridgeWs,
                        broker: "Broker A",
                        clientMode: "pro_extension",
                    },
                    reason: "matched",
                    candidateCount: 1,
                };
            }
            return { record: null, reason: "not_found", candidateCount: 0 };
        },
    };
    return { clientWs, bridgeWs, clients, bridgeRegistry };
}

test("routes a personal MT5 write to the exact account and terminal", () => {
    const { clientWs, bridgeWs, clients, bridgeRegistry } = setup();

    handleMt5Command({ ws: clientWs, clients, bridgeRegistry }, {
        topic: "mt5_command",
        command: "place_order",
        request_id: "req-1",
        account_login: "10001",
        terminal_id: "terminal-a",
        broker: "Broker A",
        symbol: "XAUUSDm",
        order_type: "buy",
        volume: 0.01,
    });

    assert.equal(bridgeWs.sent.length, 1);
    assert.equal(bridgeWs.sent[0].request_id, "req-1");
    assert.equal(bridgeWs.sent[0].account_login, "10001");
    assert.equal(bridgeWs.sent[0].terminal_id, "terminal-a");
    assert.equal(bridgeWs.sent[0].symbol, "XAUUSDm");
});

test("requires request_id for personal MT5 writes", () => {
    const { clientWs, bridgeWs, clients, bridgeRegistry } = setup();

    handleMt5Command({ ws: clientWs, clients, bridgeRegistry }, {
        topic: "mt5_command",
        command: "close",
        account_login: "10001",
        terminal_id: "terminal-a",
        ticket: 42,
    });

    assert.equal(bridgeWs.sent.length, 0);
    assert.equal(clientWs.sent.at(-1)?.topic, "error");
    assert.equal(clientWs.sent.at(-1)?.detail, "mt5_write_request_id_required");
});

test("deduplicates an in-flight write and replays the completed result", () => {
    const { clientWs, bridgeWs, clients, bridgeRegistry } = setup();
    const command = {
        topic: "mt5_command",
        command: "place_order",
        request_id: "req-dedupe",
        account_login: "10001",
        terminal_id: "terminal-a",
        symbol: "XAUUSDm",
        order_type: "buy",
        volume: 0.01,
    };

    handleMt5Command({ ws: clientWs, clients, bridgeRegistry }, command);
    handleMt5Command({ ws: clientWs, clients, bridgeRegistry }, command);

    assert.equal(bridgeWs.sent.length, 1);
    assert.equal(clientWs.sent.at(-1)?.topic, "mt5_order_result");
    assert.equal(clientWs.sent.at(-1)?.status, "pending");
    assert.equal(clientWs.sent.at(-1)?.duplicate, true);

    handleMt5OrderResult({ ws: bridgeWs, clients }, {
        topic: "mt5_order_result",
        request_id: "req-dedupe",
        command: "place_order",
        success: true,
        retcode: 10009,
        comment: "Request completed",
        order: 12345,
        deal: 54321,
        symbol: "XAUUSDm",
        resolved_symbol: "XAUUSDm",
    });

    const completed = clientWs.sent.at(-1);
    assert.equal(completed.success, true);
    assert.equal(completed.order, 12345);
    assert.equal(completed.account_login, "10001");

    handleMt5Command({ ws: clientWs, clients, bridgeRegistry }, command);
    assert.equal(bridgeWs.sent.length, 1);
    assert.equal(clientWs.sent.at(-1)?.success, true);
    assert.equal(clientWs.sent.at(-1)?.cached, true);
    assert.equal(clientWs.sent.at(-1)?.duplicate, true);
});

test("rejects reuse of one request_id across MT5 account scopes", () => {
    const { clientWs, bridgeWs, clients, bridgeRegistry } = setup();

    handleMt5Command({ ws: clientWs, clients, bridgeRegistry }, {
        topic: "mt5_command",
        command: "modify",
        request_id: "req-scope",
        account_login: "10001",
        terminal_id: "terminal-a",
        ticket: 10,
        sl: 100,
    });

    handleMt5Command({ ws: clientWs, clients, bridgeRegistry }, {
        topic: "mt5_command",
        command: "modify",
        request_id: "req-scope",
        account_login: "10002",
        terminal_id: "terminal-b",
        ticket: 10,
        sl: 101,
    });

    assert.equal(bridgeWs.sent.length, 1);
    assert.equal(clientWs.sent.at(-1)?.topic, "error");
    assert.equal(clientWs.sent.at(-1)?.detail, "mt5_request_id_scope_mismatch");
});

test("accepts execution results only from the exact bridge socket that received the write", () => {
    const { clientWs, bridgeWs, clients, bridgeRegistry } = setup();

    handleMt5Command({ ws: clientWs, clients, bridgeRegistry }, {
        topic: "mt5_command",
        command: "close",
        request_id: "req-wrong-bridge",
        account_login: "10001",
        terminal_id: "terminal-a",
        ticket: 99,
    });

    const replacementBridge = makeSocket();
    clients.set(replacementBridge, {
        userId: "user-1",
        authType: "user",
        isBridgeAuthenticated: true,
        clientMode: "pro_extension",
        bridgeAccountLogin: "10001",
        bridgeTerminalId: "terminal-a",
        bridgeBroker: "Broker A",
    });

    const before = clientWs.sent.length;
    handleMt5OrderResult({ ws: replacementBridge, clients }, {
        topic: "mt5_order_result",
        request_id: "req-wrong-bridge",
        command: "close",
        success: true,
    });

    assert.equal(clientWs.sent.length, before);
    assert.equal(bridgeWs.sent.length, 1);
});

test("legacy shared MT5 writes remain compatible without request_id", () => {
    resetMt5WriteRequestTrackingForTests();
    const clientWs = makeSocket();
    const bridgeWs = makeSocket();
    const clients = new Map([
        [clientWs, { userId: "user-1", isBridgeAuthenticated: false }],
        [bridgeWs, {
            authType: "service",
            isBridgeAuthenticated: true,
            clientMode: "service_bridge",
        }],
    ]);
    const bridgeRegistry = {
        resolve() {
            return {
                record: { ws: bridgeWs, clientMode: "service_bridge", broker: null },
                reason: "global_service_fallback",
                candidateCount: 1,
            };
        },
    };

    handleMt5Command({ ws: clientWs, clients, bridgeRegistry }, {
        topic: "mt5_command",
        command: "close",
        ticket: 7,
    });

    assert.equal(bridgeWs.sent.length, 1);
    assert.equal(bridgeWs.sent[0].command, "close");
});


test("rejects reuse of one request_id for a different write payload in the same scope", () => {
    const { clientWs, bridgeWs, clients, bridgeRegistry } = setup();

    handleMt5Command({ ws: clientWs, clients, bridgeRegistry }, {
        topic: "mt5_command",
        command: "modify",
        request_id: "req-payload-conflict",
        account_login: "10001",
        terminal_id: "terminal-a",
        ticket: 10,
        sl: 100,
    });

    handleMt5Command({ ws: clientWs, clients, bridgeRegistry }, {
        topic: "mt5_command",
        command: "modify",
        request_id: "req-payload-conflict",
        account_login: "10001",
        terminal_id: "terminal-a",
        ticket: 10,
        sl: 101,
    });

    assert.equal(bridgeWs.sent.length, 1);
    assert.equal(clientWs.sent.at(-1)?.topic, "error");
    assert.equal(clientWs.sent.at(-1)?.detail, "mt5_request_id_payload_mismatch");
});

test("ignores execution results whose command does not match the pending request", () => {
    const { clientWs, bridgeWs, clients, bridgeRegistry } = setup();

    handleMt5Command({ ws: clientWs, clients, bridgeRegistry }, {
        topic: "mt5_command",
        command: "close",
        request_id: "req-command-mismatch",
        account_login: "10001",
        terminal_id: "terminal-a",
        ticket: 99,
    });

    const before = clientWs.sent.length;
    handleMt5OrderResult({ ws: bridgeWs, clients }, {
        topic: "mt5_order_result",
        request_id: "req-command-mismatch",
        command: "modify",
        success: true,
    });

    assert.equal(clientWs.sent.length, before);
});

test("ignores execution results from a bridge with a mismatched broker identity", () => {
    const { clientWs, bridgeWs, clients, bridgeRegistry } = setup();

    handleMt5Command({ ws: clientWs, clients, bridgeRegistry }, {
        topic: "mt5_command",
        command: "close",
        request_id: "req-broker-mismatch",
        account_login: "10001",
        terminal_id: "terminal-a",
        broker: "Broker A",
        ticket: 100,
    });

    clients.get(bridgeWs).bridgeBroker = "Broker B";
    const before = clientWs.sent.length;
    handleMt5OrderResult({ ws: bridgeWs, clients }, {
        topic: "mt5_order_result",
        request_id: "req-broker-mismatch",
        command: "close",
        success: true,
    });

    assert.equal(clientWs.sent.length, before);
});
