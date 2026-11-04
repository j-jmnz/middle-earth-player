import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/interpret/constants.ts";
import { modifiedStat } from "../rules/core/keywords.ts";
import { legalIntents, legalTargets, reduce } from "../rules/engine/reduce.ts";
import { qualifyingEnemies, resolveQuest } from "../rules/quest/quest.ts";
import { attachBlocked, heroLimitExempt, restricted } from "../rules/interpret/restrictions.ts";
import { updateCard, type ScenarioState } from "../rules/core/state.ts";
import { attachTo, moveCard, spawn } from "../rules/core/zones.ts";
import { buildTable, begin, FRODO, idsOf, RIDER, SAM, sceneCards, send, type Scene, type Table } from "../../test/harness/scene.ts";

let base: Awaited<ReturnType<typeof sceneCards>>;

beforeAll(async () => {
  base = await sceneCards();
});

function synced(scene: Scene): Table {
  const table = buildTable(base, scene);
  return { ...table, state: syncConstants(table.state, table.ctx) };
}

// Reveals a Black Rider (Hide 2) from the top of the deck, commits `commit`, passes the action window, and
// returns what the test measured.
function hideTest(scene: Scene, commit: (table: Table) => string[] = () => []) {
  const table = buildTable(base, { deck: [RIDER, "f3", "f3", "f3", "f3", "f0"], ...scene });
  let run = begin(syncConstants(table.state, table.ctx));
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) run = send(run, { type: "Pass" }, table.ctx);
  expect(run.state.window?.kind).toBe("hideCommit");
  run = send(run, { type: "CommitHide", cardIds: commit(table) }, table.ctx);
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) run = send(run, { type: "Pass" }, table.ctx);
  const step = run.steps.find((entry) => entry.kind === "hideTest");
  if (step?.kind !== "hideTest") throw new Error("No Hide test ran");
  return { step, run, table };
}

describe("Hide numbers from constant effects", () => {
  it("141032 constant: hideValue -1 while the source is the active location", () => {
    expect(hideTest({}).step.discardedIds).toHaveLength(2);
    expect(hideTest({ active: "141032" }).step.discardedIds).toHaveLength(1);
    // In the staging area it does nothing.
    expect(hideTest({ staging: ["141032"] }).step.discardedIds).toHaveLength(2);
  });

  it("141040 constant: hideValue +1 for the engaged seat while the source is engaged", () => {
    expect(hideTest({ engaged: [{ code: "141040", seat: 0 }] }).step.discardedIds).toHaveLength(3);
    expect(hideTest({ seats: 2, engaged: [{ code: "141040", seat: 1 }] }).step.discardedIds).toHaveLength(2);
    expect(hideTest({ staging: ["141040"] }).step.discardedIds).toHaveLength(2);
  });

  it("141037 constant: hideThreat +2 while the source is in staging", () => {
    const plain = hideTest({});
    const road = hideTest({ staging: ["141037"] });
    expect(road.step.threat).toBe(plain.step.threat + 2);
    expect(hideTest({ active: "141037" }).step.threat).toBe(plain.step.threat);
  });

  it("141036 constant: hideWillpower per committed character while the source is the active location", () => {
    const both = (table: Table) => [idsOf(table, FRODO), idsOf(table, SAM)];
    const plain = hideTest({}, both);
    expect(plain.step.willpower).toBe(5);
    expect(hideTest({ active: "141036" }, both).step.willpower).toBe(7);
    expect(hideTest({ staging: ["141036"] }, both).step.willpower).toBe(5);
  });

  it("141023 constant: hideThreat per ally of the testing seat (141023:B:2 adds to the total Threat)", () => {
    const frodo = (table: Table) => [idsOf(table, FRODO)];
    const stage = { stage: "141023" };
    const plain = hideTest(stage, frodo).step;
    expect(plain.willpower).toBe(2);
    const allies = [{ code: "ally", seat: 0 }, { code: "ally", seat: 0 }];
    const crowded = hideTest({ ...stage, allies }, frodo).step;
    expect(crowded.willpower).toBe(2);
    expect(crowded.threat).toBe(plain.threat + 2);
    // An ally another seat controls does not count.
    expect(hideTest({ ...stage, seats: 2, allies: [{ code: "ally", seat: 1 }] }, frodo).step.threat).toBe(plain.threat);
  });

  it("constant records follow their source out of play", () => {
    const table = synced({ active: "141032" });
    expect(table.state.modifiers.some((modifier) => modifier.origin === "141032:constant:1")).toBe(true);
    const gone = moveCard(table.state, idsOf(table, "141032"), { zone: "encounterDiscard" });
    expect(syncConstants(gone, table.ctx).modifiers.some((modifier) => modifier.origin != null)).toBe(false);
  });
});

describe("stats from constant effects", () => {
  it("141072 constant: questPoints +4 while the source is in staging", () => {
    const table = synced({ staging: ["141072"] });
    const id = idsOf(table, "141072");
    expect(modifiedStat(table.state, table.state.cards[id]!, "questPoints", table.ctx.cards)).toBe(7);
    const traveled = syncConstants(moveCard(table.state, id, { zone: "activeLocation" }), table.ctx);
    expect(modifiedStat(traveled, traveled.cards[id]!, "questPoints", table.ctx.cards)).toBe(3);
  });

  it("141074 constant: engagementCost -10 on the host, read by qualifyingEnemies", () => {
    const base0 = buildTable(base, { staging: [RIDER, "141074"], start: "encounter" });
    const rider = idsOf(base0, RIDER);
    const steed = idsOf(base0, "141074");
    let state = attachTo(moveCard(base0.state, steed, { zone: "attached" }), steed, rider);
    state = syncConstants(state, base0.ctx);
    expect(modifiedStat(state, state.cards[rider]!, "engagementCost", base0.ctx.cards)).toBe(25);
    // 8 threat is below both; 25 qualifies and 35 does not.
    const at25 = { ...state, seats: [{ ...state.seats[0], threat: 25 }, state.seats[1]] as ScenarioState["seats"] };
    expect(qualifyingEnemies(at25, 0, base0.ctx.cards)).toEqual([rider]);
    const off = syncConstants(moveCard(at25, steed, { zone: "encounterDiscard" }), base0.ctx);
    expect(modifiedStat(off, off.cards[rider]!, "engagementCost", base0.ctx.cards)).toBe(35);
    expect(qualifyingEnemies(off, 0, base0.ctx.cards)).toEqual([]);
  });
});

describe("rules from constant effects", () => {
  it("141039 constant: Restrict attach with an exceptTrait", () => {
    const table = buildTable(base, { engaged: [{ code: RIDER, seat: 0 }] });
    const rider = idsOf(table, RIDER);
    expect(restricted(table.state, table.ctx, "attach")).toEqual([{ sourceId: rider, what: "attach", exceptTrait: "Morgul" }]);
    expect(attachBlocked(table.state, table.ctx, rider, "141074")).toBe(false);
    expect(attachBlocked(table.state, table.ctx, rider, "plain")).toBe(true);
    const other = buildTable(base, { engaged: [{ code: "141040", seat: 0 }] });
    expect(attachBlocked(other.state, other.ctx, idsOf(other, "141040"), "plain")).toBe(false);
  });

  it("141085 constant: Restrict heroLimit exempts the host", () => {
    const table = buildTable(base, {});
    expect(heroLimitExempt(table.state, table.ctx, idsOf(table, FRODO))).toBe(true);
    expect(heroLimitExempt(table.state, table.ctx, idsOf(table, SAM))).toBe(false);
    expect(heroLimitExempt(buildTable(base, { ring: "none" }).state, table.ctx, idsOf(table, FRODO))).toBe(false);
  });

  it("141022 constant: advance restriction lifted when the victory display holds the location", () => {
    const table = buildTable(base, { stage: "141022", progress: 0 });
    const stage = idsOf(table, "141022");
    const full = updateCard(updateCard(table.state, idsOf(table, SAM), { committed: true }), stage, { progress: 0 });
    const gate = (state: ScenarioState) => restricted(state, table.ctx, "advance").length === 0;
    expect(gate(full)).toBe(false);
    const held = resolveQuest(full, table.ctx.cards, [], gate);
    // A stage that cannot advance takes all of Sam's 3 progress (faq.progress-without-advancing).
    expect(held.cards[stage]).toMatchObject({ progress: 3, face: "B" });
    expect(held.questStage).toBe(stage);
    // Bag End reaches the victory display; the next resolution moves the stage on.
    const bagEnd = spawn(held, "141031", { zone: "victory" });
    expect(gate(bagEnd.state)).toBe(true);
    const ready = updateCard(bagEnd.state, idsOf(table, SAM), { committed: true });
    const moved = resolveQuest(ready, table.ctx.cards, [], gate);
    expect(moved.cards[moved.questStage ?? ""]?.code).toBe("141023");
  });

  it("141022 constant: a full quest phase leaves the stage in place while the advance restriction holds", () => {
    const table = buildTable(base, { stage: "141022", deck: ["f0", "f0", "f0"] });
    const stage = idsOf(table, "141022");
    let run = send(begin(table.state), { type: "Commit", cardIds: [idsOf(table, SAM)] }, table.ctx);
    run = send(run, { type: "Pass" }, table.ctx);
    expect(run.steps.some((step) => step.kind === "advance")).toBe(false);
    expect(run.state.cards[stage]).toMatchObject({ zone: "questStage", progress: 3 });
    expect(run.state.mode).toBe("travel");
  });

  it("141035 constant: Restrict travel while otherLocationInPlay holds", () => {
    const table = buildTable(base, { start: "travel", staging: ["141035", "141034"] });
    const ferry = idsOf(table, "141035");
    const road = idsOf(table, "141034");
    expect(legalTargets(table.state, { type: "Travel" }, table.ctx)).toEqual([road]);
    const refused = reduce(table.state, { type: "Travel", locationId: ferry }, table.ctx);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe("Players cannot travel to that location now");
    expect(send(begin(table.state), { type: "Travel", locationId: road }, table.ctx).state.activeLocation).toBe(road);
  });

  it("141035 constant: otherLocationInPlay does not count the source", () => {
    const table = buildTable(base, { start: "travel", staging: ["141035"] });
    expect(legalTargets(table.state, { type: "Travel" }, table.ctx)).toEqual([idsOf(table, "141035")]);
    expect(legalIntents(table.state, table.ctx).map((intent) => intent.type)).toEqual(["Travel", "DeclineTravel"]);
  });
});

describe("Travel effects", () => {
  it("141035 travel: HideTest x3 resolves, then the travel happens", () => {
    const table = buildTable(base, { start: "travel", staging: ["141035", "f3"], deck: ["f3", "f3", "f3", "f0"] });
    const ferry = idsOf(table, "141035");
    let run = send(begin(table.state), { type: "Travel", locationId: ferry }, table.ctx);
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    expect(run.state.activeLocation).toBeNull();
    run = send(run, { type: "CommitHide", cardIds: [idsOf(table, FRODO), idsOf(table, SAM)] }, table.ctx);
    expect(run.state.encounterDiscard).toHaveLength(3);
    run = send(run, { type: "Pass" }, table.ctx);
    expect(run.state.activeLocation).toBe(ferry);
    expect(run.state.window).toEqual({ kind: "optionalEngage" });
    expect(run.state.stack).toEqual([]);
  });

  it("141037 travel: HideTest x1; a hideFailed result does not stop the travel", () => {
    const table = buildTable(base, { start: "travel", staging: ["141037", "f3"], deck: ["f3", "f3"] });
    const road = idsOf(table, "141037");
    let run = send(begin(table.state), { type: "Travel", locationId: road }, table.ctx);
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    run = send(run, { type: "CommitHide", cardIds: [] }, table.ctx);
    expect(run.state.encounterDiscard).toHaveLength(1);
    run = send(run, { type: "Pass" }, table.ctx);
    expect(run.steps.some((step) => step.kind === "hideTest" && !step.success)).toBe(true);
    expect(run.state.hideFailures).toHaveLength(1);
    expect(run.state.activeLocation).toBe(road);
  });

  it("a location with no travel effect travels at once", () => {
    const table = buildTable(base, { start: "travel", staging: ["141033", "f3"] });
    const run = send(begin(table.state), { type: "Travel", locationId: idsOf(table, "141033") }, table.ctx);
    expect(run.state.activeLocation).toBe(idsOf(table, "141033"));
    expect(run.state.window).toEqual({ kind: "optionalEngage" });
    expect(run.steps.some((step) => step.kind === "push")).toBe(false);
  });
});
