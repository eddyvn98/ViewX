---
name: logic
description: "Skill for the Logic area of BE_ViewChart. 148 symbols across 55 files."
---

# Logic

148 symbols | 55 files | Cohesion: 85%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how calculatePnL, formatPnL, useSignalHistoryFilters work
- Modifying logic-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/src/features/strategy/logic/SoundService.ts` | playAIThinking, enableKeepAlive, pulse, disableKeepAlive, playTP (+5) |
| `modern-view-chart/src/features/strategy/logic/ContextCollector.ts` | captureEntryContext, getCurrentSession, calculateATR, calculateRelativeVolume, captureMTFPlaceholder (+3) |
| `modern-view-chart/src/features/strategy/logic/AiAnalyzer.ts` | analyzeSignal, callBridgeAi, parseAiResponse, buildPrompt, toNumber (+2) |
| `modern-view-chart/src/features/chart/logic/fibonacci-primitive.ts` | FibonacciPrimitive, setData, update, FibonacciPaneRenderer, renderer (+2) |
| `modern-view-chart/src/features/strategy/logic/trade-log-api.ts` | TradeLogApiError, readJsonSafe, requestJson, createTradeLog, fetchTradeStats (+1) |
| `modern-view-chart/src/features/chart/logic/tag-renderer-factory.ts` | createElementsFromHtml, createDraftGroupTagElement, createDraftLevelTagElement, createAlertTagElement, createDotTagElement (+1) |
| `modern-view-chart/src/features/chart/logic/tag-renderer-position.ts` | toEpochSec, resolveTagAnchorTime, resolveTagXCoordinate, applyTagFallbackPosition, updateTagPosition |
| `modern-view-chart/src/features/chart/logic/candle-patterns.ts` | calculateSwingPoints, findHighInRange, findLowInRange, calculateDynamicSwingPoints |
| `modern-view-chart/src/features/chart/indicators/BreakoutRaysIndicator.ts` | update, setPrices, clearRays, destroy |
| `modern-view-chart/src/features/chart/logic/legend-renderer.ts` | getSeriesEntries, getSeriesLabel, getSeriesColor, renderIndicators |

## Entry Points

Start here when exploring this area:

- **`calculatePnL`** (Function) — `modern-view-chart/src/lib/utils/pnl.ts:15`
- **`formatPnL`** (Function) — `modern-view-chart/src/lib/utils/pnl.ts:65`
- **`useSignalHistoryFilters`** (Function) — `modern-view-chart/src/features/strategy/hooks/useSignalHistoryFilters.ts:18`
- **`updateTagVisuals`** (Function) — `modern-view-chart/src/features/chart/logic/tag-renderer-visuals.ts:9`
- **`getTagOriginalMeta`** (Function) — `modern-view-chart/src/features/chart/logic/tag-renderer-visuals.shared.ts:4`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `TradeLogApiError` | Class | `modern-view-chart/src/features/strategy/logic/trade-log-api.ts` | 21 |
| `FibonacciPrimitive` | Class | `modern-view-chart/src/features/chart/logic/fibonacci-primitive.ts` | 199 |
| `calculatePnL` | Function | `modern-view-chart/src/lib/utils/pnl.ts` | 15 |
| `formatPnL` | Function | `modern-view-chart/src/lib/utils/pnl.ts` | 65 |
| `useSignalHistoryFilters` | Function | `modern-view-chart/src/features/strategy/hooks/useSignalHistoryFilters.ts` | 18 |
| `updateTagVisuals` | Function | `modern-view-chart/src/features/chart/logic/tag-renderer-visuals.ts` | 9 |
| `getTagOriginalMeta` | Function | `modern-view-chart/src/features/chart/logic/tag-renderer-visuals.shared.ts` | 4 |
| `getOpenPrice` | Function | `modern-view-chart/src/features/chart/logic/tag-renderer-visuals.shared.ts` | 8 |
| `getVolume` | Function | `modern-view-chart/src/features/chart/logic/tag-renderer-visuals.shared.ts` | 19 |
| `updatePnlVisuals` | Function | `modern-view-chart/src/features/chart/logic/tag-renderer-visuals.pnl.ts` | 6 |
| `updateDraftGroupVisuals` | Function | `modern-view-chart/src/features/chart/logic/tag-renderer-visuals.draft.ts` | 5 |
| `updateDraftLevelVisuals` | Function | `modern-view-chart/src/features/chart/logic/tag-renderer-visuals.draft.ts` | 59 |
| `updateDotTagVisuals` | Function | `modern-view-chart/src/features/chart/logic/tag-renderer-visuals.dot.ts` | 23 |
| `SignalsView` | Function | `modern-view-chart/src/features/strategy/components/SignalsView.tsx` | 24 |
| `handleTouchMove` | Function | `modern-view-chart/src/features/chart/hooks/use-chart-interaction.ts` | 96 |
| `scheduleDragStoreUpdate` | Function | `modern-view-chart/src/features/chart/hooks/interaction/pointer-handlers.ts` | 66 |
| `handlePointerMove` | Function | `modern-view-chart/src/features/chart/hooks/interaction/pointer-handlers.ts` | 173 |
| `createTradeLog` | Function | `modern-view-chart/src/features/strategy/logic/trade-log-api.ts` | 64 |
| `fetchTradeStats` | Function | `modern-view-chart/src/features/strategy/logic/trade-log-api.ts` | 78 |
| `handleManualAnalyze` | Function | `modern-view-chart/src/features/strategy/components/SignalsView.tsx` | 65 |

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
| `HandleSocketMessage → GetContext` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Voice | 5 calls |
| Strategy | 3 calls |
| Hooks | 2 calls |
| Store | 2 calls |
| Services | 1 calls |
| Slices | 1 calls |
| Runner | 1 calls |

## How to Explore

1. `gitnexus_context({name: "calculatePnL"})` — see callers and callees
2. `gitnexus_query({query: "logic"})` — find related execution flows
3. Read key files listed above for implementation details
