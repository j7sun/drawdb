# Viewport Culling for Large SQL Imports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent UI freeze when rendering 200+ tables by only mounting DOM nodes for tables visible in the current viewport, while leaving small diagrams completely unchanged.

**Architecture:** A threshold check (`tables.length >= CULLING_THRESHOLD`) gates two `useMemo` hooks in `Canvas.jsx` that filter the `tables` and `relationships` arrays to only visible items based on the SVG `viewBox` (world-space visible rect, already computed by `CanvasContext`). A pure utility file handles the geometry math. Below 200 tables, no code path changes.

**Tech Stack:** React (useMemo), Vitest (tests), SVG world-space coordinates via `viewBox` DOMRect from `CanvasContext`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/data/constants.js` | Modify | Add `CULLING_THRESHOLD = 200` |
| `src/utils/viewportCulling.js` | Create | Pure geometry functions: `getVisibleRect`, `isTableVisible` |
| `src/utils/viewportCulling.test.js` | Create | Vitest unit tests for both functions |
| `src/components/EditorCanvas/Canvas.jsx` | Modify | Add `useMemo` culling hooks, swap render arrays, add UX badge |

---

## Task 1: Add CULLING_THRESHOLD to constants

**Files:**
- Modify: `src/data/constants.js` (end of file)

- [ ] **Step 1: Add the constant**

Open `src/data/constants.js`. At the very end of the file, add:

```js
export const CULLING_THRESHOLD = 200;
```

- [ ] **Step 2: Verify the export compiles**

Run:
```bash
cd /Users/jialunsun/Desktop/drawdb && npm run build 2>&1 | tail -5
```
Expected: no errors mentioning `constants.js`.

- [ ] **Step 3: Commit**

```bash
cd /Users/jialunsun/Desktop/drawdb
git add src/data/constants.js
git commit -m "feat: add CULLING_THRESHOLD constant for viewport culling"
```

---

## Task 2: Create viewport culling utility + tests (TDD)

**Files:**
- Create: `src/utils/viewportCulling.js`
- Create: `src/utils/viewportCulling.test.js`

- [ ] **Step 1: Write the failing tests first**

Create `src/utils/viewportCulling.test.js` with this content:

```js
import { describe, it, expect } from "vitest";
import { getVisibleRect, isTableVisible } from "./viewportCulling";

// ---------------------------------------------------------------------------
// getVisibleRect
// ---------------------------------------------------------------------------
describe("getVisibleRect", () => {
  it("expands the viewBox by the default 200px padding on all sides", () => {
    const viewBox = { left: 100, top: 50, width: 1280, height: 800 };
    const rect = getVisibleRect(viewBox);
    expect(rect.left).toBe(-100);   // 100 - 200
    expect(rect.top).toBe(-150);    // 50  - 200
    expect(rect.right).toBe(1580);  // 100 + 1280 + 200
    expect(rect.bottom).toBe(1050); // 50  + 800  + 200
  });

  it("respects a custom padding value", () => {
    const viewBox = { left: 0, top: 0, width: 1000, height: 600 };
    const rect = getVisibleRect(viewBox, 50);
    expect(rect.left).toBe(-50);
    expect(rect.top).toBe(-50);
    expect(rect.right).toBe(1050);
    expect(rect.bottom).toBe(650);
  });

  it("falls back to window dimensions when viewBox width/height are 0", () => {
    const viewBox = { left: 0, top: 0, width: 0, height: 0 };
    // jsdom sets window.innerWidth/innerHeight to 1024/768 by default
    const rect = getVisibleRect(viewBox, 0);
    expect(rect.right).toBe(1024);
    expect(rect.bottom).toBe(768);
  });
});

// ---------------------------------------------------------------------------
// isTableVisible
// ---------------------------------------------------------------------------
describe("isTableVisible", () => {
  // visibleRect covers world coords 0..1000 x 0..600
  const rect = { left: 0, top: 0, right: 1000, bottom: 600 };
  const tableWidth = 220;

  it("returns true when table is fully inside the visible rect", () => {
    const table = { x: 100, y: 100, fields: new Array(5).fill({}) };
    // height = 50 + 5*36 = 230px  →  bottom = 330, well inside 600
    expect(isTableVisible(table, rect, tableWidth)).toBe(true);
  });

  it("returns true when table partially overlaps the right edge", () => {
    // table starts at x=900, width=220 → right=1120 > rect.right=1000
    const table = { x: 900, y: 100, fields: new Array(3).fill({}) };
    expect(isTableVisible(table, rect, tableWidth)).toBe(true);
  });

  it("returns true when table partially overlaps the bottom edge", () => {
    const table = { x: 100, y: 550, fields: new Array(3).fill({}) };
    // height = 50 + 3*36 = 158px  →  bottom = 708 > rect.bottom=600
    expect(isTableVisible(table, rect, tableWidth)).toBe(true);
  });

  it("returns false when table is entirely to the right of the rect", () => {
    const table = { x: 1100, y: 100, fields: new Array(3).fill({}) };
    expect(isTableVisible(table, rect, tableWidth)).toBe(false);
  });

  it("returns false when table is entirely below the rect", () => {
    const table = { x: 100, y: 700, fields: new Array(3).fill({}) };
    expect(isTableVisible(table, rect, tableWidth)).toBe(false);
  });

  it("returns false when table is entirely to the left of the rect", () => {
    const table = { x: -300, y: 100, fields: new Array(3).fill({}) };
    // right edge = -300 + 220 = -80, which is < rect.left=0
    expect(isTableVisible(table, rect, tableWidth)).toBe(false);
  });

  it("returns false when table is entirely above the rect", () => {
    const table = { x: 100, y: -300, fields: new Array(3).fill({}) };
    // height = 50 + 0*36 = 50  →  bottom = -250, which is < rect.top=0
    expect(isTableVisible(table, rect, tableWidth)).toBe(false);
  });

  it("handles a table with no fields (headerOnly)", () => {
    const table = { x: 100, y: 100, fields: [] };
    // height = 50  →  bottom = 150, inside rect
    expect(isTableVisible(table, rect, tableWidth)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
cd /Users/jialunsun/Desktop/drawdb && npx vitest run src/utils/viewportCulling.test.js
```
Expected: tests fail with "Cannot find module './viewportCulling'".

- [ ] **Step 3: Create the implementation**

Create `src/utils/viewportCulling.js`:

```js
import { tableHeaderHeight, tableFieldHeight } from "../data/constants";

/**
 * Converts the SVG viewBox (world-space visible area) into an expanded
 * bounding rect by adding `padding` on all four sides.
 *
 * The padding prevents tables at the viewport edge from popping in/out
 * as the user pans.
 *
 * @param {{ left: number, top: number, width: number, height: number }} viewBox
 *   The DOMRect from CanvasContext (world-space coordinates).
 * @param {number} [padding=200] Extra pixels to add outside the viewport.
 * @returns {{ left: number, top: number, right: number, bottom: number }}
 */
export function getVisibleRect(viewBox, padding = 200) {
  const w = viewBox.width > 0 ? viewBox.width : window.innerWidth;
  const h = viewBox.height > 0 ? viewBox.height : window.innerHeight;
  return {
    left: viewBox.left - padding,
    top: viewBox.top - padding,
    right: viewBox.left + w + padding,
    bottom: viewBox.top + h + padding,
  };
}

/**
 * Returns true if the table's bounding box intersects the visible rect.
 *
 * Table height is estimated as: tableHeaderHeight + fields.length * tableFieldHeight.
 * The 200px padding in getVisibleRect absorbs any estimation error.
 *
 * @param {{ x: number, y: number, fields: Array }} table
 * @param {{ left: number, top: number, right: number, bottom: number }} visibleRect
 * @param {number} tableWidth  The current table width from settings.tableWidth.
 * @returns {boolean}
 */
export function isTableVisible(table, visibleRect, tableWidth) {
  const tableLeft = table.x;
  const tableTop = table.y;
  const tableRight = table.x + tableWidth;
  const tableBottom =
    table.y + tableHeaderHeight + table.fields.length * tableFieldHeight;

  return (
    tableLeft < visibleRect.right &&
    tableRight > visibleRect.left &&
    tableTop < visibleRect.bottom &&
    tableBottom > visibleRect.top
  );
}
```

- [ ] **Step 4: Run tests — verify they all PASS**

```bash
cd /Users/jialunsun/Desktop/drawdb && npx vitest run src/utils/viewportCulling.test.js
```
Expected output:
```
✓ src/utils/viewportCulling.test.js (9 tests)
Test Files  1 passed (1)
Tests       9 passed (9)
```

- [ ] **Step 5: Commit**

```bash
cd /Users/jialunsun/Desktop/drawdb
git add src/utils/viewportCulling.js src/utils/viewportCulling.test.js
git commit -m "feat: add viewport culling utility with tests"
```

---

## Task 3: Integrate culling into Canvas.jsx + UX badge

**Files:**
- Modify: `src/components/EditorCanvas/Canvas.jsx`

### Step 1 — Update imports

- [ ] **Step 1a: Add `useMemo` to the React import**

Find this line near the top of `Canvas.jsx`:
```js
import { useRef, useState } from "react";
```
Replace with:
```js
import { useRef, useState, useMemo } from "react";
```

- [ ] **Step 1b: Add `CULLING_THRESHOLD` to the data/constants import**

Find the existing import from `../../data/constants`:
```js
import {
  Action,
  Cardinality,
  Constraint,
  darkBgTheme,
  ObjectType,
  gridSize,
  gridCircleRadius,
  minAreaSize,
} from "../../data/constants";
```
Replace with:
```js
import {
  Action,
  Cardinality,
  Constraint,
  CULLING_THRESHOLD,
  darkBgTheme,
  ObjectType,
  gridSize,
  gridCircleRadius,
  minAreaSize,
} from "../../data/constants";
```

- [ ] **Step 1c: Add import for viewportCulling utilities**

After the last existing import line in `Canvas.jsx`, add:
```js
import { getVisibleRect, isTableVisible } from "../../utils/viewportCulling";
```

### Step 2 — Add culling logic after context hooks

- [ ] **Step 2: Insert the three culling lines after `const { settings } = useSettings();`**

Find this line:
```js
const { settings } = useSettings();
```
Replace with:
```js
const { settings } = useSettings();

// --- Viewport culling (active only when tables.length >= CULLING_THRESHOLD) ---
const isCullingActive = tables.length >= CULLING_THRESHOLD;

const visibleTables = useMemo(() => {
  if (!isCullingActive) return tables;
  const rect = getVisibleRect(viewBox);
  return tables.filter((t) => isTableVisible(t, rect, settings.tableWidth));
}, [tables, viewBox, settings.tableWidth, isCullingActive]);

const visibleRelationships = useMemo(() => {
  if (!isCullingActive) return relationships;
  const visibleIds = new Set(visibleTables.map((t) => t.id));
  return relationships.filter(
    (r) => visibleIds.has(r.startTableId) || visibleIds.has(r.endTableId)
  );
}, [relationships, visibleTables, isCullingActive]);
// --------------------------------------------------------------------------
```

### Step 3 — Swap the render arrays

- [ ] **Step 3: Replace `relationships.map` and `tables.map` in the JSX**

Find:
```jsx
          {relationships.map((e) => (
            <Relationship key={e.id} data={e} />
          ))}
          {tables.map((table) => (
```
Replace with:
```jsx
          {visibleRelationships.map((e) => (
            <Relationship key={e.id} data={e} />
          ))}
          {visibleTables.map((table) => (
```

### Step 4 — Add the UX badge

- [ ] **Step 4: Add the culling-active badge**

The badge should appear as a sibling element to the `<svg id="diagram" ...>` element, inside the same parent container. Find the closing `</svg>` tag of the diagram SVG (it is the outermost SVG in the return). Add the badge immediately after it:

```jsx
        </svg>
        {isCullingActive && (
          <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded pointer-events-none select-none z-50">
            ⚡ Showing {visibleTables.length} of {tables.length} tables
          </div>
        )}
```

### Step 5 — Verify in dev

- [ ] **Step 5: Run the dev server and check the app loads without errors**

```bash
cd /Users/jialunsun/Desktop/drawdb && npm run dev
```
Expected: no console errors, canvas renders normally for a small diagram (badge should NOT appear).

- [ ] **Step 6: Run the full test suite**

```bash
cd /Users/jialunsun/Desktop/drawdb && npx vitest run
```
Expected: all tests pass (including the new `viewportCulling.test.js`).

- [ ] **Step 7: Commit**

```bash
cd /Users/jialunsun/Desktop/drawdb
git add src/components/EditorCanvas/Canvas.jsx
git commit -m "feat: integrate viewport culling into Canvas for 200+ table diagrams"
```

---

## Manual Verification Checklist

After all tasks are committed, verify these behaviours by hand:

- [ ] Import a SQL file with **< 200 tables** → badge does NOT appear, all tables render, no behaviour change
- [ ] Import a SQL file with **200+ tables** → badge appears (e.g. "⚡ Showing 45 of 312 tables"), UI does not freeze
- [ ] Pan the canvas on a large diagram → tables appear/disappear smoothly at edges (no harsh pop-in thanks to 200px padding)
- [ ] Zoom out far enough to see many tables → visible count in badge increases
- [ ] Select a table then pan away → no crash, table re-appears selected when panned back
