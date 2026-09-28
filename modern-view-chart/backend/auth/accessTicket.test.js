import test from "node:test";
import assert from "node:assert/strict";
import { createAccessTicket, readAccessTicket, verifyAccessTicket } from "./accessTicket.js";

test("signed WS ticket preserves user identity claims", () => {
    const secret = "test-secret";
    const ticket = createAccessTicket(secret, 300, "ws_auth", {
        auth_type: "user",
        sub: "user-123",
        sv: 4,
        account_tier: "pro",
    });

    const payload = readAccessTicket(ticket, secret);
    assert.equal(payload?.auth_type, "user");
    assert.equal(payload?.sub, "user-123");
    assert.equal(payload?.sv, 4);
    assert.equal(payload?.account_tier, "pro");
    assert.equal(verifyAccessTicket(ticket, secret), true);
});

test("tampered WS ticket is rejected", () => {
    const ticket = createAccessTicket("test-secret", 300, "ws_auth", { auth_type: "service" });
    assert.equal(readAccessTicket(`${ticket}x`, "test-secret"), null);
});
