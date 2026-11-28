// Rules: rm.time-x, rr.forced, rr.engaged, rr.staging, rr.travel, rr.explored, rr.shadow-effects, rr.search, rr.setup, rr.cancel, rr.first-player, rr.modifiers (data/rules/entries.json); ledger lines 08094:A:1, 08102:A:1, 08102:A:2, 08104:A:2, 08105:A:1 to 08111:A:1.
// The encounter cards of The Nîn-in-Eilph on its scene: each record that rests on an engine path this task checks (the time trigger, the staging area's granted Forced effects, the shadow effects that read the table), resolved in a real state.
import { describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { queueEvent } from "../../../rules/windows/queue.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { definePrinted, type PrintedCard } from "../../../rules/core/printed.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { legalIntents } from "../../../rules/engine/legal.ts";
import type { EngineStep, PlayerIntent } from "../../../rules/core/intents.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { eilphStart, eilphWorld } from "../../../../test/scenarios/the-nin-in-eilph/game.ts";
import { fightEnemy, finish, idOf, resolveRecords, run, send, statOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const table = (layout: Layout) => tableFromLayout("the-nin-in-eilph", layout);
const STAGE = "08098";
const STAGES_2: readonly string[] = ["08095", "08096", "08097"];
// The real Setup of a seeded game: the opening hands kept, the searches answered with the first option offered.
const playedSetup = ({ ctx }: Awaited<ReturnType<typeof eilphWorld>>, seats: 1 | 2): ScenarioState => {
  let state = reduce(startScenario(eilphStart(seats, 1, "Normal"), ctx), { type: "Keep" }, ctx).state;
  if (seats === 2) state = reduce(state, { type: "Keep" }, ctx).state;
  for (let guard = 0; guard < 8 && state.window?.kind === "choose"; guard += 1) state = reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx).state;
  return state;
};
const FILLERS = ["f0", "f0", "f0", "f0"];
// Stand-ins for the attachments the Sinking Bog counts: an Item and a Condition.
const ITEM = "item";
const CONDITION = "condition";
const withAttachments = (cards: ReadonlyMap<string, PrintedCard>): void => {
  const known = cards as Map<string, PrintedCard>;
  known.set(ITEM, definePrinted({ code: ITEM, name: ITEM, type: "attachment", sphere: "neutral", cost: 0, traits: ["Item"] }));
  known.set(CONDITION, definePrinted({ code: CONDITION, name: CONDITION, type: "attachment", sphere: "neutral", cost: 0, traits: ["Condition"] }));
};
const attachedTo = (state: ScenarioState, codes: readonly string[], host: string): ScenarioState => codes.reduce((next, code) => {
  const spawned = spawn(next, code, { zone: "play", seat: 0 });
  return attachTo(spawned.state, spawned.id, idOf(next, host));
}, state);
const inZone = (state: ScenarioState, code: string): string | undefined => state.cards[idOf(state, code)]?.zone;
const exhaustedCount = (state: ScenarioState): number => Object.values(state.cards).filter((card) => card.exhausted && (card.zone === "heroes" || card.zone === "play")).length;

describe("after any number of time counters come off the current quest, an engaged enemy acts (08104:A:2, 08105:A:1)", () => {
  const counted = (layout: Layout) => {
    const t = table({ stage: STAGE, ...layout });
    return { t, state: updateCard(t.state, t.state.questStage ?? "", { resources: 3 }) };
  };

  it("08104:A:2 the Giant Swamp Adder engaged with a player attacks that player, once for a removal of 2 counters", () => {
    const { t, state } = counted({ engaged: [{ code: "08104", seat: 0 }], deck: FILLERS });
    const done = run(t, state, { verb: "RemoveTimeFromQuest", amount: 2 });
    expect(done.window?.kind).toBe("defense");
    expect(done.pendingAttack?.enemyId).toBe(idOf(done, "08104"));
    expect(done.pendingAttack?.seat).toBe(0);
  });

  it("08104:A:2 the Giant Swamp Adder engaged with the second player attacks that player, whoever the first player is", () => {
    for (const firstPlayer of [0, 1] as const) {
      const { t, state } = counted({ seats: 2, firstPlayer, engaged: [{ code: "08104", seat: 1 }], deck: FILLERS });
      const done = run(t, state, { verb: "RemoveTimeFromQuest", amount: 1 });
      expect(done.pendingAttack?.enemyId).toBe(idOf(done, "08104"));
      expect(done.pendingAttack?.seat).toBe(1);
    }
  });

  it("08104:A:2 the Giant Swamp Adder engaged with the first player attacks him once, not each player", () => {
    const { t, state } = counted({ seats: 2, firstPlayer: 1, engaged: [{ code: "08104", seat: 0 }], deck: FILLERS });
    const steps: EngineStep[] = [];
    const done = run(t, state, { verb: "RemoveTimeFromQuest", amount: 1 }, { steps });
    expect(done.pendingAttack?.seat).toBe(0);
    expect(steps.filter((step) => step.kind === "attack")).toHaveLength(1);
  });

  it("08104:A:2 the Giant Swamp Adder in the staging area does nothing", () => {
    const { t, state } = counted({ staging: ["08104"], deck: FILLERS });
    const done = run(t, state, { verb: "RemoveTimeFromQuest", amount: 1 });
    expect(done.pendingAttack).toBeFalsy();
    expect(done.window?.kind).not.toBe("defense");
  });

  it("08105:A:1 Neekerbreekers engaged with a player deal 2 damage to an ally that player controls", () => {
    const { t, state } = counted({ engaged: [{ code: "08105", seat: 0 }], play: ["ally"] });
    const ally = idOf(state, "ally");
    const done = run(t, state, { verb: "RemoveTimeFromQuest", amount: 1 });
    expect(done.cards[ally]?.damage === 2 || done.cards[ally]?.zone !== "play").toBe(true);
  });

  it("08105:A:1 Neekerbreekers engaged with the second player deal 2 damage once, to an ally that player controls and no other", () => {
    const { t, state } = counted({ seats: 2, engaged: [{ code: "08105", seat: 1 }], play: [{ code: "ally", seat: 0 }, { code: "ally", seat: 1 }] });
    const done = run(t, state, { verb: "RemoveTimeFromQuest", amount: 1 });
    // The stand-in ally has 2 hit points: it takes 2 damage and is destroyed.
    const allies = (seat: number) => Object.values(done.cards).filter((card) => card.code === "ally" && card.controller === seat);
    expect(allies(0).map((card) => [card.zone, card.damage])).toEqual([["play", 0]]);
    expect(allies(1).map((card) => [card.zone, card.damage])).toEqual([["discard", 2]]);
  });

  it("08105:A:1 Neekerbreekers engaged with a player who has no ally deal no damage to a hero", () => {
    const { t, state } = counted({ engaged: [{ code: "08105", seat: 0 }] });
    const done = run(t, state, { verb: "RemoveTimeFromQuest", amount: 1 });
    expect(Object.values(done.cards).every((card) => card.damage === 0)).toBe(true);
  });

  it("08105:A:1 Neekerbreekers in the staging area deal no damage", () => {
    const { t, state } = counted({ staging: ["08105"], play: ["ally"] });
    const done = run(t, state, { verb: "RemoveTimeFromQuest", amount: 1 });
    expect(done.cards[idOf(state, "ally")]).toMatchObject({ damage: 0, zone: "play" });
  });
});

// The quest goes on from its current stage and the choices the Forced effects open are answered.
const advanced = (t: ReturnType<typeof table>): ScenarioState => finish({ state: run(t, t.state, { verb: "AdvanceStage" }, { sourceId: t.state.questStage ?? "" }), steps: [] }, t.ctx).state;

describe("Fen of Reeds, Finger of Glanduin and the cards that grant Forced effects while staged (08106:A:1, 08107:A:1)", () => {
  it("08106:A:1 after the players advance to a quest stage each player exhausts a character, while Fen of Reeds is in the staging area", () => {
    const t = table({ stage: "08096", seats: 2, staging: ["08106"] });
    expect(exhaustedCount(advanced(t))).toBe(2);
  });

  it("08106:A:1 a parallel stage that replaces the current one is an advance to a quest stage too", () => {
    const t = table({ stage: "08095", phase: "Refresh", staging: ["08106"] });
    const stage = t.state.questStage ?? "";
    const done = finish({ state: settle(updateCard(t.state, stage, { resources: 1 }), t.ctx, []), steps: [] }, t.ctx).state;
    expect(done.questStage).not.toBe(stage);
    expect(exhaustedCount(done)).toBe(1);
  });

  it("08106:A:1 a player with no ready character exhausts none, and Fen of Reeds anywhere else grants nothing", () => {
    const none = table({ stage: "08096", staging: ["08106"], exhaustedCards: ["dh1", "dh2", "dh3"] });
    expect(exhaustedCount(advanced(none))).toBe(exhaustedCount(none.state));
    const engaged = table({ stage: "08096", engaged: [{ code: "08106", seat: 0 }] });
    expect(exhaustedCount(advanced(engaged))).toBe(0);
  });

  it("08106:A:1 the first stage of the game is no advance: Fen of Reeds, added by the Setup, waits for the quest to advance", () => {
    const t = table({ stage: "08094", side: "A", staging: ["08106"] });
    expect(exhaustedCount(t.state)).toBe(0);
  });

  it("08106:A:1 the Setup's flip of stage 1 is no advance: with Fen of Reeds staged by the search, the one player exhausts a character once, for the advance to a stage 2", async () => {
    const state = playedSetup(await eilphWorld("strong"), 1);
    expect(state.staging.map((id) => state.cards[id]?.code)).toContain("08106");
    expect(STAGES_2).toContain(state.cards[state.questStage ?? ""]?.code ?? "");
    expect(exhaustedCount(state)).toBe(1);
  });

  it("08107:A:1 at the end of the round 1 progress comes off each location in play, the active location too, while Finger of Glanduin is in the staging area", () => {
    const layout = { stage: STAGE, staging: [{ code: "08108", progress: 2 }], active: { code: "08109", progress: 3 } } as const;
    const progress = (staged: boolean): number[] => {
      const t = table({ ...layout, ...(staged ? { staging: ["08107", { code: "08108", progress: 2 }] } : {}) });
      const done = settle(queueEvent(t.state, { trigger: "endOfRound", seat: null }), t.ctx, []);
      return [done.cards[idOf(done, "08108")]?.progress ?? -1, done.cards[idOf(done, "08109")]?.progress ?? -1];
    };
    expect(progress(true)).toEqual([1, 2]);
    expect(progress(false)).toEqual([2, 3]);
  });

  it("08107:A:2 an attack that destroys a character takes all progress off the current quest, one that destroys none leaves it", () => {
    const progressAfter = (damage: number): number => {
      const fight = fightEnemy(table, "08107", "f0", { stage: STAGE, hand: ["filler"], progress: 4 }, { undefended: true, tweak: (state, made) => updateCard(state, made.hero, { damage }) });
      return fight.run.state.cards[fight.run.state.questStage ?? ""]?.progress ?? -1;
    };
    expect(progressAfter(5)).toBe(0);
    expect(progressAfter(0)).toBe(4);
  });
});

describe("Hidden Eyot, Shifting Marshland and the other encounter cards (08108:A:1, 08108:A:2, 08110:A:2, 08111:A:1)", () => {
  // The Response a card leaving play offers: the window opens and the player's Trigger answers it.
  const offered = (explored: boolean, counters: number) => {
    const t = table({ stage: "08101", active: "08108" });
    const stage = t.state.questStage ?? "";
    const eyot = idOf(t.state, "08108");
    const state = updateCard(t.state, stage, { resources: counters });
    const left = run(t, state, explored ? { verb: "PlaceProgressOn", amount: 99, target: "activeLocation" } : { verb: "Discard", target: { kind: "activeLocation" } });
    return { t, stage, left, offer: legalIntents(left, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === eyot) };
  };

  it("08108:A:1 after it leaves play explored, 2 time counters go on the current quest, even on a stage with none", () => {
    for (const counters of [0, 2]) {
      const { t, stage, left, offer } = offered(true, counters);
      expect(offer).toBeDefined();
      const done = finish(send({ state: left, steps: [] }, offer as PlayerIntent, t.ctx), t.ctx).state;
      expect(done.cards[stage]?.resources).toBe(counters + 2);
    }
  });

  it("08108:A:1 a copy that is discarded unexplored offers nothing", () => {
    expect(offered(false, 0).offer).toBeUndefined();
  });

  it("08108:A:2 each player exhausts a character he controls to travel to it", () => {
    const t = table({ stage: STAGE, phase: "Travel", seats: 2, staging: ["08108"] });
    const done = finish({ state: resolveRecords(t.state, t.ctx, "08108", "travel", idOf(t.state, "08108")).state, steps: [] }, t.ctx).state;
    expect(exhaustedCount(done)).toBe(2);
  });

  it("08110:A:2 Shifting Marshland takes a time counter off the current quest", () => {
    const t = table({ stage: STAGE, side: "A" });
    const stage = t.state.questStage ?? "";
    const done = resolveRecords(updateCard(t.state, stage, { resources: 2 }), t.ctx, "08110", "whenRevealed", undefined).state;
    expect(done.cards[stage]?.resources).toBe(1);
  });

  it("08111:A:1 each player finds a Creature enemy and has it engaged, the deck shuffled", () => {
    const t = table({ stage: STAGE, seats: 2, deck: ["08103", "08104", "08105", "08104"] });
    const done = resolveRecords(t.state, t.ctx, "08111", "whenRevealed", undefined).state;
    expect(done.seats[0]?.engaged.length).toBe(1);
    expect(done.seats[1]?.engaged.length).toBe(1);
  });
});

describe("the shadow effects that read the table (08106:A:2, 08107:A:2, 08109:A:2, 08105:A:2)", () => {
  const f0 = { stage: STAGE, hand: ["filler", "filler"] } as const;

  it("08106:A:2 the attacking enemy gets +1 Attack for each time counter on the quest", () => {
    const attackWith = (counters: number): number => {
      const fight = fightEnemy(table, "08106", "f0", { ...f0, timeCounters: counters }, { undefended: true });
      const attacker = fight.during.pendingAttack?.enemyId ?? "";
      return modifiedStat(fight.during, fight.during.cards[attacker]!, "attack", fight.ctx.cards);
    };
    expect(attackWith(3) - attackWith(0)).toBe(3);
  });

  it("08105:A:2 the defending character takes 1 damage", () => {
    const fight = fightEnemy(table, "08105", "f0", f0);
    expect(fight.run.state.cards[fight.made.hero]?.damage).toBeGreaterThanOrEqual(1);
  });
});

describe("Sinking Bog (08109:A:1, 08109:A:2)", () => {
  const stats = (staging: readonly string[], attachments: readonly string[]) => {
    const t = table({ stage: STAGE, staging });
    withAttachments(t.ctx.cards);
    const state = syncConstants(attachedTo(t.state, attachments, "dh1"), t.ctx);
    return { will: statOf(state, t.ctx.cards, "dh1", "willpower"), attack: statOf(state, t.ctx.cards, "dh1", "attack"), defense: statOf(state, t.ctx.cards, "dh1", "defense") };
  };

  it("08109:A:1 each character gets -1 Willpower, -1 Attack and -1 Defense for each Item attached to it", () => {
    const free = stats([], [ITEM, ITEM]);
    const bog = stats(["08109"], [ITEM, ITEM]);
    expect([bog.will - free.will, bog.attack - free.attack, bog.defense - free.defense]).toEqual([-2, -2, -2]);
  });

  it("08109:A:1 two copies do not stack, and an attachment that is no Item does not count", () => {
    const free = stats([], [ITEM, CONDITION]);
    expect(stats(["08109", "08109"], [ITEM, CONDITION]).will - free.will).toBe(-1);
  });

  it("08109:A:1 it holds only while it is in the staging area", () => {
    const free = stats([], [ITEM]);
    const t = table({ stage: STAGE, engaged: [{ code: "08109", seat: 0 }] });
    withAttachments(t.ctx.cards);
    expect(statOf(syncConstants(attachedTo(t.state, [ITEM], "dh1"), t.ctx), t.ctx.cards, "dh1", "willpower")).toBe(free.will);
  });

  it("08109:A:2 the defending character gets -1 Defense for the attack for each attachment on it", () => {
    const defense = (attachments: number): number => {
      const fight = fightEnemy(table, "08109", "f0", { stage: STAGE, hand: ["filler"] }, { tweak: (state, made) => (withAttachments(made.ctx.cards), attachedTo(state, Array.from({ length: attachments }, (_, at) => (at % 2 === 0 ? ITEM : CONDITION)), "dh1")) });
      return statOf(fight.during, fight.ctx.cards, "dh1", "defense");
    };
    // A hero's Defense is 2: it does not go below 0.
    expect(defense(0) - defense(2)).toBe(2);
  });
});

describe("the Setup and Nalir (08094:A:1, 08102:A:1, 08102:A:2)", () => {
  it("08094:A:1 the first player controls Nalir, the Marsh-dweller stays aside and each player adds a different location to the staging area", () => {
    const t = table({ stage: "08094", side: "A", seats: 2, firstPlayer: 1, setAside: ["08102", "08103"], deck: ["08106", "08106", "08107", "08109", "f0"] });
    const done = resolveRecords(t.state, t.ctx, "08094", "setup", t.state.questStage ?? "").state;
    expect(done.cards[idOf(done, "08102")]).toMatchObject({ zone: "play", controller: 1 });
    expect(inZone(done, "08103")).toBe("setAside");
    const staged = done.staging.map((id) => done.cards[id]?.code);
    expect(staged).toHaveLength(2);
    expect(new Set(staged).size).toBe(2);
  });

  it("08094:A:1 the played Setup stages one searched Marsh location for each player, and the four searched copies are not dealt into the staging area", async () => {
    const locations = ["08106", "08107", "08108", "08109"];
    for (const seats of [1, 2] as const) {
      const state = playedSetup(await eilphWorld("strong"), seats);
      const staged = state.staging.map((id) => state.cards[id]?.code ?? "");
      expect(staged, `${seats} seats`).toHaveLength(seats);
      expect(new Set(staged).size).toBe(seats);
      expect(staged.every((code) => locations.includes(code))).toBe(true);
      // The pile's four searched copies lie in the encounter deck as search targets: 7 printed locations and the 4 make 11, and each search took one.
      expect(state.encounterDeck.filter((id) => locations.includes(state.cards[id]?.code ?? ""))).toHaveLength(11 - seats);
      expect(inZone(state, "08103")).toBe("setAside");
      expect(state.cards[idOf(state, "08102")]).toMatchObject({ zone: "play", controller: 0 });
    }
  });

  it("08102:A:1 control of Nalir goes to the first player", () => {
    const t = table({ stage: STAGE, seats: 2, firstPlayer: 1, play: [{ code: "08102", seat: 0 }] });
    const synced = settle(syncConstants(t.state, t.ctx), t.ctx, []);
    expect(synced.cards[idOf(synced, "08102")]?.controller).toBe(1);
  });

  it("08102:A:2 at the beginning of the refresh phase his controller raises his threat by the players in the game", () => {
    const t = table({ stage: STAGE, seats: 2, threat: [30, 30], play: [{ code: "08102", seat: 0 }], phase: "Refresh" });
    const done = resolveRecords(t.state, t.ctx, "08102", "forced", idOf(t.state, "08102"));
    expect(done.state.seats[0]?.threat).toBe(32);
    expect(done.state.seats[1]?.threat).toBe(30);
  });
});
