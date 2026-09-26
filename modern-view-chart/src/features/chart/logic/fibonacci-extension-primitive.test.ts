import assert from 'node:assert/strict';
import test from 'node:test';
import { FibonacciExtensionPrimitive } from './fibonacci-extension-primitive';

test('does not throw when a timeframe switch removes Fibonacci extension times from the chart scale', () => {
    const data = {
        p1Time: 100 as never,
        p2Time: 200 as never,
        p3Time: 300 as never,
        p1Price: 10,
        p2Price: 20,
        p3Price: 15,
        showPercent: true,
        showPrice: true,
        levels: [{ ratio: 1, label: '100%', color: '#fff', price: 20 }],
    };
    const primitive = new FibonacciExtensionPrimitive(data);
    primitive.attached({
        chart: { timeScale: () => ({ timeToCoordinate: () => { throw new Error('Value is undefined'); } }) },
        series: { priceToCoordinate: () => 10 },
    });
    primitive.setData(data);

    const ctx = {
        save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fillText() {},
        setLineDash() {},
    } as unknown as CanvasRenderingContext2D;
    const target = {
        useBitmapCoordinateSpace(callback: (scope: unknown) => void) {
            callback({ context: ctx, horizontalPixelRatio: 1, verticalPixelRatio: 1, bitmapSize: { width: 100, height: 100 } });
        },
    };

    assert.doesNotThrow(() => primitive.paneViews()[0].renderer().draw(target));
});
