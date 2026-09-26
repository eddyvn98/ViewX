---
name: drawing
description: "Skill for the Drawing area of BE_ViewChart. 23 symbols across 11 files."
---

# Drawing

23 symbols | 11 files | Cohesion: 85%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how distanceToSegment, getDeleteButtonPosition, useDrawingEditor work
- Modifying drawing-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/src/features/chart/hooks/drawing/use-drawing-creation.ts` | updateDraft, useDrawingCreation, updatePointerPosition, handleMouseMove, handlePointerDown (+1) |
| `modern-view-chart/src/features/chart/hooks/drawing/editor-actions.ts` | createDrawingDragHandlers, handleDragStart, findNearAnchor, handleDragEnd, handleDragMove |
| `modern-view-chart/src/features/chart/utils/geometry-utils.ts` | distanceToSegment, getDeleteButtonPosition |
| `modern-view-chart/src/features/chart/utils/snap-utils.ts` | toSeconds, findSnapPoint |
| `modern-view-chart/src/features/chart/hooks/use-chart-drawings.ts` | handlePointerMove, useChartDrawings |
| `modern-view-chart/src/features/chart/hooks/drawing/use-drawing-editor.ts` | useDrawingEditor |
| `modern-view-chart/src/features/chart/hooks/drawing/editor-selection.ts` | createDrawingSelectionHandler |
| `modern-view-chart/src/features/chart/utils/fib-utils.ts` | calculateFibLevels |
| `modern-view-chart/src/features/chart/logic/manual-rectangle-primitive.ts` | ManualRectanglePrimitive |
| `modern-view-chart/src/features/chart/logic/manual-line/manual-line-primitive-core.ts` | ManualLinePrimitive |

## Entry Points

Start here when exploring this area:

- **`distanceToSegment`** (Function) — `modern-view-chart/src/features/chart/utils/geometry-utils.ts:7`
- **`getDeleteButtonPosition`** (Function) — `modern-view-chart/src/features/chart/utils/geometry-utils.ts:42`
- **`useDrawingEditor`** (Function) — `modern-view-chart/src/features/chart/hooks/drawing/use-drawing-editor.ts:11`
- **`createDrawingSelectionHandler`** (Function) — `modern-view-chart/src/features/chart/hooks/drawing/editor-selection.ts:18`
- **`createDrawingDragHandlers`** (Function) — `modern-view-chart/src/features/chart/hooks/drawing/editor-actions.ts:34`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ManualRectanglePrimitive` | Class | `modern-view-chart/src/features/chart/logic/manual-rectangle-primitive.ts` | 127 |
| `ManualLinePrimitive` | Class | `modern-view-chart/src/features/chart/logic/manual-line/manual-line-primitive-core.ts` | 17 |
| `distanceToSegment` | Function | `modern-view-chart/src/features/chart/utils/geometry-utils.ts` | 7 |
| `getDeleteButtonPosition` | Function | `modern-view-chart/src/features/chart/utils/geometry-utils.ts` | 42 |
| `useDrawingEditor` | Function | `modern-view-chart/src/features/chart/hooks/drawing/use-drawing-editor.ts` | 11 |
| `createDrawingSelectionHandler` | Function | `modern-view-chart/src/features/chart/hooks/drawing/editor-selection.ts` | 18 |
| `createDrawingDragHandlers` | Function | `modern-view-chart/src/features/chart/hooks/drawing/editor-actions.ts` | 34 |
| `handleDragStart` | Function | `modern-view-chart/src/features/chart/hooks/drawing/editor-actions.ts` | 55 |
| `findNearAnchor` | Function | `modern-view-chart/src/features/chart/hooks/drawing/editor-actions.ts` | 61 |
| `handleDragEnd` | Function | `modern-view-chart/src/features/chart/hooks/drawing/editor-actions.ts` | 247 |
| `findSnapPoint` | Function | `modern-view-chart/src/features/chart/utils/snap-utils.ts` | 21 |
| `calculateFibLevels` | Function | `modern-view-chart/src/features/chart/utils/fib-utils.ts` | 5 |
| `handlePointerMove` | Function | `modern-view-chart/src/features/chart/hooks/use-chart-drawings.ts` | 85 |
| `updateDraft` | Function | `modern-view-chart/src/features/chart/hooks/drawing/use-drawing-creation.ts` | 66 |
| `handleDragMove` | Function | `modern-view-chart/src/features/chart/hooks/drawing/editor-actions.ts` | 176 |
| `useChartDrawings` | Function | `modern-view-chart/src/features/chart/hooks/use-chart-drawings.ts` | 10 |
| `useDrawingPrimitives` | Function | `modern-view-chart/src/features/chart/hooks/drawing/use-drawing-primitives.ts` | 13 |
| `useDrawingCreation` | Function | `modern-view-chart/src/features/chart/hooks/drawing/use-drawing-creation.ts` | 23 |
| `updatePointerPosition` | Function | `modern-view-chart/src/features/chart/hooks/drawing/use-drawing-creation.ts` | 129 |
| `handleMouseMove` | Function | `modern-view-chart/src/features/chart/hooks/drawing/use-drawing-creation.ts` | 136 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Server | 1 calls |
| Logic | 1 calls |

## How to Explore

1. `gitnexus_context({name: "distanceToSegment"})` — see callers and callees
2. `gitnexus_query({query: "drawing"})` — find related execution flows
3. Read key files listed above for implementation details
