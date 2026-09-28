import test from "node:test";
import assert from "node:assert/strict";
import {
    WS_CLIENT_MODES,
    getDefaultClientMode,
    isBridgeClientMode,
    resolveRequestedClientMode,
} from "./clientMode.js";

test("default client mode follows auth type and account tier", () => {
    assert.equal(getDefaultClientMode({ type: "guest" }), WS_CLIENT_MODES.WEB_FREE);
    assert.equal(getDefaultClientMode({ type: "user", accountTier: "free" }), WS_CLIENT_MODES.WEB_FREE);
    assert.equal(getDefaultClientMode({ type: "user", accountTier: "pro" }), WS_CLIENT_MODES.WEB_PRO);
    assert.equal(getDefaultClientMode({ type: "service" }), WS_CLIENT_MODES.SERVICE_BRIDGE);
});

test("Pro extension mode requires an authenticated Pro user", () => {
    assert.equal(resolveRequestedClientMode("pro_extension", { authType: "user", accountTier: "pro" }), "pro_extension");
    assert.equal(resolveRequestedClientMode("pro_extension", { authType: "user", accountTier: "free" }), null);
    assert.equal(resolveRequestedClientMode("pro_extension", { authType: "service", accountTier: null }), null);
});

test("only extension and service modes are bridge modes", () => {
    assert.equal(isBridgeClientMode("pro_extension"), true);
    assert.equal(isBridgeClientMode("service_bridge"), true);
    assert.equal(isBridgeClientMode("web_pro"), false);
    assert.equal(isBridgeClientMode("web_free"), false);
});
