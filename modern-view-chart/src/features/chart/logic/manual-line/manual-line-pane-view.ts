import { IPrimitivePaneView, IPrimitivePaneRenderer, PrimitivePaneViewZOrder } from 'lightweight-charts';
import { ManualLineData, ManualLinePrimitive } from './manual-line-primitive-core';
import { ManualLinePaneRenderer } from './manual-line-pane-renderer';

export class ManualLinePaneView implements IPrimitivePaneView {
    _source: ManualLinePrimitive;
    _data: ManualLineData | null = null;

    constructor(source: ManualLinePrimitive) {
        this._source = source;
    }

    update(data: ManualLineData | null) {
        this._data = data;
    }

    renderer(): IPrimitivePaneRenderer | null {
        return new ManualLinePaneRenderer(this._data, this._source);
    }

    zOrder(): PrimitivePaneViewZOrder {
        return 'bottom';
    }
}
