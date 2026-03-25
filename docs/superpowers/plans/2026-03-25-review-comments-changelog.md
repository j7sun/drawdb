# Review Comments & Changelog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-table review comments with resolve/delete states and an automatic changelog that silently records every structural schema change.

**Architecture:** Two new React contexts (`CommentsContext`, `ChangelogContext`) are inserted as providers wrapping the existing `TablesContextProvider` (DiagramContext), so DiagramContext can consume both via hooks. `CommentsSheet` and `ChangelogSheet` are Semi UI `SideSheet` components. `CommentsSheet` is controlled by `LayoutContext` flags; `ChangelogSheet` uses the existing `SIDESHEET` enum pattern. Both data arrays are persisted to IndexedDB alongside existing diagram data in `Workspace.jsx`.

**Tech Stack:** React 18, Semi UI (`@douyinfe/semi-ui`), `nanoid`, `react-i18next`, Dexie (IndexedDB via `src/db.js`)

---

## File Structure Map

### New Files
| File | Responsibility |
|---|---|
| `src/context/CommentsContext.jsx` | Comments state array, `addComment`, `resolveComment`, `deleteComment`, `deleteCommentsForTable`, `setComments` |
| `src/context/ChangelogContext.jsx` | Changelog state array, `addAutoEntry`, message builder function, `setChangelog` |
| `src/components/EditorCanvas/CommentBadge.jsx` | Badge on table header showing unresolved count; click opens CommentsSheet for that table |
| `src/components/EditorSidePanel/CommentsSheet.jsx` | Right-side 420px SideSheet listing comments for the selected table; add/resolve/delete |
| `src/components/EditorSidePanel/ChangelogSheet.jsx` | Right-side 420px SideSheet listing all auto changelog entries; filter by table |
| `src/icons/IconChangelog.jsx` | SVG icon component for Changelog nav button |

### Modified Files
| File | Change |
|---|---|
| `src/data/constants.js` | Add `SIDESHEET.CHANGELOG = 3` |
| `src/context/LayoutContext.jsx` | Add `commentsSheet: false`, `commentsTableId: null` to initial state |
| `src/pages/Editor.jsx` | Wrap `TablesContextProvider` with `CommentsContextProvider` → `ChangelogContextProvider` |
| `src/context/DiagramContext.jsx` | Call `addAutoEntry()` + `deleteCommentsForTable()` in table/field/relationship operations |
| `src/components/EditorCanvas/Table.jsx` | Render `<CommentBadge tableId={tableData.id} />` in table header |
| `src/components/EditorSidePanel/TablesTab/TableInfo.jsx` | Change `t("comment")` → `t("description")` in Collapse.Panel header |
| `src/components/EditorHeader/SideSheet/Sidesheet.jsx` | Add `SIDESHEET.CHANGELOG` case rendering `<ChangelogSheet />` |
| `src/components/EditorHeader/ControlPanel.jsx` | Add Changelog icon button that sets `openedSidesheet` to `SIDESHEET.CHANGELOG` |
| `src/components/Workspace.jsx` | Include `comments` and `changelog` in save/load; default to `[]` on load |
| `src/i18n/locales/en.js` | Add keys: `comments`, `no_comments`, `add_comment`, `resolve`, `resolved`, `open`, `changelog`, `no_changelog`, `description` |

---

## Task 1: Update Constants and LayoutContext

**Files:**
- Modify: `src/data/constants.js`
- Modify: `src/context/LayoutContext.jsx`

- [ ] **Step 1: Add SIDESHEET.CHANGELOG to constants.js**

Open `src/data/constants.js`. The current `SIDESHEET` enum is:
```js
export const SIDESHEET = {
  NONE: 0,
  TIMELINE: 1,
  VERSIONS: 2,
};
```

Add `CHANGELOG: 3`:
```js
export const SIDESHEET = {
  NONE: 0,
  TIMELINE: 1,
  VERSIONS: 2,
  CHANGELOG: 3,
};
```

- [ ] **Step 2: Add commentsSheet and commentsTableId to LayoutContext**

Open `src/context/LayoutContext.jsx`. The current initial state is:
```js
const [layout, setLayout] = useState({
  header: true,
  sidebar: true,
  issues: true,
  toolbar: true,
  dbmlEditor: false,
  readOnly: false,
});
```

Add two new fields:
```js
const [layout, setLayout] = useState({
  header: true,
  sidebar: true,
  issues: true,
  toolbar: true,
  dbmlEditor: false,
  readOnly: false,
  commentsSheet: false,
  commentsTableId: null,
});
```

- [ ] **Step 3: Lint check**
```bash
cd /Users/jialunsun/Desktop/drawdb && npm run lint
```
Expected: no new errors.

- [ ] **Step 4: Commit**
```bash
cd /Users/jialunsun/Desktop/drawdb
git add src/data/constants.js src/context/LayoutContext.jsx
git commit -m "feat: add COMMENT ObjectType, CHANGELOG sidesheet constant, commentsSheet layout flags"
```

---

## Task 2: Rename "Comment" to "Description" in TableInfo and i18n

**Files:**
- Modify: `src/components/EditorSidePanel/TablesTab/TableInfo.jsx`
- Modify: `src/i18n/locales/en.js`

- [ ] **Step 1: Add `description` key to i18n**

Open `src/i18n/locales/en.js`. Find the line:
```js
comment: "Comment",
```
Add a `description` key directly below it:
```js
comment: "Comment",
description: "Description",
```

> Note: We keep `comment` in the i18n file as it is still used for field-level comments in `FieldDetails.jsx`. We only add `description` as a new key.

- [ ] **Step 2: Update TableInfo.jsx Collapse.Panel header**

Open `src/components/EditorSidePanel/TablesTab/TableInfo.jsx`. Find the Collapse.Panel that renders the table comment:
```jsx
<Collapse.Panel header={t("comment")} itemKey="1">
```
Change it to:
```jsx
<Collapse.Panel header={t("description")} itemKey="1">
```

- [ ] **Step 3: Lint check**
```bash
cd /Users/jialunsun/Desktop/drawdb && npm run lint
```
Expected: no errors.

- [ ] **Step 4: Verify in browser**

Run `npm run dev`, open a diagram, expand any table in the left sidebar. The "Comment" section label should now read "Description". The textarea should still work normally.

- [ ] **Step 5: Commit**
```bash
cd /Users/jialunsun/Desktop/drawdb
git add src/i18n/locales/en.js src/components/EditorSidePanel/TablesTab/TableInfo.jsx
git commit -m "feat: rename table comment label to description"
```

---

## Task 3: Create CommentsContext

**Files:**
- Create: `src/context/CommentsContext.jsx`

- [ ] **Step 1: Create the file**

Create `src/context/CommentsContext.jsx` with the following content:

```jsx
import { createContext, useContext, useState } from "react";
import { nanoid } from "nanoid";

const CommentsContext = createContext(null);

export default function CommentsContextProvider({ children }) {
  const [comments, setComments] = useState([]);

  /**
   * Add a new comment to a table.
   * @param {string} tableId - The id of the table being commented on.
   * @param {string} text - The comment text.
   */
  function addComment(tableId, text) {
    const newComment = {
      id: nanoid(),
      tableId,
      text,
      resolved: false,
      createdAt: new Date().toISOString(),
      author: "You",
    };
    setComments((prev) => [...prev, newComment]);
  }

  /**
   * Mark a comment as resolved.
   * @param {string} id - The comment id.
   */
  function resolveComment(id) {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, resolved: true } : c))
    );
  }

  /**
   * Delete a single comment by id.
   * @param {string} id - The comment id.
   */
  function deleteComment(id) {
    setComments((prev) => prev.filter((c) => c.id !== id));
  }

  /**
   * Delete all comments belonging to a table (called on table deletion).
   * @param {string} tableId - The table id.
   */
  function deleteCommentsForTable(tableId) {
    setComments((prev) => prev.filter((c) => c.tableId !== tableId));
  }

  return (
    <CommentsContext.Provider
      value={{
        comments,
        setComments,
        addComment,
        resolveComment,
        deleteComment,
        deleteCommentsForTable,
      }}
    >
      {children}
    </CommentsContext.Provider>
  );
}

export function useComments() {
  return useContext(CommentsContext);
}
```

- [ ] **Step 2: Lint check**
```bash
cd /Users/jialunsun/Desktop/drawdb && npm run lint
```
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
cd /Users/jialunsun/Desktop/drawdb
git add src/context/CommentsContext.jsx
git commit -m "feat: add CommentsContext with add/resolve/delete/deleteForTable methods"
```

---

## Task 4: Create ChangelogContext

**Files:**
- Create: `src/context/ChangelogContext.jsx`

- [ ] **Step 1: Create the file**

Create `src/context/ChangelogContext.jsx` with the following content:

```jsx
import { createContext, useContext, useState } from "react";
import { nanoid } from "nanoid";

const ChangelogContext = createContext(null);

/**
 * Build a human-readable message from a changelog entry's details.
 * @param {object} details
 * @param {string} details.action - "add" | "delete" | "edit" | "move"
 * @param {string} details.element - "table" | "field" | "relationship"
 * @param {string} details.elementName - Name of the affected element
 * @param {string} [details.tableName] - Parent table name (for field changes)
 * @param {Array}  [details.changes]   - Array of { field, from, to } objects
 */
function buildMessage({ action, element, elementName, tableName, changes }) {
  if (action === "add") {
    if (element === "field") return `Added field "${elementName}" to "${tableName}"`;
    if (element === "relationship") return `Added relationship "${elementName}"`;
    return `Added table "${elementName}"`;
  }
  if (action === "delete") {
    if (element === "field") return `Deleted field "${elementName}" from "${tableName}"`;
    if (element === "relationship") return `Deleted relationship "${elementName}"`;
    return `Deleted table "${elementName}"`;
  }
  if (action === "edit") {
    if (changes && changes.length > 0) {
      const fields = changes.map((c) => c.field).join(", ");
      if (element === "field") return `Edited field "${elementName}" in "${tableName}" (${fields})`;
      return `Edited table "${elementName}" (${fields})`;
    }
    if (element === "field") return `Edited field "${elementName}" in "${tableName}"`;
    return `Edited table "${elementName}"`;
  }
  if (action === "move") return `Moved table "${elementName}"`;
  return `Changed ${element} "${elementName}"`;
}

export default function ChangelogContextProvider({ children }) {
  const [changelog, setChangelog] = useState([]);

  /**
   * Append an auto-generated changelog entry.
   * Called by DiagramContext after any structural schema change.
   * @param {object} details - See buildMessage for shape.
   */
  function addAutoEntry(details) {
    const entry = {
      id: nanoid(),
      timestamp: new Date().toISOString(),
      message: buildMessage(details),
      details,
    };
    setChangelog((prev) => [entry, ...prev]);
  }

  return (
    <ChangelogContext.Provider value={{ changelog, setChangelog, addAutoEntry }}>
      {children}
    </ChangelogContext.Provider>
  );
}

export function useChangelog() {
  return useContext(ChangelogContext);
}
```

- [ ] **Step 2: Lint check**
```bash
cd /Users/jialunsun/Desktop/drawdb && npm run lint
```
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
cd /Users/jialunsun/Desktop/drawdb
git add src/context/ChangelogContext.jsx
git commit -m "feat: add ChangelogContext with addAutoEntry and message builder"
```

---

## Task 5: Wire Both Contexts into Editor.jsx

**Files:**
- Modify: `src/pages/Editor.jsx`

- [ ] **Step 1: Import the new providers**

Open `src/pages/Editor.jsx`. At the top with the other context imports, add:
```js
import CommentsContextProvider from "../context/CommentsContext";
import ChangelogContextProvider from "../context/ChangelogContext";
```

- [ ] **Step 2: Insert providers in the chain**

The current provider chain ends with:
```jsx
<EnumsContextProvider>
  <TablesContextProvider>
    <SaveStateContextProvider>
      <WorkSpace />
    </SaveStateContextProvider>
  </TablesContextProvider>
</EnumsContextProvider>
```

Wrap `TablesContextProvider` with the two new providers. `CommentsContextProvider` must be the outermost of the two (so DiagramContext inside TablesContextProvider can consume both via hooks):
```jsx
<EnumsContextProvider>
  <CommentsContextProvider>
    <ChangelogContextProvider>
      <TablesContextProvider>
        <SaveStateContextProvider>
          <WorkSpace />
        </SaveStateContextProvider>
      </TablesContextProvider>
    </ChangelogContextProvider>
  </CommentsContextProvider>
</EnumsContextProvider>
```

- [ ] **Step 3: Lint check**
```bash
cd /Users/jialunsun/Desktop/drawdb && npm run lint
```
Expected: no errors.

- [ ] **Step 4: Verify app still loads**

Run `npm run dev` and open the app. The editor should load normally with no console errors.

- [ ] **Step 5: Commit**
```bash
cd /Users/jialunsun/Desktop/drawdb
git add src/pages/Editor.jsx
git commit -m "feat: add CommentsContextProvider and ChangelogContextProvider to editor provider chain"
```

---

## Task 6: Create CommentBadge and Add to Table.jsx

**Files:**
- Create: `src/components/EditorCanvas/CommentBadge.jsx`
- Modify: `src/components/EditorCanvas/Table.jsx`

- [ ] **Step 1: Create CommentBadge.jsx**

Create `src/components/EditorCanvas/CommentBadge.jsx`:

```jsx
import { useComments } from "../../context/CommentsContext";
import { LayoutContext } from "../../context/LayoutContext";
import { useContext } from "react";

/**
 * Badge displayed on a table header showing the count of unresolved comments.
 * - Shows a "+" icon when there are no comments (invites the user to add one).
 * - Shows the unresolved count as a red badge when comments exist.
 * - Clicking opens the CommentsSheet for this table.
 */
export default function CommentBadge({ tableId }) {
  const { comments } = useComments();
  const { setLayout } = useContext(LayoutContext);

  const unresolved = comments.filter(
    (c) => c.tableId === tableId && !c.resolved
  ).length;

  function handleClick(e) {
    e.stopPropagation();
    setLayout((prev) => ({
      ...prev,
      commentsSheet: true,
      commentsTableId: tableId,
    }));
  }

  if (unresolved === 0) {
    return (
      <button
        onClick={handleClick}
        title="Add comment"
        className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-full
                   bg-blue-500 text-white text-xs flex items-center justify-center
                   hover:bg-blue-600 focus:outline-none"
      >
        +
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      title={`${unresolved} unresolved comment${unresolved !== 1 ? "s" : ""}`}
      className="w-5 h-5 rounded-full bg-red-500 text-white text-xs
                 flex items-center justify-center hover:bg-red-600 focus:outline-none"
    >
      {unresolved}
    </button>
  );
}
```

- [ ] **Step 2: Add CommentBadge to Table.jsx**

Open `src/components/EditorCanvas/Table.jsx`. Find the import block at the top and add:
```js
import CommentBadge from "./CommentBadge";
```

Then find the header button row inside the table JSX. It currently looks like:
```jsx
<div className="flex justify-end items-center mx-2 space-x-1.5">
  <Button
    icon={tableData.locked ? <IconLock /> : <IconUnlock />}
    ...
  />
  <Button
    icon={<IconEdit />}
    ...
  />
  {/* ... Popover ... */}
</div>
```

Add `<CommentBadge tableId={tableData.id} />` at the start of that flex container:
```jsx
<div className="flex justify-end items-center mx-2 space-x-1.5">
  <CommentBadge tableId={tableData.id} />
  <Button
    icon={tableData.locked ? <IconLock /> : <IconUnlock />}
    ...
  />
  <Button
    icon={<IconEdit />}
    ...
  />
  {/* ... Popover ... */}
</div>
```

- [ ] **Step 3: Lint check**
```bash
cd /Users/jialunsun/Desktop/drawdb && npm run lint
```
Expected: no errors.

- [ ] **Step 4: Verify in browser**

Run `npm run dev`. Open a diagram with tables. Hovering over a table should show a small `+` button in the header button row. It should not break any existing table interactions.

- [ ] **Step 5: Commit**
```bash
cd /Users/jialunsun/Desktop/drawdb
git add src/components/EditorCanvas/CommentBadge.jsx src/components/EditorCanvas/Table.jsx
git commit -m "feat: add CommentBadge to table header"
```

---

## Task 7: Create CommentsSheet

**Files:**
- Create: `src/components/EditorSidePanel/CommentsSheet.jsx`
- Modify: `src/components/Workspace.jsx` (render point)

- [ ] **Step 1: Add i18n keys for comments**

Open `src/i18n/locales/en.js`. Add these keys near the existing `comment` key (`description` was already added in Task 2 — do not add it again):
```js
comments: "Comments",
no_comments: "No comments yet — click + to add one",
add_comment: "Add a comment...",
resolve: "Resolve",
resolved: "Resolved",
open_comments: "Open",
```

- [ ] **Step 2: Create CommentsSheet.jsx**

Create `src/components/EditorSidePanel/CommentsSheet.jsx`:

```jsx
import { useState, useContext } from "react";
import { SideSheet, Button, Input, Tag, Empty } from "@douyinfe/semi-ui";
import { IconTick, IconDelete } from "@douyinfe/semi-icons";
import { useTranslation } from "react-i18next";
import { useComments } from "../../context/CommentsContext";
import { LayoutContext } from "../../context/LayoutContext";

/**
 * Right-side panel showing all comments for the currently selected table.
 * Opened by clicking a CommentBadge on the canvas.
 * Controlled by layout.commentsSheet (boolean) and layout.commentsTableId (string).
 */
export default function CommentsSheet({ tables }) {
  const { t } = useTranslation();
  const { layout, setLayout } = useContext(LayoutContext);
  const { comments, addComment, resolveComment, deleteComment } = useComments();
  const [newText, setNewText] = useState("");
  const [filter, setFilter] = useState("open"); // "all" | "open" | "resolved"

  const tableId = layout.commentsTableId;
  const table = tables?.find((t) => t.id === tableId);

  const filtered = comments.filter((c) => {
    if (c.tableId !== tableId) return false;
    if (filter === "open") return !c.resolved;
    if (filter === "resolved") return c.resolved;
    return true;
  });

  function handleClose() {
    setLayout((prev) => ({ ...prev, commentsSheet: false, commentsTableId: null }));
  }

  function handleAdd() {
    const trimmed = newText.trim();
    if (!trimmed) return;
    addComment(tableId, trimmed);
    setNewText("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <SideSheet
      visible={layout.commentsSheet}
      onCancel={handleClose}
      width={420}
      title={
        <div className="text-lg">
          {t("comments")}
          {table ? ` — ${table.name}` : ""}
        </div>
      }
      style={{ paddingBottom: "16px" }}
      bodyStyle={{ padding: "0px", display: "flex", flexDirection: "column", height: "100%" }}
    >
      <div className="sidesheet-theme flex flex-col h-full">
        {/* Filter tabs */}
        <div className="flex gap-2 px-4 py-3 border-b border-gray-200">
          {["open", "resolved", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-sm capitalize
                ${filter === f
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
            >
              {f === "open" ? t("open_comments") : f === "resolved" ? t("resolved") : "All"}
            </button>
          ))}
        </div>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {filtered.length === 0 && filter === "open" && (
            <Empty description={t("no_comments")} className="mt-8" />
          )}
          {filtered.length === 0 && filter !== "open" && (
            <Empty description="No comments in this filter" className="mt-8" />
          )}
          {filtered.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-lg border p-3 ${
                comment.resolved
                  ? "opacity-50 border-gray-200"
                  : "border-gray-300"
              }`}
            >
              <p className={`text-sm ${comment.resolved ? "line-through text-gray-400" : ""}`}>
                {comment.text}
              </p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-400">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
                <div className="flex gap-1">
                  {!comment.resolved && (
                    <Button
                      icon={<IconTick />}
                      size="small"
                      title={t("resolve")}
                      onClick={() => resolveComment(comment.id)}
                    />
                  )}
                  <Button
                    icon={<IconDelete />}
                    size="small"
                    type="danger"
                    title="Delete"
                    onClick={() => deleteComment(comment.id)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add comment input */}
        <div className="px-4 py-3 border-t border-gray-200 flex gap-2">
          <Input
            placeholder={t("add_comment")}
            value={newText}
            onChange={setNewText}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button type="primary" onClick={handleAdd} disabled={!newText.trim()}>
            Add
          </Button>
        </div>
      </div>
    </SideSheet>
  );
}
```

- [ ] **Step 3: Render CommentsSheet in Workspace.jsx**

Open `src/components/Workspace.jsx`. Find the import block and add:
```js
import CommentsSheet from "./EditorSidePanel/CommentsSheet";
```

Find where the component accesses `tables` from context (look for `const { tables, ... } = useContext(...)` or similar).

Then in the JSX return, add `<CommentsSheet tables={tables} />` as a sibling to the main canvas/layout area (near the bottom of the JSX return, outside the canvas `<div>`):
```jsx
return (
  <div ...>
    {/* existing layout */}
    <CommentsSheet tables={tables} />
  </div>
);
```

> **Note:** The exact location depends on Workspace.jsx structure. Add it as the last child inside the outermost return div so it overlays the canvas.

- [ ] **Step 4: Lint check**
```bash
cd /Users/jialunsun/Desktop/drawdb && npm run lint
```
Expected: no errors.

- [ ] **Step 5: End-to-end verify in browser**

Run `npm run dev`.
1. Open a diagram with at least one table.
2. Hover over a table — the `+` badge should appear.
3. Click the `+` badge — the CommentsSheet should slide in from the right with the table name in the header.
4. Type a comment and press Enter or click Add — it appears in the list.
5. Click the ✓ Resolve button — the comment moves to Resolved filter, badge count stays at 0.
6. Switch filter to All — resolved comment shows dimmed with strikethrough.
7. Click Delete — the comment is removed.
8. Click outside or press Esc — the sheet closes.

- [ ] **Step 6: Commit**
```bash
cd /Users/jialunsun/Desktop/drawdb
git add src/components/EditorSidePanel/CommentsSheet.jsx src/components/Workspace.jsx src/i18n/locales/en.js
git commit -m "feat: add CommentsSheet with add/resolve/delete and filter tabs"
```

---

## Task 8: Cascade Delete Comments on Table Deletion

**Files:**
- Modify: `src/context/DiagramContext.jsx`

- [ ] **Step 1: Import useComments in DiagramContext**

Open `src/context/DiagramContext.jsx`. At the top, add:
```js
import { useComments } from "./CommentsContext";
```

- [ ] **Step 2: Consume deleteCommentsForTable inside the provider function**

Inside the `TablesContextProvider` function component (the one that wraps `children` and provides the context), add this near the top alongside other hook calls:
```js
const { deleteCommentsForTable } = useComments();
```

- [ ] **Step 3: Call deleteCommentsForTable inside deleteTable**

Find the `deleteTable` function. At the very end, after `setTables(...)`, add:
```js
deleteCommentsForTable(id);
```

The end of `deleteTable` should now look like:
```js
  setRelationships((prevR) =>
    prevR.filter((e) => !(e.startTableId === id || e.endTableId === id))
  );
  setTables((prev) => prev.filter((e) => e.id !== id));
  if (id === selectedElement.id) {
    setSelectedElement((prev) => ({
      ...prev,
      element: ObjectType.NONE,
      id: null,
      open: false,
    }));
  }
  deleteCommentsForTable(id);
};
```

- [ ] **Step 4: Lint check**
```bash
cd /Users/jialunsun/Desktop/drawdb && npm run lint
```
Expected: no errors.

- [ ] **Step 5: Verify cascade delete in browser**

Run `npm run dev`.
1. Add a comment to a table.
2. Verify the badge shows count 1.
3. Delete the table from the canvas.
4. Undo the deletion (Ctrl+Z) — the table comes back.
5. Re-delete the table. The badge count should be gone (comments cleaned up).

> **Note on undo:** Undo restores the table but does NOT restore its comments (this is acceptable for the current scope). Future work can extend the undo stack to also restore comments.

- [ ] **Step 6: Commit**
```bash
cd /Users/jialunsun/Desktop/drawdb
git add src/context/DiagramContext.jsx
git commit -m "feat: cascade delete comments when table is deleted"
```

---

## Task 9: Create ChangelogContext Auto-Logging in DiagramContext

**Files:**
- Modify: `src/context/DiagramContext.jsx`

> **Before starting:** Open `src/context/DiagramContext.jsx` and identify the exact function names and signatures for: `addTable`, `deleteTable`, `updateTable`, `addField`, `deleteField`, `updateField`, `addRelationship`, `deleteRelationship`. The implementations below follow the pattern observed in `deleteTable` — adjust variable names if they differ.

- [ ] **Step 1: Import useChangelog in DiagramContext**

At the top of `src/context/DiagramContext.jsx` (alongside the `useComments` import added in Task 8):
```js
import { useChangelog } from "./ChangelogContext";
```

- [ ] **Step 2: Consume addAutoEntry inside the provider function**

Inside the `TablesContextProvider` function, add alongside `deleteCommentsForTable`:
```js
const { addAutoEntry } = useChangelog();
```

- [ ] **Step 3: Add changelog call to addTable**

Find the `addTable` function. Locate where the new table is added to state (the `setTables(...)` call). After that call, add:
```js
addAutoEntry({
  action: "add",
  element: "table",
  elementId: newTable.id,
  elementName: newTable.name,
});
```

> **Note:** `newTable` is the table object being added. Verify the variable name in your local `addTable` implementation.

- [ ] **Step 4: Add changelog call to deleteTable**

In `deleteTable`, you already have `const deletedTable = tables.find((t) => t.id === id)` near the top (inside the `if (addToHistory)` block). Add the changelog call after `deleteCommentsForTable(id)`:
```js
deleteCommentsForTable(id);
addAutoEntry({
  action: "delete",
  element: "table",
  elementId: id,
  elementName: deletedTable.name,
});
```

> **Note:** `deletedTable` is already captured earlier in `deleteTable`. If `addToHistory` is false (undo/redo calls), we still want to log, so move the `deletedTable` lookup outside the `if (addToHistory)` block if it's currently inside it.

- [ ] **Step 5: Add changelog call to updateTable**

Find `updateTable(id, updatedValues)`. Add a changelog entry only when `name` or `color` changes (skip position-only changes):
```js
// Add this check at the start of updateTable, before setTables:
const shouldLog = updatedValues.name !== undefined || updatedValues.color !== undefined;
if (shouldLog) {
  const targetTable = tables.find((t) => t.id === id);
  const changes = [];
  if (updatedValues.name !== undefined && updatedValues.name !== targetTable.name) {
    changes.push({ field: "name", from: targetTable.name, to: updatedValues.name });
  }
  if (updatedValues.color !== undefined && updatedValues.color !== targetTable.color) {
    changes.push({ field: "color", from: targetTable.color, to: updatedValues.color });
  }
  if (changes.length > 0) {
    addAutoEntry({
      action: "edit",
      element: "table",
      elementId: id,
      elementName: targetTable.name,
      changes,
    });
  }
}
```

- [ ] **Step 6: Add changelog calls to addField and deleteField**

Find `addField(tid, data)`. After `setTables(...)`, add:
```js
const parentTable = tables.find((t) => t.id === tid);
addAutoEntry({
  action: "add",
  element: "field",
  elementId: data.id,
  elementName: data.name,
  tableName: parentTable?.name ?? tid,
});
```

Find `deleteField(tid, fid)`. Before or after `setTables(...)`, capture the field name and add:
```js
const parentTable = tables.find((t) => t.id === tid);
const deletedField = parentTable?.fields.find((f) => f.id === fid);
addAutoEntry({
  action: "delete",
  element: "field",
  elementId: fid,
  elementName: deletedField?.name ?? fid,
  tableName: parentTable?.name ?? tid,
});
```

- [ ] **Step 7: Add changelog call to updateField**

Find `updateField(tid, fid, updatedValues)`. Add logging for name or type changes only:
```js
const parentTable = tables.find((t) => t.id === tid);
const targetField = parentTable?.fields.find((f) => f.id === fid);
const changes = [];
if (updatedValues.name !== undefined && updatedValues.name !== targetField?.name) {
  changes.push({ field: "name", from: targetField?.name, to: updatedValues.name });
}
if (updatedValues.type !== undefined && updatedValues.type !== targetField?.type) {
  changes.push({ field: "type", from: targetField?.type, to: updatedValues.type });
}
if (changes.length > 0) {
  addAutoEntry({
    action: "edit",
    element: "field",
    elementId: fid,
    elementName: targetField?.name ?? fid,
    tableName: parentTable?.name ?? tid,
    changes,
  });
}
```

- [ ] **Step 8: Add changelog calls to addRelationship and deleteRelationship**

Find `addRelationship(data)`. After state update, add:
```js
addAutoEntry({
  action: "add",
  element: "relationship",
  elementId: data.id,
  elementName: data.name ?? `${data.startTableId} → ${data.endTableId}`,
});
```

Find `deleteRelationship(id)`. Before state update, capture the relationship name:
```js
const deletedRel = relationships.find((r) => r.id === id);
addAutoEntry({
  action: "delete",
  element: "relationship",
  elementId: id,
  elementName: deletedRel?.name ?? id,
});
```

- [ ] **Step 9: Lint check**
```bash
cd /Users/jialunsun/Desktop/drawdb && npm run lint
```
Expected: no errors.

- [ ] **Step 10: Verify auto-logging in browser**

Run `npm run dev`. Open a diagram and:
1. Add a new table — changelog should record "Added table ..."
2. Delete a table — changelog should record "Deleted table ..."
3. Rename a table — changelog should record "Edited table ... (name)"
4. Add a field — changelog should record "Added field ... to ..."
5. Delete a field — changelog should record "Deleted field ... from ..."
6. Add a relationship — changelog should record "Added relationship ..."

(You'll verify this visually once ChangelogSheet is built in Task 10, but you can `console.log(changelog)` from a component temporarily to verify entries are being created.)

- [ ] **Step 11: Commit**
```bash
cd /Users/jialunsun/Desktop/drawdb
git add src/context/DiagramContext.jsx
git commit -m "feat: auto-log table/field/relationship changes to ChangelogContext"
```

---

## Task 10: Create ChangelogSheet and Nav Button

**Files:**
- Create: `src/icons/IconChangelog.jsx`
- Create: `src/components/EditorSidePanel/ChangelogSheet.jsx`
- Modify: `src/components/EditorHeader/SideSheet/Sidesheet.jsx`
- Modify: `src/components/EditorHeader/ControlPanel.jsx`
- Modify: `src/i18n/locales/en.js`

- [ ] **Step 1: Add changelog i18n keys**

Open `src/i18n/locales/en.js`. Add:
```js
changelog: "Changelog",
no_changelog: "No changes recorded yet",
all_tables: "All tables",
```

- [ ] **Step 2: Create IconChangelog.jsx**

Create `src/icons/IconChangelog.jsx`:
```jsx
export default function IconChangelog(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="currentColor"
      {...props}
    >
      <path d="M13 3a9 9 0 0 1 9 9h-2a7 7 0 0 0-7-7V3zm0 4a5 5 0 0 1 5 5h-2a3 3 0 0 0-3-3V7zm1 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM3.055 13H5.07a7.002 7.002 0 0 0 6.93 6v2A9.002 9.002 0 0 1 3.055 13zm0-2A9.002 9.002 0 0 1 12 3v2a7.002 7.002 0 0 0-6.945 6H3.055z"/>
    </svg>
  );
}
```

- [ ] **Step 3: Create ChangelogSheet.jsx**

Create `src/components/EditorSidePanel/ChangelogSheet.jsx`:

```jsx
import { useState } from "react";
import { Select, Tag, Empty, Collapse } from "@douyinfe/semi-ui";
import { useTranslation } from "react-i18next";
import { useChangelog } from "../../context/ChangelogContext";

const ACTION_COLORS = {
  add: "green",
  delete: "red",
  edit: "blue",
  move: "orange",
};

/**
 * Content panel for the Changelog sidesheet.
 * Rendered inside the existing Sidesheet component when SIDESHEET.CHANGELOG is active.
 */
export default function ChangelogSheet({ tables }) {
  const { t } = useTranslation();
  const { changelog } = useChangelog();
  const [tableFilter, setTableFilter] = useState("all");

  const tableOptions = [
    { label: t("all_tables"), value: "all" },
    ...(tables ?? []).map((tbl) => ({ label: tbl.name, value: tbl.id })),
  ];

  const filtered = changelog.filter((entry) => {
    if (tableFilter === "all") return true;
    const tbl = tables?.find((t) => t.id === tableFilter);
    if (!tbl) return false;
    return (
      entry.details?.elementId === tableFilter ||
      entry.details?.tableName === tbl.name ||
      entry.details?.elementName === tbl.name
    );
  });

  if (changelog.length === 0) {
    return (
      <div className="px-4 pt-8">
        <Empty description={t("no_changelog")} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Table filter */}
      <div className="px-4 py-3 border-b border-gray-200">
        <Select
          value={tableFilter}
          onChange={setTableFilter}
          optionList={tableOptions}
          className="w-full"
          size="small"
        />
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filtered.length === 0 && (
          <Empty description="No entries match this filter" className="mt-8" />
        )}
        {filtered.map((entry) => (
          <div
            key={entry.id}
            className="rounded-lg border border-gray-200 p-3"
          >
            <div className="flex justify-between items-start gap-2">
              <p className="text-sm flex-1">{entry.message}</p>
              <Tag color={ACTION_COLORS[entry.details?.action] ?? "grey"} size="small">
                {entry.details?.action ?? "change"}
              </Tag>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {new Date(entry.timestamp).toLocaleString()}
            </p>
            {entry.details?.changes && entry.details.changes.length > 0 && (
              <Collapse className="mt-1">
                <Collapse.Panel header="Details" itemKey="1">
                  {entry.details.changes.map((change, i) => (
                    <p key={i} className="text-xs text-gray-500">
                      <span className="font-mono">{change.field}</span>:{" "}
                      <span className="line-through text-red-400">{String(change.from)}</span>
                      {" → "}
                      <span className="text-green-500">{String(change.to)}</span>
                    </p>
                  ))}
                </Collapse.Panel>
              </Collapse>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add CHANGELOG case to Sidesheet.jsx**

Open `src/components/EditorHeader/SideSheet/Sidesheet.jsx`.

Add the import:
```js
import ChangelogSheet from "../../EditorSidePanel/ChangelogSheet";
```

In `getTitle`, add a case:
```js
case SIDESHEET.CHANGELOG:
  return t("changelog");
```

In `getContent`, add a case. Note: `tables` needs to be passed in. Update the component signature to accept `tables` as a prop and thread it through:
```js
// Update function signature:
export default function Sidesheet({ type, title, setTitle, onClose, tables }) {

// In getContent:
case SIDESHEET.CHANGELOG:
  return <ChangelogSheet tables={tables} />;
```

- [ ] **Step 5: Pass tables to Sidesheet in ControlPanel.jsx**

Open `src/components/EditorHeader/ControlPanel.jsx`. Find where `<Sidesheet .../>` is rendered. Add the `tables` prop. The component should already have access to `tables` via a context (look for `useContext` calls at the top). If it doesn't yet consume tables context, add:
```js
// At the top of ControlPanel, with other context imports:
import { TablesContext } from "../../context/DiagramContext"; // verify export name
// ...
const { tables } = useContext(TablesContext);
```

Then pass to Sidesheet:
```jsx
<Sidesheet
  type={openedSidesheet}
  title={title}
  setTitle={setTitle}
  onClose={() => setOpenedSidesheet(SIDESHEET.NONE)}
  tables={tables}
/>
```

- [ ] **Step 6: Add Changelog button to ControlPanel.jsx**

In `ControlPanel.jsx`, find the toolbar area where the Timeline/Versions buttons are. Add a Changelog button using the same pattern:
```jsx
<Tooltip content={t("changelog")} position="bottom">
  <button
    className="py-1 px-2 hover-2 rounded-sm text-lg"
    onClick={() => setOpenedSidesheet(SIDESHEET.CHANGELOG)}
  >
    <IconChangelog />
  </button>
</Tooltip>
```

Add the import at the top of ControlPanel.jsx:
```js
import IconChangelog from "../../icons/IconChangelog";
```

- [ ] **Step 7: Lint check**
```bash
cd /Users/jialunsun/Desktop/drawdb && npm run lint
```
Expected: no errors.

- [ ] **Step 8: End-to-end verify in browser**

Run `npm run dev`.
1. Make several schema changes (add table, rename it, add a field, add a relationship).
2. Click the Changelog button in the top nav — the ChangelogSheet slides in from the right.
3. Verify entries appear in reverse chronological order (newest at top).
4. Use the table filter dropdown — selecting a table should show only relevant entries.
5. For an edit entry with changes, expand "Details" — see before/after values.
6. Press Esc or click outside — the sheet closes.

- [ ] **Step 9: Commit**
```bash
cd /Users/jialunsun/Desktop/drawdb
git add src/icons/IconChangelog.jsx \
        src/components/EditorSidePanel/ChangelogSheet.jsx \
        src/components/EditorHeader/SideSheet/Sidesheet.jsx \
        src/components/EditorHeader/ControlPanel.jsx \
        src/i18n/locales/en.js
git commit -m "feat: add ChangelogSheet and Changelog nav button"
```

---

## Task 11: Persist Comments and Changelog to IndexedDB

**Files:**
- Modify: `src/components/Workspace.jsx`

> **Before starting:** Open `src/components/Workspace.jsx` and locate: (1) the `db.diagrams.add(...)` call used when saving a new diagram, (2) the `db.diagrams.update(...)` or `.put(...)` call used when saving an existing diagram, and (3) the `setTables(diagram.tables)` section used when loading a diagram. All three locations need changes.

- [ ] **Step 1: Import both context hooks in Workspace.jsx**

At the top of `src/components/Workspace.jsx`, add:
```js
import { useComments } from "../context/CommentsContext";
import { useChangelog } from "../context/ChangelogContext";
```

- [ ] **Step 2: Consume context values**

Inside the `WorkSpace` function component, alongside existing context destructuring, add:
```js
const { comments, setComments } = useComments();
const { changelog, setChangelog } = useChangelog();
```

- [ ] **Step 3: Include comments and changelog in save (add)**

Find the `db.diagrams.add({ ... })` call. Add `comments` and `changelog` to the object:
```js
await db.diagrams.add({
  diagramId,
  database,
  name: title,
  tables,
  references: relationships,
  notes,
  areas,
  comments,      // ← add this
  changelog,     // ← add this
  // ... other existing fields
});
```

- [ ] **Step 4: Include comments and changelog in save (update)**

Find the `db.diagrams.update(...)` or `.put(...)` call for existing diagrams. Add the same two fields:
```js
await db.diagrams.update(id, {
  tables,
  references: relationships,
  notes,
  areas,
  comments,      // ← add this
  changelog,     // ← add this
  // ... other existing fields
});
```

- [ ] **Step 5: Load comments and changelog on diagram open**

Find the section where a loaded diagram's data is applied to state (where `setTables(diagram.tables)` is called). Add:
```js
setTables(diagram.tables ?? []);
setRelationships(diagram.references ?? []);
setNotes(diagram.notes ?? []);
setAreas(diagram.areas ?? []);
setComments(diagram.comments ?? []);       // ← add this
setChangelog(diagram.changelog ?? []);     // ← add this
```

The `?? []` default ensures old diagrams without these fields load cleanly.

- [ ] **Step 6: Lint check**
```bash
cd /Users/jialunsun/Desktop/drawdb && npm run lint
```
Expected: no errors.

- [ ] **Step 7: End-to-end persistence verify in browser**

Run `npm run dev`.
1. Open a diagram, add a comment to a table, make some schema changes (these will appear in changelog).
2. Save the diagram (Ctrl+S or however the app saves).
3. Refresh the browser / close and reopen the diagram.
4. Verify: the comment badge still shows on the table, the CommentsSheet shows the comment, the ChangelogSheet shows all recorded changes.
5. Open a diagram that was saved before this feature was added — it should open with no errors and empty comments/changelog.

- [ ] **Step 8: Commit**
```bash
cd /Users/jialunsun/Desktop/drawdb
git add src/components/Workspace.jsx
git commit -m "feat: persist comments and changelog arrays to IndexedDB"
```

---

## Verification Checklist

Run through these scenarios after all tasks are complete:

- [ ] Add a comment to a table → badge shows count 1
- [ ] Resolve a comment → badge count drops to 0, comment shows in Resolved filter
- [ ] Delete a comment → it disappears from all filters
- [ ] Switch between table badges while CommentsSheet is open → header updates to new table name
- [ ] Delete a table that has comments → table gone, badge gone, no orphan comments in state
- [ ] Add/delete/rename a table → ChangelogSheet shows the correct auto-entry
- [ ] Add/delete/rename a field → ChangelogSheet shows the correct auto-entry
- [ ] Add/delete a relationship → ChangelogSheet shows the correct auto-entry
- [ ] Filter changelog by a specific table → only relevant entries shown
- [ ] Save and reload diagram → comments and changelog survive the reload
- [ ] Load an old diagram (pre-feature) → no errors, empty comments and changelog
- [ ] The existing "Description" textarea in the left sidebar still works correctly
- [ ] `npm run lint` passes with zero warnings
