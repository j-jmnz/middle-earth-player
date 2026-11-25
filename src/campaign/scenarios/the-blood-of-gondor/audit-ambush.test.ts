// Rules: ats.hidden-cards, ats.hidden-cards-turn-faceup, faq.blood-of-gondor-hidden-cards, faq.errata.06117, faq.errata.06123, hon.battle, hon.siege, mec109.archery, rr.then, rr.forced, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 06117:A:1, 06117:B:1, 06117:B:2, 06118:A:1, 06118:B:1, 06118:B:2, 06118:B:3, 06118:B:4, 06119:A:1, 06119:A:2, 06120:A:1, 06120:A:2, 06121:A:1, 06122:A:1, 06122:A:2, 06123:A:1, 06123:A:2, 06123:A:3, 06124:A:1, 06125:A:1, 06125:A:2, 06126:A:1, 06127:A:1, 06127:A:2, 06128:A:1, 06128:A:2, 06128:A:3, 06129:A:1, 06130:A:1, 06130:A:2, 06130:A:3, 06131:A:1, 06131:A:2, 06132:A:1, 06132:A:2, 06132:A:3, 06133:A:1, 06133:A:2, 06133:A:3.
// An independent audit of The Blood of Gondor: each test is built from the printed words and the rule spans, on the smallest table of the scene kit. A line's test runs again without the line's records and must fail there (`lineSpec`); a line the engine does not play as printed is an `it.fails` under a FAULT comment.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { first, idOf, opened, resolveRecords, send, zoneOf, type Layout } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { drive, engagedCodes, offeredActions, table, takes, CODES, BOROMIR } from "../../../../test/scenarios/the-blood-of-gondor/table.ts";

import { tableOf, hiddenOf, discardCodes, stagingCodes, endOfRound, toCombatChoice, choose } from "./audit-kit.ts";

describe("06117:A:1 The Ambush Setup", () => {
  lineSpec("06117:A:1", "puts Faramir and Lord Alcaron into play under the first player and reveals one card per player", (effects) => {
    const made = tableOf(effects)({ seats: 2, firstPlayer: 1, stage: CODES.ambush, side: "A", setAside: [CODES.faramir, CODES.alcaron], deck: ["f3", "place", "f0", "f0"] });
    const done = resolveRecords(made.state, made.ctx, CODES.ambush, "setup", first(made.state, CODES.ambush));
    for (const code of [CODES.faramir, CODES.alcaron]) {
      expect(done.state.cards[first(done.state, code)]).toMatchObject({ zone: "play", controller: 1, exhausted: false });
    }
    expect(stagingCodes(done.state)).toHaveLength(2);
    expect(done.state.encounterDeck).toHaveLength(2);
  });
  lineSpec("06117:A:1", "reveals one card for a single player", (effects) => {
    const made = tableOf(effects)({ seats: 1, stage: CODES.ambush, side: "A", setAside: [CODES.faramir, CODES.alcaron], deck: ["f3", "place", "f0", "f0"] });
    const done = resolveRecords(made.state, made.ctx, CODES.ambush, "setup", first(made.state, CODES.ambush));
    expect(zoneOf(done.state, CODES.faramir)).toBe("play");
    expect(stagingCodes(done.state)).toHaveLength(1);
    expect(done.state.encounterDeck).toHaveLength(3);
  });
});

describe("06117:B:1 and 06118:B:2 each player takes 1 hidden card at the beginning of the quest phase", () => {
  for (const [line, stage] of [["06117:B:1", CODES.ambush], ["06118:B:2", CODES.captured]] as const) {
    lineSpec(line, "each of two players takes one hidden card at the beginning of the quest phase, and none earlier", (effects) => {
      const made = tableOf(effects)({ seats: 2, stage, phase: "Planning", deck: ["f0", "f3", "f0", "f0", "f0"] });
      const planning = drive(made, opened(made), (st) => st.phase === "Planning" && st.window?.kind === "pass", () => "");
      expect([hiddenOf(planning.state, 0), hiddenOf(planning.state, 1)]).toEqual([[], []]);
      const quest = drive(made, opened(made), (st) => st.phase === "Quest" && st.mode === "questCommit");
      expect([hiddenOf(quest.state, 0), hiddenOf(quest.state, 1)]).toEqual([["f0"], ["f3"]]);
      expect(quest.state.encounterDeck).toHaveLength(3);
    });
  }
});

describe("06117:B:2 the combat phase choice", () => {
  lineSpec("06117:B:2", "turning faceup engages an enemy whatever its cost, discards a treachery and a location unresolved, and takes nothing", (effects) => {
    const made = tableOf(effects)({ seats: 1, phase: "Encounter", deck: ["f0", CODES.looms, "place", "f0", "f0", "f0"] });
    const held = takes(made, made.state, 0, 3);
    expect(hiddenOf(held, 0)).toEqual(["f0", CODES.looms, "place"]);
    const choice = toCombatChoice(made, held);
    expect(choice.state.window).toMatchObject({ kind: "choose", options: expect.arrayContaining(["turn", "take"]) });
    const done = drive(made, choose(made, choice, "turn"), (st) => st.window?.kind !== "choose" && st.window?.kind != null);
    expect(hiddenOf(done.state, 0)).toEqual([]);
    expect(engagedCodes(done.state, 0)).toContain("f0");
    expect(discardCodes(done.state)).toEqual(expect.arrayContaining([CODES.looms, "place"]));
    expect(stagingCodes(done.state)).not.toContain("place");
  });
  lineSpec("06117:B:2", "taking a hidden card instead leaves the earlier cards facedown", (effects) => {
    const made = tableOf(effects)({ seats: 1, phase: "Encounter", deck: ["f0", "place", "f3", "f0", "f0"] });
    const held = takes(made, made.state, 0, 2);
    const choice = toCombatChoice(made, held);
    const done = choose(made, choice, "take");
    expect(hiddenOf(done.state, 0)).toEqual(["f0", "place", "f3"]);
    expect(engagedCodes(done.state, 0)).toEqual([]);
  });
  lineSpec("06117:B:2", "each player chooses in turn, the first player first, and the choices are independent", (effects) => {
    const made = tableOf(effects)({ seats: 2, firstPlayer: 1, phase: "Encounter", deck: ["f0", "f3", "f0", "f0", "f0", "f0"] });
    let state = takes(made, made.state, 0, 1);
    state = takes(made, state, 1, 1);
    const choice = toCombatChoice(made, state);
    expect(choice.state.window).toMatchObject({ kind: "choose", seat: 1 });
    const second = choose(made, choice, "turn");
    expect(second.state.window).toMatchObject({ kind: "choose", seat: 0 });
    const done = choose(made, second, "take");
    expect(hiddenOf(done.state, 1)).toEqual([]);
    expect(engagedCodes(done.state, 1)).toEqual(["f3"]);
    expect(hiddenOf(done.state, 0)).toHaveLength(2);
    expect(engagedCodes(done.state, 0)).toEqual([]);
  });
});

describe("06118:A:1 Captured! When Revealed", () => {
  lineSpec("06118:A:1", "puts Faramir and Lord Alcaron under the stage in play, controlled by nobody, and does not lose the game", (effects) => {
    const made = tableOf(effects)({ seats: 1, stage: CODES.captured, side: "A", play: [CODES.faramir, CODES.alcaron], deck: ["f0", "f0"] });
    const done = resolveRecords(made.state, made.ctx, CODES.captured, "whenRevealed", first(made.state, CODES.captured));
    for (const code of [CODES.faramir, CODES.alcaron]) {
      const card = done.state.cards[first(done.state, code)];
      expect(card?.controller).toBeNull();
      expect(card?.host).toBe(first(done.state, CODES.captured));
      expect(card?.zone).not.toBe("discard");
      expect(done.state.seats[0]?.play).not.toContain(card?.id);
    }
    expect(done.state.lost).not.toBe(true);
  });
  lineSpec("06118:A:1", "then every player turns the hidden cards he holds faceup, and a card taken meanwhile stays facedown", (effects) => {
    const made = tableOf(effects)({ seats: 2, stage: CODES.captured, side: "A", play: [CODES.faramir, CODES.alcaron], deck: ["f0", CODES.looms, CODES.crow, "f3", "f0", "f0"] });
    let state = takes(made, made.state, 0, 2);
    state = takes(made, state, 1, 2);
    expect([hiddenOf(state, 0), hiddenOf(state, 1)]).toEqual([["f0", CODES.looms], [CODES.crow, "f3"]]);
    const done = resolveRecords(state, made.ctx, CODES.captured, "whenRevealed", first(state, CODES.captured));
    expect(engagedCodes(done.state, 0)).toEqual(["f0"]);
    expect(engagedCodes(done.state, 1)).toEqual(expect.arrayContaining([CODES.crow, "f3"]));
    expect(discardCodes(done.state)).toContain(CODES.looms);
    // Evil Crow engaged seat 1 during the turn and made him take a card: that card stays facedown (faq.blood-of-gondor-hidden-cards).
    expect(hiddenOf(done.state, 0)).toEqual([]);
    expect(hiddenOf(done.state, 1)).toHaveLength(1);
  });
  lineSpec("06118:A:1", "the allies under the stage cannot use their Action and do not return to the first player when the token passes", (effects) => {
    const made = tableOf(effects)({ seats: 2, stage: CODES.captured, side: "A", play: [CODES.faramir, CODES.alcaron], engaged: ["f0"], phase: "Refresh", deck: ["f0", "f0"] });
    const under = resolveRecords(made.state, made.ctx, CODES.captured, "whenRevealed", first(made.state, CODES.captured));
    const combat = { ...under.state, phase: "Combat" as const, boundaryPhase: "Combat" as const, mode: "combatActions" as const, window: { kind: "pass" as const }, activeSeat: 0 };
    expect(offeredActions(made, combat)).toEqual([]);
    const refreshed = endOfRound(made, under.state);
    expect(refreshed.state.round).toBe(under.state.round + 1);
    expect(refreshed.state.firstPlayer).toBe(1);
    for (const code of [CODES.faramir, CODES.alcaron]) expect(refreshed.state.cards[first(refreshed.state, code)]?.controller).toBeNull();
    expect(refreshed.state.lost).not.toBe(true);
  });
});

describe("06118:B:1 and 06123:A:1 Battle and Siege", () => {
  // Boromir counts Willpower 1, Attack 3, Defense 2.
  const quested = (effects: readonly Effect[], layout: Layout): { state: ScenarioState; progress: number } => {
    const made = tableOf(effects)({ seats: 1, stage: CODES.captured, phase: "Quest", heroes: [BOROMIR], ...layout });
    const run = send(opened(made), { type: "Commit", cardIds: [idOf(made.state, BOROMIR)] }, made.ctx);
    const done = drive(made, run, (st) => st.phase !== "Quest");
    return { state: done.state, progress: done.state.cards[first(done.state, CODES.captured)]?.progress ?? 0 };
  };
  it("06118:B:1 characters count Attack instead of Willpower when questing", () => {
    expect(quested(EFFECTS, {}).progress).toBe(3);
  });
  lineSpec("06123:A:1", "the current quest gains Siege and loses Battle: Defense counts, with the Cross-roads in the staging area", (effects) => {
    // Two players: the Cross-roads has Threat 2, Defense 2 matches it, Willpower 1 would raise the threat, Attack 3 would explore.
    const result = quested(effects, { seats: 2, staging: [CODES.crossroads] });
    expect(result.progress).toBe(0);
    expect(result.state.seats[0]?.threat).toBe(28);
  });
  lineSpec("06123:A:1", "also while the Cross-roads is the active location", (effects) => {
    // Defense 2 is exactly the Cross-roads' 2 quest points: it is explored and the quest gets nothing; Attack 3 would put 1 on the quest, Willpower 1 would leave the location unexplored.
    const result = quested(effects, { active: CODES.crossroads });
    expect(result.progress).toBe(0);
    expect(zoneOf(result.state, CODES.crossroads)).not.toBe("activeLocation");
  });
});

describe("06123:A:1 on stage 1", () => {
  lineSpec("06123:A:1", "the current quest card is The Ambush too: Defense counts, so Boromir (Defense 2) explores the active Cross-roads (2 quest points)", (effects) => {
    const made = tableOf(effects)({ seats: 1, stage: CODES.ambush, phase: "Quest", heroes: [BOROMIR], active: CODES.crossroads });
    const run = drive(made, send(opened(made), { type: "Commit", cardIds: [idOf(made.state, BOROMIR)] }, made.ctx), (st) => st.phase !== "Quest");
    expect(zoneOf(run.state, CODES.crossroads)).not.toBe("activeLocation");
  });
});

describe("06118:B:3 five hidden cards", () => {
  lineSpec("06118:B:3", "a player who takes his fifth hidden card turns all five faceup, and the other player's cards stay", (effects) => {
    const made = tableOf(effects)({ seats: 2, stage: CODES.captured, phase: "Planning", deck: ["treachery", "treachery", "treachery", "treachery", "place", "f0", "f0", "f0", "f0", "f0"] });
    let state = takes(made, made.state, 0, 4);
    state = takes(made, state, 1, 1);
    const quest = drive(made, opened(made, state), (st) => st.phase === "Quest" && st.mode === "questCommit");
    expect(hiddenOf(quest.state, 0)).toEqual([]);
    expect(discardCodes(quest.state).filter((code) => code === "treachery")).toHaveLength(4);
    expect(hiddenOf(quest.state, 1)).toHaveLength(2);
  });
  it("06118:B:3 four hidden cards stay facedown", () => {
    const made = table({ seats: 1, stage: CODES.captured, phase: "Planning", deck: ["treachery", "treachery", "treachery", "treachery", "f0", "f0", "f0", "f0"] });
    const state = takes(made, made.state, 0, 3);
    const quest = drive(made, opened(made, state), (st) => st.phase === "Quest" && st.mode === "questCommit");
    expect(hiddenOf(quest.state, 0)).toHaveLength(4);
  });
  it("06118:B:3 does not apply on stage 1", () => {
    const made = table({ seats: 1, stage: CODES.ambush, phase: "Planning", deck: ["treachery", "treachery", "treachery", "treachery", "treachery", "f0", "f0"] });
    const state = takes(made, made.state, 0, 4);
    const quest = drive(made, opened(made, state), (st) => st.phase === "Quest" && st.mode === "questCommit");
    expect(hiddenOf(quest.state, 0)).toHaveLength(5);
  });
});

describe("06118:B:4 winning", () => {
  it("06118:B:4 defeating the stage wins the game", () => {
    const made = table({ seats: 1, stage: CODES.captured, progress: 13, phase: "Quest", heroes: [BOROMIR] }, undefined, [BOROMIR]);
    const run = drive(made, send(opened(made), { type: "Commit", cardIds: [idOf(made.state, BOROMIR)] }, made.ctx), (st) => st.phase !== "Quest" || st.stageCleared === true);
    expect(run.state.lost).not.toBe(true);
    expect(run.state.stageCleared || run.state.resolution != null).toBe(true);
  });
});

