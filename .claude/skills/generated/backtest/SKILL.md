---
name: backtest
description: "Skill for the Backtest area of BE_ViewChart. 22 symbols across 7 files."
---

# Backtest

22 symbols | 7 files | Cohesion: 72%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how getPnLMultiplier, calculateStandardPnL, fillSnapshot work
- Modifying backtest-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/src/features/strategy/logic/backtest/BacktestIndicators.ts` | BacktestIndicators, getAll, getValue, preCalculate, scanGroup (+2) |
| `modern-view-chart/src/features/strategy/logic/backtest/PositionManager.ts` | PositionManager, addPosition, updateTrailingStops, updateMetrics, processExits |
| `modern-view-chart/src/features/strategy/logic/backtest/BacktestEngine.ts` | run, fillSnapshot, getRiskValue, calculateConfidence |
| `modern-view-chart/src/features/strategy/utils/market-utils.ts` | getPnLMultiplier, calculateStandardPnL |
| `modern-view-chart/src/features/strategy/logic/backtest/BacktestData.ts` | prepare, getTimestamp |
| `modern-view-chart/src/features/strategy/logic/BacktestRunner.ts` | run |
| `modern-view-chart/src/features/strategy/logic/backtest/SignalEvaluator.ts` | checkCooldown |

## Entry Points

Start here when exploring this area:

- **`getPnLMultiplier`** (Function) — `modern-view-chart/src/features/strategy/utils/market-utils.ts:13`
- **`calculateStandardPnL`** (Function) — `modern-view-chart/src/features/strategy/utils/market-utils.ts:27`
- **`fillSnapshot`** (Function) — `modern-view-chart/src/features/strategy/logic/backtest/BacktestEngine.ts:93`
- **`getRiskValue`** (Function) — `modern-view-chart/src/features/strategy/logic/backtest/BacktestEngine.ts:120`
- **`scanGroup`** (Function) — `modern-view-chart/src/features/strategy/logic/backtest/BacktestIndicators.ts:14`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `PositionManager` | Class | `modern-view-chart/src/features/strategy/logic/backtest/PositionManager.ts` | 6 |
| `BacktestIndicators` | Class | `modern-view-chart/src/features/strategy/logic/backtest/BacktestIndicators.ts` | 5 |
| `getPnLMultiplier` | Function | `modern-view-chart/src/features/strategy/utils/market-utils.ts` | 13 |
| `calculateStandardPnL` | Function | `modern-view-chart/src/features/strategy/utils/market-utils.ts` | 27 |
| `fillSnapshot` | Function | `modern-view-chart/src/features/strategy/logic/backtest/BacktestEngine.ts` | 93 |
| `getRiskValue` | Function | `modern-view-chart/src/features/strategy/logic/backtest/BacktestEngine.ts` | 120 |
| `scanGroup` | Function | `modern-view-chart/src/features/strategy/logic/backtest/BacktestIndicators.ts` | 14 |
| `run` | Method | `modern-view-chart/src/features/strategy/logic/BacktestRunner.ts` | 10 |
| `checkCooldown` | Method | `modern-view-chart/src/features/strategy/logic/backtest/SignalEvaluator.ts` | 24 |
| `addPosition` | Method | `modern-view-chart/src/features/strategy/logic/backtest/PositionManager.ts` | 22 |
| `updateTrailingStops` | Method | `modern-view-chart/src/features/strategy/logic/backtest/PositionManager.ts` | 26 |
| `updateMetrics` | Method | `modern-view-chart/src/features/strategy/logic/backtest/PositionManager.ts` | 74 |
| `processExits` | Method | `modern-view-chart/src/features/strategy/logic/backtest/PositionManager.ts` | 100 |
| `getAll` | Method | `modern-view-chart/src/features/strategy/logic/backtest/BacktestIndicators.ts` | 51 |
| `getValue` | Method | `modern-view-chart/src/features/strategy/logic/backtest/BacktestIndicators.ts` | 55 |
| `run` | Method | `modern-view-chart/src/features/strategy/logic/backtest/BacktestEngine.ts` | 14 |
| `prepare` | Method | `modern-view-chart/src/features/strategy/logic/backtest/BacktestData.ts` | 5 |
| `getTimestamp` | Method | `modern-view-chart/src/features/strategy/logic/backtest/BacktestData.ts` | 10 |
| `preCalculate` | Method | `modern-view-chart/src/features/strategy/logic/backtest/BacktestIndicators.ts` | 10 |
| `cacheIndicator` | Method | `modern-view-chart/src/features/strategy/logic/backtest/BacktestIndicators.ts` | 34 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Run → NormalizeSymbol` | cross_community | 3 |
| `Run → NormalizeTF` | cross_community | 3 |
| `Run → GetTime` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Strategy | 4 calls |
| Logic | 3 calls |
| Store | 2 calls |
| Hooks | 1 calls |
| Slices | 1 calls |
| Websocket | 1 calls |
| Services | 1 calls |

## How to Explore

1. `gitnexus_context({name: "getPnLMultiplier"})` — see callers and callees
2. `gitnexus_query({query: "backtest"})` — find related execution flows
3. Read key files listed above for implementation details
