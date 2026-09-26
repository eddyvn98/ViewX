---
name: indicators
description: "Skill for the Indicators area of BE_ViewChart. 148 symbols across 43 files."
---

# Indicators

148 symbols | 43 files | Cohesion: 89%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how createIndicatorInstance, useChartRSI, calculateRSI work
- Modifying indicators-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/src/features/chart/indicators/HMAIndicator.ts` | HMAIndicator, getStyleString, getPeriod, updateLastPoint, buildPoints (+6) |
| `modern-view-chart/src/features/chart/indicators/EMAIndicator.ts` | EMAIndicator, getStyleString, getPeriod, update, updateLastPoint (+6) |
| `modern-view-chart/src/features/chart/indicators/SuperTrendIndicator.ts` | SuperTrendIndicator, destroy, getStyleString, getNumberParam, getLineWidth (+3) |
| `modern-view-chart/src/features/chart/indicators/SARIndicator.ts` | SARIndicator, destroy, getStyleString, getNumberStyle, update (+3) |
| `modern-view-chart/src/features/chart/indicators/MACDIndicator.ts` | MACDIndicator, destroy, getStyleString, getNumberParam, getLineWidth (+3) |
| `modern-view-chart/src/features/chart/indicators/VWAPIndicator.ts` | VWAPIndicator, destroy, getStyleString, getLineWidth, getCandleTime (+2) |
| `modern-view-chart/src/features/chart/indicators/RSIIndicator.ts` | RSIIndicator, getNumberParam, getLineWidth, getCandleTime, update (+2) |
| `modern-view-chart/src/features/chart/indicators/ATRIndicator.ts` | ATRIndicator, destroy, getStyleString, getStyleNumber, getPeriod (+2) |
| `modern-view-chart/src/features/chart/indicators/TrendLineIndicator.ts` | TrendLineIndicator, getStyleString, getLineWidth, update, clear (+1) |
| `modern-view-chart/src/features/chart/indicators/StochasticIndicator.ts` | StochasticIndicator, getStyleString, getNumberParam, getCandleTime, update (+1) |

## Entry Points

Start here when exploring this area:

- **`createIndicatorInstance`** (Function) — `modern-view-chart/src/features/chart/hooks/indicators/sync-indicator-series.ts:31`
- **`useChartRSI`** (Function) — `modern-view-chart/src/features/chart/hooks/use-chart-rsi.ts:5`
- **`calculateRSI`** (Function) — `modern-view-chart/src/features/chart/utils/indicators/rsi.ts:3`
- **`calculateFVG`** (Function) — `modern-view-chart/src/features/chart/utils/indicators/smc.ts:21`
- **`calculateOrderBlocks`** (Function) — `modern-view-chart/src/features/chart/utils/indicators/smc.ts:55`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `VWAPIndicator` | Class | `modern-view-chart/src/features/chart/indicators/VWAPIndicator.ts` | 5 |
| `TrendLineIndicator` | Class | `modern-view-chart/src/features/chart/indicators/TrendLineIndicator.ts` | 12 |
| `SuperTrendIndicator` | Class | `modern-view-chart/src/features/chart/indicators/SuperTrendIndicator.ts` | 6 |
| `StochasticIndicator` | Class | `modern-view-chart/src/features/chart/indicators/StochasticIndicator.ts` | 4 |
| `SARIndicator` | Class | `modern-view-chart/src/features/chart/indicators/SARIndicator.ts` | 6 |
| `RSIIndicator` | Class | `modern-view-chart/src/features/chart/indicators/RSIIndicator.ts` | 5 |
| `OrderBlockIndicator` | Class | `modern-view-chart/src/features/chart/indicators/OrderBlockIndicator.ts` | 6 |
| `MarketStructureIndicator` | Class | `modern-view-chart/src/features/chart/indicators/MarketStructureIndicator.ts` | 5 |
| `MACDIndicator` | Class | `modern-view-chart/src/features/chart/indicators/MACDIndicator.ts` | 6 |
| `IchimokuIndicator` | Class | `modern-view-chart/src/features/chart/indicators/IchimokuIndicator.ts` | 5 |
| `HMAIndicator` | Class | `modern-view-chart/src/features/chart/indicators/HMAIndicator.ts` | 11 |
| `FVGIndicator` | Class | `modern-view-chart/src/features/chart/indicators/FVGIndicator.ts` | 6 |
| `FibonacciIndicator` | Class | `modern-view-chart/src/features/chart/indicators/FibonacciIndicator.ts` | 9 |
| `FibonacciExtensionIndicator` | Class | `modern-view-chart/src/features/chart/indicators/FibonacciExtensionIndicator.ts` | 9 |
| `EMAIndicator` | Class | `modern-view-chart/src/features/chart/indicators/EMAIndicator.ts` | 11 |
| `BreakoutRaysIndicator` | Class | `modern-view-chart/src/features/chart/indicators/BreakoutRaysIndicator.ts` | 5 |
| `BollingerBandsIndicator` | Class | `modern-view-chart/src/features/chart/indicators/BollingerBandsIndicator.ts` | 4 |
| `ATRIndicator` | Class | `modern-view-chart/src/features/chart/indicators/ATRIndicator.ts` | 5 |
| `ADXIndicator` | Class | `modern-view-chart/src/features/chart/indicators/ADXIndicator.ts` | 5 |
| `TrendLinePrimitive` | Class | `modern-view-chart/src/features/chart/logic/trend-line-primitive.ts` | 105 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ProcessStrategySignal → CalculateRSI` | cross_community | 7 |
| `ProcessStrategySignal → CalculateSMA` | cross_community | 7 |
| `Run → CalculateRSI` | cross_community | 7 |
| `Run → CalculateSMA` | cross_community | 7 |
| `Update → FindHighInRange` | cross_community | 4 |
| `Update → FindLowInRange` | cross_community | 4 |
| `UpdateLastPoint → GetStyleString` | cross_community | 4 |
| `UpdateLastPoint → GetPeriod` | cross_community | 4 |
| `UpdateLastPoint → GetStyleString` | intra_community | 4 |
| `UpdateLastPoint → GetPeriod` | intra_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Hooks | 5 calls |
| Logic | 3 calls |

## How to Explore

1. `gitnexus_context({name: "createIndicatorInstance"})` — see callers and callees
2. `gitnexus_query({query: "indicators"})` — find related execution flows
3. Read key files listed above for implementation details
