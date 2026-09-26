---
name: dashboard
description: "Skill for the Dashboard area of BE_ViewChart. 30 symbols across 10 files."
---

# Dashboard

30 symbols | 10 files | Cohesion: 64%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how timeframeToSeconds, compareTimeframe, resolveCellTTL work
- Modifying dashboard-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/src/features/strategy/dashboard/matrix-utils.ts` | timeframeToSeconds, compareTimeframe, resolveCellTTL, normalizeDashboardTf, timeframeToChartInterval (+4) |
| `modern-view-chart/src/features/strategy/dashboard/matrix-cell-state.ts` | matchesCellStrategy, hasMatchingStrategyId, matchesSignalScope, candleTimeToMs, buildMatrixCellState (+1) |
| `modern-view-chart/src/features/strategy/dashboard/use-strategy-matrix-monitor.ts` | isCandleSetStale, useStrategyMatrixMonitor, requestBackfill, tick |
| `modern-view-chart/src/features/strategy/components/StrategySignalScanners.tsx` | openChart, StrategySignalScanners |
| `modern-view-chart/src/features/strategy/components/dashboard/TradeHistory.tsx` | TradeHistory, toggleExpand |
| `modern-view-chart/src/features/strategy/components/dashboard/TradeDetailPanel.tsx` | getEfficiencyColor, TradeDetailPanel |
| `modern-view-chart/src/features/strategy/components/dashboard/StrategyAIPanel.tsx` | toFriendlyError, handleMacroAnalyze |
| `modern-view-chart/src/features/strategy/hooks/use-strategy-runner.ts` | runCycle |
| `modern-view-chart/src/features/strategy/components/StrategyRunnerBootstrap.tsx` | StrategyRunnerBootstrap |
| `modern-view-chart/src/features/strategy/components/strategy-signal-scanners/useScannerViewModel.ts` | useScannerViewModel |

## Entry Points

Start here when exploring this area:

- **`timeframeToSeconds`** (Function) — `modern-view-chart/src/features/strategy/dashboard/matrix-utils.ts:19`
- **`compareTimeframe`** (Function) — `modern-view-chart/src/features/strategy/dashboard/matrix-utils.ts:34`
- **`resolveCellTTL`** (Function) — `modern-view-chart/src/features/strategy/dashboard/matrix-utils.ts:53`
- **`buildMatrixCellState`** (Function) — `modern-view-chart/src/features/strategy/dashboard/matrix-cell-state.ts:46`
- **`runCycle`** (Function) — `modern-view-chart/src/features/strategy/hooks/use-strategy-runner.ts:156`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `timeframeToSeconds` | Function | `modern-view-chart/src/features/strategy/dashboard/matrix-utils.ts` | 19 |
| `compareTimeframe` | Function | `modern-view-chart/src/features/strategy/dashboard/matrix-utils.ts` | 34 |
| `resolveCellTTL` | Function | `modern-view-chart/src/features/strategy/dashboard/matrix-utils.ts` | 53 |
| `buildMatrixCellState` | Function | `modern-view-chart/src/features/strategy/dashboard/matrix-cell-state.ts` | 46 |
| `runCycle` | Function | `modern-view-chart/src/features/strategy/hooks/use-strategy-runner.ts` | 156 |
| `normalizeDashboardTf` | Function | `modern-view-chart/src/features/strategy/dashboard/matrix-utils.ts` | 6 |
| `timeframeToChartInterval` | Function | `modern-view-chart/src/features/strategy/dashboard/matrix-utils.ts` | 59 |
| `chartIntervalToDashboardTf` | Function | `modern-view-chart/src/features/strategy/dashboard/matrix-utils.ts` | 75 |
| `buildMatrixRunnerConfigs` | Function | `modern-view-chart/src/features/strategy/dashboard/matrix-cell-state.ts` | 148 |
| `openChart` | Function | `modern-view-chart/src/features/strategy/components/StrategySignalScanners.tsx` | 65 |
| `useStrategyMatrixMonitor` | Function | `modern-view-chart/src/features/strategy/dashboard/use-strategy-matrix-monitor.ts` | 15 |
| `requestBackfill` | Function | `modern-view-chart/src/features/strategy/dashboard/use-strategy-matrix-monitor.ts` | 22 |
| `tick` | Function | `modern-view-chart/src/features/strategy/dashboard/use-strategy-matrix-monitor.ts` | 36 |
| `inferMatrixSymbolSource` | Function | `modern-view-chart/src/features/strategy/dashboard/matrix-utils.ts` | 14 |
| `StrategyRunnerBootstrap` | Function | `modern-view-chart/src/features/strategy/components/StrategyRunnerBootstrap.tsx` | 5 |
| `normalizeDashboardSymbol` | Function | `modern-view-chart/src/features/strategy/dashboard/matrix-utils.ts` | 40 |
| `sortSymbols` | Function | `modern-view-chart/src/features/strategy/dashboard/matrix-utils.ts` | 45 |
| `StrategySignalScanners` | Function | `modern-view-chart/src/features/strategy/components/StrategySignalScanners.tsx` | 11 |
| `useScannerViewModel` | Function | `modern-view-chart/src/features/strategy/components/strategy-signal-scanners/useScannerViewModel.ts` | 23 |
| `TradeHistory` | Function | `modern-view-chart/src/features/strategy/components/dashboard/TradeHistory.tsx` | 11 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RunCycle → NormalizeTF` | cross_community | 5 |
| `RunCycle → NormalizeSymbol` | cross_community | 5 |
| `RunWarmup → NormalizeTF` | cross_community | 5 |
| `RunWarmup → NormalizeSymbol` | cross_community | 5 |
| `UseStrategyRunner → NormalizeSymbol` | cross_community | 4 |
| `UseScannerViewModel → NormalizeSymbol` | cross_community | 4 |
| `UseScannerViewModel → NormalizeTF` | cross_community | 4 |
| `Tick → NormalizeTF` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Hooks | 6 calls |
| Logic | 4 calls |
| Strategy | 4 calls |
| Store | 3 calls |

## How to Explore

1. `gitnexus_context({name: "timeframeToSeconds"})` — see callers and callees
2. `gitnexus_query({query: "dashboard"})` — find related execution flows
3. Read key files listed above for implementation details
