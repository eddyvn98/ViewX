---
name: js
description: "Skill for the Js area of BE_ViewChart. 64 symbols across 17 files."
---

# Js

64 symbols | 17 files | Cohesion: 86%

## When to Use

- Working with code in `tradingview/`
- Understanding how initWebSocket, initTerminalToggle, initMobileTabs work
- Modifying js-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `tradingview/js/mobile.js` | initMobileTabs, setActiveNavItem, initBottomSheet, closeSheet, initSidebarToggleMobile (+5) |
| `tradingview/js/chart.js` | startDrawingTrendline, updateCandle, updateCandleFromTick, initChart, setChartType (+4) |
| `tradingview/js/modules/chart/init.js` | startDrawingTrendline, initChartResizer, onMove, initRSI, initChart (+2) |
| `tradingview/js/main.js` | loadChartData, setupEventListeners, handleIntervalChange, fetchRightSidebarPrices, handleSocketMessage (+2) |
| `tradingview/js/websocket.js` | initWebSocket, subscribeToCandle, addSocketListener, requestMT5Candles, waitForSocketConnection (+1) |
| `tradingview/js/core/app.js` | initApp, setupSymbolSelect, handleSymbolChange, refresh, refreshPrices |
| `tradingview/js/trade.js` | resetTradeLines, initTradeLineDragging, promptModify, closePosition |
| `tradingview/js/ui.js` | initTerminalToggle, updateChartInfoSidebar, updateRightSidebarPrices |
| `tradingview/js/utils/api.js` | fetchSymbols, fetchCandles, fetchPrices |
| `tradingview/js/api.js` | fetchCandles, fetchSymbols |

## Entry Points

Start here when exploring this area:

- **`initWebSocket`** (Function) — `tradingview/js/websocket.js:5`
- **`initTerminalToggle`** (Function) — `tradingview/js/ui.js:93`
- **`initMobileTabs`** (Function) — `tradingview/js/mobile.js:0`
- **`setActiveNavItem`** (Function) — `tradingview/js/mobile.js:45`
- **`initBottomSheet`** (Function) — `tradingview/js/mobile.js:52`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `initWebSocket` | Function | `tradingview/js/websocket.js` | 5 |
| `initTerminalToggle` | Function | `tradingview/js/ui.js` | 93 |
| `initMobileTabs` | Function | `tradingview/js/mobile.js` | 0 |
| `setActiveNavItem` | Function | `tradingview/js/mobile.js` | 45 |
| `initBottomSheet` | Function | `tradingview/js/mobile.js` | 52 |
| `closeSheet` | Function | `tradingview/js/mobile.js` | 57 |
| `initSidebarToggleMobile` | Function | `tradingview/js/mobile.js` | 85 |
| `fetchSymbols` | Function | `tradingview/js/utils/api.js` | 30 |
| `setupEventListeners` | Function | `tradingview/js/core/events.js` | 2 |
| `setHandlerMetadata` | Function | `tradingview/js/modules/socket/handlers.js` | 8 |
| `startDrawingTrendline` | Function | `tradingview/js/modules/chart/init.js` | 156 |
| `initChartResizer` | Function | `tradingview/js/modules/chart/init.js` | 161 |
| `onMove` | Function | `tradingview/js/modules/chart/init.js` | 168 |
| `initRSI` | Function | `tradingview/js/modules/chart/init.js` | 187 |
| `subscribeToCandle` | Function | `tradingview/js/websocket.js` | 23 |
| `addSocketListener` | Function | `tradingview/js/websocket.js` | 40 |
| `requestMT5Candles` | Function | `tradingview/js/websocket.js` | 44 |
| `updateChartInfoSidebar` | Function | `tradingview/js/ui.js` | 77 |
| `resetTradeLines` | Function | `tradingview/js/trade.js` | 6 |
| `startDrawingTrendline` | Function | `tradingview/js/chart.js` | 241 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `HandleSocketMessage → ConvertToHeikinAshi` | cross_community | 6 |
| `HandleSocketMessage → WaitForSocketConnection` | cross_community | 5 |
| `HandleSocketMessage → DrawTrendline` | cross_community | 5 |
| `CandleTypeSelector → ConvertToHeikinAshi` | cross_community | 4 |
| `HandleSocketMessage → FetchCandles` | cross_community | 4 |
| `HandleSocketMessage → AddSocketListener` | cross_community | 4 |
| `LoadChartData → WaitForSocketConnection` | intra_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Chart | 5 calls |
| Components | 1 calls |

## How to Explore

1. `gitnexus_context({name: "initWebSocket"})` — see callers and callees
2. `gitnexus_query({query: "js"})` — find related execution flows
3. Read key files listed above for implementation details
