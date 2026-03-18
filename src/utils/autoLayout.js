import dagre from "dagre";
import { getTableHeight } from "./utils";

export function performAutoLayout(tables, relationships, settings) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "LR",
    nodesep: 50,
    ranksep: 100,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(function () {
    return {};
  });

  tables.forEach((table) => {
    if (table.hidden) return;
    const height = getTableHeight(
      table,
      settings.tableWidth,
      settings.showComments,
    );
    g.setNode(table.id, {
      width: settings.tableWidth,
      height: height,
    });
  });

  relationships.forEach((rel) => {
    g.setEdge(rel.startTableId, rel.endTableId);
  });

  dagre.layout(g);

  const newCoords = {};
  g.nodes().forEach((v) => {
    const node = g.node(v);
    if (!node) return;
    // dagre returns the center coordinate, so we shift to top-left
    newCoords[v] = {
      x: node.x - node.width / 2,
      y: node.y - node.height / 2,
    };
  });

  return newCoords;
}
