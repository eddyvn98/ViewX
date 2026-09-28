import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildMt5AuthFields,
    buildMt5DataSourceKey,
    buildTickerStoreKeys,
    normalizeMt5AccountScope,
    resolveChartDataSource,
    sameMt5Scope,
    SHARED_MT5_SCOPE,
} from './account-scope';

test('normalizes shared and personal MT5 scopes', () => {
    const personal = normalizeMt5AccountScope({
        source: 'MT5_PERSONAL',
        account_login: '10001',
        terminal_id: 'terminal-a',
        broker: 'Broker A',
    });

    assert.equal(personal.source, 'MT5_PERSONAL');
    assert.equal(personal.accountLogin, '10001');
    assert.equal(personal.terminalId, 'terminal-a');
    assert.equal(buildMt5DataSourceKey(personal), 'MT5_PERSONAL@10001@terminal-a');
    assert.equal(buildMt5DataSourceKey(SHARED_MT5_SCOPE), 'MT5');
});

test('namespaces MT5 chart cache without changing non-MT5 sources', () => {
    const personal = normalizeMt5AccountScope({
        source: 'MT5_PERSONAL',
        account_login: '10001',
        terminal_id: 'terminal-a',
    });
    assert.equal(resolveChartDataSource('MT5', personal), 'MT5_PERSONAL@10001@terminal-a');
    assert.equal(resolveChartDataSource('BINANCE', personal), 'BINANCE');
});

test('auth fields retain selected account and terminal identity', () => {
    const personal = normalizeMt5AccountScope({
        source: 'MT5_PERSONAL',
        account_login: '10001',
        terminal_id: 'terminal-a',
    });
    assert.deepEqual(buildMt5AuthFields(personal), {
        mt5_source: 'MT5_PERSONAL',
        account_login: '10001',
        terminal_id: 'terminal-a',
    });
    assert.equal(sameMt5Scope(personal, { ...personal }), true);
    assert.equal(sameMt5Scope(personal, SHARED_MT5_SCOPE), false);
});


test('stores personal realtime tickers under exact and normalized scoped keys', () => {
    assert.deepEqual(
        buildTickerStoreKeys('MT5_PERSONAL@10001@terminal-a', 'XAUUSD.m'),
        [
            'MT5_PERSONAL@10001@terminal-a:XAUUSD.m',
            'MT5_PERSONAL@10001@terminal-a:XAUUSDm',
            'XAUUSD.m',
            'XAUUSDm',
        ],
    );
});


test('malformed personal scope without account login falls back to shared MT5', () => {
    assert.deepEqual(
        normalizeMt5AccountScope({
            source: 'MT5_PERSONAL',
            terminal_id: 'terminal-a',
        }),
        SHARED_MT5_SCOPE,
    );
});
