import assert from 'node:assert/strict';
import test from 'node:test';
import { formatChartTimeframe } from './timeframe-config';

test('formats canonical timeframe IDs for the chart header', () => {
    assert.equal(formatChartTimeframe('60'), '1H');
    assert.equal(formatChartTimeframe('240'), '4H');
    assert.equal(formatChartTimeframe('1440'), 'D');
    assert.equal(formatChartTimeframe('10080'), 'W');
});

test('keeps legacy day and week values compatible in the chart header', () => {
    assert.equal(formatChartTimeframe('D'), 'D');
    assert.equal(formatChartTimeframe('W'), 'W');
});
