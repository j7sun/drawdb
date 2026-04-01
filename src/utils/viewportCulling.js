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
export function getVisibleRect(viewBox, padding = 300) {
  const w =
    viewBox.width > 0
      ? viewBox.width
      : typeof window !== "undefined"
        ? window.innerWidth
        : 1024;
  const h =
    viewBox.height > 0
      ? viewBox.height
      : typeof window !== "undefined"
        ? window.innerHeight
        : 768;
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
