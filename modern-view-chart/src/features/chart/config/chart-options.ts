import { ColorType, CrosshairMode, DeepPartial, ChartOptions } from 'lightweight-charts';

export const initialMinW = 62; // Standard width to prevent excessive right-side gap

export const getThemeColors = (theme: string, themeColor?: string) => {
    const isDark = theme === 'dark';

    // Grid colors for Five Elements (matching CSS variables)
    const gridColors: Record<string, string> = {
        blue: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)',
        green: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.08)',
        amber: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.1)',
        red: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.08)',
        slate: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.08)',
    };

    const gridColor = (themeColor && gridColors[themeColor])
        ? gridColors[themeColor]
        : (isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)');

    const crosshairColor = (themeColor && gridColors[themeColor])
        ? gridColors[themeColor].replace(/0\.1[0-2]?|0\.08/g, '0.5') // Higher opacity for crosshair
        : '#758696';

    return {
        background: isDark ? '#0b0e14' : '#ffffff',
        text: isDark ? '#9ca3af' : '#4b5563',
        grid: gridColor,
        border: 'transparent',
        crosshair: crosshairColor,
        labelBg: isDark ? '#2a2e39' : '#374151',
        labelText: '#ffffff',
    };
};

export const getCommonOptions = (theme: string, themeColor?: string): DeepPartial<ChartOptions> => {
    const colors = getThemeColors(theme, themeColor);
    return {
        layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: colors.text,
            fontSize: 11, // Increased to improve line height/readability
            fontFamily: "'Inter', sans-serif"
        },
        grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
        crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
                visible: true,
                labelVisible: true,
                color: colors.crosshair,
                width: 1,
                style: 2, // Dashed
                labelBackgroundColor: colors.labelBg
            },
            horzLine: {
                visible: true,
                labelVisible: true,
                color: colors.crosshair,
                width: 1,
                style: 2, // Dashed
                labelBackgroundColor: colors.labelBg
            }
        },
        timeScale: {
            rightOffset: 12,
            barSpacing: 10,
            fixLeftEdge: true,
            fixRightEdge: false,
            lockVisibleTimeRangeOnResize: true,
            rightBarStaysOnScroll: true,
            borderVisible: false,
            borderColor: 'transparent',
            visible: true,
            timeVisible: true,
            secondsVisible: false,
            shiftVisibleRangeOnNewBar: true,
        },
    };
};

export const getPriceChartOptions = (width: number, height: number, theme: string, themeColor?: string): DeepPartial<ChartOptions> => {
    const common = getCommonOptions(theme, themeColor);
    return {
        ...common,
        width,
        height,
        timeScale: { ...common.timeScale, visible: false },
        rightPriceScale: {
            visible: true,
            scaleMargins: { top: 0.1, bottom: 0.1 },
            borderVisible: false,
            borderColor: 'transparent',
            minimumWidth: initialMinW,
        },
        handleScale: { mouseWheel: true, axisPressedMouseMove: { price: true, time: true } as any },
        handleScroll: true,
    };
};

export const getSubChartOptions = (width: number, height: number, theme: string, themeColor?: string): DeepPartial<ChartOptions> => {
    const common = getCommonOptions(theme, themeColor);
    return {
        ...common,
        layout: { ...common.layout, background: { type: ColorType.Solid, color: 'transparent' } },
        width,
        height,
        timeScale: { ...common.timeScale, visible: false },
        crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: { visible: false, labelVisible: false },
            horzLine: { visible: false, labelVisible: false }
        },
        rightPriceScale: {
            visible: true,
            autoScale: true,
            scaleMargins: { top: 0.1, bottom: 0.1 },
            borderVisible: false,
            borderColor: 'transparent',
            minimumWidth: initialMinW,
        },
        handleScale: { mouseWheel: false, axisPressedMouseMove: { price: true, time: true } as any },
        handleScroll: true,
    };
};

export const getTimescaleOptions = (width: number, height: number, theme: string, themeColor?: string): DeepPartial<ChartOptions> => {
    const common = getCommonOptions(theme, themeColor);
    const colors = getThemeColors(theme, themeColor);
    return {
        ...common,
        layout: { ...common.layout, fontSize: 11 },
        grid: { vertLines: { visible: false }, horzLines: { visible: false } },
        width,
        height,
        timeScale: { ...common.timeScale, visible: true },
        rightPriceScale: {
            visible: true,
            borderVisible: false,
            ticksVisible: false,
            minimumWidth: initialMinW,
            borderColor: 'transparent'
        },
        leftPriceScale: { visible: false },
        crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
                visible: true,
                labelVisible: true,
                color: 'transparent',
                labelBackgroundColor: colors.labelBg
            },
            horzLine: { visible: false, labelVisible: false },
        },
        handleScale: { mouseWheel: true, axisPressedMouseMove: { time: true } as any },
        handleScroll: true,
    };
};
