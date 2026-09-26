---
name: use-websocket
description: "Skill for the Use-websocket area of BE_ViewChart. 25 symbols across 5 files."
---

# Use-websocket

25 symbols | 5 files | Cohesion: 75%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how clearForegroundResyncTimer, useInitialHistoryAndForegroundResyncEffect, scheduleResumeHealthCheck work
- Modifying use-websocket-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/src/hooks/use-websocket/effects.ts` | ensureLiveSocket, startHeartbeatLoop, useInitialHistoryAndForegroundResyncEffect, scheduleResumeHealthCheck, runVisibleSync (+5) |
| `modern-view-chart/src/hooks/use-websocket/senders.ts` | clearForegroundResyncTimer, requestChartBackfill, syncForegroundCharts, sendSymbolsInterestNow, queueSymbolsInterestSync (+1) |
| `modern-view-chart/src/hooks/use-websocket/socket-config.ts` | parseIntervalSeconds, deriveDefaultSocketUrl, extractCredentialFromUrl, stripCredentialFromSocketUrl, buildSocketConfig |
| `modern-view-chart/src/hooks/use-websocket/symbol-utils.ts` | normalizeSymbol, buildActiveSymbolSet, collectActiveSymbolsFromStore |
| `modern-view-chart/src/hooks/use-websocket/connection.ts` | connectSocket |

## Entry Points

Start here when exploring this area:

- **`clearForegroundResyncTimer`** (Function) — `modern-view-chart/src/hooks/use-websocket/senders.ts:48`
- **`useInitialHistoryAndForegroundResyncEffect`** (Function) — `modern-view-chart/src/hooks/use-websocket/effects.ts:52`
- **`scheduleResumeHealthCheck`** (Function) — `modern-view-chart/src/hooks/use-websocket/effects.ts:78`
- **`runVisibleSync`** (Function) — `modern-view-chart/src/hooks/use-websocket/effects.ts:97`
- **`onVisibilityChange`** (Function) — `modern-view-chart/src/hooks/use-websocket/effects.ts:107`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `clearForegroundResyncTimer` | Function | `modern-view-chart/src/hooks/use-websocket/senders.ts` | 48 |
| `useInitialHistoryAndForegroundResyncEffect` | Function | `modern-view-chart/src/hooks/use-websocket/effects.ts` | 52 |
| `scheduleResumeHealthCheck` | Function | `modern-view-chart/src/hooks/use-websocket/effects.ts` | 78 |
| `runVisibleSync` | Function | `modern-view-chart/src/hooks/use-websocket/effects.ts` | 97 |
| `onVisibilityChange` | Function | `modern-view-chart/src/hooks/use-websocket/effects.ts` | 107 |
| `onFocus` | Function | `modern-view-chart/src/hooks/use-websocket/effects.ts` | 112 |
| `onPageShow` | Function | `modern-view-chart/src/hooks/use-websocket/effects.ts` | 113 |
| `normalizeSymbol` | Function | `modern-view-chart/src/hooks/use-websocket/symbol-utils.ts` | 13 |
| `buildActiveSymbolSet` | Function | `modern-view-chart/src/hooks/use-websocket/symbol-utils.ts` | 20 |
| `parseIntervalSeconds` | Function | `modern-view-chart/src/hooks/use-websocket/socket-config.ts` | 4 |
| `requestChartBackfill` | Function | `modern-view-chart/src/hooks/use-websocket/senders.ts` | 60 |
| `syncForegroundCharts` | Function | `modern-view-chart/src/hooks/use-websocket/senders.ts` | 146 |
| `handleBackfillRequest` | Function | `modern-view-chart/src/hooks/use-websocket/effects.ts` | 161 |
| `collectActiveSymbolsFromStore` | Function | `modern-view-chart/src/hooks/use-websocket/symbol-utils.ts` | 37 |
| `deriveDefaultSocketUrl` | Function | `modern-view-chart/src/hooks/use-websocket/socket-config.ts` | 19 |
| `extractCredentialFromUrl` | Function | `modern-view-chart/src/hooks/use-websocket/socket-config.ts` | 50 |
| `stripCredentialFromSocketUrl` | Function | `modern-view-chart/src/hooks/use-websocket/socket-config.ts` | 60 |
| `buildSocketConfig` | Function | `modern-view-chart/src/hooks/use-websocket/socket-config.ts` | 71 |
| `connectSocket` | Function | `modern-view-chart/src/hooks/use-websocket/connection.ts` | 10 |
| `sendSymbolsInterestNow` | Function | `modern-view-chart/src/hooks/use-websocket/senders.ts` | 16 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `StandaloneChartPage → NormalizeSymbol` | cross_community | 6 |
| `UseChartHistory → NormalizeSymbol` | cross_community | 6 |
| `NotificationManager → NormalizeSymbol` | cross_community | 6 |
| `Home → DeriveDefaultSocketUrl` | cross_community | 5 |
| `Home → ExtractCredentialFromUrl` | cross_community | 5 |
| `Home → StripCredentialFromSocketUrl` | cross_community | 5 |
| `Home → NormalizeSymbol` | cross_community | 5 |
| `StandaloneChartPage → DeriveDefaultSocketUrl` | cross_community | 5 |
| `StandaloneChartPage → ExtractCredentialFromUrl` | cross_community | 5 |
| `StandaloneChartPage → StripCredentialFromSocketUrl` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Server | 1 calls |
| Auth | 1 calls |
| Voice | 1 calls |

## How to Explore

1. `gitnexus_context({name: "clearForegroundResyncTimer"})` — see callers and callees
2. `gitnexus_query({query: "use-websocket"})` — find related execution flows
3. Read key files listed above for implementation details
