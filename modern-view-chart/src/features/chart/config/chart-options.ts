import { ColorType, CrosshairMode, DeepPartial, ChartOptions } from 'lightweight-charts';

export const initialMinW = typeof window !== 'undefined' ? (window.innerWidth < 768 ? 50 : 60) : 60;

export const commonOptions: DeepPartial<ChartOptions> = {
    layout: { background: { type: ColorType.Solid, color: '#131722' }, textColor: '#d4d4d8' },
    grid: { vertLines: { color: '#1e222d' }, horzLines: { color: '#1e222d' } },
    crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { visible: true, labelVisible: true },
        horzLine: { visible: true, labelVisible: true }
    },
    timeScale: {
        rightOffset: 20,
        barSpacing: 10,
        fixLeftEdge: true,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: false,
        borderVisible: false,
        borderColor: "#2B2B43",
        visible: true,
        timeVisible: true,
        secondsVisible: false,
        shiftVisibleRangeOnNewBar: true,
    },
};

export const getPriceChartOptions = (width: number, height: number): DeepPartial<ChartOptions> => ({
    ...commonOptions,
    width,
    height,
    timeScale: { ...commonOptions.timeScale, visible: false },
    rightPriceScale: {
        visible: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
        borderVisible: true,
        minimumWidth: initialMinW,
    },
    handleScale: { mouseWheel: true, axisPressedMouseMove: { price: true, time: true } as any },
    handleScroll: true,
});

export const getSubChartOptions = (width: number, height: number): DeepPartial<ChartOptions> => ({
    ...commonOptions,
    layout: { ...commonOptions.layout, background: { type: ColorType.Solid, color: 'transparent' } },
    width,
    height,
    timeScale: { ...commonOptions.timeScale, visible: false },
    crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { visible: false, labelVisible: false },
        horzLine: { visible: false, labelVisible: false }
    },
    rightPriceScale: {
        visible: true,
        autoScale: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
        borderVisible: true,
        minimumWidth: initialMinW,
    },
    handleScale: { mouseWheel: false, axisPressedMouseMove: { price: true, time: true } as any },
    handleScroll: true,
});

export const getTimescaleOptions = (width: number, height: number): DeepPartial<ChartOptions> => ({
    ...commonOptions,
    layout: { background: { type: ColorType.Solid, color: '#131722' }, textColor: '#d4d4d8', fontSize: 11 },
    grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    width,
    height,
    timeScale: { ...commonOptions.timeScale, visible: true },
    rightPriceScale: { visible: true, borderVisible: false, ticksVisible: false, minimumWidth: initialMinW },
    leftPriceScale: { visible: false },
    crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
            visible: true,
            labelVisible: true,
            color: 'transparent', // Transparent to hide dashed line, but force label to show
        },
        horzLine: { visible: false, labelVisible: false },
    },
    handleScale: { mouseWheel: true, axisPressedMouseMove: { time: true } as any },
    handleScroll: true,
});
