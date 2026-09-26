import assert from 'node:assert/strict';
import test from 'node:test';
import { createViewportPersistence } from './persistence';

test('persists a viewport without crashing when a price scale is empty during timeframe change', async () => {
    const updates: unknown[] = [];
    const persistence = createViewportPersistence({
        priceChart: {
            timeScale: () => ({ getVisibleLogicalRange: () => null }),
            priceScale: () => ({ getVisibleRange: () => { throw new Error('Value is null'); } }),
        } as never,
        subchartChart: {
            priceScale: () => ({ getVisibleRange: () => null }),
        } as never,
        currentContextKeyRef: { current: 'BTCUSDT|60|BINANCE' },
        viewportSaveTimeoutRef: { current: null },
        updateChart: (_chartId, patch) => updates.push(patch),
        chartId: 'chart-1',
        getIsPointerInteracting: () => false,
    });

    persistence.scheduleViewportPersist();
    await new Promise((resolve) => setTimeout(resolve, 220));

    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0], {
        viewport: {
            contextKey: 'BTCUSDT|60|BINANCE',
            savedAt: (updates[0] as { viewport: { savedAt: number } }).viewport.savedAt,
        },
    });
});
