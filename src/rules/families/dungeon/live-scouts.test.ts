// Rules: rr.staging-area, faq.lasting-effects, rr.surge (data/rules/entries.json); ledger line 00013:A:1.
// RaiseStagingThreat `live: scoutEnemiesInPlay` on a table of The Massing at Osgiliath: the staging area's total Threat is raised for the phase by 1 for each Scout enemy in play, counted as it stands now.
import { describe, expect, it } from "vitest";

import { stagingThreat } from "../../quest/quest.ts";
import { spawn } from "../../core/zones.ts";
import { finish, resolveRecords, revealFromTop, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SNAGA = "00002";
const WOLVES = "00003";
const RUINS = "00011";
const PURSUIT = "00013";

describe("RaiseStagingThreat live Scouts (00013:A:1)", () => {
  it("00013:A:1 raises the total Threat by 1 for each Scout enemy in the staging area or engaged, and again as more arrive", () => {
    const made = tableFromLayout("the-massing-at-osgiliath", { seats: 2, staging: [SNAGA, WOLVES], engaged: [{ code: SNAGA, seat: 1 }] });
    const base = stagingThreat(made.state, made.cards);
    const run = resolveRecords(made.state, made.ctx, PURSUIT, "whenRevealed");
    expect(stagingThreat(run.state, made.cards)).toBe(base + 3);
    // Live (faq.lasting-effects): a Scout that arrives later this phase counts too.
    const more = spawn(run.state, WOLVES, { zone: "staging" }).state;
    expect(stagingThreat(more, made.cards)).toBe(stagingThreat(spawn(made.state, WOLVES, { zone: "staging" }).state, made.cards) + 4);
  });

  it("00013:A:1 gains surge when there are no Scout enemies in play, and not otherwise", () => {
    const none = tableFromLayout("the-massing-at-osgiliath", { deck: [RUINS] });
    const surged = finish({ state: revealFromTop(none.state, none.ctx, PURSUIT, []).state, steps: [] }, none.ctx);
    // The card under it was revealed (an empty deck then takes the discard pile back).
    expect(surged.state.staging.map((id) => surged.state.cards[id]?.code)).toEqual([RUINS]);
    const some = tableFromLayout("the-massing-at-osgiliath", { deck: [RUINS], staging: [SNAGA] });
    const kept = finish({ state: revealFromTop(some.state, some.ctx, PURSUIT, []).state, steps: [] }, some.ctx);
    expect(kept.state.staging.map((id) => kept.state.cards[id]?.code)).toEqual([SNAGA]);
    expect(kept.state.encounterDeck.map((id) => kept.state.cards[id]?.code)).toEqual([RUINS]);
    // A Scout engaged with another player is in play too.
    const engaged = tableFromLayout("the-massing-at-osgiliath", { seats: 2, deck: [RUINS], engaged: [{ code: SNAGA, seat: 1 }] });
    const held = finish({ state: revealFromTop(engaged.state, engaged.ctx, PURSUIT, []).state, steps: [] }, engaged.ctx);
    expect(held.state.staging).toHaveLength(0);
  });
});
