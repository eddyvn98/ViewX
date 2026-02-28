import { Activity, Ruler, Sparkles, TrendingUp } from 'lucide-react';

export const INDICATOR_CATEGORIES = [
    {
        id: 'averages',
        name: 'Moving Averages',
        icon: TrendingUp,
        indicators: [
            { type: 'EMA' as const, name: 'Exponential Moving Average', description: 'Ðu?ng trung bình d?ng luy th?a, ph?n ?ng nhanh hon.', defaultParams: { period: 20 }, defaultColor: '#ffffff', pane: 'main' as const },
            { type: 'SuperTrend' as const, name: 'SuperTrend', description: 'Xác d?nh xu hu?ng chính d?a trên d? bi?n d?ng ATR.', defaultParams: { period: 10, multiplier: 3 }, defaultColor: '#ffffff', pane: 'main' as const },
            { type: 'VWAP' as const, name: 'VWAP', description: 'Giá trung bình gia quy?n theo kh?i lu?ng giao d?ch.', defaultParams: {}, defaultColor: '#FFEB3B', pane: 'main' as const },
            { type: 'SMA' as const, name: 'Simple Moving Average', description: 'Ðu?ng trung bình d?ng don gi?n, xác d?nh xu hu?ng dài h?n.', defaultParams: { period: 50 }, defaultColor: '#ffffff', pane: 'main' as const },
            { type: 'HMA' as const, name: 'Hull Moving Average', description: 'Ðu?ng trung bình d?ng Hull, c?c k? mu?t mà và ít tr?.', defaultParams: { period: 25 }, defaultColor: '#ffffff', pane: 'main' as const },
            { type: 'Ichimoku' as const, name: 'Ichimoku Cloud', description: 'H? th?ng cái nhìn thoáng qua toàn di?n v? bi?u d?.', defaultParams: { tenkan: 9, kijun: 26, spanB: 52, displacement: 26 }, defaultColor: '#2196F3', pane: 'main' as const },
            { type: 'SAR' as const, name: 'Parabolic SAR', description: 'Ch? báo d?ng và d?o chi?u Parabolic.', defaultParams: { startAF: 0.02, incrementAF: 0.02, maxAF: 0.2 }, defaultColor: '#2196F3', pane: 'main' as const },
        ],
    },
    {
        id: 'oscillators',
        name: 'Oscillators',
        icon: Activity,
        indicators: [
            { type: 'RSI' as const, name: 'Relative Strength Index (RSI)', description: 'Ch? s? s?c m?nh tuong d?i, do lu?ng quá mua/quá bán.', defaultParams: { period: 14, overbought: 70, oversold: 30 }, defaultColor: '#ffffff', pane: 'subchart' as const },
            { type: 'Stochastic' as const, name: 'Stochastic Oscillator', description: 'Ch? báo d?ng lu?ng xác d?nh vùng quá mua/quá bán.', defaultParams: { periodK: 14, smoothK: 3, periodD: 3 }, defaultColor: '#ffffff', pane: 'subchart' as const },
            { type: 'ADX' as const, name: 'Average Directional Index (ADX)', description: 'Ðo lu?ng s?c m?nh và cu?ng d? c?a xu hu?ng.', defaultParams: { period: 14 }, defaultColor: '#FFB74D', pane: 'subchart' as const },
            { type: 'MACD' as const, name: 'MACD', description: 'Ðu?ng trung bình d?ng h?i t? phân k?.', defaultParams: { fast: 12, slow: 26, signal: 9 }, defaultColor: '#2962FF', pane: 'subchart' as const },
        ],
    },
    {
        id: 'volatility',
        name: 'Volatility Indicators',
        icon: Activity,
        indicators: [
            { type: 'BollingerBands' as const, name: 'Bollinger Bands', description: 'D?i Bollinger xác d?nh bi?n d?ng giá.', defaultParams: { period: 20, stdDev: 2 }, defaultColor: '#ffffff', pane: 'main' as const },
            { type: 'ATR' as const, name: 'Average True Range', description: 'Ðo lu?ng d? bi?n d?ng th?c t? trung bình.', defaultParams: { period: 14 }, defaultColor: '#f06292', pane: 'subchart' as const },
        ],
    },
    {
        id: 'smart-analysis',
        name: 'Smart Analysis',
        icon: Sparkles,
        indicators: [
            { type: 'TrendLines' as const, name: 'Trend Lines', description: 'V? du?ng xu hu?ng d?a trên d?nh/dáy c?u trúc.', defaultParams: {}, defaultColor: '#ffffff', pane: 'main' as const },
            { type: 'MarketStructure' as const, name: 'Market Structure Labels', description: 'Hi?n th? HH, LL, HL, LH tr?c ti?p trên bi?u d?.', defaultParams: { depth: 7 }, defaultColor: '#ffffff', pane: 'main' as const },
            { type: 'BreakoutRays' as const, name: 'Breakout Horizontal Rays', description: 'V? các du?ng ngang t?i m?c d?nh/dáy d?t phá.', defaultParams: {}, defaultColor: '#ffffff', pane: 'main' as const },
            { type: 'OrderBlock' as const, name: 'Order Blocks (OB)', description: 'Xác d?nh các vùng l?nh l?n c?a Smart Money.', defaultParams: { depth: 5 }, defaultColor: 'rgba(0, 255, 136, 0.4)', pane: 'main' as const },
            { type: 'FVG' as const, name: 'Fair Value Gaps (FVG)', description: 'Tìm ki?m các kho?ng tr?ng giá m?t cân b?ng.', defaultParams: {}, defaultColor: 'rgba(255, 51, 102, 0.4)', pane: 'main' as const },
        ],
    },
    {
        id: 'fibonacci',
        name: 'Fibonacci Tools',
        icon: Ruler,
        indicators: [
            { type: 'Fibonacci' as const, name: 'Fibonacci Retracement', description: 'T? d?ng tính toán các m?c thoái lui Fibonacci.', defaultParams: { depth: 7 }, defaultColor: '#ffffff', pane: 'main' as const },
            { type: 'FibonacciExtension' as const, name: 'Trend-Based Fibonacci Extension', description: 'M? r?ng Fibonacci d?a trên xu hu?ng (3 di?m swing).', defaultParams: { depth: 7 }, defaultColor: '#ffffff', pane: 'main' as const },
        ],
    },
];
