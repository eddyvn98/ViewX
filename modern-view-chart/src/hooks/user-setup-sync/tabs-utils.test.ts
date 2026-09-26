import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildChartContextKey, sanitizeTabsInput, sanitizeViewport } from './tabs-utils';

describe('persisted chart layout sanitization', () => {
    it('rejects malformed tab payloads', () => {
        assert.equal(sanitizeTabsInput(null), null);
        assert.equal(sanitizeTabsInput({ bad: { charts: null } }), null);
    });

    it('repairs incomplete chart data without losing a valid legacy weekly interval', () => {
        const tabs = sanitizeTabsInput({
            workspace: {
                charts: {
                    chartA: { symbol: '  ', interval: 'W', source: 'invalid', chartType: 'invalid' },
                },
                activeChartId: 'missing',
                rows: -2,
                cols: '2',
            },
        });

        const tab = tabs?.workspace;
        assert.ok(tab);
        assert.equal(tab.activeChartId, 'chartA');
        assert.equal(tab.charts.chartA.symbol, 'XAUUSDm');
        assert.equal(tab.charts.chartA.interval, 'W');
        assert.equal(tab.charts.chartA.source, 'MT5');
        assert.equal(tab.charts.chartA.chartType, 'smart_candles');
        assert.equal(tab.rows, 1);
        assert.equal(tab.cols, 2);
    });

    it('drops invalid viewport ranges and builds stable chart keys', () => {
        assert.equal(sanitizeViewport({ logicalRange: { from: 10, to: 10 } }), undefined);
        assert.deepEqual(
            sanitizeViewport({ contextKey: ' MT5:XAUUSDm:W ', logicalRange: { from: 1, to: 2 } }),
            { contextKey: 'MT5:XAUUSDm:W', logicalRange: { from: 1, to: 2 } },
        );
        assert.equal(
            buildChartContextKey({ symbol: ' XAUUSDm ', interval: 'W', source: 'MT5' }),
            'XAUUSDm|W|MT5',
        );
    });
});
