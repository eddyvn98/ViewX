---
name: services
description: "Skill for the Services area of BE_ViewChart. 252 symbols across 43 files."
---

# Services

252 symbols | 43 files | Cohesion: 65%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how buildKeyboard, menuRootKeyboard, backKeyboard work
- Modifying services-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/backend/services/vnGoldService.js` | toSjcDate, parseDotNetDate, intervalToSeconds, normalizeTimeframe, aggregateCandles (+13) |
| `modern-view-chart/backend/services/telegramBot.ui.js` | buildKeyboard, menuRootKeyboard, backKeyboard, successKeyboard, callbackKeyboard (+11) |
| `modern-view-chart/backend/services/telegramBot.alerts.js` | toggleStrategySubscription, toggleScannerSubscription, createPriceAlert, createAbsolutePriceAlert, createIndicatorAlert (+11) |
| `modern-view-chart/backend/services/telegramBot.textIntent.js` | t, summarizeIntent, logAlertCreated, savePendingIntent, detectReplyLanguage (+10) |
| `modern-view-chart/backend/services/telegramBot.helpers.js` | nowIso, createId, normalizeTimeframe, formatPrice, escapeHtml (+9) |
| `modern-view-chart/backend/services/vangTodayService.js` | normalizeQuotes, normalizeText, fetchFromVangToday, getVangTodayLatestQuotes, persistVangTodaySnapshots (+7) |
| `modern-view-chart/backend/services/telegramBot.state.js` | loadUserSetupState, normalizeBotState, updateUserBotState, getSignals, getScanners (+6) |
| `modern-view-chart/backend/services/telegram.js` | editTelegramMessage, answerTelegramCallbackQuery, env, getTelegramConfig, setTelegramWebhook (+6) |
| `modern-view-chart/backend/services/telegramBot.renderers.js` | summarizeScannerSignals, resolveMatrixCell, renderScannerMatrixText, renderScannerMatrixImageUrl, renderScannerMatrixSvg (+6) |
| `modern-view-chart/backend/services/telegramBot.indicators.js` | indicatorNeedsPeriod, formatOperatorLabel, normalizeMaType, calculateHullMA, calculateMovingAverage (+6) |

## Entry Points

Start here when exploring this area:

- **`buildKeyboard`** (Function) — `modern-view-chart/backend/services/telegramBot.ui.js:13`
- **`menuRootKeyboard`** (Function) — `modern-view-chart/backend/services/telegramBot.ui.js:17`
- **`backKeyboard`** (Function) — `modern-view-chart/backend/services/telegramBot.ui.js:36`
- **`successKeyboard`** (Function) — `modern-view-chart/backend/services/telegramBot.ui.js:40`
- **`callbackKeyboard`** (Function) — `modern-view-chart/backend/services/telegramBot.ui.js:50`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `buildKeyboard` | Function | `modern-view-chart/backend/services/telegramBot.ui.js` | 13 |
| `menuRootKeyboard` | Function | `modern-view-chart/backend/services/telegramBot.ui.js` | 17 |
| `backKeyboard` | Function | `modern-view-chart/backend/services/telegramBot.ui.js` | 36 |
| `successKeyboard` | Function | `modern-view-chart/backend/services/telegramBot.ui.js` | 40 |
| `callbackKeyboard` | Function | `modern-view-chart/backend/services/telegramBot.ui.js` | 50 |
| `symbolKeyboard` | Function | `modern-view-chart/backend/services/telegramBot.ui.js` | 54 |
| `timeframeKeyboard` | Function | `modern-view-chart/backend/services/telegramBot.ui.js` | 68 |
| `buildManageAlertsKeyboard` | Function | `modern-view-chart/backend/services/telegramBot.ui.js` | 152 |
| `sendOrEditMenu` | Function | `modern-view-chart/backend/services/telegramBot.ui.js` | 238 |
| `sendMainMenu` | Function | `modern-view-chart/backend/services/telegramBot.ui.js` | 246 |
| `loadUserSetupState` | Function | `modern-view-chart/backend/services/telegramBot.state.js` | 16 |
| `handleTelegramBotUpdate` | Function | `modern-view-chart/backend/services/telegramBot.js` | 12 |
| `handleMenuAction` | Function | `modern-view-chart/backend/services/telegramBot.callback.js` | 22 |
| `handleCallback` | Function | `modern-view-chart/backend/services/telegramBot.callback.js` | 68 |
| `editTelegramMessage` | Function | `modern-view-chart/backend/services/telegram.js` | 153 |
| `answerTelegramCallbackQuery` | Function | `modern-view-chart/backend/services/telegram.js` | 172 |
| `getModuleCatalog` | Function | `modern-view-chart/backend/services/moduleCommerce.js` | 35 |
| `getModuleAccessSnapshot` | Function | `modern-view-chart/backend/services/moduleCommerce.js` | 46 |
| `startModuleTrial` | Function | `modern-view-chart/backend/services/moduleCommerce.js` | 72 |
| `buildPaymentArtifacts` | Function | `modern-view-chart/backend/services/moduleCommerce.js` | 119 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `HandleCallback → Env` | cross_community | 8 |
| `ExecuteTelegramAction → NormalizeSymbol` | cross_community | 6 |
| `BroadcastPricesToSubscribers → SanitizeValue` | cross_community | 6 |
| `ProcessTelegramWebhookUpdate → Env` | cross_community | 6 |
| `ProcessTelegramWebhookUpdate → GetTime` | cross_community | 6 |
| `EvaluatePriceAlerts → FormatUpdateStamp` | cross_community | 6 |
| `EvaluatePriceAlerts → ParseNumberLikeVnd` | cross_community | 6 |
| `EvaluatePriceAlerts → BuildQuote` | cross_community | 6 |
| `EvaluatePriceAlerts → SanitizeValue` | cross_community | 6 |
| `HandleCallback → EscapeHtml` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| User | 21 calls |
| Backend | 12 calls |
| Auth | 12 calls |
| Websocket | 10 calls |
| Telegram-intent | 2 calls |
| Handlers | 1 calls |

## How to Explore

1. `gitnexus_context({name: "buildKeyboard"})` — see callers and callees
2. `gitnexus_query({query: "services"})` — find related execution flows
3. Read key files listed above for implementation details
