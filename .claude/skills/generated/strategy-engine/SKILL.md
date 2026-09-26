---
name: strategy-engine
description: "Skill for the Strategy_engine area of BE_ViewChart. 25 symbols across 10 files."
---

# Strategy_engine

25 symbols | 10 files | Cohesion: 83%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how add_strategy, mask_url_for_log, main work
- Modifying strategy_engine-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/backend/strategy_engine/strategy_manager.py` | StrategyManager, add_strategy, on_account_update, on_market_data, _prepare_dataframe (+1) |
| `modern-view-chart/backend/strategy_engine/optimizer_service.py` | OptimizerService, handle_candles_response, run_backtest, request_optimization |
| `modern-view-chart/backend/strategy_engine/main.py` | mask_url_for_log, main, process_message |
| `modern-view-chart/backend/strategy_engine/analyzer_service.py` | AnalyzerService, handle_response, request_analysis |
| `modern-view-chart/backend/strategy_engine/indicators.py` | calculate_hull, wma, calculate_all |
| `modern-view-chart/backend/strategy_engine/strategies/hull_rsi_strategy.py` | HullRsiStrategy, on_candle |
| `modern-view-chart/backend/strategy_engine/strategies/base_strategy.py` | BaseStrategy |
| `modern-view-chart/analyze_history.py` | analyze_history |
| `modern-view-chart/backend/strategy_engine/trade_logger.py` | TradeLogger |
| `modern-view-chart/backend/strategy_engine/risk_manager.py` | RiskManager |

## Entry Points

Start here when exploring this area:

- **`add_strategy`** (Function) — `modern-view-chart/backend/strategy_engine/strategy_manager.py:13`
- **`mask_url_for_log`** (Function) — `modern-view-chart/backend/strategy_engine/main.py:27`
- **`main`** (Function) — `modern-view-chart/backend/strategy_engine/main.py:108`
- **`analyze_history`** (Function) — `modern-view-chart/analyze_history.py:14`
- **`handle_candles_response`** (Function) — `modern-view-chart/backend/strategy_engine/optimizer_service.py:31`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `StrategyManager` | Class | `modern-view-chart/backend/strategy_engine/strategy_manager.py` | 4 |
| `OptimizerService` | Class | `modern-view-chart/backend/strategy_engine/optimizer_service.py` | 6 |
| `AnalyzerService` | Class | `modern-view-chart/backend/strategy_engine/analyzer_service.py` | 7 |
| `HullRsiStrategy` | Class | `modern-view-chart/backend/strategy_engine/strategies/hull_rsi_strategy.py` | 3 |
| `BaseStrategy` | Class | `modern-view-chart/backend/strategy_engine/strategies/base_strategy.py` | 2 |
| `TradeLogger` | Class | `modern-view-chart/backend/strategy_engine/trade_logger.py` | 8 |
| `RiskManager` | Class | `modern-view-chart/backend/strategy_engine/risk_manager.py` | 0 |
| `add_strategy` | Function | `modern-view-chart/backend/strategy_engine/strategy_manager.py` | 13 |
| `mask_url_for_log` | Function | `modern-view-chart/backend/strategy_engine/main.py` | 27 |
| `main` | Function | `modern-view-chart/backend/strategy_engine/main.py` | 108 |
| `analyze_history` | Function | `modern-view-chart/analyze_history.py` | 14 |
| `handle_candles_response` | Function | `modern-view-chart/backend/strategy_engine/optimizer_service.py` | 31 |
| `run_backtest` | Function | `modern-view-chart/backend/strategy_engine/optimizer_service.py` | 104 |
| `calculate_hull` | Function | `modern-view-chart/backend/strategy_engine/indicators.py` | 4 |
| `wma` | Function | `modern-view-chart/backend/strategy_engine/indicators.py` | 7 |
| `calculate_all` | Function | `modern-view-chart/backend/strategy_engine/indicators.py` | 22 |
| `handle_response` | Function | `modern-view-chart/backend/strategy_engine/analyzer_service.py` | 42 |
| `on_account_update` | Function | `modern-view-chart/backend/strategy_engine/strategy_manager.py` | 20 |
| `on_market_data` | Function | `modern-view-chart/backend/strategy_engine/strategy_manager.py` | 29 |
| `request_optimization` | Function | `modern-view-chart/backend/strategy_engine/optimizer_service.py` | 10 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Process_message → Wma` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Backend | 1 calls |

## How to Explore

1. `gitnexus_context({name: "add_strategy"})` — see callers and callees
2. `gitnexus_query({query: "strategy_engine"})` — find related execution flows
3. Read key files listed above for implementation details
