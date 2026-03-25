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
