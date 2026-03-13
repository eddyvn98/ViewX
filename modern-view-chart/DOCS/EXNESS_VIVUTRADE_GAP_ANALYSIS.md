# Exness vs VivuTrade Gap Analysis

Generated on 2026-03-13 from live interaction checks on:

- Exness webtrading demo session
- VivuTrade production chart at `https://vivutrade.io.vn/en/chart`

## Executive Summary

Exness currently feels smoother and more stable than VivuTrade in the interactions that matter most for active trading:

- chart pan and directional reversal
- price/time scale manipulation
- timeframe and symbol switching
- order flow staying responsive while chart remains visually stable

The main pattern is not that VivuTrade is "broken", but that it appears to do more work during interaction. Exness feels closer to a thin interaction loop: drag first, settle later. VivuTrade more often feels like drag and side effects are happening together.

## Direct Comparison

| Area | Exness | VivuTrade | Gap |
| --- | --- | --- | --- |
| Pan chart | Very stable at slow speed and still controlled at fast speed | Usable, but easier to feel frame drops and redraw while dragging | VivuTrade needs a lighter pan loop |
| Price scale drag | Smooth and predictable | Decent, but fast drag feels more coupled to chart redraw | VivuTrade needs less cross-pane/layout work during scale |
| Time scale drag | One of the few places Exness also shows a bit of strain, but still controlled | More likely to expose redraw/settle behavior | VivuTrade needs dedicated time-scale optimization |
| Switch timeframe | Feels fast with limited hard reset | Context switch feels heavier and more "re-initialize everything" | VivuTrade should avoid hard series/data resets |
| Switch symbol | Fast enough to preserve user flow | Works, but visual continuity is weaker | VivuTrade should preload/swap instead of rebuild where possible |
| Order flow on chart | Panel and chart feel decoupled enough | Trade flow visibly shares rendering budget with chart area | VivuTrade should isolate order overlay updates |

## Concrete VivuTrade Findings

### 1. Pan/zoom feels more coupled to app state than Exness

Likely hot path:

- `src/features/chart/hooks/use-chart-init.ts`

Why it matters:

- The chart currently synchronizes multiple panes and persists viewport state on short intervals.
- That is useful behavior, but during pointer interaction it increases the risk of jitter and post-drag settle lag.

Target behavior:

- While the pointer is down, keep the path extremely thin.
- Persist and secondary sync should happen after interaction ends, or at least be aggressively deferred.

### 2. Timeframe/symbol changes feel more "reset-like" than Exness

Likely hot path:

- `src/features/chart/hooks/use-chart-history.ts`

Why it matters:

- The current flow clears and repopulates series on context changes.
- Even when functionally correct, this creates a visible reset sensation compared with Exness.

Target behavior:

- Keep chart instance alive.
- Reuse series where possible.
- Replace full clear-and-rebuild with incremental or staged updates.

### 3. Order interaction is not isolated enough from chart rendering

Likely hot path:

- `src/features/chart/hooks/use-chart-orders.ts`
- order tag / overlay render path under `src/features/chart/components` and `src/features/chart/logic`

Why it matters:

- Entry/TP/SL style interactions need a very high-frequency update loop.
- If drag updates travel through wider store/render paths, the chart starts feeling heavy.

Target behavior:

- Drag first on a local visual layer.
- Commit durable store updates later or at a reduced cadence.

## Recommended Fix Order

### P1

- Remove hard visual resets on symbol/timeframe switch in `use-chart-history.ts`.
- Thin the pointer-interaction path in `use-chart-init.ts`, especially pan/zoom sync across panes.
- Decouple order-line drag from broad store updates in `use-chart-orders.ts`.

### P2

- Add internal telemetry for:
  - response to first visual change
  - drag FPS / long frames
  - settle time after pointer release
- Add repeatable benchmark scenarios for VivuTrade matching the Exness checklist.

### P3

- Revisit overlay/layer redraw granularity so indicators, tags, and order visuals do not all update at the same cost during interaction.

## What "Smooth Like Exness" Means in Practice

For VivuTrade, the goal should be:

- first visible reaction almost immediately after pointer move
- no obvious redraw jump when direction changes during drag
- minimal extra settling after mouse up
- context switch that preserves continuity instead of feeling like a rebuild
- order UI that does not steal responsiveness from the chart

## Confidence Notes

- Confidence is high for pan, scale, timeframe, and symbol observations.
- Confidence is medium for chart-side TP/SL/entry drag comparison because Exness renders much of that interaction in canvas and the guest VivuTrade session uses virtual trading flow rather than a broker-backed live position object.
