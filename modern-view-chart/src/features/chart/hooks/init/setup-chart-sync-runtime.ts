import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { autoSyncLayout } from '../../logic/chart-sync';
import { Candle, ChartInstance } from '@/lib/store/types';
import {
  buildStableTimeScaleViewport,
  LogicalRangeSource,
  logicalRangesEqual,
  PersistedRange,
  resolveLockedScaleWidth,
  sanitizeRange,
} from './chart-init-helpers';

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

  let lastViewportSnapshot = '';
  let isDisposed = false;
  let isPointerInteracting = false;
  let hasPendingAutoSync = false;
  let hasPendingViewportPersist = false;
  let logicalRangeSyncRafId: number | null = null;
  let pendingLogicalRange: PersistedRange | null = null;
  let pendingLogicalRangeSource: LogicalRangeSource | null = null;
  let lastAppliedLogicalRange: PersistedRange | null = null;
  let pointerInteractionSource: LogicalRangeSource | null = null;
  let autoScrollResumeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let syncRequestId: number | null = null;
  let lastMaxW = initialMinW;
  let syncing = false;

  const persistViewport = () => {
    const logicalRange = sanitizeRange(priceTS.getVisibleLogicalRange() as PersistedRange | null);
    const mainPriceScale = priceChart.priceScale('right') as {
      getVisibleRange?: () => PersistedRange | null;
      setVisibleRange?: (range: PersistedRange) => void;
    };
    const subPriceScale = subchartChart.priceScale('right') as {
      getVisibleRange?: () => PersistedRange | null;
      setVisibleRange?: (range: PersistedRange) => void;
    };
    const mainPriceRange = sanitizeRange(mainPriceScale.getVisibleRange?.() ?? null);
    const subPriceRange = sanitizeRange(subPriceScale.getVisibleRange?.() ?? null);

    const nextViewport: NonNullable<ChartInstance['viewport']> = {
      contextKey: currentContextKeyRef.current,
      savedAt: Date.now(),
    };

    if (logicalRange) nextViewport.logicalRange = logicalRange;
    if (mainPriceRange) nextViewport.mainPriceRange = mainPriceRange;
    if (subPriceRange) nextViewport.subPriceRange = subPriceRange;

    const nextSnapshot = JSON.stringify(nextViewport);
    if (nextSnapshot === lastViewportSnapshot) return;

    lastViewportSnapshot = nextSnapshot;
    updateChart(chartId, { viewport: nextViewport });
  };

  const scheduleViewportPersist = () => {
    if (isPointerInteracting) {
      hasPendingViewportPersist = true;
      return;
    }
    if (viewportSaveTimeoutRef.current) clearTimeout(viewportSaveTimeoutRef.current);
    viewportSaveTimeoutRef.current = setTimeout(() => {
      viewportSaveTimeoutRef.current = null;
      persistViewport();
    }, 180);
  };

  const flushPendingViewportPersist = () => {
    if (!hasPendingViewportPersist) return;
    hasPendingViewportPersist = false;
    scheduleViewportPersist();
  };

  const applyLogicalRangeToTargets = (nextRange: PersistedRange, source: LogicalRangeSource | null) => {
    if (source !== 'price') priceTS.setVisibleLogicalRange(nextRange);
    if (source !== 'sub') subTS.setVisibleLogicalRange(nextRange);
    if (source !== 'foot') footTS.setVisibleLogicalRange(nextRange);
  };

  const flushLogicalRangeSync = () => {
    if (!pendingLogicalRange || syncing) return;
    const nextRange = pendingLogicalRange;
    const nextSource = pendingLogicalRangeSource;
    pendingLogicalRange = null;
    pendingLogicalRangeSource = null;
    logicalRangeSyncRafId = null;
    if (logicalRangesEqual(nextRange, lastAppliedLogicalRange)) return;

    syncing = true;
    applyLogicalRangeToTargets(nextRange, nextSource);
    syncing = false;
    lastAppliedLogicalRange = nextRange;
    scheduleViewportPersist();
  };

  const queueLogicalRangeSync = (range: unknown, source: LogicalRangeSource) => {
    const nextRange = sanitizeRange(range as PersistedRange | null);
    if (!nextRange || syncing) return;
    if (isPointerInteracting && pointerInteractionSource && source !== pointerInteractionSource) return;
    if (logicalRangesEqual(nextRange, pendingLogicalRange) || logicalRangesEqual(nextRange, lastAppliedLogicalRange)) return;
    pendingLogicalRange = nextRange;
    pendingLogicalRangeSource = source;
    if (logicalRangeSyncRafId !== null) return;
    logicalRangeSyncRafId = requestAnimationFrame(flushLogicalRangeSync);
  };

  const handleScrollPosition = (range: PersistedRange | null) => {
    if (!range) return;
    const dataCount = seriesRef.current?.data().length || 0;
    if (dataCount === 0) return;
    const isNearRealtimeEdge = range.to >= dataCount - 1;
    if (isPointerInteracting) {
      if (pointerInteractionSource !== 'foot' && !isNearRealtimeEdge) isAutoScrollEnabledRef.current = false;
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
    if (isDisposed) return;
    if (pointerInteractionSource === 'foot') {
      hasPendingAutoSync = false;
      return;
    }
    if (isPointerInteracting) {
      hasPendingAutoSync = true;
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
      (id) => { syncRequestId = id; },
      (w) => { lastMaxW = w; },
    );
  };

  const flushPendingAutoSync = () => {
    if (isDisposed || !hasPendingAutoSync) return;
    hasPendingAutoSync = false;
    handleAutoSync();
  };

  const resetToStableTimeScaleViewport = () => {
    const dataCount = (seriesRef.current?.data() as Candle[] | undefined)?.length || 0;
    if (dataCount <= 0) return;
    const nextRange = buildStableTimeScaleViewport(dataCount, window.innerWidth);
    syncing = true;
    priceTS.setVisibleLogicalRange(nextRange);
    subTS.setVisibleLogicalRange(nextRange);
    footTS.setVisibleLogicalRange(nextRange);
    syncing = false;
    lastAppliedLogicalRange = nextRange;
    isAutoScrollEnabledRef.current = true;
    scheduleViewportPersist();
  };

  const lockScaleWidthDuringPan = () => {
    try {
      const width = resolveLockedScaleWidth(priceChart.priceScale('right').width(), subchartChart.priceScale('right').width());
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
    if (isPointerInteracting) return;
    isPointerInteracting = true;
    pointerInteractionSource = source;
    if (autoScrollResumeTimeoutId) {
      clearTimeout(autoScrollResumeTimeoutId);
      autoScrollResumeTimeoutId = null;
    }
    if (source !== 'foot') {
      isAutoScrollEnabledRef.current = false;
      lockScaleWidthDuringPan();
      return;
    }
    window.dispatchEvent(new CustomEvent('chart-timescale-interaction', { detail: { chartId, active: true } }));
  };

  const handlePointerUp = () => {
    if (!isPointerInteracting) return;
    const wasFooterInteraction = pointerInteractionSource === 'foot';
    isPointerInteracting = false;
    pointerInteractionSource = null;

    if (wasFooterInteraction) {
      window.dispatchEvent(new CustomEvent('chart-timescale-interaction', { detail: { chartId, active: false } }));
    }
    if (logicalRangeSyncRafId !== null) {
      cancelAnimationFrame(logicalRangeSyncRafId);
      logicalRangeSyncRafId = null;
    }
    flushLogicalRangeSync();
    autoScrollResumeTimeoutId = setTimeout(() => {
      autoScrollResumeTimeoutId = null;
      const currentRange = sanitizeRange(priceTS.getVisibleLogicalRange() as PersistedRange | null);
      const dataCount = seriesRef.current?.data().length || 0;
      if (!currentRange || dataCount === 0) return;
      isAutoScrollEnabledRef.current = currentRange.to >= dataCount - 1;
    }, 120);

    if (wasFooterInteraction) {
      requestAnimationFrame(() => {
        flushPendingViewportPersist();
        scheduleViewportPersist();
      });
      return;
    }

    flushPendingAutoSync();
    flushPendingViewportPersist();
    scheduleViewportPersist();
  };

  const handleTimescaleDoubleClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    resetToStableTimeScaleViewport();
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
        lastAppliedLogicalRange = logicalRange;
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
    if (autoScrollResumeTimeoutId) clearTimeout(autoScrollResumeTimeoutId);
    if (syncRequestId !== null) cancelAnimationFrame(syncRequestId);
    if (logicalRangeSyncRafId !== null) cancelAnimationFrame(logicalRangeSyncRafId);
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
