// Rules: rr.forced, rr.reveal, rr.engaged, rr.victory, rr.discard-pile-and-victory-display, rr.threat-elimination-level, rr.lasting-effects, rr.cannot, rr.damage, rr.active-location, rr.quest-advancement, rr.first-player, rr.setup, rr.mulligan, rr.draw, rr.progress, vom.power-of-mordor-deck-the-temple-of-doom, vom.quest-stages-vs-side-quests (data/rules/entries.json).
// What a spec row cannot show (the Power of Mordor deck, the cards under the dials, a cap over a round, the lasting effects of 21081:B:1, who engages and defends, the Setup and the stage advance, a play limit over a round, a location that keeps its progress). Each title starts with its line id.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; a table opens on the quest phase on the stage `table` names.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { UNATTRIBUTED } from "../../../rules/core/cause.ts";
import { placeDamage } from "../../../rules/core/damage.ts";
import { flagged, updateCard, withMode } from "../../../rules/core/state.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { defeatSideQuest } from "../../../rules/families/sidequests/quest.ts";
import { drawMany, drawOpeningHand } from "../../../rules/interpret/interpret.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { placeOnMainQuest, placeQuestProgress } from "../../../rules/quest/quest.ts";
import { idOf, resolveRecords, tableFromLayout, where, type Layout } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";

const ID = "the-temple-of-doom";
const LEGACY = "21081";
const LORD = "21085";
const TRIBUTE = "21053";
const table = (layout: Layout, effects = EFFECTS) => tableFromLayout(ID, { seats: 1, stage: LEGACY, phase: "Quest", ...layout }, { effects });
const settled = (made: ReturnType<typeof table>, state: ScenarioState): ScenarioState => settle({ ...syncConstants(state, made.ctx), window: null, mode: "stopped" }, made.ctx, []);
const damageOf = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.damage ?? 0;
const progressOf = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.progress ?? 0;
// Progress placed as a card effect does, the stage never advancing: what the stage holds afterwards is what it took.
const place = (made: ReturnType<typeof table>, state: ScenarioState, amount: number): ScenarioState => placeQuestProgress(state, amount, made.ctx.cards, [], () => false);

describe("Tribute to Mordor (21053:A:1) and the Power of Mordor deck", () => {
  const POWER = ["21069", "21070", "21068"];
  lineSpec("21053:A:1", "the end of the round places 1 token; with 4 or more the 4 come off first and the top card of the deck is revealed", (effects) => {
    const made = table({ staging: [{ code: TRIBUTE, damage: 3 }], piles: { powerOfMordorDeck: POWER } }, effects);
    const done = resolveRecords(made.state, made.ctx, TRIBUTE, "forced", idOf(made.state, TRIBUTE));
    expect(damageOf(done.state, TRIBUTE)).toBe(0);
    expect(where(done.state, "21069")).toBe("staging");
    expect(done.state.piles?.powerOfMordorDeck?.length).toBe(2);
  });
  lineSpec("21053:A:1", "tokens above 4 stay after the 4 come off (6 and 1 more: 3 are left)", (effects) => {
    const made = table({ staging: [{ code: TRIBUTE, damage: 6 }], piles: { powerOfMordorDeck: POWER } }, effects);
    const done = resolveRecords(made.state, made.ctx, TRIBUTE, "forced", idOf(made.state, TRIBUTE));
    expect(damageOf(done.state, TRIBUTE)).toBe(3);
  });
  lineSpec("21053:A:1", "with fewer than 4 tokens only the token is placed and no card is revealed", (effects) => {
    const made = table({ staging: [{ code: TRIBUTE, damage: 1 }], piles: { powerOfMordorDeck: POWER } }, effects);
    const done = resolveRecords(made.state, made.ctx, TRIBUTE, "forced", idOf(made.state, TRIBUTE));
    expect(damageOf(done.state, TRIBUTE)).toBe(2);
    expect(done.state.piles?.powerOfMordorDeck?.length).toBe(3);
    expect(done.state.lost).toBeFalsy();
  });
  lineSpec("21053:A:1", "with no card left in the Power of Mordor deck the players lose the game", (effects) => {
    const made = table({ staging: [{ code: TRIBUTE, damage: 3 }], piles: { powerOfMordorDeck: [] } }, effects);
    const done = resolveRecords(made.state, made.ctx, TRIBUTE, "forced", idOf(made.state, TRIBUTE));
    expect(done.state.lost).toBe(true);
  });
  it("21053:A:1 a revealed card of the deck that leaves play goes to the encounter discard pile, never back to the deck", () => {
    const made = table({ staging: [{ code: TRIBUTE, damage: 3 }], piles: { powerOfMordorDeck: ["21066", "21070"] } });
    const revealed = resolveRecords(made.state, made.ctx, TRIBUTE, "forced", idOf(made.state, TRIBUTE)).state;
    const khamul = idOf(revealed, "21066");
    const dead = settle(placeDamage(revealed, khamul, 20, made.ctx.cards, [], "framework", UNATTRIBUTED), made.ctx, []);
    expect(where(dead, "21066")).toBe("encounterDiscard");
    expect(dead.piles?.powerOfMordorDeck?.map((id) => dead.cards[id]?.code)).toEqual(["21070"]);
  });
  lineSpec("21053:A:2", "when the side quest is defeated the players win; it cannot be the current quest while Ulchor has hit points left", (effects) => {
    const made = table({ staging: [TRIBUTE, "21054"] }, effects);
    const tribute = idOf(made.state, TRIBUTE);
    expect(flagged(settled(made, made.state), tribute, "cannotBeCurrentQuest")).toBe(true);
    const spent = settled(made, updateCard(made.state, idOf(made.state, "21054"), { damage: 40 }));
    expect(flagged(spent, tribute, "cannotBeCurrentQuest")).toBe(false);
    const defeated = defeatSideQuest(updateCard(made.state, tribute, { progress: 8 }), tribute, made.ctx, []);
    const won = resolveRecords(settle({ ...defeated, window: null, mode: "stopped" }, made.ctx, []), made.ctx, TRIBUTE, "forced", tribute);
    expect(won.state.stageCleared).toBe(true);
  });
});

describe("The Lord of Middle-earth (21085:B:2): the cap is on this stage only", () => {
  const begin = (effects: typeof EFFECTS, hand: readonly string[], extra: Layout = {}) => {
    const made = table({ stage: LORD, hand, ...extra }, effects);
    const stage = idOf(made.state, LORD);
    const done = resolveRecords(made.state, made.ctx, LORD, "forced", stage);
    return { made, state: done.state };
  };
  lineSpec("21085:B:2", "X is the printed cost of the card discarded: no more than X progress goes on the stage this round", (effects) => {
    const { made, state } = begin(effects, ["c3"]);
    expect(progressOf(place(made, state, 5), LORD)).toBe(3);
  });
  lineSpec("21085:B:2", "the progress placed in two steps counts together against the cap", (effects) => {
    const { made, state } = begin(effects, ["c3"]);
    expect(progressOf(place(made, place(made, state, 2), 2), LORD)).toBe(3);
  });
  lineSpec("21085:B:2", "with X = 0 (a card of no cost) no progress can be placed on the stage", (effects) => {
    const { made, state } = begin(effects, ["c0"]);
    expect(progressOf(place(made, state, 4), LORD)).toBe(0);
  });
  lineSpec("21085:B:2", "a side quest that is the current quest is not capped, only the stage is", (effects) => {
    const { made, state } = begin(effects, ["c1"], { staging: ["21065"] });
    const quest = idOf(state, "21065");
    const current = { ...state, modifiers: [...state.modifiers, { instanceId: quest, sourceId: quest, stat: "currentQuest" as const, amount: 1, until: "endOfPhase" as const }] };
    const after = place(made, current, 5);
    expect(progressOf(after, "21065")).toBeGreaterThan(1);
    // The main quest card takes progress while the side quest is the current quest (an effect that adds progress to it): the stage's own cap holds.
    expect(progressOf(placeOnMainQuest(after, 5, made.ctx.cards, [], () => false), LORD)).toBe(1);
  });
});

describe("The Legacy of Mordor (21081:B:1): the hero cannot ready or be healed until the refresh phase begins", () => {
  const begun = (effects: typeof EFFECTS, layout: Layout = {}) => {
    const made = table({ stage: LEGACY, ...layout }, effects);
    return { made, state: resolveRecords(made.state, made.ctx, LEGACY, "forced", idOf(made.state, LEGACY)).state };
  };
  lineSpec("21081:B:1", "each player takes 1 damage on a hero he controls, which is exhausted and cannot ready or be healed", (effects) => {
    const { state } = begun(effects, { seats: 2 });
    const heroes = Object.values(state.cards).filter((card) => card.zone === "heroes" && card.damage === 1);
    expect(heroes.map((card) => card.controller).sort()).toEqual([0, 1]);
    for (const hero of heroes) {
      expect(hero.exhausted).toBe(true);
      expect(flagged(state, hero.id, "cannotReady")).toBe(true);
      expect(flagged(state, hero.id, "cannotBeHealed")).toBe(true);
    }
  });
  lineSpec("21081:B:1", "the effects hold through the combat phase, up to its end, and are gone when the refresh phase begins", (effects) => {
    const { state } = begun(effects);
    const hero = Object.values(state.cards).find((card) => card.zone === "heroes" && card.damage === 1)?.id ?? "none";
    const inCombat = withMode({ ...state, phase: "Combat", mode: "combatActions" }, "playerAttacks");
    expect(flagged(inCombat, hero, "cannotReady") && flagged(inCombat, hero, "cannotBeHealed")).toBe(true);
    const refresh = withMode({ ...state, phase: "Combat", mode: "playerAttacks" }, "refresh");
    expect(flagged(refresh, hero, "cannotReady") || flagged(refresh, hero, "cannotBeHealed")).toBe(false);
  });
});

describe("Lost in the Dark (21065:A:1, 21065:A:2): the cards under the threat dials", () => {
  const LOST = "21065";
  const deckOf = Array.from({ length: 12 }, (_, i) => ({ code: i % 2 === 0 ? "ally" : "event", seat: 0 }));
  const underOf = (state: ScenarioState): number => Object.values(state.cards).filter((card) => card.zone === "under" && card.owner === 0).length;
  lineSpec("21065:A:1", "When Revealed: each player puts the top 10 cards of his deck facedown under his threat dial", (effects) => {
    const made = table({ deckOf, hand: ["ally"] }, effects);
    const done = resolveRecords(made.state, made.ctx, LOST, "whenRevealed");
    expect(underOf(done.state)).toBe(10);
    expect(done.state.seats[0]?.deck.length).toBe(2);
    expect(done.state.seats[0]?.hand.length).toBe(1);
  });
  lineSpec("21065:A:1", "two players each put 10 of their own cards under their dials", (effects) => {
    const both = [...deckOf, ...deckOf.map((card) => ({ ...card, seat: 1 }))];
    const made = table({ seats: 2, deckOf: both }, effects);
    const done = resolveRecords(made.state, made.ctx, LOST, "whenRevealed");
    const under = Object.values(done.state.cards).filter((card) => card.zone === "under");
    expect(under.filter((card) => card.owner === 0).length).toBe(10);
    expect(under.filter((card) => card.owner === 1).length).toBe(10);
  });
  lineSpec("21065:A:1", "When this stage is defeated each player shuffles the cards under his dial back into his deck", (effects) => {
    const made = table({ deckOf, staging: [LOST] }, effects);
    const quest = idOf(made.state, LOST);
    const held = resolveRecords(made.state, made.ctx, LOST, "whenRevealed", quest).state;
    expect(underOf(held)).toBe(10);
    const stays = settled(made, moveCard(held, quest, { zone: "encounterDiscard" }));
    expect(underOf(stays)).toBe(10);
    const defeated = settled(made, moveCard(held, quest, { zone: "victory" }));
    expect(underOf(defeated)).toBe(0);
    expect(defeated.seats[0]?.deck.length).toBe(12);
  });
  lineSpec("21065:A:2", "Forced: after a player raises his threat he discards the top card from under his dial", (effects) => {
    const made = table({ deckOf, staging: [LOST] }, effects);
    const quest = idOf(made.state, LOST);
    const held = resolveRecords(made.state, made.ctx, LOST, "whenRevealed", quest).state;
    const after = resolveRecords(held, made.ctx, LOST, "forced", quest).state;
    expect(underOf(after)).toBe(9);
    expect(after.seats[0]?.discard.length).toBe(1);
  });
});

describe("Under the Watchful Eye (21068:A:2): the opening hand and the mulligan do not count", () => {
  it("21068:A:2 the opening hand drawn at Setup raises no threat when the card is revealed later", () => {
    const made = table({ deckOf: Array.from({ length: 8 }, () => ({ code: "ally", seat: 0 })), phase: "Planning" });
    const hand = drawOpeningHand(made.state, 0, [], made.ctx);
    expect(hand.seats[0]?.hand.length).toBe(6);
    const eye = resolveRecords(hand, made.ctx, "21068", "forced");
    expect(eye.state.seats[0]?.threat).toBe(made.state.seats[0]?.threat);
  });
  lineSpec("21068:A:2", "a draw in the round after the card is in play raises the drawing player's threat by 1, whatever number he drew", (effects) => {
    const made = table({ deckOf: Array.from({ length: 8 }, () => ({ code: "ally", seat: 0 })), staging: ["21068"], phase: "Planning" }, effects);
    const drawn = drawMany(made.state, 0, 2, [], UNATTRIBUTED, made.ctx);
    const done = settled(made, drawn);
    expect(done.seats[0]?.threat).toBe((made.state.seats[0]?.threat ?? 0) + 1);
  });
});
