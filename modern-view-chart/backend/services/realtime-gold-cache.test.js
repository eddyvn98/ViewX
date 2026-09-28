import test from "node:test";
import assert from "node:assert/strict";
import { getCachedVietnamGoldQuotes } from "./vnGoldService.js";
import { getCachedVangTodayQuotes } from "./vangTodayService.js";

test("realtime gold cache readers return synchronously without refresh", () => {
    const vnGold = getCachedVietnamGoldQuotes({ refresh: false });
    const vangToday = getCachedVangTodayQuotes({ refresh: false });

    assert.ok(Array.isArray(vnGold));
    assert.ok(Array.isArray(vangToday));
});
