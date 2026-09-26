---
name: handlers
description: "Skill for the Handlers area of BE_ViewChart. 34 symbols across 23 files."
---

# Handlers

34 symbols | 23 files | Cohesion: 54%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how setupMessageRouter, hasRequiredRole, handleStrategySignal work
- Modifying handlers-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/backend/websocket/messageRouter.js` | isTradingCommandAllowed, normalizeCommandName, isReadOnlyMt5Command, isReadOnlyBinanceCommand, setupMessageRouter |
| `modern-view-chart/backend/websocket/mt5Scope.js` | isRecipientForMt5Owner, setScopedMt5State, resolveBridgeOwnerUserId |
| `modern-view-chart/backend/websocket/handlers/vnGoldCandlesHandler.js` | normalizeVangTodayInterval, isLegacyVnGoldSymbol, handleVnGoldCandles |
| `modern-view-chart/backend/websocket/handlers/binanceCommandHandler.js` | handleBinanceCommand, broadcastBinanceUpdate |
| `modern-view-chart/backend/websocket/handlers/mt5UpdateHandler.js` | handleMt5Update, broadcastBridgeStatus |
| `modern-view-chart/backend/websocket/handlers/subscribeHandler.js` | broadcastToSubscribers, handleSubscribeCandle |
| `modern-view-chart/backend/auth/roles.js` | hasRequiredRole |
| `modern-view-chart/backend/websocket/handlers/strategySignalHandler.js` | handleStrategySignal |
| `modern-view-chart/backend/websocket/handlers/binanceHistoryHandler.js` | handleBinanceHistory |
| `modern-view-chart/backend/websocket/handlers/alertTriggeredHandler.js` | handleAlertTriggered |

## Entry Points

Start here when exploring this area:

- **`setupMessageRouter`** (Function) — `modern-view-chart/backend/websocket/messageRouter.js:72`
- **`hasRequiredRole`** (Function) — `modern-view-chart/backend/auth/roles.js:14`
- **`handleStrategySignal`** (Function) — `modern-view-chart/backend/websocket/handlers/strategySignalHandler.js:0`
- **`handleBinanceHistory`** (Function) — `modern-view-chart/backend/websocket/handlers/binanceHistoryHandler.js:13`
- **`handleBinanceCommand`** (Function) — `modern-view-chart/backend/websocket/handlers/binanceCommandHandler.js:3`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `setupMessageRouter` | Function | `modern-view-chart/backend/websocket/messageRouter.js` | 72 |
| `hasRequiredRole` | Function | `modern-view-chart/backend/auth/roles.js` | 14 |
| `handleStrategySignal` | Function | `modern-view-chart/backend/websocket/handlers/strategySignalHandler.js` | 0 |
| `handleBinanceHistory` | Function | `modern-view-chart/backend/websocket/handlers/binanceHistoryHandler.js` | 13 |
| `handleBinanceCommand` | Function | `modern-view-chart/backend/websocket/handlers/binanceCommandHandler.js` | 3 |
| `handleAlertTriggered` | Function | `modern-view-chart/backend/websocket/handlers/alertTriggeredHandler.js` | 1 |
| `handleAlertCommand` | Function | `modern-view-chart/backend/websocket/handlers/alertCommandHandler.js` | 1 |
| `setBridgeOnline` | Function | `modern-view-chart/backend/runtime-state.js` | 9 |
| `isRecipientForMt5Owner` | Function | `modern-view-chart/backend/websocket/mt5Scope.js` | 15 |
| `setScopedMt5State` | Function | `modern-view-chart/backend/websocket/mt5Scope.js` | 51 |
| `calcBollingerBands` | Function | `modern-view-chart/backend/services/indicators.js` | 2 |
| `broadcastCandleForSymbol` | Function | `modern-view-chart/backend/websocket/services/broadcastService.js` | 26 |
| `handleMt5Update` | Function | `modern-view-chart/backend/websocket/handlers/mt5UpdateHandler.js` | 7 |
| `handleMt5Positions` | Function | `modern-view-chart/backend/websocket/handlers/mt5PositionsHandler.js` | 3 |
| `handleMt5History` | Function | `modern-view-chart/backend/websocket/handlers/mt5HistoryHandler.js` | 8 |
| `resolveBridgeOwnerUserId` | Function | `modern-view-chart/backend/websocket/mt5Scope.js` | 10 |
| `handleMt5SymbolInfo` | Function | `modern-view-chart/backend/websocket/handlers/mt5SymbolInfoHandler.js` | 2 |
| `handleMt5Command` | Function | `modern-view-chart/backend/websocket/handlers/mt5CommandHandler.js` | 3 |
| `handleMt5Candles` | Function | `modern-view-chart/backend/websocket/handlers/mt5CandlesHandler.js` | 4 |
| `addChartSubscription` | Function | `modern-view-chart/backend/websocket/subscriptionIndex.js` | 40 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `SetupMessageRouter → IncrementWsDroppedBackpressure` | cross_community | 5 |
| `HandleVnGoldCandles → NormalizeTimeframe` | cross_community | 5 |
| `HandleMt5Update → IncrementWsDroppedBackpressure` | cross_community | 4 |
| `HandleMt5Update → SetWsBufferPressure` | cross_community | 4 |
| `SetupMessageRouter → SetWsBufferPressure` | cross_community | 4 |
| `SetupMessageRouter → NormalizeSymbol` | cross_community | 4 |
| `SetupMessageRouter → GetScopeId` | cross_community | 4 |
| `HandleVnGoldCandles → GetTime` | cross_community | 4 |
| `HandleVnGoldCandles → ToSjcDate` | cross_community | 4 |
| `HandleVnGoldCandles → ParseNumberLikeVnd` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Websocket | 14 calls |
| Services | 8 calls |
| Auth | 1 calls |
| Backend | 1 calls |

## How to Explore

1. `gitnexus_context({name: "setupMessageRouter"})` — see callers and callees
2. `gitnexus_query({query: "handlers"})` — find related execution flows
3. Read key files listed above for implementation details
