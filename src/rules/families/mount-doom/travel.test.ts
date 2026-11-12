import { describe, expect, it } from "vitest";

import { AUTHORED_EFFECTS } from "../../../effects/authored/return-of-the-king/mount-doom.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard, withMode } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { legalIntents } from "../../engine/reduce.ts";
import { hero, send, table, recordsOf } from "../defense/table.ts";

// Rules: mec113.fortitude-tests, rr.travel, rr.active-location, rr.in-player-order (data/rules/entries.json); ledger lines 146043:A:3, 146046:A:2, 146048:A:2.
// Traveling to the locations of Mount Doom whose Travel effect is a Fortitude test or an exhaustion: the cost is paid in a frame of the travel, and the players travel either way once it is.

const card = (code: string, eyeIcons?: number) => definePrinted({ code, name: code, type: "treachery", keywords: eyeIcons ? { eyeIcons } : {} });
const place = (code: string, name: string) => definePrinted({ code, name, type: "location", threat: 2, questPoints: 5 });
const stage = (code: string, questPoints?: number) => definePrinted({ code, name: code, type: "quest", ...(questPoints != null ? { questPoints } : {}) });

// The travel window of the Travel phase, with `location` in the staging area and the first player's heroes ready.
function atTravel(code: string, name: string, options: { seatCount?: 1 | 2; encounter?: readonly string[]; progress?: number } = {}) {
  const seatCount = options.seatCount ?? 1;
  const base = table({ seatCount, cards: [hero("a", { willpower: 2 }), hero("b", { willpower: 2 }), card("eyes3", 3), card("eyes0"), place(code, name), stage("146075", 4), stage("146077", 20)], effects: recordsOf(AUTHORED_EFFECTS, code, "146077"), heroes: [{ code: "a", seat: 0 }, ...(seatCount === 2 ? [{ code: "b", seat: 1 }] : [])], encounter: options.encounter ?? [], threat: 30, staging: [{ code }] });
  let state: ScenarioState = { ...base.state, stages: [{ code: "146075" }, { code: "146076" }, { code: "146077" }, { code: "146078" }] };
  const quest = spawn(state, "146077", { zone: "questStage" });
  state = { ...quest.state, questStage: quest.id };
  if (options.progress != null) state = updateCard(state, quest.id, { progress: options.progress });
  return { ...base, state: { ...withMode(state, "travel"), phase: "Travel" as const, boundaryPhase: "Travel" as const, window: { kind: "travel" as const } } };
}
const threat = (state: ScenarioState, seat = 0) => state.seats[seat]?.threat ?? 0;
const travelTo = (run: ReturnType<typeof atTravel>, code: string, state: ScenarioState = run.state) => send(state, { type: "Travel", locationId: run.ids[code] ?? "" }, run.ctx);
const commit = (run: ReturnType<typeof atTravel>, state: ScenarioState, seat = 0) => send(state, { type: "CommitFortitude", cardIds: [run.ids[seat === 0 ? "a" : "b"] ?? ""] }, run.ctx);
const pass = (run: ReturnType<typeof atTravel>, state: ScenarioState) => send(state, { type: "Pass" }, run.ctx);

describe("Plain of Gorgoroth (146046:A:2)", () => {
  // The game goes on after the travel (the refresh phase raises each threat by 1), so the threat is read against a game whose test is passed.
  const played = (encounter: readonly string[]) => {
    const run = atTravel("146046", "Plain of Gorgoroth", { seatCount: 2, encounter });
    const asked = travelTo(run, "146046");
    expect(asked.window).toEqual({ kind: "fortitudeCommit", seat: 0 });
    // The action window of the test closes when both players have passed.
    return pass(run, pass(run, commit(run, asked))) satisfies ScenarioState;
  };

  it("has the first player make a Fortitude test to travel; a failure raises each player's threat by 4, and the players travel there either way", () => {
    const failed = played(["eyes3", "eyes3", "eyes3"]);
    const passed = played(["eyes0", "eyes0", "eyes0"]);
    expect([threat(failed, 0) - threat(passed, 0), threat(failed, 1) - threat(passed, 1)]).toEqual([4, 4]);
    expect(failed.activeLocation).not.toBeNull();
    expect(passed.activeLocation).not.toBeNull();
  });
});

describe("Mount Doom (146043:A:2, 146043:A:3)", () => {
  it("cannot be traveled to until stage 3 holds 20 progress", () => {
    const run = atTravel("146043", "Mount Doom", { progress: 19 });
    expect(legalIntents(run.state, run.ctx).some((intent) => intent.type === "Travel")).toBe(false);
    const ready = atTravel("146043", "Mount Doom", { progress: 20 });
    expect(legalIntents(ready.state, ready.ctx).some((intent) => intent.type === "Travel")).toBe(true);
  });

  it("has each player in turn make a Fortitude test and raise his own threat by 9 if he fails it", () => {
    const run = atTravel("146043", "Mount Doom", { seatCount: 2, progress: 20, encounter: ["eyes0", "eyes0", "eyes0", "eyes3", "eyes3", "eyes3"] });
    const first = travelTo(run, "146043");
    expect(first.window).toEqual({ kind: "fortitudeCommit", seat: 0 });
    // The first player passes (no icons), then the second is asked and fails.
    const second = pass(run, pass(run, commit(run, first)));
    expect(second.window).toEqual({ kind: "fortitudeCommit", seat: 1 });
    const done = pass(run, pass(run, commit(run, second, 1)));
    expect([threat(done, 0), threat(done, 1)]).toEqual([30, 39]);
    expect(done.activeLocation).toBe(run.ids["146043"]);
  });
});

describe("Old Water-course (146048:A:2)", () => {
  it("has each player exhaust a hero to travel: with no ready hero the players cannot travel", () => {
    const run = atTravel("146048", "Old Water-course");
    expect(legalIntents(run.state, run.ctx).some((intent) => intent.type === "Travel")).toBe(true);
    const tired = { ...run.state, cards: { ...run.state.cards, [run.ids.a ?? ""]: { ...run.state.cards[run.ids.a ?? ""]!, exhausted: true } } };
    expect(legalIntents(tired, run.ctx).some((intent) => intent.type === "Travel")).toBe(false);
  });
});
