import { describe, expect, it } from "vitest";

import { hubItems, type HubItemsInput } from "./hub-items";

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
    expect(shape(hubItems(input()))).toEqual(["fold-all", "box", "tiles:a", "tiles:b", "tiles:c", "box", "tiles:d", "tiles:e", "coming", "locked"]);
  });

  it("puts `posters` tiles in each row on a tablet, the last row short", () => {
    expect(shape(hubItems(input({ posters: 2, waiting: 0 })))).toEqual(["fold-all", "box", "tiles:ab", "tiles:c", "box", "tiles:de"]);
  });

  it("marks the first row of each box", () => {
    const rows = hubItems(input()).flatMap((item) => (item.type === "tiles" ? [item.first] : []));
    expect(rows).toEqual([true, false, false, true, false]);
  });

  it("keeps a folded box's header and leaves its tiles out", () => {
    const items = hubItems(input({ folded: (id) => id === "box-core" || id === "scenarios-coming" }));
    expect(shape(items)).toEqual(["fold-all", "box", "box", "tiles:d", "tiles:e", "coming"]);
    expect(items[1]).toMatchObject({ id: "box-core", count: 3, folded: true });
  });

  it("gives every item its own key", () => {
    const ids = hubItems(input({ posters: 2 })).map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers Collapse all only with two folds or more", () => {
    expect(shape(hubItems(input({ boxes: input().boxes.slice(0, 1), waiting: 0 })))).toEqual(["box", "tiles:a", "tiles:b", "tiles:c"]);
  });
});
