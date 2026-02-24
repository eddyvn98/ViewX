import { ISeriesApi, IChartApi } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateFVG } from '../utils/indicators/smc';
import { SMCPrimitive, SMCZone } from '../logic/smc-primitive';
import { toSec } from '../utils/time-utils';

export class FVGIndicator {
    private primitive: SMCPrimitive;

    constructor(
        private chart: IChartApi,
        private series: ISeriesApi<any>,
        private config: IndicatorConfig
    ) {
        this.primitive = new SMCPrimitive();
        this.series.attachPrimitive(this.primitive);
    }

    update(candles: Candle[], config: IndicatorConfig) {
        this.config = config;

        if (!this.config.visible) {
            this.primitive.setData(null);
            return;
        }

        const fvgData = calculateFVG(candles);
        const styles = this.config.styles || {};
        const bullColor = styles.bullColor || 'rgba(0, 255, 136, 0.15)';
        const bearColor = styles.bearColor || 'rgba(255, 51, 102, 0.15)';

        const zones: SMCZone[] = fvgData.map((fvg, i) => ({
            id: `fvg-${i}`,
            startTime: toSec(fvg.time) as any,
            endTime: null, // FVGs extend until filled, but for simplicity we can just show them
            top: fvg.top,
            bottom: fvg.bottom,
            color: fvg.type === 'bullish' ? bullColor : bearColor,
            label: 'FVG'
        }));

        this.primitive.setData({ zones });
    }

    destroy() {
        if (this.series && this.primitive) {
            this.series.detachPrimitive(this.primitive);
        }
    }
}
