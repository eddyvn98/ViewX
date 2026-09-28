import test from "node:test";
import assert from "node:assert/strict";
import { getBinancePrices, mergeBinancePrices } from "./binanceTickerService.js";

test("background Binance fallback can warm realtime cache synchronously", () => {
    mergeBinancePrices([
        { symbol: "BTCUSDT", price: 64000, change: 1.25, source: "BINANCE" },
    ]);

    const prices = getBinancePrices(["BTCUSDT"]);
    assert.equal(prices.length, 1);
    assert.equal(prices[0].symbol, "BTCUSDT");
    assert.equal(prices[0].price, 64000);
});
