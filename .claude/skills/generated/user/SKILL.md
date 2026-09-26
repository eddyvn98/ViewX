---
name: user
description: "Skill for the User area of BE_ViewChart. 85 symbols across 17 files."
---

# User

85 symbols | 17 files | Cohesion: 78%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how emitModuleActivated, createMyModuleOrder, listMyModuleOrders work
- Modifying user-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/backend/modules/user/module-commerce.controller.js` | normalizeModuleName, normalizeModuleNames, getAuthRole, computeExpireMeta, expireOrderIfNeeded (+15) |
| `modern-view-chart/backend/modules/user/user-state.helpers.js` | sanitizeClientId, resolveStateScope, resolvePublicStateScope, parseBaseRevision, isPlainObject (+5) |
| `modern-view-chart/backend/modules/user/setup-state.upsert.js` | buildScopeBase, buildStatePayload, buildConflictEnvelope, buildSavedEnvelope, resolveSchemaVersion (+4) |
| `modern-view-chart/backend/modules/user/telegram.controller.js` | requireAuthedUser, hasTelegramModuleAccess, getTelegramStatus, startTelegramLink, updateTelegramPreferences (+3) |
| `tradingview/user/user.js` | initAuthPopupEvents, showAuthPopup, hideAuthPopup, toggleAuthMode, handleAuthSubmit (+2) |
| `modern-view-chart/backend/modules/user/trade-log.service.js` | toFiniteNumber, buildEmptyTradeStats, groupByWinrate, computeTradeStats, toNullableNumber (+2) |
| `modern-view-chart/backend/services/telegram.js` | buildTelegramStartPayload, hashTelegramPayload, buildTelegramDeepLink, sendTelegramMessage |
| `modern-view-chart/backend/modules/user/setup-state.get.js` | formatStateResponse, fetchState, createGetStateHandler |
| `modern-view-chart/backend/modules/user/public-trade.controller.js` | getPublicTradeStats, updatePublicTradeExit, createPublicTradeLog |
| `modules/user/user.controller.js` | createUser, login, updatePassword |

## Entry Points

Start here when exploring this area:

- **`emitModuleActivated`** (Function) — `modern-view-chart/backend/services/moduleEvents.js:4`
- **`createMyModuleOrder`** (Function) — `modern-view-chart/backend/modules/user/module-commerce.controller.js:129`
- **`listMyModuleOrders`** (Function) — `modern-view-chart/backend/modules/user/module-commerce.controller.js:144`
- **`cancelMyModuleOrder`** (Function) — `modern-view-chart/backend/modules/user/module-commerce.controller.js:154`
- **`listAdminModuleOrders`** (Function) — `modern-view-chart/backend/modules/user/module-commerce.controller.js:175`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `emitModuleActivated` | Function | `modern-view-chart/backend/services/moduleEvents.js` | 4 |
| `createMyModuleOrder` | Function | `modern-view-chart/backend/modules/user/module-commerce.controller.js` | 129 |
| `listMyModuleOrders` | Function | `modern-view-chart/backend/modules/user/module-commerce.controller.js` | 144 |
| `cancelMyModuleOrder` | Function | `modern-view-chart/backend/modules/user/module-commerce.controller.js` | 154 |
| `listAdminModuleOrders` | Function | `modern-view-chart/backend/modules/user/module-commerce.controller.js` | 175 |
| `getAdminModuleStats` | Function | `modern-view-chart/backend/modules/user/module-commerce.controller.js` | 249 |
| `confirmAdminModuleOrder` | Function | `modern-view-chart/backend/modules/user/module-commerce.controller.js` | 280 |
| `rejectAdminModuleOrder` | Function | `modern-view-chart/backend/modules/user/module-commerce.controller.js` | 304 |
| `listAdminModuleMembers` | Function | `modern-view-chart/backend/modules/user/module-commerce.controller.js` | 319 |
| `adminExtendMemberModule` | Function | `modern-view-chart/backend/modules/user/module-commerce.controller.js` | 328 |
| `adminExpireMemberModule` | Function | `modern-view-chart/backend/modules/user/module-commerce.controller.js` | 368 |
| `processTelegramWebhookUpdate` | Function | `modern-view-chart/backend/services/telegramWebhookProcessor.js` | 4 |
| `buildTelegramStartPayload` | Function | `modern-view-chart/backend/services/telegram.js` | 13 |
| `hashTelegramPayload` | Function | `modern-view-chart/backend/services/telegram.js` | 17 |
| `buildTelegramDeepLink` | Function | `modern-view-chart/backend/services/telegram.js` | 21 |
| `sendTelegramMessage` | Function | `modern-view-chart/backend/services/telegram.js` | 26 |
| `getTelegramStatus` | Function | `modern-view-chart/backend/modules/user/telegram.controller.js` | 27 |
| `startTelegramLink` | Function | `modern-view-chart/backend/modules/user/telegram.controller.js` | 58 |
| `updateTelegramPreferences` | Function | `modern-view-chart/backend/modules/user/telegram.controller.js` | 107 |
| `sendTelegramTest` | Function | `modern-view-chart/backend/modules/user/telegram.controller.js` | 137 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ProcessTelegramWebhookUpdate → Env` | cross_community | 6 |
| `ProcessTelegramWebhookUpdate → GetTime` | cross_community | 6 |
| `StartTelegramLink → GetTime` | cross_community | 5 |
| `ProcessTelegramWebhookUpdate → NormalizeModuleKey` | cross_community | 5 |
| `EvaluatePriceAlerts → Env` | cross_community | 5 |
| `UpdateTelegramPreferences → GetTime` | cross_community | 5 |
| `SendTelegramTest → GetTime` | cross_community | 5 |
| `SendTelegramTest → Env` | cross_community | 5 |
| `SendTelegramSignal → GetTime` | cross_community | 5 |
| `SendTelegramSignal → Env` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 15 calls |
| Backend | 2 calls |

## How to Explore

1. `gitnexus_context({name: "emitModuleActivated"})` — see callers and callees
2. `gitnexus_query({query: "user"})` — find related execution flows
3. Read key files listed above for implementation details
