import { describe, expect, it } from "vitest";

import { withThreat } from "../../core/state.ts";
import { optionalEnemies } from "../../quest/quest.ts";
import { enemy, hero, table } from "../defense/table.ts";

// Rules: rr.optional-engagement, rr.engagement-check (data/rules/entries.json); ledger line 03060:A:1 (docs/scenarios/dwarrowdelf/into-the-pit.md, Into the Pit). The flag `optionalEngageThreat` on an enemy: a player whose threat is at least its amount cannot optionally engage it.

function scene(threat: number, flagged = true) {
  const built = table({ cards: [hero("a"), enemy("scout"), enemy("other")], effects: [], heroes: [{ code: "a" }], staging: [{ code: "scout" }, { code: "other" }] });
  const modifiers = flagged ? [{ instanceId: built.ids.scout!, sourceId: built.ids.scout!, stat: "optionalEngageThreat" as const, amount: 25, until: "whileSourceInPlay" as const }] : [];
  const state = withThreat({ ...built.state, modifiers }, 0, threat);
  return { ...built, state };
}

describe("optionalEngageThreat (03060:A:1)", () => {
  it("bars a player at 25 or higher from optionally engaging that enemy only", () => {
    const { state, ids, ctx } = scene(25);
    expect(optionalEnemies(state, ctx.cards, 0)).toEqual([ids.other]);
  });

  it("lets a player below 25 engage it", () => {
    const { state, ids, ctx } = scene(24);
    expect(optionalEnemies(state, ctx.cards, 0).sort()).toEqual([ids.scout!, ids.other!].sort());
  });

  it("changes nothing without the flag", () => {
    const { state, ctx } = scene(40, false);
    expect(optionalEnemies(state, ctx.cards, 0)).toHaveLength(2);
  });

  it("reads the threat an engagement check reads: a threat ceiling lowers it below the limit", () => {
    const { state, ids, ctx } = scene(30);
    const capped = { ...state, modifiers: [...state.modifiers, { instanceId: "seat:0", sourceId: "x", stat: "threatCeiling" as const, amount: 20, until: "endOfGame" as const }] };
    expect(optionalEnemies(capped, ctx.cards, 0).sort()).toEqual([ids.scout!, ids.other!].sort());
  });
});
