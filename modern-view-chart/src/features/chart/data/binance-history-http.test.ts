import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBinanceHistoryResponse } from './binance-history-http';

describe('parseBinanceHistoryResponse', () => {
    it('parses normalized backend candle payloads', () => {
        const candles = parseBinanceHistoryResponse({
            candles: [
                { time: 1_700_000_000, open: '10', high: '12', low: '9', close: '11', volume: '42' },
            ],
        });

        assert.equal(candles.length, 1);
        assert.deepEqual(candles[0], {
            time: 1_700_000_000,
            open: 10,
            high: 12,
            low: 9,
            close: 11,
            volume: 42,
        });
    });

    it('drops malformed rows instead of poisoning chart history', () => {
        const candles = parseBinanceHistoryResponse({
            candles: [
                { time: 'bad', open: 1, high: 2, low: 0, close: 1, volume: 1 },
                { time: 2, open: 1, high: 2, low: 0, close: 1, volume: 1 },
            ],
        });

        assert.equal(candles.length, 1);
        assert.equal(Number(candles[0].time), 2);
    });
});
