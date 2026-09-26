---
name: hooks
description: "Skill for the Hooks area of BE_ViewChart. 94 symbols across 47 files."
---

# Hooks

94 symbols | 47 files | Cohesion: 80%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how normalizeSymbol, isSameSymbol, createMarketSlice work
- Modifying hooks-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/src/features/chart/hooks/use-subchart-legend-dom-updater.ts` | buildIndicatorSeeds, useSubchartLegendDOMUpdater, refreshRefs, updateLegend, findCandleIndex (+2) |
| `modern-view-chart/src/features/chart/hooks/use-legend-dom-updater.ts` | useLegendDOMUpdater, renderLatest, getIndicatorsFor, handleCrosshair, handleTimescaleInteraction |
| `modern-view-chart/src/features/chart/hooks/use-chart-ticker.ts` | useChartTicker, getIntervalSeconds, syncToStore, handleTick |
| `modern-view-chart/src/features/chart/hooks/use-chart-history.ts` | useChartHistory, getCandles, handleAutoFit, getPersistedViewport |
| `modern-view-chart/src/features/chart/hooks/use-chart-scale-reset.ts` | useChartScaleReset, focusRecentCandles, handlePriceScaleDblClick, handleTimeScaleDblClick |
| `modern-view-chart/src/features/chart/components/SubchartLegend.tsx` | getSeriesLabel, getSeriesColor, SubchartLegend |
| `modern-view-chart/src/features/chart/hooks/indicators/indicator-candle-utils.ts` | toNumericTime, getIntervalSeconds, buildLiveCandle |
| `modern-view-chart/src/features/chart/hooks/use-cursor-tooltip-dom-updater.tsx` | useCursorTooltipDOMUpdater, getIndicatorsFor, handleCrosshair |
| `modern-view-chart/src/features/chart/hooks/use-chart-indicator-values.ts` | getNumberParam, isMacdSeries, useChartIndicatorValues |
| `modern-view-chart/src/features/chart/hooks/use-series-switcher.ts` | useSeriesSwitcher, getSeriesTypeName, handleSwitch |

## Entry Points

Start here when exploring this area:

- **`normalizeSymbol`** (Function) — `modern-view-chart/src/lib/utils/symbol.ts:5`
- **`isSameSymbol`** (Function) — `modern-view-chart/src/lib/utils/symbol.ts:26`
- **`createMarketSlice`** (Function) — `modern-view-chart/src/lib/store/slices/market-slice.ts:21`
- **`createChartSlice`** (Function) — `modern-view-chart/src/lib/store/slices/chart-slice.ts:27`
- **`useChartTicker`** (Function) — `modern-view-chart/src/features/chart/hooks/use-chart-ticker.ts:31`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `DiamondSeries` | Class | `modern-view-chart/src/features/chart/logic/diamond-series.ts` | 248 |
| `normalizeSymbol` | Function | `modern-view-chart/src/lib/utils/symbol.ts` | 5 |
| `isSameSymbol` | Function | `modern-view-chart/src/lib/utils/symbol.ts` | 26 |
| `createMarketSlice` | Function | `modern-view-chart/src/lib/store/slices/market-slice.ts` | 21 |
| `createChartSlice` | Function | `modern-view-chart/src/lib/store/slices/chart-slice.ts` | 27 |
| `useChartTicker` | Function | `modern-view-chart/src/features/chart/hooks/use-chart-ticker.ts` | 31 |
| `getIntervalSeconds` | Function | `modern-view-chart/src/features/chart/hooks/use-chart-ticker.ts` | 65 |
| `syncToStore` | Function | `modern-view-chart/src/features/chart/hooks/use-chart-ticker.ts` | 112 |
| `handleTick` | Function | `modern-view-chart/src/features/chart/hooks/use-chart-ticker.ts` | 125 |
| `useChartRuntime` | Function | `modern-view-chart/src/features/chart/hooks/use-chart-runtime.ts` | 12 |
| `useChartOHLC` | Function | `modern-view-chart/src/features/chart/hooks/use-chart-ohlc.ts` | 10 |
| `useChartData` | Function | `modern-view-chart/src/features/chart/hooks/use-chart-data.ts` | 6 |
| `handleStartDraft` | Function | `modern-view-chart/src/features/chart/components/ChartTradingOverlay.tsx` | 29 |
| `handleConfirm` | Function | `modern-view-chart/src/features/chart/components/ChartTradingOverlay.tsx` | 52 |
| `mergeRunnerConfigs` | Function | `modern-view-chart/src/features/strategy/hooks/runner/config-merge.ts` | 8 |
| `collectUniqueChartConfigs` | Function | `modern-view-chart/src/features/strategy/hooks/runner/chart-config.ts` | 20 |
| `ChartItem` | Function | `modern-view-chart/src/features/chart/components/ChartItem.tsx` | 17 |
| `norm` | Function | `modern-view-chart/src/features/chart/logic/order-tags/symbol-utils.ts` | 2 |
| `useSubchartLegendDOMUpdater` | Function | `modern-view-chart/src/features/chart/hooks/use-subchart-legend-dom-updater.ts` | 35 |
| `refreshRefs` | Function | `modern-view-chart/src/features/chart/hooks/use-subchart-legend-dom-updater.ts` | 69 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ProcessStrategySignal → NormalizeType` | cross_community | 7 |
| `ProcessStrategySignal → CalculateRSI` | cross_community | 7 |
| `ProcessStrategySignal → CalculateEMA` | cross_community | 7 |
| `ProcessStrategySignal → CalculateSMA` | cross_community | 7 |
| `HandleManualAnalyze → NormalizeType` | cross_community | 7 |
| `Run → NormalizeType` | cross_community | 7 |
| `Run → CalculateRSI` | cross_community | 7 |
| `Run → CalculateEMA` | cross_community | 7 |
| `Run → CalculateSMA` | cross_community | 7 |
| `UseChartHistory → NormalizeSymbol` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Indicators | 10 calls |
| Slices | 4 calls |
| Components | 3 calls |
| Chart-sync-runtime | 2 calls |

## How to Explore

1. `gitnexus_context({name: "normalizeSymbol"})` — see callers and callees
2. `gitnexus_query({query: "hooks"})` — find related execution flows
3. Read key files listed above for implementation details
