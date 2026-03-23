import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { autoSyncLayout } from '../../../logic/chart-sync';
import type { Candle } from '@/lib/store/types';
import { useMarketStore } from '@/lib/store';
import {
  buildStableTimeScaleViewport,
  LogicalRangeSource,
  PersistedRange,
  resolveLockedScaleWidth,
} from '../chart-init-helpers';
import type { PointerState } from './pointer-state';

type InteractionHandlersDeps = {
  priceChart: IChartApi;
  subchartChart: IChartApi;
  timescaleChart: IChartApi;
  priceContainer: HTMLDivElement;
  subchartContainer: HTMLDivElement;
  chartId: string;
  seriesRef: React.MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  isAutoScrollEnabledRef: React.MutableRefObject<boolean>;
  initialMinW: number;
  pointerState: PointerState;
  scheduleViewportPersist: () => void;
  flushPendingViewportPersist: () => void;
  flushLogicalRangeSync: () => void;
  cancelPendingLogicalRangeSync: () => void;
};

type InteractionHandlers = {
  handleScrollPosition: (range: PersistedRange | null) => void;
  handleAutoSync: () => void;
  handlePointerDown: (source: LogicalRangeSource) => void;
  handlePointerUp: () => void;
  handleTimescaleDoubleClick: (event: MouseEvent) => void;
  flushPendingAutoSync: () => void;
  getIsPointerInteracting: () => boolean;
  getPointerInteractionSource: () => LogicalRangeSource | null;
  dispose: () => void;
};

export function createInteractionHandlers({
  priceChart,
  subchartChart,
  timescaleChart,
  priceContainer,
  subchartContainer,
  seriesRef,
  isAutoScrollEnabledRef,
  initialMinW,
  pointerState,
  scheduleViewportPersist,
  flushPendingViewportPersist,
  flushLogicalRangeSync,
  cancelPendingLogicalRangeSync,
  chartId,
}: InteractionHandlersDeps): InteractionHandlers {
  let hasPendingAutoSync = false;
  let autoScrollResumeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let syncRequestId: number | null = null;
  let lastMaxW = initialMinW;
  let lastOlderBackfillAt = 0;
  let lastOlderBackfillOldestTime = 0;

  const handleScrollPosition = (range: PersistedRange | null) => {
    if (!range) return;
    const dataCount = seriesRef.current?.data().length || 0;
    if (dataCount === 0) return;
    const isNearRealtimeEdge = range.to >= dataCount - 1;
    if (pointerState.getIsPointerInteracting()) {
      if (pointerState.getPointerInteractionSource() !== 'foot' && !isNearRealtimeEdge) {
        isAutoScrollEnabledRef.current = false;
      }
      return;
    }
    if (!isAutoScrollEnabledRef.current && isNearRealtimeEdge) {
      isAutoScrollEnabledRef.current = true;
      return;
    }
    if (isAutoScrollEnabledRef.current && !isNearRealtimeEdge) {
      isAutoScrollEnabledRef.current = false;
    }
  };

  const handleAutoSync = () => {
    if (pointerState.getIsPointerInteracting()) {
      hasPendingAutoSync = true;
      return;
    }
    if (pointerState.getPointerInteractionSource() === 'foot') {
      hasPendingAutoSync = false;
      return;
    }
    autoSyncLayout(
      priceChart,
      subchartChart,
      timescaleChart,
      priceContainer,
      subchartContainer,
      initialMinW,
      lastMaxW,
      syncRequestId,
      (id: number | null) => {
        syncRequestId = id;
      },
      (w: number) => {
        lastMaxW = w;
      },
    );
  };

  const flushPendingAutoSync = () => {
    if (hasPendingAutoSync && !pointerState.getIsPointerInteracting()) {
      hasPendingAutoSync = false;
      handleAutoSync();
    }
  };

  const resetToStableTimeScaleViewport = () => {
    const dataCount = (seriesRef.current?.data() as Candle[] | undefined)?.length || 0;
    if (dataCount <= 0) return;
    const nextRange = buildStableTimeScaleViewport(dataCount, window.innerWidth);
    priceChart.timeScale().setVisibleLogicalRange(nextRange);
    subchartChart.timeScale().setVisibleLogicalRange(nextRange);
    timescaleChart.timeScale().setVisibleLogicalRange(nextRange);
    pointerState.setPointerInteracting(false);
    pointerState.setPointerInteractionSource(null);
    lastMaxW = initialMinW;
    scheduleViewportPersist();
  };

  const lockScaleWidthDuringPan = () => {
    try {
      const width = resolveLockedScaleWidth(
        priceChart.priceScale('right').width(),
        subchartChart.priceScale('right').width(),
      );
      if (width == null) return;
      const opt = { rightPriceScale: { minimumWidth: width } };
      priceChart.applyOptions(opt);
      subchartChart.applyOptions(opt);
      timescaleChart.applyOptions(opt);
    } catch {
      // Ignore transient resize/teardown errors.
    }
  };

  const handlePointerDown = (source: LogicalRangeSource) => {
    if (pointerState.getIsPointerInteracting()) return;
    pointerState.setPointerInteracting(true);
    pointerState.setPointerInteractionSource(source);
    if (autoScrollResumeTimeoutId) {
      clearTimeout(autoScrollResumeTimeoutId);
      autoScrollResumeTimeoutId = null;
    }
    if (source !== 'foot') {
      isAutoScrollEnabledRef.current = false;
      lockScaleWidthDuringPan();
      return;
    }
    window.dispatchEvent(
      new CustomEvent('chart-timescale-interaction', { detail: { chartId, active: true } }),
    );
  };

  const handlePointerUp = () => {
    if (!pointerState.getIsPointerInteracting()) return;
    const wasFooterInteraction = pointerState.getPointerInteractionSource() === 'foot';
    pointerState.setPointerInteracting(false);
    pointerState.setPointerInteractionSource(null);

    if (wasFooterInteraction) {
      window.dispatchEvent(
        new CustomEvent('chart-timescale-interaction', { detail: { chartId, active: false } }),
      );
    }

    cancelPendingLogicalRangeSync();
    flushLogicalRangeSync();
    autoScrollResumeTimeoutId = setTimeout(() => {
      autoScrollResumeTimeoutId = null;
      const currentRange = priceChart.timeScale().getVisibleLogicalRange();
      const dataCount = seriesRef.current?.data().length || 0;
      if (!currentRange || dataCount === 0) return;
      isAutoScrollEnabledRef.current = currentRange.to >= dataCount - 1;

      const LEFT_EDGE_TRIGGER_BARS = 160;
      const visibleBars = Math.max(1, Math.floor((currentRange.to ?? currentRange.from) - currentRange.from));
      const dynamicThreshold = Math.max(LEFT_EDGE_TRIGGER_BARS, visibleBars * 2);
      if (currentRange.from > dynamicThreshold) return;

      const firstPoint = (seriesRef.current?.data() as Array<{ time?: unknown }> | undefined)?.[0];
      const oldestTime = Number(firstPoint?.time);
      if (!Number.isFinite(oldestTime) || oldestTime <= 0) return;

      const now = Date.now();
      if (now - lastOlderBackfillAt < 2500 && Math.floor(oldestTime) === Math.floor(lastOlderBackfillOldestTime)) {
        return;
      }

      const state = useMarketStore.getState();
      let chartMeta: { symbol?: string; interval?: string; source?: string } | undefined;
      for (const tab of Object.values(state.tabs)) {
        const candidate = tab?.charts?.[chartId];
        if (candidate) {
          chartMeta = candidate;
          break;
        }
      }
      const symbol = String(chartMeta?.symbol || '').trim();
      const interval = String(chartMeta?.interval || '').trim();
      const source = String(chartMeta?.source || '').toUpperCase();
      if (!symbol || !interval || !source) return;

      lastOlderBackfillAt = now;
      lastOlderBackfillOldestTime = oldestTime;
      window.dispatchEvent(
        new CustomEvent('chart-backfill-request', {
          detail: {
            source,
            symbol,
            interval,
            count: 300,
            direction: 'older',
            anchorTimeSec: Math.floor(oldestTime),
            reason: 'pointer_pan_left_edge',
          },
        }),
      );
    }, 120);

    if (wasFooterInteraction) {
      requestAnimationFrame(() => {
        flushPendingViewportPersist();
        scheduleViewportPersist();
      });
    } else {
      flushPendingAutoSync();
      flushPendingViewportPersist();
      scheduleViewportPersist();
    }
  };

  const handleTimescaleDoubleClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    resetToStableTimeScaleViewport();
  };

  const dispose = () => {
    if (autoScrollResumeTimeoutId) {
      clearTimeout(autoScrollResumeTimeoutId);
      autoScrollResumeTimeoutId = null;
    }
    if (syncRequestId !== null) {
      cancelAnimationFrame(syncRequestId);
      syncRequestId = null;
    }
  };

  return {
    handleScrollPosition,
    handleAutoSync,
    handlePointerDown,
    handlePointerUp,
    handleTimescaleDoubleClick,
    flushPendingAutoSync,
    getIsPointerInteracting: pointerState.getIsPointerInteracting,
    getPointerInteractionSource: pointerState.getPointerInteractionSource,
    dispose,
  };
}
