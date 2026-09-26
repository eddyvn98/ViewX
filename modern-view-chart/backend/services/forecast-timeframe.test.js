import assert from 'node:assert/strict';
import test from 'node:test';
import { formatForecastTimeframe } from './forecast-timeframe.js';

test('formats canonical and legacy forecast timeframes for chat responses', () => {
    assert.equal(formatForecastTimeframe('60'), '1H');
    assert.equal(formatForecastTimeframe('240'), '4H');
    assert.equal(formatForecastTimeframe('1440'), 'D');
    assert.equal(formatForecastTimeframe('10080'), 'W');
    assert.equal(formatForecastTimeframe('D'), 'D');
    assert.equal(formatForecastTimeframe('W'), 'W');
});
