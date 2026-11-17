// Which nodes a modal layer makes inert (modal-layers.ts): the siblings of the layer and of each of its ancestors, and nothing inside it or above it.
import { describe, expect, it } from "vitest";

import { layersKept, outsideOf, ownScrim } from "./modal-layers.ts";

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

describe("ownScrim", () => {
  const box = {};
  const element = (testID: string | null, parentElement: unknown) => ({ parentElement, getAttribute: () => testID });
  it("is a scrim beside the layer, not a scrim elsewhere or another sibling", () => {
    const modal = { parentElement: box };
    expect(ownScrim(element("carousel-scrim", box), modal)).toBe(true);
    expect(ownScrim(element("carousel-scrim", {}), modal)).toBe(false);
    expect(ownScrim(element("phase-rail", box), modal)).toBe(false);
    expect(ownScrim(element(null, box), modal)).toBe(false);
  });
});

describe("layersKept", () => {
  const holds = (outer: string, inner: string) => inner.startsWith(`${outer}/`);
  it("keeps the preview open under its keyword bubble, and closes both when neither is on top", () => {
    expect(layersKept(["preview"], "preview/bubble", holds)).toBe(1);
    expect(layersKept(["preview", "preview/bubble"], "preview/bubble", holds)).toBe(2);
    expect(layersKept(["preview", "preview/bubble"], "preview", holds)).toBe(1);
    expect(layersKept(["preview", "preview/bubble"], null, holds)).toBe(0);
  });

  it("closes a layer the new top is not inside", () => {
    expect(layersKept(["preview"], "quest-advance", holds)).toBe(0);
    expect(layersKept([], "preview", holds)).toBe(0);
  });
});
