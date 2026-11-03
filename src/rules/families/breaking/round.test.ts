// Rules: mec109.multiple-staging-areas, mec109.saga-staging-rules, rr.step-3-3, rr.step-3-4, rr.engagement-check, rr.optional-engagement, mec109.archery,
// rr.player-elimination (data/rules/entries.json). A round played with separate staging areas: each seat reveals into its own area, quests against it, raises only
// its own threat, engages only from it, takes its own stage's archery, and an eliminated seat's area and stage are discarded.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { expectOk } from "../../fixture.ts";
import { legalIntents, legalTargets, reduce, type PlayerIntent, type ScenarioState } from "../../reduce.ts";
import { archeryRecipients, archeryTotal } from "../../combat.ts";
import { optionalEnemies, qualifyingEnemies, stagingThreat } from "../../quest.ts";
import { clearEliminated } from "../../keywords.ts";
import { withSeat, withThreat } from "../../state.ts";
import { runInstruction } from "../../interpret.ts";
import { settle } from "../../machine.ts";
import type { EngineStep } from "../../intents.ts";
import { codes, loadBreakingWorld, makeBreaking, settled, type BreakingLayout, type BreakingTable, type BreakingWorld } from "../../../../scripts/breaking-scene.ts";
import { first } from "../../../../scripts/past-scene.ts";

let world: BreakingWorld;

beforeAll(async () => {
  world = await loadBreakingWorld();
}, 60_000);

const heroes = [["strong"], ["weak"]] as const;
const make = (layout: BreakingLayout = {}) => makeBreaking(world, { seats: 2, stage: "separate", frodo: false, heroes, threats: [30, 30], ...layout });

function send(table: BreakingTable, state: ScenarioState, intent: PlayerIntent): ScenarioState {
  return expectOk(reduce(state, intent, table.ctx)).state;
}

// Passes every pass window until the encounter phase opens (or `until` is reached).
function toEncounter(table: BreakingTable, state: ScenarioState): ScenarioState {
  let current = state;
  for (let guard = 0; guard < 40 && current.phase !== "Encounter" && !current.lost; guard += 1) {
    if (current.window?.kind === "pass") current = send(table, current, { type: "Pass" });
    else if (current.window?.kind === "travel") current = send(table, current, { type: "DeclineTravel" });
    // A stage 3B's Response to a successful quest (142063:B:3) is passed.
    else if (current.window?.kind === "response") current = send(table, current, { type: "Pass" });
    else break;
  }
  return current;
}

// Each seat commits its hero and passes, the first seat to act first.
function commitBoth(table: BreakingTable, state: ScenarioState): ScenarioState {
  let current = state;
  for (let turn = 0; turn < 2; turn += 1) {
    current = send(table, current, { type: "Commit", cardIds: [table.heroes[current.activeSeat]?.[0] ?? ""] });
    current = send(table, current, { type: "Pass" });
  }
  return current;
}

describe("the quest phase with separate staging", () => {
  // Seat 0 has grunt (2) and the deck's first card; seat 1 has brute (3), scout (1) and the deck's second card.
  const layout: BreakingLayout = { areas: [["grunt"], ["brute", "scout"]], deck: ["scout", "grunt"] };

  it("reveals one card for each seat into its own staging area", () => {
    const table = make(layout);
    const committed = commitBoth(table, table.state);
    const mid = settled(table, committed);
    // The seats revealed in order, and each card is in its revealer's area, not the shared one.
    expect(mid.seats[0].staging.map((id) => mid.cards[id]?.code)).toEqual(["grunt", "scout"]);
    expect(mid.seats[1].staging.map((id) => mid.cards[id]?.code)).toEqual(["brute", "scout", "grunt"]);
    expect(mid.staging).toHaveLength(5);
    expect(codes(mid, mid.encounterDeck)).toEqual([]);
  });

  it("compares each seat's own committed willpower with its own area's threat: progress on its own stage, or only its own threat raised", () => {
    // Frodo's Choice is in play (the area of seat 1), so a stage 3B takes progress (142063:B:1 turns it into discards while it is not).
    const table = make({ ...layout, areas: [["grunt"], ["brute", "scout", "142068"]] });
    const after = toEncounter(table, commitBoth(table, table.state));
    // Seat 0: willpower 6 against grunt 2 + scout 1: 3 progress on its own stage. Seat 1: willpower 1 against 3 + 1 + 2: its threat rises by 5; seat 0's does not.
    expect(after.cards[after.seats[0].stage ?? ""]?.progress).toBe(3);
    expect(after.cards[after.seats[1].stage ?? ""]?.progress).toBe(0);
    expect(after.seats[0].threat).toBe(30);
    expect(after.seats[1].threat).toBe(35);
    expect(after.phase).toBe("Encounter");
    // Nobody is committed any more, and no stage moved.
    expect(Object.values(after.cards).some((card) => card.committed)).toBe(false);
    expect(after.cards[after.seats[0].stage ?? ""]?.code).toBe("142063");
  });

  it("reads the threat of an area, not the whole staging area, and the willpower of the seat alone", () => {
    const table = make(layout);
    expect(stagingThreat(table.state, world.cards, 0)).toBe(2);
    expect(stagingThreat(table.state, world.cards, 1)).toBe(4);
    expect(stagingThreat(table.state, world.cards)).toBe(6);
  });
});

describe("the encounter phase with separate staging", () => {
  const layout: BreakingLayout = { areas: [["grunt", "scout"], ["brute", "grunt"]], phase: "Encounter" };

  it("lets a seat engage and check against only the enemies in its own area", () => {
    const table = make(layout);
    const state = table.state;
    expect(codes(state, optionalEnemies(state, world.cards, 0)).sort()).toEqual(["grunt", "scout"]);
    expect(codes(state, optionalEnemies(state, world.cards, 1)).sort()).toEqual(["brute", "grunt"]);
    // Both are high enough for every cost, so each check engages the dearest enemy of its own area first.
    const rich = { ...state, seats: [{ ...state.seats[0], threat: 45 }, { ...state.seats[1], threat: 45 }] as typeof state.seats };
    expect(codes(rich, qualifyingEnemies(rich, 0, world.cards))).toEqual(["scout", "grunt"]);
    expect(codes(rich, qualifyingEnemies(rich, 1, world.cards))).toEqual(["brute", "grunt"]);
    // The legal Engage targets are the acting seat's own.
    expect(codes(state, legalTargets(state, { type: "Engage" }, table.ctx))).toEqual(expect.arrayContaining(["grunt", "scout"]));
    expect(legalTargets(state, { type: "Engage" }, table.ctx)).toEqual(optionalEnemies(state, world.cards, 0));
    const refused = reduce(state, { type: "Engage", enemyId: state.seats[1].staging[0] ?? "" }, table.ctx);
    expect(refused.ok).toBe(false);
  });

  it("engages each seat's enemies from its own area through the engagement checks, leaving a too-dear enemy where it is", () => {
    const table = make({ ...layout, threats: [25, 25] });
    let state = send(table, table.state, { type: "DeclineEngage" });
    state = send(table, state, { type: "DeclineEngage" });
    for (let guard = 0; guard < 10 && state.window?.kind === "chooseEnemy"; guard += 1) state = send(table, state, { type: "ChooseEnemy", enemyId: state.window.options[0] ?? "" });
    state = settled(table, state);
    // Seat 0 (threat 25) engaged scout (20) and then grunt (10) over the passes; seat 1 engaged grunt only: brute (40) is too dear, and seat 0's enemies were never its choice.
    expect(codes(state, state.seats[0].engaged).sort()).toEqual(["grunt", "scout"]);
    expect(codes(state, state.seats[1].engaged)).toEqual(["grunt"]);
    expect(codes(state, state.seats[1].staging)).toEqual(["brute"]);
    expect(state.seats[0].staging).toEqual([]);
  });

  it("offers no optional engagement to a seat whose area is empty", () => {
    const table = make({ areas: [[], ["grunt"]], phase: "Encounter" });
    expect(optionalEnemies(table.state, world.cards, 0)).toEqual([]);
    expect(optionalEnemies(table.state, world.cards, 1)).toHaveLength(1);
    const next = send(table, table.state, { type: "DeclineEngage" });
    expect(next.activeSeat).toBe(1);
    expect(legalIntents(next, table.ctx).map((intent) => intent.type)).toContain("Engage");
  });
});

describe("archery with separate staging", () => {
  it("is totaled at each stage: the stage's area and engaged enemies, and only that seat assigns it", () => {
    const table = make({ areas: [["archer"], ["grunt"]], engaged: [{ code: "archer", seat: 1 }], phase: "Combat" });
    expect(archeryTotal(table.state, world.cards, 0)).toBe(2);
    expect(archeryTotal(table.state, world.cards, 1)).toBe(2);
    expect(archeryTotal(table.state, world.cards)).toBe(4);
    const after = settled(table, table.state);
    expect(after.window).toEqual({ kind: "archery", total: 2, seat: 0 });
    expect(after.activeSeat).toBe(0);
    const own = table.heroes[0]?.[0] ?? "";
    const other = table.heroes[1]?.[0] ?? "";
    expect(legalTargets(after, { type: "Distribute" }, table.ctx)).toEqual([own]);
    expect(reduce(after, { type: "Distribute", assignments: [{ cardId: other, amount: 2 }] }, table.ctx).ok).toBe(false);
    const dealt = send(table, after, { type: "Distribute", assignments: [{ cardId: own, amount: 2 }] });
    expect(dealt.cards[own]?.damage).toBe(2);
    // Then the second stage's own window, for the second seat.
    const second = settled(table, dealt);
    expect(second.window).toEqual({ kind: "archery", total: 2, seat: 1 });
    expect(second.activeSeat).toBe(1);
    expect(legalTargets(second, { type: "Distribute" }, table.ctx)).toEqual([other]);
    const done = send(table, second, { type: "Distribute", assignments: [{ cardId: other, amount: 2 }] });
    expect(done.cards[other]?.damage).toBe(2);
    expect(settled(table, done).window?.kind).not.toBe("archery");
    expect(settled(table, done).archeryDone).toBeUndefined();
  });

  it("asks only the stage that has archery", () => {
    const table = make({ areas: [[], ["archer"]], phase: "Combat" });
    const after = settled(table, table.state);
    expect(after.window).toEqual({ kind: "archery", total: 2, seat: 1 });
    expect(archeryRecipients(after, world.cards, 1)).toEqual([table.heroes[1]?.[0]]);
    expect(archeryRecipients(after, world.cards)).toHaveLength(2);
  });
});

describe("an eliminated seat with separate staging", () => {
  it("discards its stage and the encounter cards at it, the enemies engaged with it included, and leaves the other seat's stage alone", () => {
    const table = make({ areas: [["grunt"], ["brute", "scout"]], engaged: [{ code: "archer", seat: 1 }] });
    const stage = table.state.seats[1].stage ?? "";
    const eliminated = withSeat(withThreat(table.state, 1, 50), 1, { ...table.state.seats[1], threat: 50, eliminated: true });
    const after = clearEliminated(eliminated, world.cards);
    expect(after.seats[1].staging).toEqual([]);
    expect(after.seats[1].stage).toBeUndefined();
    expect(codes(after, after.encounterDiscard).sort()).toEqual(["archer", "brute", "scout"]);
    expect(after.cards[stage]?.zone).toBe("setAside");
    expect(codes(after, after.seats[0].staging)).toEqual(["grunt"]);
    expect(after.cards[after.seats[0].stage ?? ""]?.zone).toBe("questStage");
    expect(first(after, "grunt") in after.cards).toBe(true);
    expect(after.staging).toEqual(after.seats[0].staging);
  });
});

describe("an effect's staging area and quest with separate staging", () => {
  it("are the acting seat's own: progress goes on its stage and a card added to the staging area goes to its area", () => {
    const table = make({ areas: [["grunt", "142068"], ["scout"]], setAside: ["142073"] });
    const stage1 = table.state.seats[1].stage ?? "";
    const steps: EngineStep[] = [];
    const progressed = runInstruction({ ...table.state, window: null }, { verb: "PlaceQuestProgress", perPlayer: 2 }, { seat: 1, sourceId: stage1 }, table.ctx, steps);
    expect(progressed.cards[stage1]?.progress).toBe(4);
    expect(progressed.cards[table.state.seats[0].stage ?? ""]?.progress).toBe(0);
    expect(progressed.separate).toBe(true);
    expect(progressed.questStage).toBeNull();
    const added = runInstruction({ ...table.state, window: null }, { verb: "AddSetAsideToStaging", code: "142073" }, { seat: 1, sourceId: stage1 }, table.ctx, steps);
    expect(codes(added, added.seats[1].staging)).toEqual(["scout", "142073"]);
    expect(codes(added, added.seats[0].staging)).toEqual(["grunt", "142068"]);
    expect(added.staging).toHaveLength(4);
    expect(codes(added, added.setAside)).not.toContain("142073");
    const forSeatZero = runInstruction({ ...table.state, window: null }, { verb: "AddSetAsideToStaging", code: "142073" }, { seat: 0, sourceId: stage1 }, table.ctx, steps);
    expect(codes(forSeatZero, forSeatZero.seats[0].staging)).toEqual(["grunt", "142068", "142073"]);
  });
});

describe("advancing one seat's stage", () => {
  it("replaces only that seat's stage with the one named, side B up, and its When Revealed effects resolve for that seat", () => {
    const table = make({ areas: [["grunt"], ["scout"]], setAside: ["142073"] });
    // A stand-in for the 4A record (phase 16b): "Add Parth Galen to the staging area."
    const record: Effect = { id: "142067:whenRevealed:1", cardCode: "142067", lines: ["142067:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSetAsideToStaging", code: "142073" }] };
    const ctx = { ...table.ctx, effects: [...table.ctx.effects, record] };
    const stage0 = table.state.seats[0].stage ?? "";
    const stage1 = table.state.seats[1].stage ?? "";
    const steps: EngineStep[] = [];
    const advanced = settle(runInstruction({ ...table.state, window: null }, { verb: "AdvanceToStage", code: "142067" }, { seat: 1, sourceId: stage1 }, ctx, steps), ctx, steps);
    expect(advanced.cards[advanced.seats[1].stage ?? ""]?.code).toBe("142067");
    expect(advanced.cards[advanced.seats[1].stage ?? ""]?.face).toBe("B");
    expect(advanced.cards[advanced.seats[1].stage ?? ""]?.zone).toBe("questStage");
    expect(advanced.cards[stage1]?.zone).toBe("setAside");
    expect(advanced.seats[0].stage).toBe(stage0);
    expect(advanced.questStage).toBeNull();
    expect(advanced.questDeck.map((id) => advanced.cards[id]?.code)).toEqual(["142065", "142066"]);
    expect(steps.filter((step) => step.kind === "advance")).toHaveLength(1);
    // The new stage's When Revealed effect ran for seat 1: Parth Galen went to seat 1's staging area.
    expect(codes(advanced, advanced.seats[1].staging)).toEqual(["scout", "142073"]);
    expect(codes(advanced, advanced.seats[0].staging)).toEqual(["grunt"]);
    expect(advanced.viewSeat).toBeUndefined();
    // A code that is not in the quest deck changes nothing.
    const none = runInstruction({ ...table.state, window: null }, { verb: "AdvanceToStage", code: "142099" }, { seat: 1, sourceId: stage1 }, ctx, []);
    expect(none.seats[1].stage).toBe(stage1);
  });
});

describe("from stage 2B into the next round", () => {
  it("plays stage 2B at the end of the refresh phase and then a quest phase with the new areas: each seat reveals into its own", () => {
    const table = makeBreaking(world, { seats: 2, stage: 2, heroes, frodo: false, threats: [30, 30], staging: ["grunt", "brute"], deck: ["scout", "place", "grunt", "brute"], discard: [], setAside: ["142074", "142068"], phase: "Refresh" });
    let state = settled(table, { ...table.state, mode: "refresh", window: null });
    for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) {
      const options = state.window.options;
      // The first player takes Orc Hunting (142066), the second then has the other three: it takes the first.
      const pick = options.includes("142066") && state.activeSeat === 0 ? "142066" : (options[0] ?? "");
      state = settled(table, send(table, state, { type: "Choose", optionId: pick }));
    }
    expect(state.separate).toBe(true);
    expect(codes(state, [state.seats[0].stage ?? "", state.seats[1].stage ?? ""])).toEqual(["142066", "142063"]);
    // Each seat took one of the two shared cards; the stages' Forced effects revealed a card for each seat whose area was small.
    expect(sharedStagingCount(state)).toBe(0);
    expect(state.seats[0].staging.length).toBeGreaterThanOrEqual(1);
    expect(state.seats[1].staging.length).toBeGreaterThanOrEqual(1);
    // The round goes on to the next quest phase.
    let round = state;
    for (let guard = 0; guard < 30 && !(round.mode === "questCommit" && round.window?.kind === "pass"); guard += 1) {
      if (round.window?.kind === "pass") round = send(table, round, { type: "Pass" });
      else break;
    }
    expect(round.mode).toBe("questCommit");
    const before = round.seats.map((seat) => seat.staging.length);
    const revealed = settled(table, commitBoth(table, round));
    // One card was revealed for each seat into its own area: each area grew by one (a card with Surge adds more, and none of these has it).
    expect(revealed.seats[0].staging.length + revealed.seats[1].staging.length).toBe(before[0]! + before[1]! + 2);
    expect(revealed.seats[0].staging.length).toBe(before[0]! + 1);
    expect(revealed.seats[1].staging.length).toBe(before[1]! + 1);
  });
});

function sharedStagingCount(state: ScenarioState): number {
  const owned = new Set(state.seats.flatMap((seat) => seat.staging));
  return state.staging.filter((id) => !owned.has(id)).length;
}
