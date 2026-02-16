# Refactoring Plan: Chart Hooks modularization

## Objective
Refactor 3 heavy chart hooks to reduce file size (< 200 lines) and improve maintainability (Single Responsibility Principle).

## 1. `use-chart-init.ts` (Current: ~430 lines)
**Strategy:** Extract chart configuration and synchronization logic into pure setup functions.

### New Module Structure:
- **`src/features/chart/config/chart-options.ts`**
  - Export `getCommonOptions()`, `getPriceChartOptions()`, `getSubChartOptions()`, `getTimescaleOptions()`.
  - Removes ~80 lines of configuration objects from the main file.

- **`src/features/chart/logic/chart-sync.ts`**
  - Move `createSyncLine`, `syncVerticalLines`, `syncTime` (TimeScale sync), and `autoSyncLayout` (Resize/Width sync) here.
  - These can be standalone functions that accept Chart API instances.
  - Removes ~150 lines of complex sync logic.

## Proposed Changes

### Chart UI Refinement

#### [MODIFY] [tag-renderer.ts](file:///d:/TradingWeb/BE_ViewChart/modern-view-chart/src/features/chart/logic/tag-renderer.ts)
- Hide the numeric price label on floating order tags for existing positions and pending orders.
- Maintain price visibility for "Draft" orders (new orders being prepared) to ensure user knows the target entry level.
- This unclutters the chart while keeping essential information on the Y-axis.

---

### Strategy View Refinement (Completed)
x sync logic.

- **`src/features/chart/hooks/use-chart-init.ts` (Main)**
  - Will only handle:
    - `useRef` creation.
    - `useEffect` for lifecycle (mount/unmount).
    - Calling the config and sync setup functions.
  - Target size: ~100-120 lines.

## 2. `use-chart-interaction.ts` (Current: ~265 lines)
**Strategy:** Extract hit-testing and complex drag validation logic.

### New Module Structure:
- **`src/features/chart/logic/chart-hit-test.ts`**
  - Move `getNearElement` logic here. Keep it pure by passing necessary state (orders, positions, alerts) as arguments.
  - Removes ~60 lines.

- **`src/features/chart/logic/chart-drag.ts`**
  - Move `validateDragPrice` logic (ensuring SL/TP doesn't cross Entry).
  - Move internal DOM update logic for the drag tag (`tagElement.style.transform...`).
  - Removes ~50 lines.

- **`src/features/chart/hooks/use-chart-interaction.ts` (Main)**
  - Will focus on Event Listeners (`mousedown`, `mousemove`, `mouseup`) and state connection (`useMarketStore`).
  - Target size: ~150 lines.

## 3. `use-legend-dom-updater.ts` (Current: ~313 lines)
**Strategy:** Separate massive calculation logic and DOM manipulation helpers.

### New Module Structure:
- **`src/features/chart/logic/legend-calculations.ts`**
  - Move the `indicatorCacheRef` builder logic (mapping indicators to calculation results like EMA, RSI, MACD).
  - This is a heavy computation logic separate from the React/DOM layer.
  - Removes ~60 lines.

- **`src/features/chart/logic/legend-renderer.ts`**
  - Move `updateDOM` inner logic, specifically the part that updates textContent and styles for OHLC and Indicators.
  - Separate `formatPrice` into a shared utility if not already present.
  - Removes ~100 lines.

- **`src/features/chart/hooks/use-legend-dom-updater.ts` (Main)**
  - Manage subscriptions (`chart-crosshair`, `ticker`).
  - Manage `requestAnimationFrame` loop.
  - Target size: ~120 lines.

## Execution Order
1. Create new utility files in `src/features/chart/logic/` and `src/features/chart/config/`.
2. Move code from hooks to these new files.
3. Import and integrate new functions back into the original hooks.
4. Verify functionality (Chart rendeirng, syncing, interaction, legend updates).
