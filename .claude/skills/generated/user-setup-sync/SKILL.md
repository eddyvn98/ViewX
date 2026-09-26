---
name: user-setup-sync
description: "Skill for the User-setup-sync area of BE_ViewChart. 42 symbols across 12 files."
---

# User-setup-sync

42 symbols | 12 files | Cohesion: 91%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how useUserSetupSync, isPlainObject, sanitizeViewport work
- Modifying user-setup-sync-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/src/hooks/user-setup-sync/tabs-utils.ts` | isPlainObject, sanitizeViewport, toSafeRange, sanitizeTabsForPersistence, createFallbackTabs (+5) |
| `modern-view-chart/src/hooks/user-setup-sync/sync-utils.ts` | getOrCreateClientId, buildApiUrl, buildPublicApiUrl, getAuthHeaders, emitUserSetupSyncStatus (+1) |
| `modern-view-chart/src/hooks/user-setup-sync/strategy-utils.ts` | trimIndicatorsSnapshot, trimTradeContext, trimDrawings, trimStrategyState, hasUsableMatrixScanner (+1) |
| `modern-view-chart/src/hooks/user-setup-sync/effects/remote-sync/save-manager.ts` | createSaveManager, buildSnapshot, saveState, flushSave, scheduleSave |
| `modern-view-chart/src/hooks/user-setup-sync/state-utils.ts` | measureJsonBytes, fitPersistedSetupStateToBudget, pickPersistedSetupState, selectPersistableMarketState |
| `modern-view-chart/src/hooks/user-setup-sync/effects/remote-sync-effect.ts` | setupRemoteSyncEffect, isActive, flushBeforeLeave, handleVisibilityChange |
| `modern-view-chart/src/hooks/user-setup-sync/persistence-utils.ts` | getPersistedUiState, applyPersistedSetupState |
| `modern-view-chart/src/hooks/use-user-setup-sync.ts` | useUserSetupSync |
| `modern-view-chart/src/hooks/user-setup-sync/effects/broadcast-effect.ts` | setupBroadcastEffect |
| `modern-view-chart/src/hooks/user-setup-sync/effects/remote-sync/polling.ts` | pollRemoteState |

## Entry Points

Start here when exploring this area:

- **`useUserSetupSync`** (Function) — `modern-view-chart/src/hooks/use-user-setup-sync.ts:11`
- **`isPlainObject`** (Function) — `modern-view-chart/src/hooks/user-setup-sync/tabs-utils.ts:2`
- **`sanitizeViewport`** (Function) — `modern-view-chart/src/hooks/user-setup-sync/tabs-utils.ts:6`
- **`toSafeRange`** (Function) — `modern-view-chart/src/hooks/user-setup-sync/tabs-utils.ts:11`
- **`sanitizeTabsForPersistence`** (Function) — `modern-view-chart/src/hooks/user-setup-sync/tabs-utils.ts:36`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `useUserSetupSync` | Function | `modern-view-chart/src/hooks/use-user-setup-sync.ts` | 11 |
| `isPlainObject` | Function | `modern-view-chart/src/hooks/user-setup-sync/tabs-utils.ts` | 2 |
| `sanitizeViewport` | Function | `modern-view-chart/src/hooks/user-setup-sync/tabs-utils.ts` | 6 |
| `toSafeRange` | Function | `modern-view-chart/src/hooks/user-setup-sync/tabs-utils.ts` | 11 |
| `sanitizeTabsForPersistence` | Function | `modern-view-chart/src/hooks/user-setup-sync/tabs-utils.ts` | 36 |
| `createFallbackTabs` | Function | `modern-view-chart/src/hooks/user-setup-sync/tabs-utils.ts` | 159 |
| `sanitizeTabsInput` | Function | `modern-view-chart/src/hooks/user-setup-sync/tabs-utils.ts` | 184 |
| `getOrCreateClientId` | Function | `modern-view-chart/src/hooks/user-setup-sync/sync-utils.ts` | 4 |
| `buildApiUrl` | Function | `modern-view-chart/src/hooks/user-setup-sync/sync-utils.ts` | 22 |
| `buildPublicApiUrl` | Function | `modern-view-chart/src/hooks/user-setup-sync/sync-utils.ts` | 30 |
| `getAuthHeaders` | Function | `modern-view-chart/src/hooks/user-setup-sync/sync-utils.ts` | 38 |
| `emitUserSetupSyncStatus` | Function | `modern-view-chart/src/hooks/user-setup-sync/sync-utils.ts` | 53 |
| `parseRetryAfterMs` | Function | `modern-view-chart/src/hooks/user-setup-sync/sync-utils.ts` | 65 |
| `trimIndicatorsSnapshot` | Function | `modern-view-chart/src/hooks/user-setup-sync/strategy-utils.ts` | 6 |
| `trimTradeContext` | Function | `modern-view-chart/src/hooks/user-setup-sync/strategy-utils.ts` | 11 |
| `trimDrawings` | Function | `modern-view-chart/src/hooks/user-setup-sync/strategy-utils.ts` | 22 |
| `trimStrategyState` | Function | `modern-view-chart/src/hooks/user-setup-sync/strategy-utils.ts` | 37 |
| `hasUsableMatrixScanner` | Function | `modern-view-chart/src/hooks/user-setup-sync/strategy-utils.ts` | 71 |
| `mergePersistedStrategyState` | Function | `modern-view-chart/src/hooks/user-setup-sync/strategy-utils.ts` | 86 |
| `measureJsonBytes` | Function | `modern-view-chart/src/hooks/user-setup-sync/state-utils.ts` | 8 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `PollRemoteState → ReadStoredAccessToken` | cross_community | 5 |
| `RunInitialSync → ReadStoredAccessToken` | cross_community | 5 |
| `SaveState → ReadStoredAccessToken` | cross_community | 5 |
| `SaveState → BuildChartContextKey` | cross_community | 5 |
| `SaveState → IsPlainObject` | cross_community | 5 |
| `UseUserSetupSync → ReadStoredAccessToken` | cross_community | 4 |
| `Home → GetOrCreateClientId` | cross_community | 3 |
| `Home → BuildApiUrl` | cross_community | 3 |
| `Home → BuildPublicApiUrl` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Auth | 5 calls |
| Store | 1 calls |

## How to Explore

1. `gitnexus_context({name: "useUserSetupSync"})` — see callers and callees
2. `gitnexus_query({query: "user-setup-sync"})` — find related execution flows
3. Read key files listed above for implementation details
