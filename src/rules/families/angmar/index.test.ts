// Rules: mec108.time-x, mec108.side-quests, mec108.side-quests-in-play, mec108.objective-allies, mec108.campaign-setup-intruders-in-chetwood, rr.in-play-and-out-of-play, rr.step-3-4, rr.damage, rr.first-player, faq.side-quest-current-quest-text, faq.additional-attacks (data/rules/entries.json);
// ledger lines 09016:A:1, 09016:A:4, 09023:A:1, 09024:A:1, 09024:A:2, 09024:A:3, 09047:A:1, 09048:A:2, 09049:A:2, 09051:A:1, 09051:A:2, 10156:A:2, 10158:A:1, 10158:A:2, 09021:A:1. The angmar family on tables of Intruders in Chetwood, built from data/ by the layout kit.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { definePrinted } from "../../core/printed.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { questCapTally } from "../caves/progress.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { holds } from "../../interpret/conditions.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { placeQuestProgress } from "../../quest/quest.ts";
import { probeTable } from "../../../../scripts/card-smoke/encounter.ts";
import { encounterWorld } from "../../../../scripts/card-smoke/encounter-world.ts";
import { HERO, HERO2, idOf, resolveRecords, revealFromTop, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { announceHurt, noteHurt } from "./damage.ts";
import { chooseCurrentQuest, setCurrentQuest } from "./quest.ts";
import { removeTimeCounters, timeAtRefreshEnd, timeOf } from "./time.ts";

const SCENARIO = "intruders-in-chetwood";
const RESCUE = "09024";
const IARION = "09016";
const PENDANT = "10157";
const PROTECT = "10158";
const REARGUARD = "09023";

const built = (layout: Layout = {}) => {
  const t = tableFromLayout(SCENARIO, layout);
  // A player side quest stands in for the one a player has in a quest area (the scenario deals none).
  t.cards.set("psq", definePrinted({ code: "psq", name: "Player quest", type: "player-side-quest", questPoints: 3 }));
  return t;
};
const scope = { actor: 0, sourceId: null, returned: 0 } as const;
const canAdvance = () => true;

describe("the game reads the side quest rules when it deals an encounter side quest", () => {
  it("mec108.side-quests notes `sideQuests` at the start of Intruders in Chetwood, and a game with a side quest deck of its own or none leaves it", async () => {
    const world = await encounterWorld(SCENARIO);
    expect(probeTable(world).sideQuests).toBe(true);
    const night = await encounterWorld("fire-in-the-night");
    expect(probeTable(night).sideQuests).toBeUndefined();
    const plain = await encounterWorld("the-oath");
    expect(probeTable(plain).sideQuests).toBeUndefined();
  }, 120_000);
});

describe("quest cards in play (the amount questCards)", () => {
  it("09016:A:1 counts the main quest card, each encounter side quest in the staging area and each player side quest, and no side quest in the victory display; never fewer than 1", () => {
    const t = built({ staging: [REARGUARD, "09046"], victory: ["09051"] });
    expect(resolveAmount(t.state, { questCards: true }, scope, t.ctx)).toBe(3);
    const bare = built();
    expect(resolveAmount(bare.state, { questCards: true }, scope, bare.ctx)).toBe(1);
    const quested = spawn(t.state, "psq", { zone: "seatQuest", seat: 0 }).state;
    expect(resolveAmount(quested, { questCards: true }, scope, t.ctx)).toBe(4);
    const done = { ...bare.state, questStage: null };
    expect(resolveAmount(done, { questCards: true }, scope, bare.ctx)).toBe(1);
  });

  it("09016:A:1 gives Iârion his Willpower, Attack and Defense X and Shrouded Hills its Threat X; 09048:A:2 gives Shrouded Hills surge while it is the only quest card in play", () => {
    const t = built({ play: [IARION], staging: ["09048", REARGUARD] });
    const iarion = t.state.cards[idOf(t.state, IARION)]!;
    for (const stat of ["willpower", "attack", "defense"] as const) expect(modifiedStat(t.state, iarion, stat, t.cards)).toBe(2);
    const hills = t.state.cards[idOf(t.state, "09048")]!;
    expect(modifiedStat(t.state, hills, "threat", t.cards)).toBe(2);
    expect(modifiedStat(t.state, hills, "gainsSurge", t.cards)).toBe(0);
    const lone = built({ staging: ["09048"] });
    expect(modifiedStat(lone.state, lone.state.cards[idOf(lone.state, "09048")]!, "gainsSurge", lone.cards)).toBe(1);
  });

  it("09048:A:2 reveals the next card at once when Shrouded Hills is the only quest card in play, and not otherwise", () => {
    const alone = built({ deck: ["f0", "f3"] });
    const surged = revealFromTop(alone.state, alone.ctx, "09048", []);
    expect(surged.state.staging.map((id) => surged.state.cards[id]?.code)).toEqual(["09048", "f0"]);
    const shared = built({ deck: ["f0", "f3"], staging: [REARGUARD] });
    const plain = revealFromTop(shared.state, shared.ctx, "09048", []);
    expect(plain.state.staging.map((id) => plain.state.cards[id]?.code)).toEqual([REARGUARD, "09048"]);
  });
});

describe("the current quest", () => {
  it("09047:A:1, 09023:A:2 reads the current quest as a side quest only while a side quest holds the mark until the end of the phase", () => {
    const t = built({ staging: [REARGUARD, "09047"] });
    const rearguard = idOf(t.state, REARGUARD);
    expect(holds(t.state, { kind: "currentQuest", is: "side" }, scope, t.ctx)).toBe(false);
    const marked = setCurrentQuest(t.state, rearguard, t.ctx);
    expect(holds(marked, { kind: "currentQuest", is: "side" }, scope, t.ctx)).toBe(true);
    expect(holds(marked, { kind: "currentQuest", is: "self" }, { ...scope, sourceId: rearguard }, t.ctx)).toBe(true);
    expect(holds(marked, { kind: "currentQuest", is: "self" }, { ...scope, sourceId: idOf(t.state, "09047") }, t.ctx)).toBe(false);
    const rugged = marked.cards[idOf(marked, "09047")]!;
    expect(modifiedStat(syncConstants(marked, t.ctx), rugged, "threat", t.cards)).toBe(2 + (t.cards.get("09047")?.threat ?? 0));
    expect(modifiedStat(syncConstants(t.state, t.ctx), rugged, "threat", t.cards)).toBe(t.cards.get("09047")?.threat ?? 0);
    // The main quest card takes it back: the mark ends.
    const back = setCurrentQuest(marked, marked.questStage ?? "", t.ctx);
    expect(holds(back, { kind: "currentQuest", is: "side" }, scope, t.ctx)).toBe(false);
  });

  it("09049:A:2 lets the first player choose a quest card other than the current quest, the main quest card included, and the one card left is taken without asking", () => {
    const t = built({ staging: [REARGUARD, "09046"] });
    const rearguard = idOf(t.state, REARGUARD);
    const ambush = idOf(t.state, "09046");
    const asked = chooseCurrentQuest(t.state, { verb: "ChooseCurrentQuest" }, { seat: 0, sourceId: null }, t.ctx, []);
    // Outside an effect frame nothing can be asked: the first card is taken.
    expect([rearguard, ambush, t.state.questStage]).toContain([...asked.modifiers].find((m) => m.stat === "currentQuest")?.instanceId ?? t.state.questStage);
    const marked = setCurrentQuest(t.state, rearguard, t.ctx);
    const choices = (run: { state: ScenarioState }): string[] => (run.state.window?.kind === "choose" ? [...run.state.window.options] : []);
    const spied: string[][] = [];
    const run = resolveRecords(marked, t.ctx, "09049", "whenRevealed", undefined, (state) => {
      spied.push(choices({ state }));
      return state.window?.kind === "choose" && state.window.options.includes(ambush) ? ambush : (state.window?.kind === "choose" ? (state.window.options[1] ?? "") : "");
    });
    expect(spied.flat()).toContain(ambush);
    expect(spied.flat()).toContain(marked.questStage);
    expect(spied.flat()).not.toContain(rearguard);
    expect(holds(run.state, { kind: "currentQuest", is: "self" }, { ...scope, sourceId: ambush }, t.ctx)).toBe(true);
    // With only the main quest card and nothing else, no other quest card is there to choose.
    const lone = built();
    expect(holds(lone.state, { kind: "currentQuest", is: "other" }, scope, lone.ctx)).toBe(false);
    expect(holds(t.state, { kind: "currentQuest", is: "other" }, scope, t.ctx)).toBe(true);
  });

  it("09023:A:1 caps the progress placed on the main quest card, and on the side quest that is the current quest, at 3 a round; the progress counts toward one tally", () => {
    const main = built({ staging: [REARGUARD] });
    const steps: EngineStep[] = [];
    const first = placeQuestProgress(main.state, 5, main.cards, steps, canAdvance);
    expect(first.cards[first.questStage ?? ""]?.progress).toBe(3);
    const second = placeQuestProgress(first, 2, main.cards, [], canAdvance);
    expect(second.cards[second.questStage ?? ""]?.progress).toBe(3);

    const ambush = built({ staging: [REARGUARD, "09046"] });
    const current = setCurrentQuest(ambush.state, idOf(ambush.state, "09046"), ambush.ctx);
    const placed = placeQuestProgress(current, 5, ambush.cards, steps, canAdvance);
    expect(placed.cards[idOf(placed, "09046")]?.progress).toBe(3);
    expect(placed.cards[placed.questStage ?? ""]?.progress).toBe(0);
    expect(placeQuestProgress(placed, 1, ambush.cards, [], canAdvance).cards[idOf(placed, "09046")]?.progress).toBe(3);
    // The next round the tally is new.
    const next = settle({ ...placed, modifiers: placed.modifiers.filter((modifier) => modifier.stat !== "questProgressPlaced") }, ambush.ctx, []);
    expect(placeQuestProgress(next, 1, ambush.cards, [], canAdvance).cards[idOf(placed, "09046")]?.progress).toBe(4);
  });

  it("09023:A:1 counts only the progress a side quest took, not the room left: a side quest 1 short of full, or a Protect the Innocent holding 1 damage, leave 2 of the 3 for the rest of the round", () => {
    const wilds = built({ staging: [REARGUARD, { code: "09051", progress: 3 }] });
    const current = setCurrentQuest(wilds.state, idOf(wilds.state, "09051"), wilds.ctx);
    const placed = placeQuestProgress(current, 5, wilds.cards, [], canAdvance);
    expect(placed.cards[idOf(placed, "09051")]?.progress).toBe(4);
    expect(questCapTally(placed)).toEqual({ placed: 1, limit: 3 });
    const full = built({ staging: [REARGUARD, { code: "09051", progress: 4 }] });
    const stuck = placeQuestProgress(setCurrentQuest(full.state, idOf(full.state, "09051"), full.ctx), 5, full.cards, [], canAdvance);
    expect(questCapTally(stuck)).toEqual({ placed: 0, limit: 3 });
    const protect = built({ staging: [REARGUARD, { code: PROTECT, damage: 1 }] });
    const healed = placeQuestProgress(setCurrentQuest(protect.state, idOf(protect.state, PROTECT), protect.ctx), 3, protect.cards, [], canAdvance);
    expect(healed.cards[idOf(healed, PROTECT)]?.damage).toBe(0);
    expect(questCapTally(healed)).toEqual({ placed: 1, limit: 3 });
  });

  it("10158:A:2 removes as much damage from Protect the Innocent as the progress placed on it, no more than it holds, instead of placing progress", () => {
    const t = built({ staging: [{ code: PROTECT, damage: 4 }] });
    const quest = idOf(t.state, PROTECT);
    const current = setCurrentQuest(t.state, quest, t.ctx);
    const steps: EngineStep[] = [];
    const healed = placeQuestProgress(current, 3, t.cards, steps, canAdvance);
    expect(healed.cards[quest]).toMatchObject({ damage: 1, progress: 0 });
    expect(steps.some((step) => step.kind === "damage" && step.targetId === quest && step.amount === -3)).toBe(true);
    const clean = placeQuestProgress(healed, 7, t.cards, [], canAdvance);
    expect(clean.cards[quest]).toMatchObject({ damage: 0, progress: 0 });
    expect(clean.cards[clean.questStage ?? ""]?.progress).toBe(0);
  });

  it("10158:A:3 loses the game with 10 damage on Protect the Innocent, and with 9 the game goes on", () => {
    const t = built({ staging: [{ code: PROTECT, damage: 9 }] });
    expect(settle({ ...t.state, window: null, mode: "stopped" }, t.ctx, []).lost).toBeFalsy();
    const quest = idOf(t.state, PROTECT);
    const over = settle({ ...updateCard(t.state, quest, { damage: 10 }), window: null, mode: "stopped" }, t.ctx, []);
    expect(over.lost).toBe(true);
  });
});

describe("Time X (mec108.time-x)", () => {
  it("09024:A:1 puts 4 time counters on Rescue Iârion as it is revealed, by the deck or by a search alike", () => {
    const t = built({ play: [IARION], deck: ["f0"] });
    expect(timeOf(t.ctx, RESCUE)).toBe(4);
    expect(timeOf(t.ctx, "09047")).toBeNull();
    const revealed = revealFromTop(t.state, t.ctx, RESCUE, []);
    expect(revealed.state.cards[revealed.id]?.resources).toBe(4);
  });

  it("09024:A:3 takes one counter off each Time card as the refresh phase ends, and announces the removal of the last", () => {
    const t = built({ play: [IARION], staging: [{ code: RESCUE, resources: 2 }] });
    const rescue = idOf(t.state, RESCUE);
    const once = removeTimeCounters(t.state, t.ctx);
    expect(once.cards[rescue]?.resources).toBe(1);
    expect((once.pendingEvents ?? []).some((event) => event.trigger === "lastTimeCounterRemoved")).toBe(false);
    const twice = removeTimeCounters(once, t.ctx);
    expect(twice.cards[rescue]?.resources).toBe(0);
    expect((twice.pendingEvents ?? []).filter((event) => event.trigger === "lastTimeCounterRemoved" && event.subject === rescue)).toHaveLength(1);
    // None left: nothing is removed and nothing is announced again.
    const none = removeTimeCounters({ ...twice, pendingEvents: [] }, t.ctx);
    expect(none.pendingEvents ?? []).toEqual([]);
    // The end of the refresh phase pushes the frame that does it; a table with no Time card pushes none.
    const frame = settle(timeAtRefreshEnd({ ...t.state, window: null, mode: "stopped" }, t.ctx, []), t.ctx, []);
    expect(frame.cards[rescue]?.resources).toBe(1);
    const bare = built({ play: [IARION], staging: [REARGUARD] });
    expect(timeAtRefreshEnd(bare.state, bare.ctx, [])).toBe(bare.state);
  });
});

describe("a card held under a side quest", () => {
  const held = () => {
    const t = built({ play: [IARION], staging: [RESCUE], attached: [{ code: PENDANT, to: IARION }] });
    const rescue = idOf(t.state, RESCUE);
    const run = resolveRecords(t.state, t.ctx, RESCUE, "whenRevealed", rescue);
    return { t, rescue, iarion: idOf(t.state, IARION), pendant: idOf(t.state, PENDANT), state: run.state };
  };

  it("09024:A:2 puts Iârion facedown under Rescue Iârion, still in play, controlled by nobody, with his Pendant still attached, and no one gets him back by the first player token", () => {
    const { t, rescue, iarion, pendant, state } = held();
    expect(state.cards[iarion]).toMatchObject({ zone: "captive", host: rescue, controller: null, face: "down" });
    expect(state.cards[pendant]?.host).toBe(iarion);
    expect(state.cards[pendant]?.controller).toBeNull();
    expect(state.lost).toBeFalsy();
    // 09016:A:2 gives him to the first player only while a player controls him: the sweep does not take him from under the quest.
    const swept = settle({ ...state, window: null, mode: "stopped" }, t.ctx, []);
    expect(swept.cards[iarion]?.controller).toBeNull();
    expect(swept.cards[iarion]?.zone).toBe("captive");
    expect(holds(swept, { kind: "controls", code: IARION }, scope, t.ctx)).toBe(false);
  });

  it("09024:A:2 returns Iârion exhausted under the first player when the stage is defeated, his Pendant with him", async () => {
    const { t, rescue, iarion, pendant, state } = held();
    const { defeatSideQuest } = await import("../sidequests/quest.ts");
    const steps: EngineStep[] = [];
    const done = defeatSideQuest(updateCard(state, rescue, { progress: 6 }), rescue, t.ctx, steps);
    expect(done.cards[iarion]).toMatchObject({ zone: "play", controller: 0, exhausted: true, face: "up" });
    expect(done.cards[pendant]).toMatchObject({ zone: "play", host: iarion });
    expect(done.cards[rescue]?.zone).toBe("victory");
    expect(done.lost).toBeFalsy();
  });

  it("09024:A:3 discards Iârion from under the stage when the last time counter goes, he leaves play and the players lose the game (09016:A:4)", () => {
    const { t, rescue, iarion, state } = held();
    const run = resolveRecords(settle({ ...state, window: null, mode: "stopped" }, t.ctx, []), t.ctx, RESCUE, "forced", rescue);
    const done = settle({ ...run.state, window: null, mode: "stopped" }, t.ctx, []);
    expect(done.cards[iarion]?.zone).not.toBe("captive");
    expect(done.lost).toBe(true);
  });

  it("09051:A:1, 09051:A:2 places each player's hand facedown under Lost in the Wilderness and returns it to its owner when the side quest is defeated", async () => {
    const t = built({ seats: 2, staging: ["09051"], hand: [{ code: "event", seat: 0 }, { code: "ally", seat: 0 }, { code: "event", seat: 1 }] });
    const quest = idOf(t.state, "09051");
    const run = resolveRecords(t.state, t.ctx, "09051", "whenRevealed", quest);
    expect(run.state.seats[0]?.hand).toEqual([]);
    expect(run.state.seats[1]?.hand).toEqual([]);
    const under = Object.values(run.state.cards).filter((card) => card.zone === "under" && card.host === quest);
    expect(under.map((card) => [card.code, card.owner]).sort()).toEqual([["ally", 0], ["event", 0], ["event", 1]]);
    const { defeatSideQuest } = await import("../sidequests/quest.ts");
    const defeated = defeatSideQuest(updateCard(run.state, quest, { progress: 4 }), quest, t.ctx, []);
    const back = settle({ ...defeated, window: null, mode: "stopped" }, t.ctx, []);
    const returned = resolveRecords(back, t.ctx, "09051", "forced", quest);
    expect(returned.state.seats[0]?.hand.map((id) => returned.state.cards[id]?.code).sort()).toEqual(["ally", "event"]);
    expect(returned.state.seats[1]?.hand.map((id) => returned.state.cards[id]?.code)).toEqual(["event"]);
  });
});

describe("an attack that damages a character (attackDamagedCharacter)", () => {
  const fight = () => {
    const t = built({ staging: [{ code: PROTECT, damage: 0 }], engaged: ["f3"] });
    const enemy = idOf(t.state, "f3");
    return { t, enemy, state: { ...t.state, pendingAttack: { enemyId: enemy, seat: 0, defenderId: t.hero } } as ScenarioState };
  };

  it("10158:A:1 is heard once for the attack, whatever the number of characters damaged, from the damage the attack placed", () => {
    const { t, state } = fight();
    const noted = noteHurt(noteHurt(state, t.hero, 0, 2, t.ctx), t.hero2, 0, 1, t.ctx);
    const hurt = updateCard(updateCard(noted, t.hero, { damage: 2 }), t.hero2, { damage: 1 });
    const done = announceHurt(hurt, hurt.pendingAttack!);
    expect((done.pendingEvents ?? []).filter((event) => event.trigger === "attackDamagedCharacter")).toHaveLength(1);
  });

  it("10158:A:1 is not heard when the damage was canceled before the attack ended, and is heard when the damage destroyed the character", () => {
    const { t, state } = fight();
    const noted = noteHurt(state, t.hero, 0, 2, t.ctx);
    expect(announceHurt(noted, noted.pendingAttack!).pendingEvents ?? []).toEqual([]);
    const destroyed = updateCard(noted, t.hero, { zone: "discard", damage: 6 });
    expect((announceHurt(destroyed, destroyed.pendingAttack!).pendingEvents ?? []).map((event) => event.trigger)).toEqual(["attackDamagedCharacter"]);
  });

  it("10158:A:1 notes nothing in a game with no card that hears it, and places 1 damage on Protect the Innocent for the Forced effect", () => {
    const plain = tableFromLayout(SCENARIO, { engaged: ["f3"] });
    const enemy = idOf(plain.state, "f3");
    const attack = { ...plain.state, pendingAttack: { enemyId: enemy, seat: 0, defenderId: plain.hero } } as ScenarioState;
    expect(noteHurt(attack, plain.hero, 0, 2, plain.ctx)).toBe(attack);
    const t = built({ staging: [PROTECT], engaged: ["f3"] });
    const run = resolveRecords(t.state, t.ctx, PROTECT, "forced", idOf(t.state, PROTECT));
    expect(run.state.cards[idOf(t.state, PROTECT)]?.damage).toBe(1);
  });
});

describe("the campaign card's Setup (10156:A:2)", () => {
  it("10156:A:2 attaches a copy of the Pendant from the supply to Iârion, under his controller", () => {
    const t = built({ play: [IARION] });
    const run = runInstruction(t.state, { verb: "AttachNewTo", code: PENDANT, to: "Iârion" }, { seat: 0, sourceId: null }, t.ctx, []);
    const iarion = idOf(run, IARION);
    const pendant = run.cards[idOf(run, PENDANT)]!;
    expect(pendant).toMatchObject({ zone: "play", host: iarion, controller: 0 });
    // With no Iârion in play nothing is attached.
    const bare = built();
    expect(runInstruction(bare.state, { verb: "AttachNewTo", code: PENDANT, to: "Iârion" }, { seat: 0, sourceId: null }, bare.ctx, [])).toBe(bare.state);
  });

  it("10156:A:2 adds Protect the Innocent to the staging area, and lets each player in turn place 4 damage on it to add 1 resource to each of their heroes, and decline", () => {
    const t = built({ seats: 2, play: [IARION] });
    const frame = (answers: string[]): ScenarioState => {
      const pending = [...answers];
      return resolveRecords(t.state, t.ctx, "10156", "campaignSetup", undefined, () => pending.shift() ?? "keep").state;
    };
    const both = frame(["trade", "trade"]);
    expect(both.cards[idOf(both, PROTECT)]).toMatchObject({ zone: "staging", damage: 8 });
    expect(both.cards[t.hero]?.resources).toBe(1);
    expect(both.cards[t.hero2]?.resources).toBe(1);
    expect(both.cards[t.seat1Hero ?? ""]?.resources).toBe(1);
    const mixed = frame(["keep", "trade"]);
    expect(mixed.cards[idOf(mixed, PROTECT)]?.damage).toBe(4);
    expect(mixed.cards[t.hero]?.resources).toBe(0);
    expect(mixed.cards[t.seat1Hero ?? ""]?.resources).toBe(1);
    const declined = frame([]);
    expect(declined.cards[idOf(declined, PROTECT)]?.damage).toBe(0);
  });
});

describe("Sudden Assault's comparison (09021:A:1)", () => {
  it("09021:A:1 holds when the committed Willpower is greater than the Threat in the staging area (an empty staging area: 0 Threat)", () => {
    const strong = built({ staging: ["f3"], committed: [HERO, HERO2] });
    expect(holds(strong.state, { kind: "questLeads" }, scope, strong.ctx)).toBe(true);
    const weak = built({ staging: ["f3", "f3"], committed: [HERO] });
    expect(holds(weak.state, { kind: "questLeads" }, scope, weak.ctx)).toBe(false);
    const empty = built({ committed: [HERO] });
    expect(holds(empty.state, { kind: "questLeads" }, scope, empty.ctx)).toBe(true);
  });
});
