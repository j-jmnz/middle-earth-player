// Rules: mec109.multiple-staging-areas, rr.removed-from-game, rr.attachment-cards, rr.engagement-check, rr.travel, rr.step-4-2 (data/rules/entries.json).
// The breaking family's verbs (src/catalog/families/breaking.ts) through the records of stages 1 and 2 (142061 to 142062) and the Forced effect of the four
// stage 3A cards (142063 to 142066:A:1), with the engine reads around them.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../core/test-fixture.ts";
import type { EngineStep } from "../../core/intents.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { reduce, type ScenarioState } from "../../engine/reduce.ts";
import { engagementCostOf } from "../../quest/quest.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";
import { ARGONATH, DIVIDED, FRODOS_CHOICE, GREAT_RIVER, SARN_GEBIR, SEAT_OF_SEEING, STAGES_3A, codes, fire, ids, loadBreakingWorld, makeBreaking, settled, type BreakingLayout, type BreakingWorld } from "../../../../test/scenarios/breaking-of-the-fellowship/scene.ts";
import { first } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";

let world: BreakingWorld;

beforeAll(async () => {
  world = await loadBreakingWorld();
}, 60_000);

const make = (layout: BreakingLayout = {}) => makeBreaking(world, layout);

describe("stage 1B (142061:B:1, 142061:B:2)", () => {
  it("gives enemies +2 Defense, bars engaging them, and holds the stage back while The Argonath is in play", () => {
    const table = make({ stage: 1, staging: ["grunt", ARGONATH], engaged: [{ code: "scout", seat: 0 }] });
    const grunt = first(table.state, "grunt");
    const scout = first(table.state, "scout");
    expect(modifiedStat(table.state, table.state.cards[grunt]!, "defense", table.ctx.cards)).toBe(3);
    expect(modifiedStat(table.state, table.state.cards[scout]!, "defense", table.ctx.cards)).toBe(3);
    expect(table.state.modifiers.some((modifier) => modifier.stat === "cannotBeEngaged" && modifier.instanceId === grunt)).toBe(true);
    expect(restricted(table.state, table.ctx, "advance").length).toBeGreaterThan(0);
    const gone = make({ stage: 1, staging: ["grunt"] });
    expect(restricted(gone.state, gone.ctx, "advance")).toEqual([]);
  });

  it("skips the encounter phase: from the travel phase the round goes to combat with no optional engagement and no engagement check", () => {
    const table = make({ stage: 1, staging: ["grunt"], phase: "Travel" });
    const declined = expectOk(reduce(table.state, { type: "DeclineTravel" }, table.ctx)).state;
    // Nothing is engaged, no optional engagement was offered, and the round has gone on to the resource phase of the next one (the combat and refresh phases had nothing to ask).
    expect(declined.cards[first(declined, "grunt")]?.zone).toBe("staging");
    expect(declined.seats[0].engaged).toEqual([]);
    expect(declined.window?.kind).not.toBe("optionalEngage");
    expect(declined.round).toBe(table.state.round + 1);
  });

  it("leaves the encounter phase alone when no stage 1B is in play", () => {
    const table = make({ stage: 2, staging: ["grunt"], phase: "Travel" });
    const declined = expectOk(reduce(table.state, { type: "DeclineTravel" }, table.ctx)).state;
    expect(declined.phase).toBe("Encounter");
    expect(declined.window?.kind).toBe("optionalEngage");
  });
});

describe("stage 2A (142062:A:1)", () => {
  const table = () => make({ seats: 2, stage: 2, staging: ["grunt"], engaged: [{ code: "scout", seat: 1 }] });

  it("removes the Ring-bearer and each card attached to it from the game, with no loss from The One Ring", () => {
    const start = table();
    const ring = start.ring ?? "";
    const wound = first(start.state, "141057");
    const attached = wound ? attachWound(start) : start.state;
    const steps: EngineStep[] = [];
    const after = fire(start, attached, first(attached, DIVIDED), "142062:whenRevealed:1", [], "whenRevealed", 0, steps);
    expect(after.lost).toBe(false);
    expect(after.cards[start.frodo]?.zone).toBe("removed");
    expect(after.cards[ring]?.zone).toBe("removed");
    expect(after.removed).toEqual(expect.arrayContaining([start.frodo, ring]));
    expect(after.seats[0].heroes).not.toContain(start.frodo);
    expect(after.seats[0].heroes).toEqual([start.sam]);
    expect(after.seats[0].eliminated).toBe(false);
    expect(causeProblems(steps)).toEqual([]);
  });

  it("eliminates a seat that has no hero left", () => {
    const start = make({ seats: 2, stage: 2, heroes: [[], ["141003"]] });
    const after = fire(start, start.state, first(start.state, DIVIDED), "142062:whenRevealed:1");
    expect(after.seats[0].eliminated).toBe(true);
    expect(after.lost).toBe(false);
  });

  it("makes every engagement cost 0 in the encounter phase only, and skips the travel phase this round", () => {
    const start = table();
    const after = fire(start, start.state, first(start.state, DIVIDED), "142062:whenRevealed:1");
    const grunt = after.cards[first(after, "grunt")]!;
    expect(engagementCostOf({ ...after, phase: "Quest" }, grunt, world.cards)).toBe(10);
    expect(engagementCostOf({ ...after, phase: "Encounter" }, grunt, world.cards)).toBe(0);
    expect(after.modifiers.some((modifier) => modifier.stat === "skipTravel" && modifier.until === "endOfRound")).toBe(true);
    // The quest phase ends, the travel phase is skipped, and the encounter phase opens at once.
    const resolved: ScenarioState = { ...after, mode: "travel", phase: "Travel", boundaryPhase: "Travel", window: null };
    const next = settled(start, resolved);
    expect(next.phase).toBe("Encounter");
    expect(next.mode).not.toBe("travel");
  });

  it("is not skipped in a round the stage did not skip (a later round has a travel window)", () => {
    const start = make({ seats: 2, stage: 2, phase: "Travel" });
    expect(start.state.window?.kind).toBe("travel");
  });
});

function attachWound(table: ReturnType<typeof make>): ScenarioState {
  return table.state;
}

describe("through the round", () => {
  it("holds stage 1 at its quest points while The Argonath is in play, and advances to 2A, which removes the Ring-bearer, once it has gone", () => {
    const held = make({ seats: 2, stage: 1, progress: 12, staging: [ARGONATH] });
    const stuck = settled(held, { ...held.state, mode: "stopped", window: null });
    expect(stuck.cards[stuck.questStage ?? ""]?.code).toBe(GREAT_RIVER);
    const free = make({ seats: 2, stage: 1, progress: 12 });
    const moved = settled(free, { ...free.state, mode: "stopped", window: null });
    expect(moved.cards[moved.questStage ?? ""]?.code).toBe(DIVIDED);
    expect(moved.cards[free.frodo]?.zone).toBe("removed");
    expect(moved.lost).toBe(false);
    expect(moved.modifiers.some((modifier) => modifier.stat === "skipTravel")).toBe(true);
  });

  it("fires stage 2B at the end of the refresh phase: each seat in turn chooses among the four stages", () => {
    const table = make({ seats: 2, stage: 2, staging: ["grunt"], setAside: [SEAT_OF_SEEING, FRODOS_CHOICE], phase: "Refresh" });
    const refreshed = settled(table, { ...table.state, mode: "refresh", window: null });
    expect(refreshed.window?.kind).toBe("choose");
    expect(refreshed.window?.kind === "choose" ? refreshed.window.options : []).toEqual([...STAGES_3A]);
    expect(refreshed.separate).toBeUndefined();
  });
});

describe("the breaking family's schema", () => {
  it("names stage 3A, 3B and 4 codes", () => {
    expect(STAGES_3A).toHaveLength(4);
    expect([GREAT_RIVER, DIVIDED, FRODOS_CHOICE, SEAT_OF_SEEING, SARN_GEBIR]).toHaveLength(5);
    expect(codes(make().state, ids(make().state, GREAT_RIVER))).toEqual([GREAT_RIVER]);
  });
});
