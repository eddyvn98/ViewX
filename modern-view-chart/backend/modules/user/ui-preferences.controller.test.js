import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuthenticatedUserId } from "./ui-preferences.controller.js";

test("resolves the user id shape attached by checkLogin", () => {
    assert.equal(resolveAuthenticatedUserId({ userId: "user-123" }), "user-123");
    assert.equal(resolveAuthenticatedUserId({ id: "legacy-id" }), "legacy-id");
    assert.equal(resolveAuthenticatedUserId(undefined), "");
});
