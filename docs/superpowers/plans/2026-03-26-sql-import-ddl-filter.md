# SQL Import DDL Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix SQL import crashing on real-world MySQL dumps (e.g. Chinook) by pre-filtering the raw SQL to DDL-only statements before passing it to `node-sql-parser`.

**Architecture:** Extract a pure `filterDDL(sql)` utility function into `src/utils/importSQL/filterDDL.js`. Wire it into `parseSQLAndLoadDiagram()` in `Modal.jsx` — called once, before `parser.astify()`, for all non-Oracle databases. Add Vitest (trivial with Vite already present) and unit-test `filterDDL` in isolation.

**Tech Stack:** Vite + Vitest (new devDep), `node-sql-parser` (existing), React 18

---

## File Structure Map

### New Files
| File | Responsibility |
|---|---|
| `src/utils/importSQL/filterDDL.js` | Pure function: strips block/line comments, splits on `;`, keeps only `CREATE TABLE` and `ALTER TABLE` statements |
| `src/utils/importSQL/filterDDL.test.js` | Unit tests for `filterDDL` |

### Modified Files
| File | Change |
|---|---|
| `package.json` | Add `vitest` devDependency, add `"test"` script |
| `vite.config.js` | Add `test: { environment: "node" }` to defineConfig |
| `src/components/EditorHeader/Modal/Modal.jsx` | Call `filterDDL(importSource.src)` before `parser.astify()` in `parseSQLAndLoadDiagram` |

---

## Task 1: Set Up Vitest

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`

- [ ] **Step 1: Install vitest**

```bash
npm install --save-dev vitest
```

Expected: `vitest` appears in `package.json` devDependencies.

- [ ] **Step 2: Add test script to package.json**

Open `package.json`. In the `"scripts"` section, add:
```json
"test": "vitest run"
```

The scripts section should now look like:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0",
  "preview": "vite preview",
  "test": "vitest run"
},
```

- [ ] **Step 3: Add test config to vite.config.js**

Open `vite.config.js`. Add a `test` block:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Verify vitest runs (no tests yet)**

```bash
npm test
```

Expected output: something like `No test files found` or `0 tests passed` — no error.

- [ ] **Step 5: Commit**

```bash
git add package.json vite.config.js package-lock.json
git commit -m "chore: add vitest for unit testing"
```

---

## Task 2: Create filterDDL Utility with Tests (TDD)

**Files:**
- Create: `src/utils/importSQL/filterDDL.js`
- Create: `src/utils/importSQL/filterDDL.test.js`

### What filterDDL must do

- Strip block comments (`/* ... */`) and line comments (`-- ...`)
- Split on `;`
- Keep only statements whose trimmed text starts with `CREATE TABLE` or `ALTER TABLE` (case-insensitive)
- Return the kept statements joined with `;\n`, with a trailing `;`
- Return an empty string if no DDL statements are found (caller will handle it gracefully)

### Why only CREATE TABLE and ALTER TABLE

`node-sql-parser` can handle both. `ALTER TABLE ... ADD CONSTRAINT` is how MySQL dumps express foreign keys — drawDB's `importSQL` reads these to build relationships. All other statement types (`DROP DATABASE`, `CREATE DATABASE`, `USE`, `INSERT INTO`, `SET`, `LOCK TABLES`) either crash the parser or are irrelevant to diagram building.

---

- [ ] **Step 1: Write the failing test file**

Create `src/utils/importSQL/filterDDL.test.js`:

```js
import { describe, it, expect } from "vitest";
import { filterDDL } from "./filterDDL";

describe("filterDDL", () => {
  it("keeps CREATE TABLE statements", () => {
    const sql = "CREATE TABLE `Album` (`AlbumId` INT NOT NULL);";
    expect(filterDDL(sql)).toContain("CREATE TABLE");
  });

  it("keeps ALTER TABLE statements", () => {
    const sql = "ALTER TABLE `Album` ADD CONSTRAINT `FK_AlbumArtistId` FOREIGN KEY (`ArtistId`) REFERENCES `Artist` (`ArtistId`);";
    expect(filterDDL(sql)).toContain("ALTER TABLE");
  });

  it("strips DROP DATABASE statements", () => {
    const sql = "DROP DATABASE IF EXISTS `Chinook`;\nCREATE TABLE `Album` (`AlbumId` INT NOT NULL);";
    expect(filterDDL(sql)).not.toContain("DROP DATABASE");
    expect(filterDDL(sql)).toContain("CREATE TABLE");
  });

  it("strips CREATE DATABASE statements", () => {
    const sql = "CREATE DATABASE `Chinook`;\nCREATE TABLE `Album` (`AlbumId` INT NOT NULL);";
    expect(filterDDL(sql)).not.toContain("CREATE DATABASE");
    expect(filterDDL(sql)).toContain("CREATE TABLE");
  });

  it("strips USE statements", () => {
    const sql = "USE `Chinook`;\nCREATE TABLE `Album` (`AlbumId` INT NOT NULL);";
    expect(filterDDL(sql)).not.toContain("USE `Chinook`");
    expect(filterDDL(sql)).toContain("CREATE TABLE");
  });

  it("strips INSERT INTO statements", () => {
    const sql = "INSERT INTO `Album` VALUES (1, 'For Those', 1);\nCREATE TABLE `Album` (`AlbumId` INT NOT NULL);";
    expect(filterDDL(sql)).not.toContain("INSERT INTO");
    expect(filterDDL(sql)).toContain("CREATE TABLE");
  });

  it("strips block comments", () => {
    const sql = "/* this is a comment */\nCREATE TABLE `Album` (`AlbumId` INT NOT NULL);";
    expect(filterDDL(sql)).not.toContain("this is a comment");
    expect(filterDDL(sql)).toContain("CREATE TABLE");
  });

  it("strips line comments", () => {
    const sql = "-- drop the table\nCREATE TABLE `Album` (`AlbumId` INT NOT NULL);";
    expect(filterDDL(sql)).not.toContain("drop the table");
    expect(filterDDL(sql)).toContain("CREATE TABLE");
  });

  it("returns empty string when no DDL statements exist", () => {
    const sql = "USE `Chinook`;\nINSERT INTO `Album` VALUES (1, 'For Those', 1);";
    expect(filterDDL(sql)).toBe("");
  });

  it("handles a realistic MySQL dump excerpt", () => {
    const sql = `
      /* Chinook Database */
      DROP DATABASE IF EXISTS \`Chinook\`;
      CREATE DATABASE \`Chinook\`;
      USE \`Chinook\`;
      CREATE TABLE \`Album\` (
        \`AlbumId\` INT NOT NULL,
        \`Title\` NVARCHAR(160) NOT NULL
      );
      INSERT INTO \`Album\` VALUES (1, 'For Those About To Rock We Salute You', 1);
      ALTER TABLE \`Album\` ADD CONSTRAINT \`FK_AlbumArtistId\`
        FOREIGN KEY (\`ArtistId\`) REFERENCES \`Artist\` (\`ArtistId\`);
    `;
    const result = filterDDL(sql);
    expect(result).toContain("CREATE TABLE");
    expect(result).toContain("ALTER TABLE");
    expect(result).not.toContain("DROP DATABASE");
    expect(result).not.toContain("INSERT INTO");
    expect(result).not.toContain("USE `Chinook`");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: all tests fail with `Cannot find module './filterDDL'` or similar.

- [ ] **Step 3: Create filterDDL.js**

Create `src/utils/importSQL/filterDDL.js`:

```js
/**
 * Pre-filters a raw SQL string to DDL-only statements that node-sql-parser
 * can safely handle. Strips block comments, line comments, and all non-DDL
 * statements (DROP DATABASE, CREATE DATABASE, USE, INSERT INTO, SET, etc.).
 *
 * Only CREATE TABLE and ALTER TABLE are kept — the two statement types that
 * drawDB's importSQL utility actually reads to build the diagram.
 *
 * @param {string} sql - Raw SQL string (e.g. a full MySQL dump)
 * @returns {string} SQL string containing only DDL statements, or "" if none found
 */
export function filterDDL(sql) {
  // Remove block comments /* ... */ (including multi-line)
  let cleaned = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove line comments -- ...
  cleaned = cleaned.replace(/--[^\n]*/g, "");

  const DDL_PREFIXES = ["CREATE TABLE", "ALTER TABLE"];

  const ddlStatements = cleaned
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) =>
      DDL_PREFIXES.some((prefix) => stmt.toUpperCase().startsWith(prefix))
    );

  if (ddlStatements.length === 0) return "";

  return ddlStatements.join(";\n") + ";";
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests pass (10/10).

- [ ] **Step 5: Lint check**

```bash
npm run lint
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/importSQL/filterDDL.js src/utils/importSQL/filterDDL.test.js
git commit -m "feat: add filterDDL utility to strip non-DDL statements from SQL imports"
```

---

## Task 3: Wire filterDDL into Modal.jsx

**Files:**
- Modify: `src/components/EditorHeader/Modal/Modal.jsx`

- [ ] **Step 1: Add the import**

Open `src/components/EditorHeader/Modal/Modal.jsx`. At the top, alongside the existing `importSQL` import, add:

```js
import { filterDDL } from "../../../utils/importSQL/filterDDL";
```

- [ ] **Step 2: Call filterDDL before astify**

Find the `parseSQLAndLoadDiagram` function. The current non-Oracle branch looks like:

```js
const parser = new Parser();

ast = parser.astify(importSource.src, {
  database: targetDatabase,
});
```

Change it to:

```js
const parser = new Parser();
const ddlOnly = filterDDL(importSource.src);

ast = parser.astify(ddlOnly, {
  database: targetDatabase,
});
```

The full updated try block should look like:

```js
try {
  if (targetDatabase === DB.ORACLESQL) {
    const oracleParser = new OracleParser();
    ast = oracleParser.parse(importSource.src);
  } else {
    const parser = new Parser();
    const ddlOnly = filterDDL(importSource.src);
    ast = parser.astify(ddlOnly, {
      database: targetDatabase,
    });
  }
} catch (error) {
  const message = error.location
    ? `${error.name} [Ln ${error.location.start.line}, Col ${error.location.start.column}]: ${error.message}`
    : error.message;
  setError({ type: STATUS.ERROR, message });
  return;
}
```

> **Note:** Oracle uses its own parser (`oracle-sql-parser`) which is unaffected by this change.

- [ ] **Step 3: Lint check**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Manual end-to-end verification**

Run `npm run dev`. Open the editor, click **Import from SQL**, select **MySQL** as the database, paste or upload the Chinook_MySql.sql file, and click Import.

Expected:
- No error message appears
- The 11 Chinook tables appear on the canvas (Album, Artist, Customer, Employee, Genre, Invoice, InvoiceLine, MediaType, Playlist, PlaylistTrack, Track)
- Foreign key relationships are visible between tables

Also verify a simple SQL import still works:
```sql
CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));
```
Expected: single `users` table appears with no error.

- [ ] **Step 5: Commit**

```bash
git add src/components/EditorHeader/Modal/Modal.jsx
git commit -m "fix: pre-filter SQL to DDL-only before parsing to fix import crash on real-world dumps"
```
