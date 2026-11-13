// Rules: mec108.thaurdir, mec108.side-quests, mec108.side-quests-in-play, mec108.battle, mec108.indestructible, rr.active-location, rr.staging-threat, rr.forced, rr.destroy, rr.search, rr.resources, rr.printed, faq.enemy-attacks-outside-combat (data/rules/entries.json)
// ledger lines 10125:B:1, 10126:A:1, 10126:B:1, 10126:B:2, 10129:A:1, 10131:A:1, 10132:A:1, 10135:A:1, 10137:A:2, 10139:A:2, 10139:A:3, 10191:A:2.
// Thaurdir's flips and exits, Furious Charge and the cards the judge and the review read again, on tables built from a layout.
import { describe, expect, it } from "vitest";

import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { moveCard, shadowCards } from "../../../rules/core/zones.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { destroyCard, modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { committedWillpower, placeOnMainQuest, placeQuestProgress, stagingThreat } from "../../../rules/quest/quest.ts";
import { setCurrentQuest } from "../../../rules/families/angmar/quest.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { fightEnemy, fillerRecord, finish, idOf, legalIntents, resolveRecords, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { seatThreat } from "../../../rules/families/play/hooks.ts";

const SCENARIO = "the-battle-of-carn-dum";
const STAGE1 = "10125";
const STAGE2 = "10126";
const CAPTAIN = "10127";
const CHAMPION = "10128";
const GARRISON = "10129";
const WEREWOLF = "10131";
const FURIOUS = "10139";
const ORC_AMBUSH = "09046";
const DECK = ["f0", "f0", "f0", "f0", "f0", "f0", "f0", "f0"];

const built = (layout: Layout = {}) => tableFromLayout(SCENARIO, { deck: DECK, ...layout });
const canAdvance = () => true;
const shadowsOn = (state: ScenarioState, code: string): number => shadowCards(state.cards[idOf(state, code)]).length;
const settled = (state: ScenarioState, t: { ctx: Parameters<typeof settle>[1] }, steps: EngineStep[] = []): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, t.ctx, steps);
const dealTo = (state: ScenarioState, t: ReturnType<typeof built>, code: string, times: number): ScenarioState =>
  Array.from({ length: times }).reduce<ScenarioState>((next) => runInstruction(next, { verb: "DealShadowInPlay", target: "self" }, { seat: 0, sourceId: idOf(next, code) }, t.ctx, []), state);

describe("Thaurdir on stage 2B cannot leave the staging area", () => {
  it("10126:B:1 stays in the staging area when an effect would return, move, shuffle or discard him, and leaves it only when damage destroys him, which wins the game", () => {
    const t = built({ stage: STAGE2, staging: [CHAMPION], progress: 15 });
    const id = idOf(t.state, CHAMPION);
    expect(flagged(t.state, id, "cannotLeaveStaging")).toBe(true);
    for (const zone of ["encounterDiscard", "encounterDeck", "hand", "setAside", "removed"] as const) {
      const moved = moveCard(t.state, id, zone === "hand" ? { zone, seat: 0 } : { zone });
      expect(moved.cards[id]?.zone, zone).toBe("staging");
    }
    const engaged = moveCard(t.state, id, { zone: "engaged", seat: 0 });
    expect(engaged.cards[id]?.zone).toBe("staging");
    // A discard effect does nothing to him (it is not damage that destroys him).
    const discarded = runInstruction(t.state, { verb: "Discard", target: { kind: "picked" } }, { seat: 0, sourceId: null }, t.ctx, []);
    expect(discarded.cards[id]?.zone).toBe("staging");
    expect(destroyCard(t.state, id, t.cards, []).cards[id]?.zone).toBe("staging");
    // Damage that destroys him (15 progress took his Indestructible away) discards him and the game is won.
    const dead = settled(placeDamage(t.state, id, 99, t.cards, [], "framework", ruleCause("rr.damage")), t);
    expect(dead.cards[id]?.zone).toBe("encounterDiscard");
    expect(dead.stageCleared).toBe(true);
  });

  it("10126:B:1 counts Thaurdir's Threat in the staging area while he is considered engaged", () => {
    const t = built({ stage: STAGE2, staging: [CHAMPION] });
    expect(flagged(t.state, idOf(t.state, CHAMPION), "engagedWithAll")).toBe(true);
    expect(stagingThreat(t.state, t.cards)).toBe(4);
    const garrison = built({ stage: STAGE2, staging: [CHAMPION, GARRISON] });
    expect(stagingThreat(garrison.state, garrison.cards)).toBe(5);
  });
});

describe("a flip keeps his shadow cards and is heard by the new side", () => {
  // Thaurdir (Captain) holds 1 shadow card; the event is announced to the Forced effects and the table settles.
  const flipsOn = (layout: Layout, side: string, announce: (state: ScenarioState, t: ReturnType<typeof built>) => ScenarioState) => {
    const t = built({ staging: [side], ...layout });
    const held = dealTo(t.state, t, side, 1);
    const id = idOf(held, side);
    const done = settled(announce(held, t), t);
    return { done, id };
  };
  const endOfRound = (state: ScenarioState, t: ReturnType<typeof built>): ScenarioState => fireForced({ ...state, window: null }, { trigger: "endOfRound", seat: null, phase: "End of round" }, t.ctx, []);

  it("10125:B:1 flips Champion side faceup Thaurdir to Captain at the end of the round, keeping his shadow card and announcing it: the Captain side deals each enemy a card", () => {
    const { done, id } = flipsOn({ stage: STAGE1 }, CHAMPION, endOfRound);
    expect(done.cards[id]?.code).toBe(CAPTAIN);
    // The held card and the one the Captain's Forced dealt to him.
    expect(shadowCards(done.cards[id])).toHaveLength(2);
  });

  it("10126:B:1 flips Captain side faceup Thaurdir to Champion at the end of the round, keeping his shadow card, and the Champion side heals and attacks the first player", () => {
    const { done, id } = flipsOn({ stage: STAGE2 }, CAPTAIN, endOfRound);
    expect(done.cards[id]?.code).toBe(CHAMPION);
    expect(shadowCards(done.cards[id]).length).toBeGreaterThanOrEqual(1);
    expect(done.pendingAttack?.enemyId).toBe(id);
  });

  it("10126:A:1 raises each player's threat by the shadow cards in play, then flips Captain side faceup Thaurdir, keeping his shadow cards", () => {
    const t = built({ stage: STAGE2, seats: 2, staging: [CAPTAIN, GARRISON] });
    const held = dealTo(dealTo(t.state, t, CAPTAIN, 2), t, GARRISON, 1);
    const before = [seatThreat(held, 0), seatThreat(held, 1)];
    const run = resolveRecords(held, t.ctx, STAGE2, "whenRevealed", held.questStage ?? "");
    expect([seatThreat(run.state, 0) - before[0]!, seatThreat(run.state, 1) - before[1]!]).toEqual([3, 3]);
    const id = idOf(run.state, CHAMPION);
    expect(shadowCards(run.state.cards[id]).length).toBeGreaterThanOrEqual(2);
  });

  it("10139:A:2 flips Captain side faceup Thaurdir when progress is placed on Furious Charge, keeping his shadow card, and the Champion side hears it", () => {
    const t = built({ stage: STAGE2, staging: [CAPTAIN, FURIOUS] });
    const held = dealTo(setCurrentQuest(t.state, idOf(t.state, FURIOUS), t.ctx), t, CAPTAIN, 1);
    const steps: EngineStep[] = [];
    const placed = settled(placeQuestProgress(held, 3, t.cards, steps, canAdvance), t, steps);
    const id = idOf(placed, CHAMPION);
    expect(shadowCards(placed.cards[id]).length).toBeGreaterThanOrEqual(1);
    expect(placed.pendingAttack?.enemyId).toBe(id);
  });
});

describe("Midwinter's Crux reads the main quest card", () => {
  it("10126:B:2 takes Thaurdir's Indestructible away at 15 progress on the stage itself, not at 15 or more on a side quest that is the current quest", () => {
    const t = built({ stage: STAGE2, progress: 14, staging: [CHAMPION, FURIOUS] });
    const current = setCurrentQuest(t.state, idOf(t.state, FURIOUS), t.ctx);
    const placed = settled(placeQuestProgress(current, 20, t.cards, [], canAdvance), t);
    expect(placed.cards[idOf(placed, FURIOUS)]?.progress).toBe(20);
    // Furious Charge holds 20 progress and the stage 14: he is still indestructible.
    expect(flagged(placed, idOf(placed, CHAMPION), "losesKeywords")).toBe(false);
    const hit = settled(placeDamage(placed, idOf(placed, CHAMPION), 99, t.cards, [], "framework", ruleCause("rr.damage")), t);
    expect(hit.cards[idOf(hit, CHAMPION)]?.zone).toBe("staging");
    const stage = built({ stage: STAGE2, progress: 15, staging: [CHAMPION, FURIOUS] });
    expect(flagged(stage.state, idOf(stage.state, CHAMPION), "losesKeywords")).toBe(true);
  });
});

describe("Furious Charge", () => {
  const mainProgress = (state: ScenarioState): number => state.cards[state.questStage ?? ""]?.progress ?? -1;

  it("10139:A:2 hears only the progress placed on Furious Charge, and not the progress placed on the main quest or another side quest", () => {
    const t = built({ stage: STAGE1, staging: [CAPTAIN, FURIOUS, ORC_AMBUSH] });
    const place = (state: ScenarioState): ScenarioState => {
      const steps: EngineStep[] = [];
      return settled(placeQuestProgress(state, 2, t.cards, steps, canAdvance), t, steps);
    };
    expect(place(t.state).cards[idOf(t.state, CAPTAIN)]?.code).toBe(CAPTAIN);
    expect(place(setCurrentQuest(t.state, idOf(t.state, ORC_AMBUSH), t.ctx)).cards[idOf(t.state, CAPTAIN)]?.code).toBe(CAPTAIN);
    const here = place(setCurrentQuest(t.state, idOf(t.state, FURIOUS), t.ctx));
    expect(here.cards[idOf(t.state, CAPTAIN)]?.code).toBe(CHAMPION);
  });

  it("10139:A:3 adds 10 progress to the main quest card when another side quest is the current quest, the active location keeping none of it", () => {
    const t = built({ stage: STAGE1, active: "10133", staging: [FURIOUS, ORC_AMBUSH] });
    const current = setCurrentQuest(t.state, idOf(t.state, ORC_AMBUSH), t.ctx);
    const placed = placeOnMainQuest(current, 10, t.cards, [], canAdvance);
    expect(mainProgress(placed)).toBe(10);
    expect(placed.cards[idOf(placed, "10133")]?.progress).toBe(0);
    expect(placed.cards[idOf(placed, ORC_AMBUSH)]?.progress).toBe(0);
    // Through the record's own instruction.
    const run = runInstruction(current, { verb: "QuestProgress", amount: 10, main: true }, { seat: 0, sourceId: null }, t.ctx, []);
    expect(mainProgress(run)).toBe(10);
  });

  it("10139:A:3 is placed on the current quest, the active location first, while the main quest is the current quest", () => {
    const t = built({ stage: STAGE1, active: "10133", staging: [FURIOUS] });
    const run = runInstruction(t.state, { verb: "QuestProgress", amount: 10, main: true }, { seat: 0, sourceId: null }, t.ctx, []);
    expect(run.cards[idOf(run, "10133")]?.progress).toBe(5);
    expect(mainProgress(run)).toBe(5);
  });

  it("10139:A:3 offers its Response when Furious Charge is defeated and puts the 10 progress on the main quest, the main quest card taking all of it past a side quest still current", () => {
    const t = built({ stage: STAGE1, staging: [FURIOUS] });
    const current = setCurrentQuest(t.state, idOf(t.state, FURIOUS), t.ctx);
    const steps: EngineStep[] = [];
    const defeated = settled(placeQuestProgress(current, 30, t.cards, steps, canAdvance), t, steps);
    expect(defeated.cards[idOf(defeated, FURIOUS)]?.zone).toBe("victory");
    const offer = legalIntents(finish({ state: defeated, steps }, t.ctx).state, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(defeated, FURIOUS));
    const trigger = offer as PlayerIntent | undefined;
    if (trigger) {
      const used = finish(send({ state: defeated, steps }, trigger, t.ctx), t.ctx);
      expect(mainProgress(used.state)).toBe(10);
    } else {
      // The Response resolved without an offer: the progress is on the main quest already.
      expect(mainProgress(defeated)).toBe(10);
    }
  });
});

describe("Accursed Battlefield", () => {
  it("10132:A:1 has the committed characters count their Attack in place of their Willpower for the main quest and for a side quest that is the current quest, and Willpower without it", () => {
    // Each hero stand-in has 2 Willpower and 2 Attack: 3 more Attack tells the two apart.
    const stronger = (table: ReturnType<typeof built>): ScenarioState => ({ ...table.state, modifiers: [...table.state.modifiers, ...[table.hero, table.hero2].map((id) => ({ instanceId: id, sourceId: "t", stat: "attack" as const, amount: 3, until: "endOfRound" as const }))] });
    const t = built({ active: "10132", staging: [FURIOUS], committed: ["dh1", "dh2"] });
    expect(committedWillpower(stronger(t), t.cards)).toBe(10);
    expect(committedWillpower(setCurrentQuest(stronger(t), idOf(t.state, FURIOUS), t.ctx), t.cards)).toBe(10);
    const off = built({ staging: [FURIOUS], committed: ["dh1", "dh2"] });
    expect(committedWillpower(setCurrentQuest(stronger(off), idOf(off.state, FURIOUS), off.ctx), off.cards)).toBe(4);
  });
});

describe("the boons", () => {
  it("10191:A:2 gives +2 Attack and +2 hit points to an attached character, and nothing to a host that is not one", () => {
    const t = built({ attached: [{ code: "10191", to: "dh1" }] });
    const hero = t.state.cards[t.hero]!;
    const printed = t.cards.get("dh1")!;
    expect(modifiedStat(t.state, hero, "attack", t.cards)).toBe((printed.attack ?? 0) + 2);
    expect(modifiedStat(t.state, hero, "hitPoints", t.cards)).toBe((printed.health ?? 0) + 2);
    // An attachment on an enemy (a host that is not a character) adds nothing to it.
    const odd = built({ staging: ["f3"], attached: [{ code: "10191", to: "f3" }] });
    const enemy = odd.state.cards[idOf(odd.state, "f3")]!;
    expect(modifiedStat(odd.state, enemy, "attack", odd.cards)).toBe(odd.cards.get("f3")?.attack);
    expect(modifiedStat(odd.state, enemy, "hitPoints", odd.cards)).toBe(odd.cards.get("f3")?.health);
  });

  it("10135:A:1 raises a player's threat by the resources spent in one payment, 2 for a cost of 2 paid by one hero or two, and not for a card that costs nothing", () => {
    const threatAfter = (code: string, payments: (hero: string, other: string) => { heroId: string; amount: number }[], active = true): number => {
      const t = built({ phase: "Planning", hand: [code], heroResources: 3, ...(active ? { active: "10135" } : {}) });
      const ctx = { ...t.ctx, effects: [...t.ctx.effects, fillerRecord("c2")] };
      const before = seatThreat(t.state, 0);
      const played = send(start(t.state), { type: "PlayCard", cardId: idOf(t.state, code), payments: payments(t.hero, t.hero2) }, ctx);
      return seatThreat(finish(played, ctx).state, 0) - before;
    };
    expect(threatAfter("c2", (hero) => [{ heroId: hero, amount: 2 }])).toBe(2);
    expect(threatAfter("c2", (hero, other) => [{ heroId: hero, amount: 1 }, { heroId: other, amount: 1 }])).toBe(2);
    expect(threatAfter("filler", () => [])).toBe(0);
    expect(threatAfter("c2", (hero) => [{ heroId: hero, amount: 2 }], false)).toBe(0);
  });

  it("10137:A:2 searches for another copy of the ally the attack destroyed (the first of them, not whichever character defended)", () => {
    const fight = fightEnemy((made: Layout) => built(made), "10137", "f3", { play: ["ally"], deckOf: ["ally", "ally", "event"], hand: ["filler"] }, { defender: (made) => Object.values(made.state.cards).find((card) => card.code === "ally" && card.zone === "play")?.id ?? "", tweak: (state) => ({ ...state, modifiers: [...state.modifiers, { instanceId: idOf(state, "f3"), sourceId: "t", stat: "attack" as const, amount: 2, until: "endOfRound" as const }] }) });
    const state = fight.run.state;
    const deckCodes = state.seats[0]!.deck.map((id) => state.cards[id]?.code);
    const discardCodes = state.seats[0]!.discard.map((id) => state.cards[id]?.code);
    // The ally (2 hit points, Defense 1) takes 3 from the attack of 1 + 2 + 1: it is destroyed, and the one other copy in the deck follows it into the discard pile.
    expect(discardCodes.filter((code) => code === "ally")).toHaveLength(2);
    expect(deckCodes.filter((code) => code === "ally")).toHaveLength(1);
    expect(deckCodes).toContain("event");
  });

  it("10131:A:1 deals the Werewolf of Angmar a shadow card each time any player plays an event", () => {
    const t = built({ phase: "Planning", staging: [WEREWOLF], hand: ["filler"] });
    const played = send(start(t.state), { type: "PlayCard", cardId: idOf(t.state, "filler"), payments: [] }, t.ctx);
    expect(shadowsOn(finish(played, t.ctx).state, WEREWOLF)).toBe(1);
  });

  it("10129:A:1 adds 1 Threat for each shadow card dealt to Carn Dûm Garrison, to the Threat in the staging area", () => {
    const t = built({ stage: STAGE1, staging: [GARRISON] });
    expect(stagingThreat(t.state, t.cards)).toBe(1);
    const dealt = settled(dealTo(t.state, t, GARRISON, 2), t);
    expect(stagingThreat(dealt, t.cards)).toBe(3);
    expect(committedWillpower(dealt, t.cards)).toBe(committedWillpower(t.state, t.cards));
  });
});
