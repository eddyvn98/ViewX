import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAccountTier, resolveUserAccountTier } from "./accountTier.js";

test("pro and pro_plus normalize to Pro account tier", () => {
    assert.equal(normalizeAccountTier("pro"), "pro");
    assert.equal(normalizeAccountTier("pro_plus"), "pro");
    assert.equal(normalizeAccountTier("free"), "free");
});

test("expired Pro subscription resolves to free", () => {
    const now = Date.parse("2026-09-28T00:00:00.000Z");
    assert.equal(resolveUserAccountTier({
        plan: "pro",
        subscription: {
            plan: "pro",
            validUntil: "2026-09-27T23:59:59.000Z",
        },
    }, now), "free");
});

test("active Pro Plus subscription resolves to pro", () => {
    const now = Date.parse("2026-09-28T00:00:00.000Z");
    assert.equal(resolveUserAccountTier({
        plan: "free",
        subscription: {
            plan: "pro_plus",
            validUntil: "2026-10-28T00:00:00.000Z",
        },
    }, now), "pro");
});
