# Chart Performance & Interaction Stability Plan

Status: IN PROGRESS  
Owner area: `modern-view-chart`  
Tracking branch: `feat/chart-performance-torture`

## Goal

Make the chart remain correct and responsive when a user acts faster than normal: rapid timeframe/symbol changes, indicator add/remove, pan/zoom, drag, drawing, resize, and mixed sequences.

A green build must eventually mean more than "the canvas exists". It must prove:

1. Final chart state is correct after rapid input.
2. Stale async work cannot overwrite the latest symbol/timeframe.
3. No crash, unhandled error, duplicated chart instance, or leaked canvas/DOM objects.
4. Interaction remains responsive under stress.
5. Performance regressions are visible in CI artifacts and later become blocking budgets.

## Current baseline

- Stack: React 19 + Lightweight Charts + Zustand + Web Worker indicators.
- Playwright exists but current smoke coverage only verifies that at least one `canvas` renders.
- Current GitHub Actions CI runs lint/build only; browser E2E is not part of the gate.
- Existing code already contains useful protections:
  - generation/key guards around history application during rapid context switches;
  - indicator batch version checks;
  - chart instances are intentionally not recreated for every symbol/timeframe change;
  - indicator calculation is delegated to a worker.
- Initial hotspots to benchmark:
  - chart-init `MutationObserver` repeatedly scanning descendants and setting `touchAction`;
  - realtime ticker schedules a new `requestAnimationFrame` for every incoming tick instead of coalescing to one latest-tick frame;
  - repeated `setData()` during fast context changes;
  - indicator worker work/results while indicators are quickly added/removed;
  - pointer/crosshair/drawing update frequency.

## Test strategy

### A. Rapid context switching

Stress sequence examples:

- M1 -> M5 -> M15 -> H1 -> H4 -> M5 repeatedly.
- XAUUSD -> BTCUSD -> EURUSD -> XAUUSD repeatedly.
- Symbol and timeframe changes interleaved with 10-50 ms gaps.

Blocking assertions:

- final symbol/timeframe/source exactly match the final user action;
- no stale dataset replaces the final context;
- no page error/unhandled rejection;
- chart canvas count returns to the expected count;
- chart remains interactive after the sequence.

### B. Indicator torture

Stress:

- add/remove RSI, MACD, Bollinger, Ichimoku, ATR, ADX and other supported indicators;
- change parameters quickly;
- remove an indicator while its worker calculation is still in flight;
- repeat until a stable baseline for worker/series cleanup is established.

Assertions:

- removed indicators do not reappear from stale worker results;
- series/primitive count does not grow without bound;
- no destroyed instance receives an update;
- final indicator list matches the final user actions.

### C. Pan / zoom / crosshair / drag

Stress:

- fast wheel zoom bursts;
- long left/right pan drags;
- dense pointer movement across the chart;
- price/subchart resize drags;
- order/alert tag drag where available.

Measure:

- long tasks;
- frame gaps;
- input-to-update delay where observable;
- page/console errors.

### D. Drawing torture

Stress:

- trend line, horizontal/vertical line, rectangle, Fibonacci retracement/extension;
- rapid pointer move while creating;
- select/move/resize/delete;
- undo/redo where supported.

Assertions:

- drawing state is not stuck;
- draft objects are cleaned up;
- final drawing count/state is correct;
- no pointer listener leak.

### E. Mixed chaos

Interleave all of the above in a deterministic sequence. This is the closest automated approximation to a user "doing everything quickly".

## Observability

Every browser stress run should collect:

- Playwright trace;
- screenshot on failure;
- video on failure/retry;
- console errors;
- page errors;
- long-task entries;
- requestAnimationFrame frame-gap samples;
- canvas count;
- selected DOM count;
- JS heap where Chromium exposes it;
- final chart state;
- later: setData/update counters and indicator-worker timings.

Artifacts must be uploaded by GitHub Actions when a run fails, and performance JSON should be uploaded on every stress run once the reporter is stable.

## Deterministic data

Performance/correctness tests must not depend on MT5, Binance, WebSocket availability, or internet timing.

Use a test-only E2E bridge gated by `NEXT_PUBLIC_E2E=1` to seed deterministic candle/ticker data into the Zustand store. Production behavior remains unchanged when the flag is absent.

Live integration/soak tests are a separate layer and must not replace deterministic tests.

## CI rollout

### Stage 1 - correctness gate (blocking)

- build application with `NEXT_PUBLIC_E2E=1`;
- start production Next server;
- run Chromium chart stress suite;
- fail on incorrect final state, crash, page error, or core interaction failure;
- upload Playwright report/trace artifacts.

### Stage 2 - performance reporting

Collect long tasks, frame gaps, heap, and canvas/DOM metrics. Do not immediately fail PRs on absolute timing while GitHub runner variance is unknown.

### Stage 3 - regression budgets

After enough baseline runs:

- enforce relative/robust budgets rather than brittle one-off timing;
- block large regression in long tasks/frame gaps/memory growth;
- keep correctness assertions strict.

## Initial performance targets

These are engineering targets, not immediate GitHub-runner hard gates:

- no user action should permanently block the main thread;
- normal pointer/drag rendering should aim to stay near one visual update per frame;
- stale intermediate symbol/timeframe work should be discarded;
- realtime tick bursts should coalesce to the latest value per animation frame;
- memory/canvas/series counts should return near baseline after repeated context churn;
- no growing listener/observer/worker queue after repeated stress loops.

## Implementation checklist

### Phase 0 - baseline
- [x] Inspect existing chart architecture and Playwright/CI setup.
- [x] Identify initial likely hotspots.
- [x] Create this tracking document.
- [ ] Capture first deterministic stress baseline.

### Phase 1 - testability + first gate
- [ ] Add stable chart/timeframe/indicator test hooks.
- [ ] Add E2E-only deterministic chart data bridge.
- [ ] Add performance probe helper.
- [ ] Add rapid symbol/timeframe stress test.
- [ ] Add pan/zoom pointer stress test.
- [ ] Wire Chromium stress tests into GitHub Actions.
- [ ] Upload Playwright artifacts.

### Phase 2 - indicator/drawing stress
- [ ] Indicator add/remove/parameter torture.
- [ ] Drawing create/move/delete torture.
- [ ] Mixed chaos scenario.
- [ ] Track series/drawing/indicator counts.

### Phase 3 - hotspot fixes
- [ ] Benchmark and reduce MutationObserver subtree work.
- [ ] Coalesce realtime tick RAF scheduling.
- [ ] Verify `setData()` count during context churn and reduce redundant full redraws.
- [ ] Verify worker cancellation/version behavior under add/remove churn.
- [ ] Profile crosshair/drawing pointer paths.

### Phase 4 - regression budgets
- [ ] Establish repeatable baselines from CI/local runs.
- [ ] Add memory/long-task/frame-gap regression thresholds.
- [ ] Keep historical performance JSON artifacts for comparison.

### Phase 5 - live soak
- [ ] Add optional MT5/Binance/WebSocket live soak job.
- [ ] Run longer symbol/timeframe/tick churn outside the deterministic PR gate.

## Definition of done

The chart work is considered stable only when:

- rapid interactions repeatedly finish in the correct final state;
- browser stress tests run automatically on PR/push;
- failures include enough trace/metrics to reproduce the issue;
- repeated stress does not show unbounded memory/canvas/series/listener growth;
- known hotspots are benchmarked and fixed or explicitly documented;
- performance regression budgets are enforced after baseline stabilization.

## Rule for future chart changes

Any change touching chart initialization, data/history, realtime ticker, indicators, drawing, sync, pointer handling, overlays, or chart state must either:

1. pass the chart stress suite unchanged, or
2. update/add a stress case that covers the new behavior.

Do not accept "canvas rendered" as sufficient verification for chart stability.
