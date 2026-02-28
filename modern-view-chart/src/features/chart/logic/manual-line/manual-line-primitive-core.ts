import {
    ISeriesPrimitive,
    IPrimitivePaneView,
    IChartApi,
    ISeriesApi,
} from 'lightweight-charts';
import { ManualLinePaneView } from './manual-line-pane-view';

export interface ManualLineData {
    points: { time: number; price: number }[];
    type: 'trend-line' | 'horizontal-line' | 'vertical-line' | 'crosshair';
    color: string;
    lineWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    selected?: boolean;
}

export class ManualLinePrimitive implements ISeriesPrimitive {
    _data: ManualLineData | null = null;
    _paneViews: ManualLinePaneView[] = [];
    _series: ISeriesApi<any> | null = null;
    _chart: IChartApi | null = null;
    _requestUpdate: (() => void) | null = null;

    constructor() {
        this._paneViews = [new ManualLinePaneView(this)];
    }

    update(data: ManualLineData) {
        this._data = data;
        this._paneViews[0].update(data);
        this._requestUpdate?.();
    }

    attached({ chart, series, requestUpdate }: any) {
        this._series = series;
        this._chart = chart;
        this._requestUpdate = requestUpdate;
    }

    detached() {
        this._series = null;
        this._chart = null;
        this._requestUpdate = null;
    }

    paneViews(): IPrimitivePaneView[] {
        return this._paneViews;
    }
}
