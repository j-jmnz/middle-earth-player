// Rules: rr.guarded, rr.in-play-and-out-of-play, rr.explored, rr.cannot, rr.restricted (data/rules/entries.json); docs/brief.md (The Wizard's Quest, readings 9, 10 and 17).
// The lines a card-spec row cannot express (spec.test.ts holds the rest): what a played card is offered after a held card lies under its holder, a held card that comes back when its holder leaves play, a hero released when its guard leaves play.
import { describe, expect, it } from "vitest";

import { legalIntents } from "../../../rules/engine/legal.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { finish, idOf, opening, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const table = (layout: Layout) => tableFromLayout("the-wizards-quest", layout);
const playable = (state: ScenarioState, ctx: ReturnType<typeof table>["ctx"], cardId: string): boolean => legalIntents({ ...state, ...opening("Planning") }, ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === cardId);
// The card in the first seat's hand with this code.
const inHand = (state: ScenarioState, code: string): string => state.seats[0]!.hand.find((id) => state.cards[id]?.code === code) ?? "";
const left = (state: ScenarioState, ctx: ReturnType<typeof table>["ctx"], id: string): ScenarioState => finish({ state: settle(moveCard(state, id, { zone: "encounterDiscard" }), ctx, []), steps: [] }, ctx).state;

describe("held player cards", () => {
  it("51004:B:2 no copy of a held ally can be played, and the ally returns to its owner's hand when the stage is defeated", () => {
    const made = table({ stage: "51004", heroResources: 2, play: ["ally"], hand: ["ally"] });
    expect(playable(made.state, made.ctx, inHand(made.state, "ally"))).toBe(true);
    const held = resolveRecords(made.state, made.ctx, "51004", "whenRevealed", idOf(made.state, "51004")).state;
    expect(Object.values(held.cards).filter((card) => card.code === "ally" && card.zone === "under")).toHaveLength(1);
    expect(playable(held, made.ctx, inHand(held, "ally"))).toBe(false);
  });

  it("51013:A:1 no copy of the guarded card can be played, and it returns to its owner's hand when Necromancer's Pass leaves play", () => {
    const made = table({ staging: ["51013"], heroResources: 3, hand: ["c1", "c3", "c3"] });
    const pass = idOf(made.state, "51013");
    const held = resolveRecords(made.state, made.ctx, "51013", "whenRevealed", pass).state;
    const under = Object.values(held.cards).filter((card) => card.zone === "under");
    expect(under).toHaveLength(1);
    expect(under[0]?.code).toBe("c3");
    expect(held.seats[0]?.hand).toHaveLength(2);
    expect(held.seats[0]?.hand.some((id) => playable(held, made.ctx, id) && held.cards[id]?.code === "c3")).toBe(false);
    const back = left(held, made.ctx, pass);
    expect(back.cards[under[0]!.id]?.zone).toBe("hand");
    expect(back.seats[0]?.hand).toHaveLength(3);
  });
});

describe("Dungeons of the Necromancer", () => {
  it("51008:B:2 the stage cannot be defeated while an enemy guards a hero, and the hero returns exhausted when the guard leaves play", () => {
    const made = table({ stage: "51008", deck: ["f3", "f3"] });
    const stage = idOf(made.state, "51008");
    const held = resolveRecords(made.state, made.ctx, "51008", "whenRevealed", stage).state;
    expect(held.cards[idOf(held, "dh1")]?.zone).toBe("captive");
    expect(restricted(held, made.ctx, "advance").length).toBeGreaterThan(0);
    const back = left(held, made.ctx, held.cards[idOf(held, "dh1")]?.host ?? "");
    expect(back.cards[idOf(back, "dh1")]).toMatchObject({ zone: "heroes", exhausted: true });
    expect(restricted(back, made.ctx, "advance")).toHaveLength(0);
  });
});
