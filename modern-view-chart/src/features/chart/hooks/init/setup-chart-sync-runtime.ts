import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { ChartInstance } from '@/lib/store/types';
import {
  LogicalRangeSource,
  PersistedRange,
  sanitizeRange,
} from './chart-init-helpers';
import { createLogicalRangeSync } from './chart-sync-runtime/logical-range';
import { createPointerState } from './chart-sync-runtime/pointer-state';
import { createViewportPersistence } from './chart-sync-runtime/persistence';
import { createInteractionHandlers } from './chart-sync-runtime/interaction-handlers';

type RuntimeParams = {
  priceChart: IChartApi;
  subchartChart: IChartApi;
  timescaleChart: IChartApi;
  priceContainer: HTMLDivElement;
  subchartContainer: HTMLDivElement;
  timescaleContainer: HTMLDivElement;
  chartId: string;
  seriesRef: React.MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  persistedViewportRef: React.MutableRefObject<ChartInstance['viewport'] | undefined>;
  currentContextKeyRef: React.MutableRefObject<string | undefined>;
  viewportSaveTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  isAutoScrollEnabledRef: React.MutableRefObject<boolean>;
  initialMinW: number;
  updateChart: (chartId: string, patch: Partial<ChartInstance>) => void;
};

export function setupChartSyncRuntime({
  priceChart,
  subchartChart,
  timescaleChart,
  priceContainer,
  subchartContainer,
  timescaleContainer,
  chartId,
  seriesRef,
  persistedViewportRef,
  currentContextKeyRef,
  viewportSaveTimeoutRef,
  isAutoScrollEnabledRef,
  initialMinW,
  updateChart,
}: RuntimeParams) {
  const priceTS = priceChart.timeScale();
  const subTS = subchartChart.timeScale();
  const footTS = timescaleChart.timeScale();

  let isDisposed = false;

  const pointerState = createPointerState();

  const viewportPersistence = createViewportPersistence({
    priceChart,
    subchartChart,
    currentContextKeyRef,
    viewportSaveTimeoutRef,
    updateChart,
    chartId,
    getIsPointerInteracting: pointerState.getIsPointerInteracting,
  });
  const { scheduleViewportPersist, flushPendingViewportPersist } = viewportPersistence;

  const logicalRangeSync = createLogicalRangeSync({
    priceTS,
    subTS,
    footTS,
    scheduleViewportPersist,
    getIsPointerInteracting: pointerState.getIsPointerInteracting,
    getPointerInteractionSource: pointerState.getPointerInteractionSource,
  });
  const {
    queueLogicalRangeSync,
    flushLogicalRangeSync,
    cancelPendingLogicalRangeSync,
    setLastAppliedLogicalRange,
  } = logicalRangeSync;

  const interactionHandlers = createInteractionHandlers({
    priceChart,
    subchartChart,
    timescaleChart,
    priceContainer,
    subchartContainer,
    chartId,
    seriesRef,
    isAutoScrollEnabledRef,
    initialMinW,
    pointerState,
    scheduleViewportPersist,
    flushPendingViewportPersist,
    flushLogicalRangeSync,
    cancelPendingLogicalRangeSync,
  });

  const {
    handleScrollPosition,
    handleAutoSync,
    handlePointerDown,
    handlePointerUp,
    handleTimescaleDoubleClick,
  } = interactionHandlers;

  const applyLogicalRangeToTargets = (nextRange: PersistedRange, source: LogicalRangeSource | null) => {
    if (source !== 'price') priceTS.setVisibleLogicalRange(nextRange);
    if (source !== 'sub') subTS.setVisibleLogicalRange(nextRange);
    if (source !== 'foot') footTS.setVisibleLogicalRange(nextRange);
  };

  const handlePricePointerDown = () => handlePointerDown('price');
  const handleSubPointerDown = () => handlePointerDown('sub');
  const handleFootPointerDown = () => handlePointerDown('foot');

  priceTS.subscribeVisibleLogicalRangeChange((range) => queueLogicalRangeSync(range, 'price'));
  subTS.subscribeVisibleLogicalRangeChange((range) => queueLogicalRangeSync(range, 'sub'));
  footTS.subscribeVisibleLogicalRangeChange((range) => queueLogicalRangeSync(range, 'foot'));
  priceTS.subscribeVisibleLogicalRangeChange(handleScrollPosition);
  priceTS.subscribeVisibleLogicalRangeChange(handleAutoSync);

  priceContainer.addEventListener('pointerdown', handlePricePointerDown, true);
  subchartContainer.addEventListener('pointerdown', handleSubPointerDown, true);
  timescaleContainer.addEventListener('pointerdown', handleFootPointerDown, true);
  priceContainer.addEventListener('mousedown', handlePricePointerDown, true);
  subchartContainer.addEventListener('mousedown', handleSubPointerDown, true);
  timescaleContainer.addEventListener('mousedown', handleFootPointerDown, true);
  priceContainer.addEventListener('touchstart', handlePricePointerDown, true);
  subchartContainer.addEventListener('touchstart', handleSubPointerDown, true);
  timescaleContainer.addEventListener('touchstart', handleFootPointerDown, true);
  timescaleContainer.addEventListener('dblclick', handleTimescaleDoubleClick, true);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);
  window.addEventListener('mouseup', handlePointerUp);
  window.addEventListener('touchend', handlePointerUp);
  window.addEventListener('touchcancel', handlePointerUp);
  const restorePersistedViewport = () => {
    try {
      const logicalRange = sanitizeRange(persistedViewportRef.current?.logicalRange);
      const matchesCurrentContext =
        !currentContextKeyRef.current ||
        persistedViewportRef.current?.contextKey === currentContextKeyRef.current;
      const mainPriceRange = matchesCurrentContext ? sanitizeRange(persistedViewportRef.current?.mainPriceRange) : null;
      const subPriceRange = matchesCurrentContext ? sanitizeRange(persistedViewportRef.current?.subPriceRange) : null;

      if (matchesCurrentContext && logicalRange) {
        applyLogicalRangeToTargets(logicalRange, null);
        setLastAppliedLogicalRange(logicalRange);
      }
      const mainPriceScale = priceChart.priceScale('right') as { setVisibleRange?: (range: PersistedRange) => void };
      const subPriceScale = subchartChart.priceScale('right') as { setVisibleRange?: (range: PersistedRange) => void };
      if (mainPriceRange) mainPriceScale.setVisibleRange?.(mainPriceRange);
      if (subPriceRange) subPriceScale.setVisibleRange?.(subPriceRange);
    } catch {
      // Ignore restore races while charts are still initializing.
    }
  };

  const syncChartSizes = () => {
    if (isDisposed) return;
    if (priceContainer.clientWidth > 0 && priceContainer.clientHeight > 0) {
      priceChart.resize(Math.max(1, Math.round(priceContainer.clientWidth)), Math.max(1, Math.round(priceContainer.clientHeight)), true);
    }
    if (subchartContainer.clientWidth > 0 && subchartContainer.clientHeight > 0) {
      subchartChart.resize(Math.max(1, Math.round(subchartContainer.clientWidth)), Math.max(1, Math.round(subchartContainer.clientHeight)), true);
    }
    if (timescaleContainer.clientWidth > 0 && timescaleContainer.clientHeight > 0) {
      timescaleChart.resize(Math.max(1, Math.round(timescaleContainer.clientWidth)), Math.max(1, Math.round(timescaleContainer.clientHeight)), true);
    }
    handleAutoSync();
  };

  const cleanup = () => {
    isDisposed = true;
    cancelPendingLogicalRangeSync();
    interactionHandlers.dispose();
    priceContainer.removeEventListener('pointerdown', handlePricePointerDown, true);
    subchartContainer.removeEventListener('pointerdown', handleSubPointerDown, true);
    timescaleContainer.removeEventListener('pointerdown', handleFootPointerDown, true);
    priceContainer.removeEventListener('mousedown', handlePricePointerDown, true);
    subchartContainer.removeEventListener('mousedown', handleSubPointerDown, true);
    timescaleContainer.removeEventListener('mousedown', handleFootPointerDown, true);
    priceContainer.removeEventListener('touchstart', handlePricePointerDown, true);
    subchartContainer.removeEventListener('touchstart', handleSubPointerDown, true);
    timescaleContainer.removeEventListener('touchstart', handleFootPointerDown, true);
    timescaleContainer.removeEventListener('dblclick', handleTimescaleDoubleClick, true);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
    window.removeEventListener('mouseup', handlePointerUp);
    window.removeEventListener('touchend', handlePointerUp);
    window.removeEventListener('touchcancel', handlePointerUp);
  };

  return { syncChartSizes, restorePersistedViewport, cleanup };
}
