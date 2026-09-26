---
name: telegram-intent
description: "Skill for the Telegram-intent area of BE_ViewChart. 44 symbols across 7 files."
---

# Telegram-intent

44 symbols | 7 files | Cohesion: 67%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how parseDeleteIntent, parsePricePercentIntent, parsePriceAbsoluteIntent work
- Modifying telegram-intent-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/backend/services/telegram-intent/pipeline.js` | finalizeMergedIntent, mergePendingIntent, withMeta, messageByLang, buildSuggestionForPending (+12) |
| `modern-view-chart/backend/services/telegram-intent/shared.js` | normalizeSymbol, normalizeTimeframe, normalizeCompareOperator, parsePositiveNumber, parseIndicatorToken (+5) |
| `modern-view-chart/backend/services/telegram-intent/templates.js` | parseDeleteIntent, parsePricePercentIntent, parsePriceAbsoluteIntent, parseRsiIntent, parseMaCrossIntent (+1) |
| `modern-view-chart/backend/services/telegram-intent/memory.js` | normalizePatternKey, toTokenSet, jaccardSimilarity, lookupPhraseMemory, savePhraseMemory |
| `modern-view-chart/backend/services/telegram-intent/ai.js` | normalizeAiIntent, getAt, extractJsonObject, parseAiIntent |
| `modern-view-chart/backend/services/telegram-intent/rules.js` | parseRuleIntent |
| `modern-view-chart/backend/services/telegramIntent.js` | parseTelegramIntent |

## Entry Points

Start here when exploring this area:

- **`parseDeleteIntent`** (Function) — `modern-view-chart/backend/services/telegram-intent/templates.js:9`
- **`parsePricePercentIntent`** (Function) — `modern-view-chart/backend/services/telegram-intent/templates.js:25`
- **`parsePriceAbsoluteIntent`** (Function) — `modern-view-chart/backend/services/telegram-intent/templates.js:39`
- **`parseRsiIntent`** (Function) — `modern-view-chart/backend/services/telegram-intent/templates.js:52`
- **`parseMaCrossIntent`** (Function) — `modern-view-chart/backend/services/telegram-intent/templates.js:104`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `parseDeleteIntent` | Function | `modern-view-chart/backend/services/telegram-intent/templates.js` | 9 |
| `parsePricePercentIntent` | Function | `modern-view-chart/backend/services/telegram-intent/templates.js` | 25 |
| `parsePriceAbsoluteIntent` | Function | `modern-view-chart/backend/services/telegram-intent/templates.js` | 39 |
| `parseRsiIntent` | Function | `modern-view-chart/backend/services/telegram-intent/templates.js` | 52 |
| `parseMaCrossIntent` | Function | `modern-view-chart/backend/services/telegram-intent/templates.js` | 104 |
| `parseIndicatorIntent` | Function | `modern-view-chart/backend/services/telegram-intent/templates.js` | 123 |
| `normalizeSymbol` | Function | `modern-view-chart/backend/services/telegram-intent/shared.js` | 43 |
| `normalizeTimeframe` | Function | `modern-view-chart/backend/services/telegram-intent/shared.js` | 49 |
| `normalizeCompareOperator` | Function | `modern-view-chart/backend/services/telegram-intent/shared.js` | 65 |
| `parsePositiveNumber` | Function | `modern-view-chart/backend/services/telegram-intent/shared.js` | 81 |
| `parseIndicatorToken` | Function | `modern-view-chart/backend/services/telegram-intent/shared.js` | 86 |
| `normalizeSuggestion` | Function | `modern-view-chart/backend/services/telegram-intent/shared.js` | 99 |
| `normalizeIntentOutput` | Function | `modern-view-chart/backend/services/telegram-intent/shared.js` | 106 |
| `parseRuleIntent` | Function | `modern-view-chart/backend/services/telegram-intent/rules.js` | 10 |
| `parseTelegramIntent` | Function | `modern-view-chart/backend/services/telegramIntent.js` | 2 |
| `resolveTelegramIntent` | Function | `modern-view-chart/backend/services/telegram-intent/pipeline.js` | 401 |
| `parseAiIntent` | Function | `modern-view-chart/backend/services/telegram-intent/ai.js` | 201 |
| `normalizeDirection` | Function | `modern-view-chart/backend/services/telegram-intent/shared.js` | 74 |
| `stripDiacritics` | Function | `modern-view-chart/backend/services/telegram-intent/shared.js` | 35 |
| `detectUserLanguage` | Function | `modern-view-chart/backend/services/telegram-intent/shared.js` | 152 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ResolveTelegramIntent → StripDiacritics` | cross_community | 5 |
| `ResolveTelegramIntent → NormalizeTimeframe` | cross_community | 5 |
| `ResolveTelegramIntent → NormalizeCompareOperator` | cross_community | 4 |
| `ResolveTelegramIntent → NormalizeSuggestion` | cross_community | 4 |
| `ExecuteIntentAndReply → StripDiacritics` | cross_community | 4 |

## How to Explore

1. `gitnexus_context({name: "parseDeleteIntent"})` — see callers and callees
2. `gitnexus_query({query: "telegram-intent"})` — find related execution flows
3. Read key files listed above for implementation details
