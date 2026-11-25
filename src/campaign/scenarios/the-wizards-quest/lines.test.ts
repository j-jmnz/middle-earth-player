// Rules: rr.guarded, rr.in-play-and-out-of-play, rr.explored, rr.cannot, rr.restricted (data/rules/entries.json); docs/scenarios/standalone-scenarios/the-wizards-quest.md (The Wizard's Quest, readings 9, 10 and 17).
// The lines a card-spec row cannot express (spec.test.ts holds the rest): what a played card is offered after a held card lies under its holder, a held card that comes back when its holder leaves play, a hero released when its guard leaves play.
import { describe, expect, it } from "vitest";

import { legalIntents } from "../../../rules/engine/legal.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { attachBlocked, restricted } from "../../../rules/interpret/restrictions.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { addModifier } from "../../../rules/core/keywords.ts";
import { healDamage } from "../../../rules/families/dreamchaser/heal-cap.ts";
import { fightEnemy, finish, idOf, opening, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { flagged, updateCard } from "../../../rules/core/state.ts";

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

describe("Necromancer's Pass revealed by the second seat", () => {
  it("51013:A:1 the first player's hand is the one kept and searched, whoever reveals it", () => {
    const made = table({ seats: 2, firstPlayer: 0, staging: ["51013"], hand: [{ code: "c1", seat: 0 }, { code: "c3", seat: 0 }, { code: "c2", seat: 0 }] });
    const asked: number[] = [];
    const pass = idOf(made.state, "51013");
    const held = resolveRecords(made.state, made.ctx, "51013", "whenRevealed", pass, (now) => {
      if (now.window?.kind !== "choose") return "";
      asked.push(now.window.seat);
      return now.window.options[0] ?? "";
    }, true, 1).state;
    const under = Object.values(held.cards).filter((card) => card.zone === "under");
    expect(asked).toEqual([0]);
    expect(under.map((card) => card.code)).toEqual(["c3"]);
    expect(held.seats[0]?.hand).toHaveLength(2);
    expect(held.seats[1]?.hand).toHaveLength(0);
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

describe("cannot have non-objective player card attachments", () => {
  it("51012:A:1 bars a player card attachment and lets an encounter card attach (as 51015:A:1 and 51034:A:1 do)", () => {
    for (const code of ["51012", "51015", "51034"]) {
      const made = table({ staging: [code] });
      const host = idOf(made.state, code);
      expect(attachBlocked(made.state, made.ctx, host, "attachment")).toBe(true);
      expect(attachBlocked(made.state, made.ctx, host, "51017")).toBe(false);
    }
  });
});

describe("effects of the encounter cards that a card-spec row cannot show", () => {
  it("51027:A:1 a character damaged by Evil Storm cannot be healed until the end of the phase", () => {
    const made = table({ committed: ["dh1"], deck: ["f0", "f0"] });
    const revealed = finish({ state: revealFromTop(made.state, made.ctx, "51027", []).state, steps: [] }, made.ctx).state;
    const hero = idOf(revealed, "dh1");
    expect(revealed.cards[hero]?.damage).toBe(1);
    expect(healDamage(revealed, hero, 1, made.ctx).healed).toBe(0);
    const other = idOf(revealed, "dh2");
    // Every damaged character holds the lasting effect, one damaged later too (docs/scenarios/standalone-scenarios/the-wizards-quest.md, The Wizard's Quest, reading 15).
    expect(healDamage(updateCard(revealed, other, { damage: 1 }), other, 1, made.ctx).healed).toBe(0);
  });

  it("51041:A:1 after a player optionally engages an enemy he deals 1 damage to a character he controls", () => {
    const made = table({ phase: "Encounter", staging: ["51041", "f3"], deck: [] });
    const engaged = finish(send(start(made.state), { type: "Engage", enemyId: idOf(made.state, "f3") }, made.ctx), made.ctx);
    const damage = ["dh1", "dh2"].reduce((sum, code) => sum + (engaged.state.cards[idOf(engaged.state, code)]?.damage ?? 0), 0);
    expect(damage).toBe(1);
  });

  it("51047:A:2 Shadow: an attacker engaged this round cannot take damage until the end of the round", () => {
    const tweak = (state: ScenarioState): ScenarioState => addModifier(state, idOf(state, "f3"), idOf(state, "f3"), "engagedThisRound", 1, "endOfRound");
    const fight = fightEnemy((layout: Layout) => table(layout), "51047", "f3", {}, { tweak });
    expect(flagged(fight.during, idOf(fight.during, "f3"), "cannotTakeDamage")).toBe(true);
    const plain = fightEnemy((layout: Layout) => table(layout), "51047", "f3", {});
    expect(flagged(plain.during, idOf(plain.during, "f3"), "cannotTakeDamage")).toBe(false);
  });
});

describe("Befouled Equipment", () => {
  it("51036:A:1 attaches to the character, ally or hero, with the most attachments that has no Befouled Equipment, a second copy to the next", () => {
    const made = table({ play: ["ally"], attached: [{ code: "attachment", to: "ally" }, { code: "attachment", to: "ally" }, { code: "attachment", to: "dh1" }], deck: ["f0", "f0"] });
    const ally = idOf(made.state, "ally");
    const first = finish({ state: revealFromTop(made.state, made.ctx, "51036", []).state, steps: [] }, made.ctx).state;
    const copy = Object.values(first.cards).find((card) => card.code === "51036");
    expect(copy?.host).toBe(ally);
    const second = finish({ state: revealFromTop(first, made.ctx, "51036", []).state, steps: [] }, made.ctx).state;
    const copies = Object.values(second.cards).filter((card) => card.code === "51036");
    expect(copies.map((card) => card.host).sort()).toEqual([ally, idOf(second, "dh1")].sort());
  });
});
