// Rules: mec109.campaign-mode (data/rules/entries.json). Where a cycle (Shadows of Mirkwood: scenarios that are part of no campaign) shows in the app: one fold on the Scenarios
// tab once a scenario is playable, the rest Coming soon, never a New playthrough tile on the Campaigns tab, and no booklet to open (src/campaign/cycle-shell.test.ts is the engine's half).
import { describe, expect, it } from "vitest";

import { BOXES, bookletOf, boxOf, campaignOf, campaignOfScenario, scenarioOf } from "../data/campaign-data.ts";

import { comingLater } from "./hub-runs.ts";
import { lockedBoxTiles, lockedCampaignTiles, startableRows, type CampaignRow } from "./list.ts";

const cycle = campaignOf("shadows-of-mirkwood");
const rows: CampaignRow[] = [
  { id: "shadows-of-mirkwood", name: "Shadows of Mirkwood", scenarioCount: 6, playable: true, kind: "cycle", box: null },
  { id: "mirkwood-paths", name: "Mirkwood Paths", scenarioCount: 3, playable: true, kind: "campaign", box: null },
];

describe("the cycle on the tabs", () => {
  it("is registered: a cycle in one box, its scenarios readable with no campaign card, no booklet to open", () => {
    expect(cycle?.kind).toBe("cycle");
    for (const id of cycle?.scenarios ?? []) {
      expect(scenarioOf(id)?.id).toBe(id);
      expect(boxOf(id)?.campaignId, id).toBe("shadows-of-mirkwood");
      expect(campaignOfScenario(id)?.kind, id).toBe("cycle");
      expect(bookletOf("shadows-of-mirkwood", id), id).toBeNull();
    }
  });

  it("offers no New playthrough tile for a cycle, even when one of its scenarios is playable", () => {
    expect(startableRows(rows).map((row) => row.id)).toEqual(["mirkwood-paths"]);
    expect(startableRows(rows.map((row) => ({ ...row, playable: false })))).toEqual([]);
    expect(lockedCampaignTiles(rows.map((row) => ({ ...row, playable: false }))).map((tile) => tile.id)).not.toContain("shadows-of-mirkwood");
  });

  it("is one Coming later tile named for the cycle while nothing is playable, captioned Cycle", () => {
    const locked = rows.map((row) => ({ ...row, playable: false }));
    const tiles = comingLater(BOXES, locked, () => false, (id) => id);
    expect(tiles.find((tile) => tile.id === "shadows-of-mirkwood")).toEqual({ id: "shadows-of-mirkwood", name: "Shadows of Mirkwood", caption: "Cycle · 6 scenarios · Coming soon" });
    expect(lockedBoxTiles(locked).some((tile) => tile.id === "shadows-of-mirkwood")).toBe(true);
  });

  it("lists its scenarios in pack order in its fold, and the rest as Coming later, once one is playable", () => {
    const box = BOXES.find((one) => one.id === "shadows-of-mirkwood");
    expect(box?.scenarios).toEqual(cycle?.scenarios);
    const playable = (id: string) => id === "the-hunt-for-gollum";
    const tiles = comingLater(BOXES, rows, playable, (id) => id);
    expect(tiles.some((tile) => tile.id === "shadows-of-mirkwood")).toBe(false);
    expect(tiles.map((tile) => tile.id)).toContain("conflict-at-the-carrock");
    expect(tiles.map((tile) => tile.id)).not.toContain("the-hunt-for-gollum");
  });
});
