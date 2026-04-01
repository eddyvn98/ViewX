import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { MouseEventParams, Time } from 'lightweight-charts';
import { setupCrosshairListeners } from './setup-crosshair-listeners';
import { useMarketStore } from '@/lib/store';

type CrosshairCb = (p: MouseEventParams<Time>) => void;

class MockCustomEvent<T = unknown> extends Event {
    detail: T;

    constructor(type: string, init?: CustomEventInit<T>) {
        super(type);
        this.detail = (init?.detail ?? null) as T;
    }
}

const createMockChart = () => {
    let cb: CrosshairCb | null = null;
    let clearCount = 0;
    return {
        chart: {
            timeScale: () => ({
                coordinateToLogical: (x: number) => x,
                timeToCoordinate: (time: number) => time,
            }),
            clearCrosshairPosition: () => {
                clearCount += 1;
            },
            subscribeCrosshairMove: (handler: CrosshairCb) => {
                cb = handler;
            },
            unsubscribeCrosshairMove: () => {
                cb = null;
            },
        },
        emit: (payload: MouseEventParams<Time>) => cb?.(payload),
        getClearCount: () => clearCount,
    };
};

describe('setupCrosshairListeners', () => {
    beforeEach(() => {
        (globalThis as unknown as { CustomEvent: typeof MockCustomEvent }).CustomEvent = MockCustomEvent;
        (globalThis as unknown as { requestAnimationFrame: (fn: (ts: number) => void) => number }).requestAnimationFrame = (fn: (ts: number) => void) => {
            fn(Date.now());
            return 1;
        };
        (globalThis as unknown as { cancelAnimationFrame: (id: number) => void }).cancelAnimationFrame = () => { };

        const eventTarget = new EventTarget();
        (globalThis as unknown as { window: Pick<Window, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'> }).window = {
            addEventListener: eventTarget.addEventListener.bind(eventTarget),
            removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
            dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
        };

        useMarketStore.setState({
            isCrosshairSyncEnabled: true,
            syncCrosshair: () => { },
        } as Partial<ReturnType<typeof useMarketStore.getState>> as ReturnType<typeof useMarketStore.getState>);
    });

    it('emits chart-crosshair payload when sync is enabled', () => {
        const price = createMockChart();
        const sub = createMockChart();
        const foot = createMockChart();
        const payloads: Array<{ time?: number | null }> = [];

        window.addEventListener('chart-crosshair', (e: Event) => {
            payloads.push((e as CustomEvent<{ time?: number | null }>).detail ?? {});
        });

        const cleanup = setupCrosshairListeners({
            priceChart: price.chart as never,
            subchartChart: sub.chart as never,
            timescaleChart: foot.chart as never,
            chartId: 'c1',
            candleSeries: {} as never,
            subSyncSeries: {} as never,
            footSyncSeries: {} as never,
            markerSeries: {} as never,
            priceLineEl: null,
            subLineEl: null,
            footLineEl: null,
            footTimeLabelEl: null,
            seriesRef: { current: { coordinateToPrice: () => 123 } as never },
            formatTimeLabel: (t) => String(t),
        });

        price.emit({
            point: { x: 10, y: 20 },
            time: 100 as Time,
        } as MouseEventParams<Time>);

        assert.equal(payloads.length > 0, true);
        assert.equal(payloads.at(-1)?.time, 100);
        cleanup();
    });

    it('clears sync and suppresses move payload when sync is disabled', () => {
        const price = createMockChart();
        const sub = createMockChart();
        const foot = createMockChart();
        const payloads: Array<{ time?: number | null }> = [];

        window.addEventListener('chart-crosshair', (e: Event) => {
            payloads.push((e as CustomEvent<{ time?: number | null }>).detail ?? {});
        });

        const cleanup = setupCrosshairListeners({
            priceChart: price.chart as never,
            subchartChart: sub.chart as never,
            timescaleChart: foot.chart as never,
            chartId: 'c1',
            candleSeries: {} as never,
            subSyncSeries: {} as never,
            footSyncSeries: {} as never,
            markerSeries: {} as never,
            priceLineEl: null,
            subLineEl: null,
            footLineEl: null,
            footTimeLabelEl: null,
            seriesRef: { current: { coordinateToPrice: () => 456 } as never },
            formatTimeLabel: (t) => String(t),
        });

        price.emit({
            point: { x: 12, y: 22 },
            time: 101 as Time,
        } as MouseEventParams<Time>);
        assert.equal(payloads.at(-1)?.time, 101);

        useMarketStore.getState().setCrosshairSync(false);
        assert.equal(payloads.at(-1)?.time ?? null, null);

        const countAfterDisable = payloads.length;
        price.emit({
            point: { x: 20, y: 30 },
            time: 102 as Time,
        } as MouseEventParams<Time>);

        assert.equal(payloads.length, countAfterDisable);
        assert.equal(sub.getClearCount() > 0, true);
        assert.equal(foot.getClearCount() > 0, true);
        cleanup();
    });
});
