// Rules: rr.guarded, dwd.ally-objective-arwen-road-to-rivendell (data/rules/entries.json); docs/design-system-table.md, Cards, "Road to Rivendell". The Table step of Ambush in the Night (901402:B:1): Arwen, guarded by Goblin Gate, is a held card with no controller drawn
// under Goblin Gate in its zone, in the staging area as the guarded pair and under the active location when it is active, and the active Goblin Gate's quest points read live (901402:B:2).
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { idOf, resolveRecords, start, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { tableLayout, type CardSlot, type LayoutViews, type PileViews } from "../layout/layout.ts";
import { PILES, TABLE_ZONES, pileSelector, secondPilesOf, zoneSelector } from "../store/selectors.ts";
import { zoneFactsOf } from "../store/zone-facts.ts";

function guarded(active: boolean, extra: Layout = {}) {
  const made = tableFromLayout("road-to-rivendell", { stage: "901402", side: "B", play: ["04041"], ...(active ? { active: "04043" } : { staging: ["04043"] }), ...extra }, { effects: EFFECTS });
  const run = resolveRecords(start(made.state).state, made.ctx, "901402", "whenRevealed", idOf(made.state, "901402"));
  const state: ScenarioState = run.state;
  const facts = zoneFactsOf(made.ctx.cards);
  const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, 0, facts)(state)])) as unknown as LayoutViews;
  const piles = Object.fromEntries([...PILES, ...secondPilesOf(state)].map((pile) => [pile, pileSelector(pile, 0)(state)])) as unknown as PileViews;
  return { state, views, piles, ctx: made.ctx };
}

describe("901402:B:1 Arwen under Goblin Gate", () => {
  it("901402:B:1 draws her as the guarded pair in the staging area while Goblin Gate waits there, with nobody controlling her", () => {
    const { views, state } = guarded(false);
    expect(views.staging.entries.map((entry) => entry.card.code)).toEqual(["04041", "04043"]);
    expect(views.staging.entries[0]?.card.controller).toBeNull();
    expect(views.activeLocation.entries).toHaveLength(0);
    expect(state.seats[0]?.play).not.toContain(idOf(state, "04041"));
  });

  it("901402:B:1 draws her under Goblin Gate in the active location's zone, and no longer in the staging area", () => {
    const { views, piles } = guarded(true);
    expect(views.staging.entries.map((entry) => entry.card.code)).toEqual([]);
    const gate = views.activeLocation.entries[0];
    expect(gate?.card.code).toBe("04043");
    expect(gate?.attached.map((card) => card.code)).toEqual(["04041"]);
    expect(gate?.attached[0]?.controller).toBeNull();
    const slots = tableLayout(844, 390, views, piles, { stacks: true }).slots;
    const peek = slots.find((slot) => slot.kind === "attachment" && slot.zone === "activeLocation");
    const host = slots.find((slot): slot is CardSlot => slot.kind === "card" && slot.zone === "activeLocation");
    expect(peek).toBeDefined();
    expect(host?.code).toBe("04043");
  });

  it("901402:B:2 reads Goblin Gate's quest points live: 4 printed and 1 for each enemy engaged with a player", () => {
    const { state, ctx } = guarded(true, { engaged: ["04049", "04050"] });
    expect(modifiedStat(state, state.cards[idOf(state, "04043")]!, "questPoints", ctx.cards)).toBe(6);
  });
});
