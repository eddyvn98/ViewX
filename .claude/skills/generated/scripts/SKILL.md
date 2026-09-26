---
name: scripts
description: "Skill for the Scripts area of BE_ViewChart. 27 symbols across 8 files."
---

# Scripts

27 symbols | 8 files | Cohesion: 89%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how buildLegacyMetrics, toLegacySummaryText, getEslintCommand work
- Modifying scripts-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/scripts/lint-common.mjs` | getEslintCommand, runEslint, runGit, resolveBaseRef, normalizePath (+2) |
| `modern-view-chart/scripts/lint-legacy-delta.mjs` | readJson, loadCurrentMetrics, buildRuleDelta, formatDelta, main |
| `modern-view-chart/scripts/lint-legacy-baseline-update.mjs` | readJson, getHeadSha, loadMetrics, main |
| `modern-view-chart/scripts/setup-telegram-webhook.mjs` | readEnv, resolveBackendOrigin, resolveWebhookUrl, main |
| `modern-view-chart/scripts/lint-legacy-metrics.mjs` | buildLegacyMetrics, toLegacySummaryText |
| `modern-view-chart/scripts/lint-changed.mjs` | getChangedFiles, main |
| `modern-view-chart/scripts/benchmark-exness.mjs` | runCli, getSessionState |
| `modern-view-chart/scripts/lint-legacy.mjs` | main |

## Entry Points

Start here when exploring this area:

- **`buildLegacyMetrics`** (Function) — `modern-view-chart/scripts/lint-legacy-metrics.mjs:0`
- **`toLegacySummaryText`** (Function) — `modern-view-chart/scripts/lint-legacy-metrics.mjs:58`
- **`getEslintCommand`** (Function) — `modern-view-chart/scripts/lint-common.mjs:94`
- **`runEslint`** (Function) — `modern-view-chart/scripts/lint-common.mjs:98`
- **`runGit`** (Function) — `modern-view-chart/scripts/lint-common.mjs:51`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `buildLegacyMetrics` | Function | `modern-view-chart/scripts/lint-legacy-metrics.mjs` | 0 |
| `toLegacySummaryText` | Function | `modern-view-chart/scripts/lint-legacy-metrics.mjs` | 58 |
| `getEslintCommand` | Function | `modern-view-chart/scripts/lint-common.mjs` | 94 |
| `runEslint` | Function | `modern-view-chart/scripts/lint-common.mjs` | 98 |
| `runGit` | Function | `modern-view-chart/scripts/lint-common.mjs` | 51 |
| `resolveBaseRef` | Function | `modern-view-chart/scripts/lint-common.mjs` | 63 |
| `isIgnoredPath` | Function | `modern-view-chart/scripts/lint-common.mjs` | 7 |
| `isLintableCodePath` | Function | `modern-view-chart/scripts/lint-common.mjs` | 46 |
| `readJson` | Function | `modern-view-chart/scripts/lint-legacy-baseline-update.mjs` | 9 |
| `getHeadSha` | Function | `modern-view-chart/scripts/lint-legacy-baseline-update.mjs` | 13 |
| `loadMetrics` | Function | `modern-view-chart/scripts/lint-legacy-baseline-update.mjs` | 19 |
| `main` | Function | `modern-view-chart/scripts/lint-legacy-baseline-update.mjs` | 31 |
| `readJson` | Function | `modern-view-chart/scripts/lint-legacy-delta.mjs` | 12 |
| `loadCurrentMetrics` | Function | `modern-view-chart/scripts/lint-legacy-delta.mjs` | 17 |
| `buildRuleDelta` | Function | `modern-view-chart/scripts/lint-legacy-delta.mjs` | 29 |
| `formatDelta` | Function | `modern-view-chart/scripts/lint-legacy-delta.mjs` | 48 |
| `main` | Function | `modern-view-chart/scripts/lint-legacy-delta.mjs` | 94 |
| `readEnv` | Function | `modern-view-chart/scripts/setup-telegram-webhook.mjs` | 3 |
| `resolveBackendOrigin` | Function | `modern-view-chart/scripts/setup-telegram-webhook.mjs` | 7 |
| `resolveWebhookUrl` | Function | `modern-view-chart/scripts/setup-telegram-webhook.mjs` | 11 |

## How to Explore

1. `gitnexus_context({name: "buildLegacyMetrics"})` — see callers and callees
2. `gitnexus_query({query: "scripts"})` — find related execution flows
3. Read key files listed above for implementation details
