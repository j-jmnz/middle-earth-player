// Rules: rr.immune, rr.search, rr.setup, rm.the-orcs-search (data/rules/entries.json); ledger lines 08122:A:1, 08126:A:1.
// What a card-spec row cannot show for Celebrimbor's Secret: the Ost-in-Edhil locations that are only search targets at Setup, and The Secret Chamber's immunity to player card effects.
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { placeDamage, playerCardEffectCanChoose } from "../../../rules/core/keywords.ts";
import { pickCandidates } from "../../../rules/interpret/pick.ts";
import { idOf, idsOf, resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "celebrimbors-secret";
const CHAMBER = "08126";
const OST_IN_EDHIL = ["08130", "08131", "08132", "08133"] as const;

describe("The Ost-in-Edhil locations at Setup (08122:A:1)", () => {
  it("08122:A:1 the four locations the staging pile lists are marked searched: search targets that count toward the encounter deck, not cards the Setup stages", () => {
    const cards = loadAnyScenario(SCENARIO).cards;
    for (const code of OST_IN_EDHIL) expect(cards.find((card) => card.code === code && card.pile === "staging")).toMatchObject({ searched: true });
  });

  it("08122:A:1 each player adds one different location from the encounter deck: with two players two of the four are staged and the other two stay in the deck", () => {
    const t = tableFromLayout(SCENARIO, { seats: 2, deck: [...OST_IN_EDHIL, "f0"] });
    const done = resolveRecords(t.state, t.ctx, "08122", "setup", t.state.questStage ?? "");
    const staged = done.state.staging.map((id) => done.state.cards[id]?.code).filter((code) => OST_IN_EDHIL.some((each) => each === code));
    expect(staged).toHaveLength(2);
    expect(new Set(staged).size).toBe(2);
    const left = done.state.encounterDeck.map((id) => done.state.cards[id]?.code).filter((code) => OST_IN_EDHIL.some((each) => each === code));
    expect(left).toHaveLength(2);
  });
});

describe("The Secret Chamber is immune to player card effects (08126:A:1)", () => {
  it("08126:A:1 a player card cannot choose it and its damage does nothing, while the game's own damage lands", () => {
    const t = tableFromLayout(SCENARIO, { staging: [CHAMBER], hand: ["filler"] });
    const chamber = idOf(t.state, CHAMBER);
    const filler = idsOf(t.state, "filler")[0] ?? "";
    expect(playerCardEffectCanChoose(t.ctx.cards.get(CHAMBER)!, t.state, chamber)).toBe(false);
    expect(pickCandidates(t.state, { type: "location", control: "any" }, 0, [], filler, t.ctx)).not.toContain(chamber);
    expect(placeDamage(t.state, chamber, 3, t.ctx.cards, [], "player", ruleCause("rr.damage")).cards[chamber]?.damage).toBe(0);
    expect(placeDamage(t.state, chamber, 3, t.ctx.cards, [], "framework", ruleCause("rr.damage")).cards[chamber]?.damage).toBe(3);
  });
});
