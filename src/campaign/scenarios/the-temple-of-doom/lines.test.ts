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
import { defenderBarredByEngagement } from "../../../rules/families/mordor/engage.ts";
import { playLimitBars } from "../../../rules/families/wilderland/rounds.ts";
import { lowerThreatByEffect } from "../../../rules/families/quest/threat.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { placeOnMainQuest, placeQuestProgress, stagingThreat } from "../../../rules/quest/quest.ts";
import { idOf, legalIntents, resolveRecords, send, tableFromLayout, where, type Layout } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";

const ID = "the-temple-of-doom";
const LEGACY = "21081";
const LORD = "21085";
const TRIBUTE = "21053";
const table = (layout: Layout, effects = EFFECTS) => tableFromLayout(ID, { seats: 1, stage: LEGACY, phase: "Quest", ...layout }, { effects });
const settled = (made: ReturnType<typeof table>, state: ScenarioState): ScenarioState => settle({ ...syncConstants(state, made.ctx), window: null, mode: "stopped" }, made.ctx, []);
const damageOf = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.damage ?? 0;
const progressOf = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.progress ?? 0;
// A line that holds with its records and with none (what stays unchanged): a plain test, beside the lineSpec checks that fail without the records.
const negative = (line: string, name: string, check: (effects: typeof EFFECTS) => void): void => it(`${line} ${name}`, () => check(EFFECTS));
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

describe("The enemies that engage by a constant line (21066:A:2, 21066:A:3, 21058:A:1, 21069:A:1)", () => {
  const KHAMUL = "21066";
  const GUARD = "21058";
  const ULCHOR = "21054";
  lineSpec("21066:A:2", "Khamûl engages the first player (the second seat when it is the first player)", (effects) => {
    const made = table({ seats: 2, firstPlayer: 1, staging: [KHAMUL] }, effects);
    const state = settled(made, made.state);
    expect(where(state, KHAMUL)).toBe("engaged");
    expect(state.cards[idOf(state, KHAMUL)]?.controller).toBe(1);
  });
  lineSpec("21066:A:2", "he is moved to the first player when he is engaged with another player", (effects) => {
    const made = table({ seats: 2, firstPlayer: 0, engaged: [{ code: KHAMUL, seat: 1 }] }, effects);
    const state = settled(made, made.state);
    expect(state.cards[idOf(state, KHAMUL)]?.controller).toBe(0);
  });
  lineSpec("21066:A:3", "only the engaged player declares defenders against him; the other player's characters cannot", (effects) => {
    const made = table({ seats: 2, engaged: [KHAMUL], phase: "Combat" }, effects);
    const state = settled(made, made.state);
    const enemy = idOf(state, KHAMUL);
    const attacking = { ...state, pendingAttack: { enemyId: enemy, defenderId: null, undefended: false } } as unknown as ScenarioState;
    const heroOf = (seat: number) => Object.values(state.cards).find((card) => card.zone === "heroes" && card.controller === seat)!.id;
    const reason = (id: string) => defenderBarredByEngagement(attacking, made.ctx.cards.get(state.cards[id]!.code)!, made.ctx.cards, id);
    expect(reason(heroOf(0))).toBeNull();
    const effectsFlag = flagged(state, enemy, "defendOnlyByEngaged") && flagged(state, enemy, "attackOnlyByEngaged");
    expect(effectsFlag).toBe(true);
    expect(reason(heroOf(1))).toMatch(/Only the engaged player/);
  });
  lineSpec("21058:A:1", "Ulchor's Guard engages the player Thane Ulchor is engaged with, and stays engaged when Ulchor leaves", (effects) => {
    const made = table({ seats: 2, staging: [GUARD], engaged: [{ code: ULCHOR, seat: 1 }] }, effects);
    const state = settled(made, made.state);
    expect(where(state, GUARD)).toBe("engaged");
    expect(state.cards[idOf(state, GUARD)]?.controller).toBe(1);
    const left = settled(made, moveCard(state, idOf(state, ULCHOR), { zone: "encounterDiscard" }));
    expect(left.cards[idOf(left, GUARD)]?.controller).toBe(1);
  });
  negative("21058:A:1", "with Ulchor in the staging area the Guard stays there", (effects) => {
    const made = table({ staging: [GUARD, ULCHOR] }, effects);
    expect(where(settled(made, made.state), GUARD)).toBe("staging");
  });
  lineSpec("21069:A:1", "the engagement the constant line makes is announced: the non-unique enemy cannot take damage until the end of the round", (effects) => {
    const made = table({ staging: [GUARD, "21069"], engaged: [ULCHOR] }, effects);
    const state = settled(made, made.state);
    expect(where(state, GUARD)).toBe("engaged");
    expect(flagged(state, idOf(state, GUARD), "cannotTakeDamage")).toBe(true);
  });
  negative("21069:A:1", "a unique enemy (Khamûl) that engages a player is not held", (effects) => {
    const made = table({ staging: [KHAMUL, "21069", "21020"] }, effects);
    const state = settled(made, made.state);
    expect(where(state, KHAMUL)).toBe("engaged");
    expect(flagged(state, idOf(state, KHAMUL), "cannotTakeDamage")).toBe(false);
    expect(flagged(state, idOf(state, "21020"), "cannotTakeDamage")).toBe(false);
  });
});

describe("Covered in Darkness (21070:A:2): a player's threat cannot be reduced by more than 1 each round by player card effects", () => {
  const lower = (made: ReturnType<typeof table>, state: ScenarioState, amount: number): ScenarioState => lowerThreatByEffect(state, 0, amount, idOf(state, "ally"), made.ctx, [], UNATTRIBUTED);
  lineSpec("21070:A:2", "a reduction by 3 by a player card lowers the threat by 1, and a second one in the round by none", (effects) => {
    const made = table({ staging: ["21070"], threat: [30, 30], play: ["ally"] }, effects);
    const state = settled(made, made.state);
    expect(lower(made, state, 3).seats[0]?.threat).toBe(29);
    expect(lower(made, lower(made, state, 3), 3).seats[0]?.threat).toBe(29);
  });
  lineSpec("21070:A:2", "each player has his own cap", (effects) => {
    const made = table({ seats: 2, staging: ["21070"], threat: [30, 30], play: ["ally"] }, effects);
    const state = settled(made, made.state);
    expect(lowerThreatByEffect(state, 1, 3, idOf(state, "ally"), made.ctx, [], UNATTRIBUTED).seats[1]?.threat).toBe(29);
  });
});

describe("The Forgotten Temple (21080:A:1, 21080:B:2): the stage 2 cards are shuffled under it and it advances to the topmost", () => {
  const STAGES = ["21081", "21083", "21084", "21085"];
  const setup = (effects: typeof EFFECTS, seed = 1) => {
    const made = table({ stage: "21080", phase: "Planning", seed }, effects);
    return { made, state: settled(made, resolveRecords(made.state, made.ctx, "21080", "setup", idOf(made.state, "21080")).state) };
  };
  lineSpec("21080:A:1", "Setup: the four stage 2 cards are shuffled and lie under stage 1, in the quest deck", (effects) => {
    const orders = [1, 2, 3, 4, 5, 6].map((seed) => {
      const { state } = setup(effects, seed);
      return state.questDeck.map((id) => state.cards[id]?.code);
    });
    for (const order of orders) expect([...order].sort()).toEqual(STAGES);
    // The seeds give different orders: a quest deck left as dealt (no shuffle) is the same each time.
    expect(new Set(orders.map((order) => order.join())).size).toBeGreaterThan(1);
  });
  lineSpec("21080:B:2", "at the end of the planning phase it gets 1 resource", (effects) => {
    const { made, state } = setup(effects);
    const stage = idOf(state, "21080");
    const done = resolveRecords(state, made.ctx, "21080", "forced", stage);
    expect(done.state.cards[stage]?.resources).toBe(1);
    expect(done.state.cards[done.state.questStage ?? ""]?.code).toBe("21080");
  });
  lineSpec("21080:B:2", "with 2 resources it is added to the victory display and the quest advances to the topmost stage 2, side A", (effects) => {
    const { made, state } = setup(effects);
    const stage = idOf(state, "21080");
    const top = state.cards[state.questDeck[0] ?? ""]?.code;
    const done = resolveRecords(updateCard(state, stage, { resources: 1 }), made.ctx, "21080", "forced", stage);
    expect(done.state.victory.map((id) => done.state.cards[id]?.code)).toEqual(["21080"]);
    expect(done.state.cards[done.state.questStage ?? ""]?.code).toBe(top);
    expect(STAGES).toContain(top);
    expect(done.state.cards[done.state.questStage ?? ""]?.face).not.toBe("down");
  });
});

describe("Narrow Opening (21062:A:1): each player cannot play more than 1 card each round while it is the active location", () => {
  const NARROW = "21062";
  const made = (effects: typeof EFFECTS, layout: Layout = {}) => table({ phase: "Planning", heroResources: 4, hand: ["ally", "ally", "event"], ...layout }, effects);
  const playable = (state: ScenarioState, ctx: ReturnType<typeof table>["ctx"], seat = 0): number => legalIntents({ ...state, activeSeat: seat }, ctx).filter((intent) => intent.type === "PlayCard").length;
  const play = (t: ReturnType<typeof table>, state: ScenarioState, cardId: string): ScenarioState => send({ state, steps: [] }, { type: "PlayCard", cardId, payments: [{ heroId: t.hero, amount: t.cards.get(state.cards[cardId]?.code ?? "")?.cost ?? 0 }] }, t.ctx).state;
  const firstCard = (t: ReturnType<typeof table>, state: ScenarioState): string => legalIntents(state, t.ctx).find((intent) => intent.type === "PlayCard")?.cardId ?? "";
  lineSpec("21062:A:1", "a player who played a card cannot play another this round, in this phase or the next", (effects) => {
    const t = made(effects, { active: NARROW });
    const state = syncConstants(t.state, t.ctx);
    expect(playable(state, t.ctx)).toBeGreaterThan(1);
    const played = play(t, state, firstCard(t, state));
    expect(playable(played, t.ctx)).toBe(0);
    expect(playable({ ...played, phase: "Quest" }, t.ctx)).toBe(0);
  });
  lineSpec("21062:A:1", "each player has his own count: the second player can still play his card", (effects) => {
    const t = made(effects, { active: NARROW, seats: 2 });
    const state = syncConstants(t.state, t.ctx);
    const played = play(t, state, firstCard(t, state));
    const mine = (played.seats[0]?.hand ?? [])[0] ?? "";
    const other = (played.seats[1]?.hand ?? [])[0] ?? "";
    expect(playLimitBars({ ...played, activeSeat: 0 }, mine, t.ctx, {})).toBe(true);
    expect(playLimitBars({ ...played, activeSeat: 1 }, other, t.ctx, {})).toBe(false);
  });
  negative("21062:A:1", "it holds only while it is the active location (in the staging area a player plays more than 1 card)", () => {
    const t = made(EFFECTS, { staging: [NARROW] });
    const state = syncConstants(t.state, t.ctx);
    const played = play(t, state, firstCard(t, state));
    expect(playable(played, t.ctx)).toBeGreaterThan(0);
  });
});

describe("The stage 2B discards (21083:B:1, 21084:B:1) and The Tower of Barad-dûr (21067:A:3)", () => {
  lineSpec("21083:B:1", "X cards are discarded from the encounter deck (1 more than the stages in the victory display) and 2 Threat is added for each different type", (effects) => {
    const made = table({ stage: "21083", victory: ["21080"], deck: ["21062", "21059", "21063", "21058"] }, effects);
    const before = stagingThreat(made.state, made.cards);
    const done = resolveRecords(made.state, made.ctx, "21083", "forced", idOf(made.state, "21083"));
    expect(done.state.encounterDeck.length).toBe(2);
    expect(stagingThreat(done.state, made.cards)).toBe(before + 4);
  });
  lineSpec("21083:B:1", "cards of one type add 2 once", (effects) => {
    const made = table({ stage: "21083", victory: ["21080"], deck: ["21062", "21063", "21059"] }, effects);
    const before = stagingThreat(made.state, made.cards);
    const done = resolveRecords(made.state, made.ctx, "21083", "forced", idOf(made.state, "21083"));
    expect(stagingThreat(done.state, made.cards)).toBe(before + 2);
  });
  lineSpec("21084:B:1", "each player discards the top X cards of his deck and each copy of them in his hand and in play", (effects) => {
    const made = table({ stage: "21084", victory: ["21080"], deckOf: ["ally", "event", "c2"], hand: ["ally", "event", "c2"], play: ["ally"] }, effects);
    const done = resolveRecords(made.state, made.ctx, "21084", "forced", idOf(made.state, "21084"));
    expect(done.state.seats[0]?.deck.length).toBe(1);
    expect(done.state.seats[0]?.hand.map((id) => done.state.cards[id]?.code)).toEqual(["c2"]);
    expect(where(done.state, "ally")).toBe("discard");
  });
  lineSpec("21067:A:3", "each player's threat elimination level is reduced by 5: a player at 45 is eliminated, a player at 44 is not", (effects) => {
    const made = table({ seats: 2, threat: [45, 44], staging: ["21067"] }, effects);
    const state = settled(made, made.state);
    expect(state.seats[0]?.eliminated).toBe(true);
    expect(state.seats[1]?.eliminated).toBeFalsy();
  });
});

describe("Thane Ulchor (21054:A:2): he can be engaged with exactly 4 quest stages in the victory display", () => {
  const STAGE_CODES = ["21080", "21081", "21083", "21084", "21085"];
  const engageable = (n: number): boolean => {
    const made = table({ stage: "21085", staging: ["21054"], victory: STAGE_CODES.slice(0, n) });
    return !flagged(settled(made, made.state), idOf(made.state, "21054"), "cannotBeEngaged");
  };
  negative("21054:A:2", "with 4 stages (X is 5) he can be engaged, with 3 or 5 he cannot", () => {
    expect([3, 4, 5].map(engageable)).toEqual([false, true, false]);
  });
  negative("21081:B:2", "with 3 quest stages in the victory display progress can be placed on the stage", () => {
    const made = table({ stage: LEGACY, victory: ["21080", "21083", "21084"] });
    expect(flagged(settled(made, made.state), idOf(made.state, LEGACY), "noProgressPlaced")).toBe(false);
  });
});
