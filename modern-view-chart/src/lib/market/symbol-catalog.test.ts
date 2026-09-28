import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildSymbolIdentityKey,
    createSymbolDescriptor,
    normalizeTransportSymbol,
} from './symbol-catalog';

test('personal MT5 symbol identity includes account and terminal', () => {
    const a = {
        symbol: 'XAUUSD.m',
        source: 'MT5_PERSONAL' as const,
        accountLogin: '10001',
        terminalId: 'terminal-a',
    };
    const b = {
        ...a,
        accountLogin: '20002',
    };

    assert.notEqual(buildSymbolIdentityKey(a), buildSymbolIdentityKey(b));
});

test('MT5 transport symbol stays exact while non-MT5 keeps legacy normalization', () => {
    assert.equal(normalizeTransportSymbol('XAUUSD.m', 'MT5_PERSONAL'), 'XAUUSD.m');
    assert.equal(normalizeTransportSymbol('XAUUSD.M', 'MT5'), 'XAUUSD.M');
    assert.equal(normalizeTransportSymbol('btcusdt', 'BINANCE'), 'BTCUSDT');
});

test('catalog descriptor preserves broker metadata', () => {
    const item = createSymbolDescriptor({
        symbol: 'XAUUSD.raw',
        description: 'Gold',
        path: 'Forex\\Metals',
        digits: 2,
        type: 'forex',
    }, {
        source: 'MT5_PERSONAL',
        accountLogin: '12345',
        terminalId: 'desk-1',
        broker: 'Broker A',
    });

    assert.equal(item?.symbol, 'XAUUSD.raw');
    assert.equal(item?.accountLogin, '12345');
    assert.equal(item?.terminalId, 'desk-1');
    assert.equal(item?.broker, 'Broker A');
    assert.equal(item?.digits, 2);
});
