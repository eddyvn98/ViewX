import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSymbolList } from './build-symbol-list';

test('market list keeps overlapping personal MT5 symbols isolated by account', () => {
    const items = buildSymbolList({
        mode: 'discovery',
        legacyWatchlist: [],
        watchlistItems: [],
        availableSymbols: [
            {
                symbol: 'XAUUSDm',
                source: 'MT5_PERSONAL',
                accountLogin: '10001',
                terminalId: 'a',
                broker: 'Broker A',
            },
            {
                symbol: 'XAUUSDm',
                source: 'MT5_PERSONAL',
                accountLogin: '20002',
                terminalId: 'b',
                broker: 'Broker B',
            },
        ],
        tickerItems: [],
        deferredSearch: 'XAUUSD',
        sourceTab: 'MT5',
        binanceUniverse: [],
        vangTodaySymbols: [],
        prioritizeWatched: false,
        watchlistSearchIncludesDiscovery: true,
    });

    const personal = items.filter((item) => item.source === 'MT5_PERSONAL');
    assert.equal(personal.length, 2);
    assert.deepEqual(personal.map((item) => item.accountLogin).sort(), ['10001', '20002']);
});

test('manual symbol fallback only uses MT5 when MT5 tab was explicitly selected', () => {
    const common = {
        mode: 'discovery' as const,
        legacyWatchlist: [],
        watchlistItems: [],
        availableSymbols: [],
        tickerItems: [],
        deferredSearch: 'USDCAD.custom',
        binanceUniverse: [],
        vangTodaySymbols: [],
        prioritizeWatched: false,
        watchlistSearchIncludesDiscovery: true,
    };

    const mt5Items = buildSymbolList({ ...common, sourceTab: 'MT5' });
    assert.equal(mt5Items.some((item) => item.symbol === 'USDCAD.custom' && item.source === 'MT5'), true);

    const allItems = buildSymbolList({ ...common, sourceTab: 'ALL' });
    assert.equal(allItems.some((item) => item.symbol === 'USDCAD.custom'), false);
});
