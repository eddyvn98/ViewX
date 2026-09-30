import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fitPersistedSetupStateToBudget } from './state-utils';
import type { PersistedSetupState } from './types';

function createSnapshot(): PersistedSetupState {
    const largeReasoning = 'x'.repeat(300_000);
    return {
        watchlist: ['XAUUSDm', 'BTCUSDm', 'EURUSDm'],
        watchlistItems: [
            { symbol: 'XAUUSDm', source: 'MT5' },
            { symbol: 'BTCUSDm', source: 'MT5' },
            { symbol: 'EURUSDm', source: 'MT5' },
        ],
        tabs: {} as PersistedSetupState['tabs'],
        activeTabId: 'workspace',
        favoriteTimeframes: ['1', '5', '15', '60'],
        favoriteChartTypes: ['candles', 'heikin_ashi', 'smart_candles'],
        chartIndicators: {
            chartA: [{
                id: 'supertrend-1',
                type: 'supertrend',
                params: { period: 10 },
                color: '#fff',
                visible: true,
                lineWidth: 1,
                pane: 'main',
            }],
        },
        chartDrawings: {
            chartA: [{
                id: 'drawing-1',
                type: 'trend-line',
                points: [{ time: 1, price: 1 }, { time: 2, price: 2 }],
                color: '#fff',
                visible: true,
                lineWidth: 1,
                lineStyle: 'solid',
                params: { note: largeReasoning },
            }],
        },
        alerts: [{
            id: 'alert-1',
            symbol: 'XAUUSDm',
            price: 5000,
            active: true,
            type: 'crossing',
            createdAt: 1,
        }],
        ui: {
            isLeftSidebarOpen: true,
            isRightSidebarOpen: false,
            activeRightSidebarTab: 'layer',
            activeMobileTab: 'watchlist',
            themeColor: 'blue',
            sidebarTopHeight: 222,
            rightSidebarWidth: 511,
            rightSidebarTabOrder: ['layer', 'strategy', 'trade'],
            isDrawingToolbarVisible: true,
            snapToCandle: false,
            isChartLegendVisible: false,
            isCrosshairSyncEnabled: false,
            strategyPanelView: 'signals',
            strategyEditingStrategyId: null,
            strategyBuilderDraft: null,
            signalHistoryRange: 'week',
            marketListSearchQuery: 'gold',
            marketListSourceTab: 'MT5',
        },
        terminal: {
            isTerminalVisible: true,
            isTerminalCollapsed: false,
            terminalHeight: 444,
            orderForm: { orderType: 'market', side: 'buy', volume: '0.2', sl: '', tp: '' },
        },
        strategy: {
            strategies: [],
            signals: [],
            virtualPositions: [],
            virtualBalance: 10000,
            initialVirtualBalance: 10000,
            lastBacktestPnL: 0,
            backtestCount: 0,
            matrixScanners: [],
            focusedMatrixScannerId: null,
            scopedLastSignalTimes: {},
            showHistoryMarkers: true,
            lastResetTime: 0,
        },
    };
}

describe('user setup persistence budget', () => {
    it('never silently drops user-owned state from large snapshots', () => {
        const snapshot = createSnapshot();
        const fitted = fitPersistedSetupStateToBudget(snapshot);

        assert.equal(fitted, snapshot);
        assert.equal(fitted.ui.activeMobileTab, 'watchlist');
        assert.equal(fitted.ui.isCrosshairSyncEnabled, false);
        assert.equal(fitted.ui.rightSidebarWidth, 511);
        assert.equal(fitted.chartIndicators.chartA.length, 1);
        assert.equal(fitted.chartDrawings.chartA.length, 1);
        assert.equal(fitted.alerts.length, 1);
        assert.deepEqual(fitted.watchlist, ['XAUUSDm', 'BTCUSDm', 'EURUSDm']);
    });
});
