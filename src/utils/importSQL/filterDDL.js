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
 *
 * @limitation Splits on bare `;` characters. A semicolon inside a string
 * literal (e.g. DEFAULT 'a;b') or CHECK constraint will cause that statement
 * to be split and silently truncated. This is extremely rare in real-world
 * schema DDL but is a known edge case.
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

  // Normalize SQL Server types that appear in MySQL dumps but are not
  // recognised by node-sql-parser's MySQL grammar.
  const normalized = ddlStatements
    .join(";\n")
    .replace(/\bNVARCHAR\b/gi, "VARCHAR")
    .replace(/\bNCHAR\b/gi, "CHAR");

  return normalized + ";";
}
