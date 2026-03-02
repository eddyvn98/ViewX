import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRunnerConfigs } from './config-merge';

describe('strategy runner merge config', () => {
    it('dedupes chart + matrix configs by source:symbol:interval', () => {
        const merged = mergeRunnerConfigs(
            [
                { source: 'MT5', symbol: 'XAUUSDm', interval: '1' },
                { source: 'MT5', symbol: 'BTCUSDm', interval: '5' },
            ],
            [
                { source: 'MT5', symbol: 'XAUUSDm', interval: '1' },
                { source: 'MT5', symbol: 'EURUSDm', interval: '15' },
            ]
        );
        assert.equal(merged.length, 3);
        assert.ok(merged.some((x) => x.symbol === 'EURUSDm' && x.interval === '15'));
    });
});

