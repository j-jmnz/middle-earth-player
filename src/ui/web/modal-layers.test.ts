// Which nodes a modal layer makes inert (modal-layers.ts): the siblings of the layer and of each of its ancestors, and nothing inside it or above it.
import { describe, expect, it } from "vitest";

import { outsideOf } from "./modal-layers.ts";

type Node = { name: string; parent: Node | null; children: Node[] };

function tree(name: string, ...children: Node[]): Node {
  const node: Node = { name, parent: null, children };
  for (const child of children) child.parent = node;
  return node;
}

const names = (nodes: readonly Node[]): string[] => nodes.map((node) => node.name);
const leaf = (name: string): Node => tree(name);

describe("outsideOf", () => {
  it("returns the siblings along the chain from the layer to the body, not the layer, its own children or the body", () => {
    const preview = tree("preview", leaf("scrim"), leaf("close"));
    const hand = leaf("hand");
    const root = tree("table", hand, leaf("rail"), tree("overlays", preview, leaf("toast")));
    const body = tree("body", tree("app", root, leaf("splash")), leaf("portal"));
    expect(names(outsideOf(preview, (node) => node.parent, (node) => node.children, body)).sort()).toEqual(["hand", "portal", "rail", "splash", "toast"]);
  });

  it("stops at a detached layer instead of walking past the top", () => {
    const lone = tree("lone", leaf("a"));
    expect(outsideOf(lone, (node) => node.parent, (node) => node.children, tree("body"))).toEqual([]);
  });
});
