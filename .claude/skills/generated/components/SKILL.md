---
name: components
description: "Skill for the Components area of BE_ViewChart. 164 symbols across 64 files."
---

# Components

164 symbols | 64 files | Cohesion: 86%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how cn, ThemeToggle, ThemeColorSwitcher work
- Modifying components-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/src/features/strategy/components/AIChatView.tsx` | IconTabButton, toFriendlyError, getAuthContext, getVisibleUserPrompt, sanitizeAssistantResponse (+9) |
| `modern-view-chart/src/features/terminal/components/OrderForm.tsx` | setOrderType, setSide, handleSubmit, calculatePnl, setSl (+4) |
| `modern-view-chart/src/features/strategy/components/StrategyPreview.tsx` | formatComparator, summarizeGroup, formatOffset, summarizeSL, summarizeTP (+3) |
| `modern-view-chart/src/features/strategy/components/RuleBuilder.tsx` | normalizeType, getFieldOptions, getFieldLabel, RuleSection, removeCondition (+2) |
| `modern-view-chart/src/features/chart/components/symbol-logo-map.ts` | normalizeSymbol, getTokenLogo, isAlphaCode, extractForexPair, classifyAsset (+1) |
| `modern-view-chart/src/features/strategy/components/StrategyMarkers.tsx` | StrategyMarkersView, toEpochSec, intervalToSec, snapToInterval, isStrategyActive (+1) |
| `modern-view-chart/src/features/strategy/components/StrategyList.tsx` | formatComparator, summarizeGroup, formatOffset, summarizeSL, summarizeTP (+1) |
| `modern-view-chart/src/features/chart/components/CandleTypeSelector.tsx` | CandleTypeSelector, getPalette, normalizeHex, updateTypeColor, openColorEditor (+1) |
| `modern-view-chart/src/features/chart/components/ChartPanels.tsx` | ChartPanels, updateCompactMode, clamp, updateHeight, onPointerMove |
| `modern-view-chart/src/features/terminal/components/PositionModifier.tsx` | PositionModifier, formatPrice, formatPnl, handleAdjust, calculateTargetPnl |

## Entry Points

Start here when exploring this area:

- **`cn`** (Function) — `modern-view-chart/src/lib/utils.ts:3`
- **`ThemeToggle`** (Function) — `modern-view-chart/src/components/layout/ThemeToggle.tsx:7`
- **`ThemeColorSwitcher`** (Function) — `modern-view-chart/src/components/layout/ThemeColorSwitcher.tsx:18`
- **`isThemeId`** (Function) — `modern-view-chart/src/components/layout/ThemeColorSwitcher.tsx:27`
- **`TabContainer`** (Function) — `modern-view-chart/src/components/layout/TabContainer.tsx:7`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `cn` | Function | `modern-view-chart/src/lib/utils.ts` | 3 |
| `ThemeToggle` | Function | `modern-view-chart/src/components/layout/ThemeToggle.tsx` | 7 |
| `ThemeColorSwitcher` | Function | `modern-view-chart/src/components/layout/ThemeColorSwitcher.tsx` | 18 |
| `isThemeId` | Function | `modern-view-chart/src/components/layout/ThemeColorSwitcher.tsx` | 27 |
| `TabContainer` | Function | `modern-view-chart/src/components/layout/TabContainer.tsx` | 7 |
| `handleRename` | Function | `modern-view-chart/src/components/layout/TabContainer.tsx` | 18 |
| `submitRename` | Function | `modern-view-chart/src/components/layout/TabContainer.tsx` | 23 |
| `MobileTimeframeSlide` | Function | `modern-view-chart/src/components/layout/MobileTimeframeSlide.tsx` | 10 |
| `handleSelect` | Function | `modern-view-chart/src/components/layout/MobileTimeframeSlide.tsx` | 27 |
| `renderModeContent` | Function | `modern-view-chart/src/components/layout/MobileBottomNav.tsx` | 128 |
| `Logo` | Function | `modern-view-chart/src/components/layout/Logo.tsx` | 12 |
| `TerminalHeader` | Function | `modern-view-chart/src/features/terminal/components/TerminalHeader.tsx` | 18 |
| `TerminalFooter` | Function | `modern-view-chart/src/features/terminal/components/TerminalFooter.tsx` | 14 |
| `VirtualBalanceCard` | Function | `modern-view-chart/src/features/strategy/components/VirtualBalanceCard.tsx` | 6 |
| `TimezoneSelector` | Function | `modern-view-chart/src/features/chart/components/TimezoneSelector.tsx` | 22 |
| `handleSelect` | Function | `modern-view-chart/src/features/chart/components/TimezoneSelector.tsx` | 50 |
| `TimeframeToolbar` | Function | `modern-view-chart/src/features/chart/components/TimeframeToolbar.tsx` | 9 |
| `TimeframeSelector` | Function | `modern-view-chart/src/features/chart/components/TimeframeSelector.tsx` | 12 |
| `handleSelect` | Function | `modern-view-chart/src/features/chart/components/TimeframeSelector.tsx` | 25 |
| `SubchartIndicatorsTabs` | Function | `modern-view-chart/src/features/chart/components/SubchartIndicatorsTabs.tsx` | 14 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CandleTypeSelector → ConvertToHeikinAshi` | cross_community | 4 |
| `StrategyMarkersView → NormalizeSymbol` | cross_community | 4 |
| `StrategyMarkersView → NormalizeTF` | cross_community | 4 |
| `AIChatView → GetVisibleUserPrompt` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Strategy | 4 calls |
| Hooks | 3 calls |
| Mt5-activation | 2 calls |
| Store | 2 calls |
| Slices | 1 calls |
| Auth | 1 calls |
| Js | 1 calls |

## How to Explore

1. `gitnexus_context({name: "cn"})` — see callers and callees
2. `gitnexus_query({query: "components"})` — find related execution flows
3. Read key files listed above for implementation details
