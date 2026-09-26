---
name: desktop
description: "Skill for the Desktop area of BE_ViewChart. 28 symbols across 1 files."
---

# Desktop

28 symbols | 1 files | Cohesion: 96%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how resolveDevBridgeSourceDir, resolvePaths, logLine work
- Modifying desktop-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/desktop/main.cjs` | resolveDevBridgeSourceDir, resolvePaths, logLine, getDesktopStatusPayload, broadcastDesktopStatus (+23) |

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `resolveDevBridgeSourceDir` | Function | `modern-view-chart/desktop/main.cjs` | 48 |
| `resolvePaths` | Function | `modern-view-chart/desktop/main.cjs` | 64 |
| `logLine` | Function | `modern-view-chart/desktop/main.cjs` | 87 |
| `getDesktopStatusPayload` | Function | `modern-view-chart/desktop/main.cjs` | 94 |
| `broadcastDesktopStatus` | Function | `modern-view-chart/desktop/main.cjs` | 107 |
| `loadSettings` | Function | `modern-view-chart/desktop/main.cjs` | 119 |
| `persistSettings` | Function | `modern-view-chart/desktop/main.cjs` | 195 |
| `normalizeToken` | Function | `modern-view-chart/desktop/main.cjs` | 202 |
| `applySyncedAccessToken` | Function | `modern-view-chart/desktop/main.cjs` | 284 |
| `installAuthHeaderSniffer` | Function | `modern-view-chart/desktop/main.cjs` | 295 |
| `updateTray` | Function | `modern-view-chart/desktop/main.cjs` | 352 |
| `copyBridgeSource` | Function | `modern-view-chart/desktop/main.cjs` | 387 |
| `writeBridgeEnv` | Function | `modern-view-chart/desktop/main.cjs` | 402 |
| `ensureBridgeDependencies` | Function | `modern-view-chart/desktop/main.cjs` | 414 |
| `startBridgeProcess` | Function | `modern-view-chart/desktop/main.cjs` | 419 |
| `startBridge` | Function | `modern-view-chart/desktop/main.cjs` | 463 |
| `stopBridge` | Function | `modern-view-chart/desktop/main.cjs` | 490 |
| `restartBridge` | Function | `modern-view-chart/desktop/main.cjs` | 503 |
| `createTray` | Function | `modern-view-chart/desktop/main.cjs` | 600 |
| `scoreToken` | Function | `modern-view-chart/desktop/main.cjs` | 207 |

## How to Explore

1. `gitnexus_context({name: "resolveDevBridgeSourceDir"})` — see callers and callees
2. `gitnexus_query({query: "desktop"})` — find related execution flows
3. Read key files listed above for implementation details
