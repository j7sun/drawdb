# Viewport Culling for Large SQL Imports

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Rendering performance — Canvas.jsx and supporting utilities only

---

## Problem

When importing a SQL file with 200+ tables, drawdb freezes because React attempts to mount all table DOM nodes simultaneously. The SQL parsing phase (AST → diagram structure) is acceptable in duration; the freeze occurs exclusively in the rendering phase.

---

## Goal

Prevent UI freeze when rendering large diagrams (200+ tables) by only mounting table and relationship components that fall within (or near) the current viewport. Diagrams below the threshold render exactly as today — no behaviour change for normal use.

---

## Non-Goals

- Improving SQL parsing performance
- Paginating or chunking the import itself
- Adding a spatial index (R-tree) — O(n) filter over 1000 items is ~0.1ms, overkill
- Virtualising the relationship lines for sub-threshold diagrams

---

## Design

### Threshold

```js
// src/utils/constants.js
CULLING_THRESHOLD = 200
```

Viewport culling is **only active when `tables.length >= 200`**. Below this, all existing render paths are unchanged and incur zero overhead.

---

### New File: `src/utils/viewportCulling.js`

Pure functions with no React dependencies — fully unit-testable.

#### `getVisibleRect(pan, zoom, screenSize, padding = 200)`

Converts the current screen-space pan/zoom transform into a world-space bounding rectangle, expanded by `padding` on all four sides to prevent pop-in when panning.

```
left   = (-pan.x / zoom) - padding
top    = (-pan.y / zoom) - padding
right  = (screenSize.width  - pan.x) / zoom + padding
bottom = (screenSize.height - pan.y) / zoom + padding
```

Returns `{ left, top, right, bottom }`.

**Fallback:** If `screenSize.width` or `screenSize.height` is `0` (before `ResizeObserver` fires on first render), fall back to `window.innerWidth` / `window.innerHeight` respectively.

#### `isTableVisible(table, visibleRect, tableWidth)`

Checks whether a table's bounding box intersects `visibleRect`.

- **Table width:** `tableWidth` (from `settings.tableWidth`)
- **Table height (estimated):** `50 + table.fields.length * 36` (px)
  - 50px header, 36px per field row
  - The 200px padding buffer absorbs any estimation error

Returns `boolean`.

---

### Modified File: `src/components/EditorCanvas/Canvas.jsx`

Two `useMemo` hooks added after existing context consumption. Both are no-ops when culling is inactive.

```js
const isCullingActive = tables.length >= CULLING_THRESHOLD;

const visibleTables = useMemo(() => {
  if (!isCullingActive) return tables;
  const rect = getVisibleRect(pan, zoom, screenSize);
  return tables.filter(t => isTableVisible(t, rect, settings.tableWidth));
}, [tables, pan, zoom, screenSize, settings.tableWidth, isCullingActive]);

const visibleRelationships = useMemo(() => {
  if (!isCullingActive) return relationships;
  const visibleIds = new Set(visibleTables.map(t => t.id));
  return relationships.filter(r =>
    visibleIds.has(r.startTableId) || visibleIds.has(r.endTableId)
  );
}, [relationships, visibleTables, isCullingActive]);
```

**Relationship culling rule:** A relationship is kept if **at least one** of its endpoint tables is visible. This allows lines to extend gracefully off-screen toward culled tables rather than disappearing abruptly.

> **Implementation note:** Verify the exact field names for relationship endpoint table IDs in the relationship data structure (e.g. `startTableId`/`endTableId` or equivalent) before implementing the filter.

**Render swap:**
```js
// Replace:
{tables.map(table => <Table ... />)}
{relationships.map(r => <Relationship ... />)}

// With:
{visibleTables.map(table => <Table ... />)}
{visibleRelationships.map(r => <Relationship ... />)}
```

**UX indicator** — a read-only badge rendered in the bottom-left corner of the canvas when culling is active:

```
⚡ Showing 47 of 1,240 tables
```

Implemented as a simple absolutely-positioned element inside the canvas wrapper; no interaction required.

---

### Modified File: `src/utils/constants.js`

Add:
```js
export const CULLING_THRESHOLD = 200;
```

---

## Edge Cases

| Case | Behaviour |
|------|-----------|
| Selected table panned out of view | Table unmounts; selection ID preserved in `SelectContext`; re-mounts selected when panned back |
| Zoom-to-fit on import | `arrangeTables()` sets pan/zoom before first render; visible set computed correctly from fitted viewport |
| Table height estimation error | 200px padding buffer absorbs all realistic estimation errors |
| Both relationship endpoints culled | Relationship filtered out entirely — correct, no value in rendering invisible lines |
| `screenSize` is zero on first render | Falls back to `window.innerWidth` / `window.innerHeight` |

---

## Files Changed

| File | Change |
|------|--------|
| `src/utils/viewportCulling.js` | **New** — pure viewport utility functions |
| `src/utils/constants.js` | **Modified** — add `CULLING_THRESHOLD = 200` |
| `src/components/EditorCanvas/Canvas.jsx` | **Modified** — add `useMemo` culling hooks, swap render arrays, add UX badge |

---

## Performance Expectation

| Tables | DOM nodes before | DOM nodes after | Pan/zoom re-render cost |
|--------|-----------------|-----------------|------------------------|
| < 200  | All tables      | All tables (unchanged) | Unchanged |
| 1,000  | 1,000           | ~30–60          | ~0.1ms filter per frame |
| 5,000  | 5,000           | ~30–60          | ~0.5ms filter per frame |
