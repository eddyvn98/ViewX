import { ISeriesApi, IChartApi } from 'lightweight-charts';
import { IndicatorConfig, Candle } from '@/lib/store/types';
import { calculateOrderBlocks } from '../utils/indicators/smc';
import { SMCPrimitive, SMCZone } from '../logic/smc-primitive';
import { toSec } from '../utils/time-utils';

export class OrderBlockIndicator {
    private primitive: SMCPrimitive;

    constructor(
        private chart: IChartApi,
        private series: ISeriesApi<any>,
        private config: IndicatorConfig
    ) {
        this.primitive = new SMCPrimitive();
        this.series.attachPrimitive(this.primitive);
    }

    private getStyleString(key: string, fallback: string): string {
        const value = this.config.styles?.[key];
        return typeof value === 'string' ? value : fallback;
    }

    private getNumberParam(key: string, fallback: number): number {
        const value = this.config.params[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    }

    private getBooleanStyle(key: string, fallback: boolean): boolean {
        const value = this.config.styles?.[key];
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value === 'true';
        return fallback;
    }

    update(candles: Candle[], config: IndicatorConfig) {
        this.config = config;

        if (!this.config.visible) {
            this.primitive.setData(null);
            return;
        }

        const depth = this.getNumberParam('depth', 5);
        const obData = calculateOrderBlocks(candles, depth);

        const bullColor = this.getStyleString('bullColor', 'rgba(0, 255, 136, 0.2)');
        const bearColor = this.getStyleString('bearColor', 'rgba(255, 51, 102, 0.2)');
        const showMitigated = this.getBooleanStyle('showMitigated', false);

        const zones: SMCZone[] = obData
            .filter(ob => showMitigated || !ob.isMitigated)
            .map((ob, i) => {
                const baseColor = ob.type === 'bullish' ? bullColor : bearColor;
                // If mitigated, make it even more transparent
                const finalColor = ob.isMitigated ? baseColor.replace(/[\d.]+\)$/, '0.05)') : baseColor;

                return {
                    id: `ob-${i}`,
                    startTime: toSec(ob.time) as any,
                    endTime: ob.isMitigated ? toSec(ob.mitigationTime!) as any : null,
                    top: ob.high,
                    bottom: ob.low,
                    color: finalColor,
                    borderColor: ob.isMitigated ? undefined : (ob.type === 'bullish' ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 51, 102, 0.3)'),
                    label: ob.isMitigated ? undefined : 'OB'
                };
            });

        this.primitive.setData({ zones });
    }

    destroy() {
        if (this.series && this.primitive) {
            this.series.detachPrimitive(this.primitive);
        }
    }
}
