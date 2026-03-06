import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { EMAIndicator } from '../../indicators/EMAIndicator';
import { HMAIndicator } from '../../indicators/HMAIndicator';
import { RSIIndicator } from '../../indicators/RSIIndicator';
import { MACDIndicator } from '../../indicators/MACDIndicator';
import { BreakoutRaysIndicator } from '../../indicators/BreakoutRaysIndicator';
import { TrendLineIndicator } from '../../indicators/TrendLineIndicator';
import { MarketStructureIndicator } from '../../indicators/MarketStructureIndicator';
import { FibonacciIndicator } from '../../indicators/FibonacciIndicator';
import { FibonacciExtensionIndicator } from '../../indicators/FibonacciExtensionIndicator';
import { ATRIndicator } from '../../indicators/ATRIndicator';
import { BollingerBandsIndicator } from '../../indicators/BollingerBandsIndicator';
import { StochasticIndicator } from '../../indicators/StochasticIndicator';
import { SuperTrendIndicator } from '../../indicators/SuperTrendIndicator';
import { VWAPIndicator } from '../../indicators/VWAPIndicator';
import { IchimokuIndicator } from '../../indicators/IchimokuIndicator';
import { ADXIndicator } from '../../indicators/ADXIndicator';
import { OrderBlockIndicator } from '../../indicators/OrderBlockIndicator';
import { FVGIndicator } from '../../indicators/FVGIndicator';
import { SARIndicator } from '../../indicators/SARIndicator';

interface IndicatorRefs {
    priceChart: IChartApi;
    subchartChart: IChartApi;
    series: ISeriesApi<any>;
    markerSeries: ISeriesApi<any>;
}

export function createIndicatorInstance(config: any, refs: IndicatorRefs): any {
    const { priceChart, subchartChart, series, markerSeries } = refs;

    switch (config.type) {
        case 'EMA': return new EMAIndicator(priceChart, config);
        case 'SMA': return new EMAIndicator(priceChart, config);
        case 'HMA': return new HMAIndicator(priceChart, config);
        case 'RSI': return new RSIIndicator(subchartChart, config);
        case 'MACD': return new MACDIndicator(subchartChart, config);
        case 'BREAKOUT_RAYS':
        case 'BreakoutRays': return new BreakoutRaysIndicator(markerSeries as any, config);
        case 'TREND_LINES':
        case 'TrendLines': return new TrendLineIndicator(markerSeries as any, config);
        case 'MARKET_STRUCTURE':
        case 'MarketStructure': return new MarketStructureIndicator(markerSeries as any, config);
        case 'FIBONACCI':
        case 'Fibonacci': return new FibonacciIndicator(markerSeries as any, config);
        case 'FIBONACCI_EXTENSION':
        case 'FibonacciExtension': return new FibonacciExtensionIndicator(markerSeries as any, config);
        case 'ATR': return new ATRIndicator(subchartChart, config);
        case 'BollingerBands':
        case 'BOLLINGER_BANDS': return new BollingerBandsIndicator(priceChart, config);
        case 'Stochastic':
        case 'STOCHASTIC': return new StochasticIndicator(subchartChart, config);
        case 'SuperTrend':
        case 'SUPERTREND': return new SuperTrendIndicator(priceChart, config);
        case 'VWAP': return new VWAPIndicator(priceChart, config);
        case 'Ichimoku':
        case 'ICHIMOKU': return new IchimokuIndicator(priceChart, config);
        case 'ADX': return new ADXIndicator(subchartChart, config);
        case 'OrderBlock': return new OrderBlockIndicator(priceChart, series, config);
        case 'FVG': return new FVGIndicator(priceChart, series, config);
        case 'SAR': return new SARIndicator(priceChart, config);
        default: return null;
    }
}
