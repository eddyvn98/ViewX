---
name: websocket
description: "Skill for the Websocket area of BE_ViewChart. 42 symbols across 15 files."
---

# Websocket

42 symbols | 15 files | Cohesion: 56%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how setWsClients, incrementWsDroppedRateLimit, addDefaultPriceClient work
- Modifying websocket-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/backend/websocket/mt5Scope.js` | getScopeId, getScopedMt5State, clearScopedMt5State, setScopedMt5Symbols, getScopedMt5Symbols (+3) |
| `modern-view-chart/backend/websocket/subscriptionIndex.js` | clearWsFromIndex, addDefaultPriceClient, removeClientFromIndexes, collectInterestSymbolsFromIndex, normalizeSymbol (+2) |
| `modern-view-chart/backend/websocket/loopManager.js` | broadcastBinanceState, startPriceBroadcast, startBinanceBroadcast, startInterestChecker, startHeartbeat (+1) |
| `modern-view-chart/backend/runtime-state.js` | setWsClients, incrementWsDroppedRateLimit, recordBroadcastLoopDuration, incrementWsDroppedBackpressure, setWsBufferPressure |
| `modern-view-chart/backend/websocket/handlers/virtualTradeHandler.js` | resolvePrice, emitState, handleVirtualTradeCommand |
| `modern-view-chart/backend/websocket/index.js` | initWebSocket, broadcastBridgeStatus |
| `modern-view-chart/backend/websocket/config.js` | parseBooleanEnv, resolveQueryAuthPolicy |
| `modern-view-chart/backend/websocket/services/broadcastService.js` | broadcastChartCandles, broadcastToAll |
| `modern-view-chart/backend/websocket/auth.js` | emitWsError |
| `modern-view-chart/backend/websocket/services/binanceTickerService.js` | startBinanceTickerStream |

## Entry Points

Start here when exploring this area:

- **`setWsClients`** (Function) — `modern-view-chart/backend/runtime-state.js:13`
- **`incrementWsDroppedRateLimit`** (Function) — `modern-view-chart/backend/runtime-state.js:17`
- **`addDefaultPriceClient`** (Function) — `modern-view-chart/backend/websocket/subscriptionIndex.js:30`
- **`removeClientFromIndexes`** (Function) — `modern-view-chart/backend/websocket/subscriptionIndex.js:34`
- **`initWebSocket`** (Function) — `modern-view-chart/backend/websocket/index.js:26`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `setWsClients` | Function | `modern-view-chart/backend/runtime-state.js` | 13 |
| `incrementWsDroppedRateLimit` | Function | `modern-view-chart/backend/runtime-state.js` | 17 |
| `addDefaultPriceClient` | Function | `modern-view-chart/backend/websocket/subscriptionIndex.js` | 30 |
| `removeClientFromIndexes` | Function | `modern-view-chart/backend/websocket/subscriptionIndex.js` | 34 |
| `initWebSocket` | Function | `modern-view-chart/backend/websocket/index.js` | 26 |
| `parseBooleanEnv` | Function | `modern-view-chart/backend/websocket/config.js` | 11 |
| `resolveQueryAuthPolicy` | Function | `modern-view-chart/backend/websocket/config.js` | 19 |
| `emitWsError` | Function | `modern-view-chart/backend/websocket/auth.js` | 4 |
| `startBinanceTickerStream` | Function | `modern-view-chart/backend/websocket/services/binanceTickerService.js` | 5 |
| `recordBroadcastLoopDuration` | Function | `modern-view-chart/backend/runtime-state.js` | 33 |
| `collectInterestSymbolsFromIndex` | Function | `modern-view-chart/backend/websocket/subscriptionIndex.js` | 75 |
| `startPeriodicTasks` | Function | `modern-view-chart/backend/websocket/loopManager.js` | 99 |
| `broadcastChartCandles` | Function | `modern-view-chart/backend/websocket/services/broadcastService.js` | 177 |
| `incrementWsDroppedBackpressure` | Function | `modern-view-chart/backend/runtime-state.js` | 21 |
| `setWsBufferPressure` | Function | `modern-view-chart/backend/runtime-state.js` | 25 |
| `safeSend` | Function | `modern-view-chart/backend/websocket/wsSend.js` | 4 |
| `broadcastToAll` | Function | `modern-view-chart/backend/websocket/services/broadcastService.js` | 185 |
| `handleVirtualTradeCommand` | Function | `modern-view-chart/backend/websocket/handlers/virtualTradeHandler.js` | 46 |
| `getScopedMt5State` | Function | `modern-view-chart/backend/websocket/mt5Scope.js` | 59 |
| `clearScopedMt5State` | Function | `modern-view-chart/backend/websocket/mt5Scope.js` | 63 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ExecuteTelegramAction → NormalizeSymbol` | cross_community | 6 |
| `SetupMessageRouter → IncrementWsDroppedBackpressure` | cross_community | 5 |
| `EvaluatePriceAlerts → NormalizeSymbol` | cross_community | 5 |
| `EvaluatePriceAlerts → GetScopeId` | cross_community | 5 |
| `HandleMt5Update → IncrementWsDroppedBackpressure` | cross_community | 4 |
| `HandleMt5Update → SetWsBufferPressure` | cross_community | 4 |
| `SetupMessageRouter → SetWsBufferPressure` | cross_community | 4 |
| `SetupMessageRouter → NormalizeSymbol` | cross_community | 4 |
| `SetupMessageRouter → GetScopeId` | cross_community | 4 |
| `InitWebSocket → SanitizeValue` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Handlers | 10 calls |
| Services | 3 calls |
| Backend | 1 calls |
| Auth | 1 calls |

## How to Explore

1. `gitnexus_context({name: "setWsClients"})` — see callers and callees
2. `gitnexus_query({query: "websocket"})` — find related execution flows
3. Read key files listed above for implementation details
