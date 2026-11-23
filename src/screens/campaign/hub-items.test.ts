import { describe, expect, it } from "vitest";

import { hubItems, searchHub, type HubItemsInput } from "./hub-items";

const entries = (ids: string[]) => ids.map((id, index) => ({ id, number: index + 1 }));
const input = (over: Partial<HubItemsInput> = {}): HubItemsInput => ({
  boxes: [
    { box: { id: "core", name: "Core" }, playable: entries(["a", "b", "c"]) },
    { box: { id: "cycle", name: "Cycle" }, playable: entries(["d", "e"]) },
  ],
  waiting: 4,
  posters: 0,
  folded: () => false,
  ...over,
});
const shape = (items: ReturnType<typeof hubItems>) => items.map((item) => (item.type === "tiles" ? `tiles:${item.entries.map((entry) => entry.id).join("")}` : item.type));

describe("hubItems", () => {
  it("lists Collapse all, each box with one row per tile on a phone, then Coming later", () => {
    expect(shape(hubItems(input()))).toEqual(["search", "fold-all", "box", "tiles:a", "tiles:b", "tiles:c", "box", "tiles:d", "tiles:e", "coming", "locked"]);
  });

  it("puts `posters` tiles in each row on a tablet, the last row short", () => {
    expect(shape(hubItems(input({ posters: 2, waiting: 0 })))).toEqual(["search", "fold-all", "box", "tiles:ab", "tiles:c", "box", "tiles:de"]);
  });

  it("marks the first row of each box", () => {
    const rows = hubItems(input()).flatMap((item) => (item.type === "tiles" ? [item.first] : []));
    expect(rows).toEqual([true, false, false, true, false]);
  });

  it("keeps a folded box's header and leaves its tiles out", () => {
    const items = hubItems(input({ folded: (id) => id === "box-core" || id === "scenarios-coming" }));
    expect(shape(items)).toEqual(["search", "fold-all", "box", "box", "tiles:d", "tiles:e", "coming"]);
    expect(items[2]).toMatchObject({ id: "box-core", count: 3, folded: true });
  });

  it("gives every item its own key", () => {
    const ids = hubItems(input({ posters: 2 })).map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers Collapse all only with two folds or more", () => {
    expect(shape(hubItems(input({ boxes: input().boxes.slice(0, 1), waiting: 0 })))).toEqual(["search", "box", "tiles:a", "tiles:b", "tiles:c"]);
  });
});

describe("searchHub", () => {
  const names: Record<string, string> = { a: "Passage Through Mirkwood", b: "Journey Along the Anduin", c: "Escape from Dol Guldur", d: "The Fate of Númenor", e: "The Hunt for Gollum" };
  const tiles = [
    { id: "x", name: "The Old Forest", caption: "Coming soon · Cycle · 3" },
    { id: "y", name: "Dream-chaser", caption: "Cycle · 9 scenarios · Coming soon" },
  ];
  const search = (text: string) => searchHub(input().boxes, tiles, text, (id) => names[id] ?? id);
  const kept = (text: string) => search(text).boxes.map(({ box, playable }) => `${box.id}:${playable.map((entry) => entry.id).join("")}`);

  it("keeps everything while the field is empty", () => {
    expect(search("  ")).toMatchObject({ searching: false, boxes: input().boxes, waiting: tiles });
  });

  it("keeps the scenarios whose names hold every word, with their book numbers", () => {
    expect(kept("mirk pass")).toEqual(["core:a"]);
    expect(search("gollum").boxes[0]?.playable).toEqual([{ id: "e", number: 2 }]);
  });

  it("ignores accents and case", () => {
    expect(kept("NUMENOR")).toEqual(["cycle:d"]);
  });

  it("keeps every scenario of a box whose name holds the words", () => {
    expect(kept("core")).toEqual(["core:abc"]);
  });

  it("keeps the locked tiles whose name or caption holds the words", () => {
    expect(search("forest").waiting.map((tile) => tile.id)).toEqual(["x"]);
    expect(search("cycle").waiting.map((tile) => tile.id)).toEqual(["x", "y"]);
  });

  it("opens every fold, leaves Collapse all out and says when nothing matches", () => {
    const found = search("gollum");
    expect(shape(hubItems(input({ boxes: found.boxes, waiting: found.waiting.length, searching: true, folded: () => true })))).toEqual(["search", "box", "tiles:e"]);
    expect(shape(hubItems(input({ boxes: [], waiting: 0, searching: true })))).toEqual(["search", "empty"]);
  });
});
