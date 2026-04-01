import { describe, it, expect } from "vitest";
import { getVisibleRect, isTableVisible } from "./viewportCulling";

// ---------------------------------------------------------------------------
// getVisibleRect
// ---------------------------------------------------------------------------
describe("getVisibleRect", () => {
  it("expands the viewBox by the default 300px padding on all sides", () => {
    const viewBox = { left: 100, top: 50, width: 1280, height: 800 };
    const rect = getVisibleRect(viewBox);
    expect(rect.left).toBe(-200);   // 100 - 300
    expect(rect.top).toBe(-250);    // 50  - 300
    expect(rect.right).toBe(1680);  // 100 + 1280 + 300
    expect(rect.bottom).toBe(1150); // 50  + 800  + 300
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
