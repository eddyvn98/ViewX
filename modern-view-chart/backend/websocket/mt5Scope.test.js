import test from "node:test";
import assert from "node:assert/strict";
import {
    clearScopedMt5Prices,
    clearScopedMt5State,
    clearScopedMt5Symbols,
    createMt5Scope,
    getScopedMt5Price,
    getScopedMt5State,
    getScopedMt5Symbols,
    isRecipientForMt5Scope,
    setScopedMt5Price,
    setScopedMt5State,
    setScopedMt5Symbols,
} from "./mt5Scope.js";

test("isolates MT5 read-only state across 2 users x 2 accounts", () => {
    const prices = new Map();
    const scopes = [
        createMt5Scope({ ownerUserId: "u1", accountLogin: "1001", terminalId: "t1" }),
        createMt5Scope({ ownerUserId: "u1", accountLogin: "1002", terminalId: "t2" }),
        createMt5Scope({ ownerUserId: "u2", accountLogin: "2001", terminalId: "t1" }),
        createMt5Scope({ ownerUserId: "u2", accountLogin: "2002", terminalId: "t2" }),
    ];

    scopes.forEach((scope, index) => {
        setScopedMt5Price(prices, scope, { symbol: "XAUUSDm", price: 100 + index });
        setScopedMt5State(scope, {
            account: { login: scope.accountLogin, balance: 1000 + index },
            positions: [{ ticket: 1, marker: scope.scopeId }],
            orders: [{ ticket: 2, marker: scope.scopeId }],
        });
        setScopedMt5Symbols(scope, [{ symbol: `SYM${index}` }]);
    });

    scopes.forEach((scope, index) => {
        assert.equal(getScopedMt5Price(prices, scope, "XAUUSDm")?.price, 100 + index);
        assert.equal(getScopedMt5State(scope)?.account?.login, scope.accountLogin);
        assert.equal(getScopedMt5State(scope)?.positions?.[0]?.marker, scope.scopeId);
        assert.equal(getScopedMt5Symbols(scope)?.[0]?.symbol, `SYM${index}`);
    });

    clearScopedMt5Prices(prices, scopes[0]);
    clearScopedMt5State(scopes[0]);
    clearScopedMt5Symbols(scopes[0]);

    assert.equal(getScopedMt5Price(prices, scopes[0], "XAUUSDm"), null);
    assert.equal(getScopedMt5State(scopes[0]), null);
    assert.deepEqual(getScopedMt5Symbols(scopes[0]), []);
    assert.equal(getScopedMt5Price(prices, scopes[1], "XAUUSDm")?.price, 101);

    scopes.slice(1).forEach((scope) => {
        clearScopedMt5Prices(prices, scope);
        clearScopedMt5State(scope);
        clearScopedMt5Symbols(scope);
    });
});

test("only the web client that selected the personal account receives its MT5 frames", () => {
    const scopeA = createMt5Scope({ ownerUserId: "u1", accountLogin: "1001", terminalId: "t1" });
    const scopeB = createMt5Scope({ ownerUserId: "u1", accountLogin: "1002", terminalId: "t2" });
    const shared = createMt5Scope();

    const clientA = { userId: "u1", selectedMt5AccountLogin: "1001", selectedMt5TerminalId: "t1", isBridgeAuthenticated: false };
    const clientB = { userId: "u1", selectedMt5AccountLogin: "1002", selectedMt5TerminalId: "t2", isBridgeAuthenticated: false };
    const otherUser = { userId: "u2", selectedMt5AccountLogin: "1001", selectedMt5TerminalId: "t1", isBridgeAuthenticated: false };
    const sharedClient = { userId: "u1", selectedMt5AccountLogin: null, selectedMt5TerminalId: null, isBridgeAuthenticated: false };

    assert.equal(isRecipientForMt5Scope(clientA, scopeA), true);
    assert.equal(isRecipientForMt5Scope(clientA, scopeB), false);
    assert.equal(isRecipientForMt5Scope(clientB, scopeA), false);
    assert.equal(isRecipientForMt5Scope(otherUser, scopeA), false);
    assert.equal(isRecipientForMt5Scope(sharedClient, scopeA), false);
    assert.equal(isRecipientForMt5Scope(sharedClient, shared), true);
    assert.equal(isRecipientForMt5Scope(clientA, shared), false);
});
