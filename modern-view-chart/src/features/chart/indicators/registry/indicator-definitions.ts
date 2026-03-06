export type IndicatorParamType = 'number' | 'boolean' | 'select' | 'color';

export interface IndicatorParamSchema {
    name: string;
    type: IndicatorParamType;
    default: any;
    min?: number;
    max?: number;
    step?: number;
    options?: { label: string; value: any }[];
}

export interface IndicatorStyleSchema {
    name: string;
    label: string;
    type: 'color' | 'number' | 'select';
    default: any;
    min?: number;
    max?: number;
    step?: number;
    options?: { label: string; value: any }[];
}

export interface IndicatorMetadata {
    type: string;
    name: string;
    description: string;
    params: Record<string, IndicatorParamSchema>;
    styles: Record<string, IndicatorStyleSchema>;
}

export const INDICATOR_REGISTRY: Record<string, IndicatorMetadata> = {
    EMA: {
        type: 'EMA',
        name: 'Exponential Moving Average',
        description: 'Đường trung bình động lũy thừa.',
        params: {
            period: { name: 'Period', type: 'number', default: 20, min: 1, max: 500 }
        },
        styles: {
            line: { name: 'line', label: 'EMA Line', type: 'color', default: '#00ff88' },
            aboveLine: { name: 'aboveLine', label: 'Price Above', type: 'color', default: '#22c55e' },
            belowLine: { name: 'belowLine', label: 'Price Below', type: 'color', default: '#ef4444' },
            width: { name: 'width', label: 'Line Width', type: 'number', default: 2, min: 1, max: 10 }
        }
    },
    SMA: {
        type: 'SMA',
        name: 'Simple Moving Average',
        description: 'Đường trung bình động đơn giản.',
        params: {
            period: { name: 'Period', type: 'number', default: 50, min: 1, max: 500 }
        },
        styles: {
            line: { name: 'line', label: 'SMA Line', type: 'color', default: '#2196F3' },
            aboveLine: { name: 'aboveLine', label: 'Price Above', type: 'color', default: '#22c55e' },
            belowLine: { name: 'belowLine', label: 'Price Below', type: 'color', default: '#ef4444' },
            width: { name: 'width', label: 'Line Width', type: 'number', default: 2, min: 1, max: 10 }
        }
    },
    RSI: {
        type: 'RSI',
        name: 'Relative Strength Index',
        description: 'Chỉ số sức mạnh tương đối.',
        params: {
            period: { name: 'Period', type: 'number', default: 14, min: 1, max: 100 },
            overbought: { name: 'Overbought', type: 'number', default: 70, min: 1, max: 100 },
            oversold: { name: 'Oversold', type: 'number', default: 30, min: 1, max: 100 }
        },
        styles: {
            line: { name: 'line', label: 'RSI Line', type: 'color', default: '#f06292' },
            width: { name: 'width', label: 'Line Width', type: 'number', default: 2, min: 1, max: 10 },
            upperBand: { name: 'upperBand', label: 'Upper Band', type: 'color', default: '#ef5350' },
            lowerBand: { name: 'lowerBand', label: 'Lower Band', type: 'color', default: '#26a69a' }
        }
    },
    MACD: {
        type: 'MACD',
        name: 'MACD',
        description: 'Moving Average Convergence Divergence.',
        params: {
            fast: { name: 'Fast Length', type: 'number', default: 12, min: 1, max: 100 },
            slow: { name: 'Slow Length', type: 'number', default: 26, min: 1, max: 100 },
            signal: { name: 'Signal Smoothing', type: 'number', default: 9, min: 1, max: 100 }
        },
        styles: {
            macdLine: { name: 'macdLine', label: 'MACD Line', type: 'color', default: '#2962FF' },
            signalLine: { name: 'signalLine', label: 'Signal Line', type: 'color', default: '#FF6D00' },
            histogramBull: { name: 'histogramBull', label: 'Histogram (Bull)', type: 'color', default: '#26a69a' },
            histogramBear: { name: 'histogramBear', label: 'Histogram (Bear)', type: 'color', default: '#ef5350' }
        }
    },
    HMA: {
        type: 'HMA',
        name: 'Hull Moving Average',
        description: 'Đường trung bình động Hull.',
        params: {
            period: { name: 'Period', type: 'number', default: 25, min: 1, max: 500 }
        },
        styles: {
            line: { name: 'line', label: 'HMA Line', type: 'color', default: '#00bcd4' },
            aboveLine: { name: 'aboveLine', label: 'Price Above', type: 'color', default: '#06b6d4' },
            belowLine: { name: 'belowLine', label: 'Price Below', type: 'color', default: '#a855f7' },
            width: { name: 'width', label: 'Line Width', type: 'number', default: 2, min: 1, max: 10 }
        }
    },
    MarketStructure: {
        type: 'MarketStructure',
        name: 'Market Structure',
        description: 'Cấu trúc thị trường (HH, LL, HL, LH).',
        params: {
            depth: { name: 'Depth', type: 'number', default: 7, min: 1, max: 50 }
        },
        styles: {
            bullColor: { name: 'bullColor', label: 'Bullish Label', type: 'color', default: '#00ff88' },
            bearColor: { name: 'bearColor', label: 'Bearish Label', type: 'color', default: '#ff4444' },
            fontSize: { name: 'fontSize', label: 'Font Size', type: 'number', default: 10, min: 8, max: 20 }
        }
    },
    TrendLines: {
        type: 'TrendLines',
        name: 'Trend Lines',
        description: 'Đường xu hướng tự động.',
        params: {
            depth: { name: 'Depth', type: 'number', default: 7, min: 1, max: 50 }
        },
        styles: {
            support: { name: 'support', label: 'Support Line', type: 'color', default: '#00ff88' },
            resistance: { name: 'resistance', label: 'Resistance Line', type: 'color', default: '#ff4444' },
            width: { name: 'width', label: 'Line Width', type: 'number', default: 1, min: 1, max: 5 }
        }
    },
    Fibonacci: {
        type: 'Fibonacci',
        name: 'Fibonacci Retracement',
        description: 'Thoái lui Fibonacci.',
        params: {
            depth: { name: 'Depth', type: 'number', default: 7, min: 2, max: 100 }
        },
        styles: {
            lineColor: { name: 'lineColor', label: 'Level Lines', type: 'color', default: '#ffffff' },
            labelColor: { name: 'labelColor', label: 'Labels', type: 'color', default: '#ffffff' },
            opacity: { name: 'opacity', label: 'Background Opacity', type: 'number', default: 0.1, min: 0, max: 1, step: 0.05 }
        }
    },
    BollingerBands: {
        type: 'BollingerBands',
        name: 'Bollinger Bands',
        description: 'Dải Bollinger xác định biến động.',
        params: {
            period: { name: 'Period', type: 'number', default: 20, min: 1, max: 200 },
            stdDev: { name: 'Standard Deviation', type: 'number', default: 2, min: 1, max: 5, step: 0.1 }
        },
        styles: {
            middleLine: { name: 'middleLine', label: 'Middle Band', type: 'color', default: '#FFB74D' },
            upperLine: { name: 'upperLine', label: 'Upper Band', type: 'color', default: '#2196F3' },
            lowerLine: { name: 'lowerLine', label: 'Lower Band', type: 'color', default: '#2196F3' },
            background: { name: 'background', label: 'Background Fill', type: 'color', default: 'rgba(33, 150, 243, 0.05)' }
        }
    },
    Stochastic: {
        type: 'Stochastic',
        name: 'Stochastic Oscillator',
        description: 'Chỉ báo động lượng Stochastic.',
        params: {
            periodK: { name: '%K Period', type: 'number', default: 14, min: 1, max: 100 },
            smoothK: { name: '%K Smoothing', type: 'number', default: 3, min: 1, max: 50 },
            periodD: { name: '%D Period', type: 'number', default: 3, min: 1, max: 50 }
        },
        styles: {
            kLine: { name: 'kLine', label: '%K Line', type: 'color', default: '#2196F3' },
            dLine: { name: 'dLine', label: '%D Line', type: 'color', default: '#FF6D00' },
            upperBand: { name: 'upperBand', label: 'Upper Band', type: 'color', default: '#ef5350' },
            lowerBand: { name: 'lowerBand', label: 'Lower Band', type: 'color', default: '#26a69a' }
        }
    },
    ATR: {
        type: 'ATR',
        name: 'Average True Range',
        description: 'Độ biến động thực tế trung bình.',
        params: {
            period: { name: 'Period', type: 'number', default: 14, min: 1, max: 100 }
        },
        styles: {
            line: { name: 'line', label: 'ATR Line', type: 'color', default: '#f06292' },
            width: { name: 'width', label: 'Line Width', type: 'number', default: 2, min: 1, max: 10 }
        }
    },
    SuperTrend: {
        type: 'SuperTrend',
        name: 'SuperTrend',
        description: 'Chỉ báo xu hướng dựa trên độ biến động ATR.',
        params: {
            period: { name: 'ATR Period', type: 'number', default: 10, min: 1, max: 100 },
            multiplier: { name: 'Multiplier', type: 'number', default: 3, min: 1, max: 20, step: 0.1 }
        },
        styles: {
            bullColor: { name: 'bullColor', label: 'Bullish Trend', type: 'color', default: '#00ff88' },
            bearColor: { name: 'bearColor', label: 'Bearish Trend', type: 'color', default: '#ff4444' },
            width: { name: 'width', label: 'Line Width', type: 'number', default: 2, min: 1, max: 10 }
        }
    },
    VWAP: {
        type: 'VWAP',
        name: 'VWAP',
        description: 'Giá trung bình gia quyền theo khối lượng.',
        params: {},
        styles: {
            line: { name: 'line', label: 'VWAP Line', type: 'color', default: '#FFEB3B' },
            width: { name: 'width', label: 'Line Width', type: 'number', default: 1, min: 1, max: 10 }
        }
    },
    Ichimoku: {
        type: 'Ichimoku',
        name: 'Ichimoku Cloud',
        description: 'Hệ thống cái nhìn thoáng qua về sự cân bằng của biểu đồ.',
        params: {
            tenkan: { name: 'Tenkan-sen', type: 'number', default: 9, min: 1, max: 100 },
            kijun: { name: 'Kijun-sen', type: 'number', default: 26, min: 1, max: 100 },
            spanB: { name: 'Senkou Span B', type: 'number', default: 52, min: 1, max: 200 },
            displacement: { name: 'Displacement', type: 'number', default: 26, min: 1, max: 100 }
        },
        styles: {
            tenkanLine: { name: 'tenkanLine', label: 'Tenkan-sen', type: 'color', default: '#2196F3' },
            kijunLine: { name: 'kijunLine', label: 'Kijun-sen', type: 'color', default: '#FF6D00' },
            spanALine: { name: 'spanALine', label: 'Senkou Span A', type: 'color', default: '#26a69a' },
            spanBLine: { name: 'spanBLine', label: 'Senkou Span B', type: 'color', default: '#ef5350' },
            chikouLine: { name: 'chikouLine', label: 'Chikou Span', type: 'color', default: '#9c27b0' },
            cloudUp: { name: 'cloudUp', label: 'Cloud Bullish (Up)', type: 'color', default: 'rgba(38, 166, 154, 0.1)' },
            cloudDown: { name: 'cloudDown', label: 'Cloud Bearish (Down)', type: 'color', default: 'rgba(239, 83, 80, 0.1)' }
        }
    },
    ADX: {
        type: 'ADX',
        name: 'Average Directional Index (ADX)',
        description: 'Đo lường sức mạnh của xu hướng.',
        params: {
            period: { name: 'ADX Period', type: 'number', default: 14, min: 1, max: 100 }
        },
        styles: {
            adxLine: { name: 'adxLine', label: 'ADX Line', type: 'color', default: '#FFB74D' },
            plusDI: { name: 'plusDI', label: '+DI Line', type: 'color', default: '#26a69a' },
            minusDI: { name: 'minusDI', label: '-DI Line', type: 'color', default: '#ef5350' },
            width: { name: 'width', label: 'Line Width', type: 'number', default: 2, min: 1, max: 10 }
        }
    },
    OrderBlock: {
        type: 'OrderBlock',
        name: 'Order Blocks (OB)',
        description: 'Xác định các vùng lệnh của Smart Money.',
        params: {
            depth: { name: 'Detection Depth', type: 'number', default: 5, min: 2, max: 50 }
        },
        styles: {
            bullColor: { name: 'bullColor', label: 'Bullish OB', type: 'color', default: 'rgba(0, 255, 136, 0.2)' },
            bearColor: { name: 'bearColor', label: 'Bearish OB', type: 'color', default: 'rgba(255, 51, 102, 0.2)' },
            showMitigated: { name: 'showMitigated', label: 'Show Mitigated', type: 'select', default: 'false', options: [{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }] }
        }
    },
    FVG: {
        type: 'FVG',
        name: 'Fair Value Gaps (FVG)',
        description: 'Phát hiện các khoảng trống mất cân bằng thanh khoản.',
        params: {},
        styles: {
            bullColor: { name: 'bullColor', label: 'Bullish FVG', type: 'color', default: 'rgba(0, 255, 136, 0.15)' },
            bearColor: { name: 'bearColor', label: 'Bearish FVG', type: 'color', default: 'rgba(255, 51, 102, 0.15)' }
        }
    },
    SAR: {
        type: 'SAR',
        name: 'Parabolic SAR',
        description: 'Chỉ báo dừng và đảo chiều Parabolic.',
        params: {
            startAF: { name: 'Start AF', type: 'number', default: 0.02, min: 0.01, max: 0.1, step: 0.01 },
            incrementAF: { name: 'Increment AF', type: 'number', default: 0.02, min: 0.01, max: 0.1, step: 0.01 },
            maxAF: { name: 'Max AF', type: 'number', default: 0.2, min: 0.1, max: 0.5, step: 0.01 }
        },
        styles: {
            color: { name: 'color', label: 'Color', type: 'color', default: '#2196F3' },
            width: { name: 'width', label: 'Dot Size', type: 'number', default: 2, min: 1, max: 5 }
        }
    }
};
