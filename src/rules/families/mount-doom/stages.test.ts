import { describe, expect, it } from "vitest";

import { AUTHORED_EFFECTS } from "../../../effects/authored/return-of-the-king/mount-doom.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { settle } from "../../engine/machine.ts";
import { definePrinted } from "../../core/printed.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { advanceFreed } from "../../quest/stage-reveal.ts";
import { fireForced } from "../../windows/triggers.ts";
import { hero, send, table, recordsOf } from "../defense/table.ts";
import { STOP } from "./stop.ts";

// Rules: mec113.dire, mec113.fortitude-tests, rr.quest-advancement, faq.progress-without-advancing (data/rules/entries.json); ledger lines 146076:B:1, 146076:B:2, 146077:B:2, 146077:B:3, 146078:B:2.
// The records of Mount Doom's quest stages on a small table: the stages 2 to 4 with the cards their Forced effects name.

const MOUNT_DOOM = "146043";
const quest = (code: string, questPoints?: number) => definePrinted({ code, name: code, type: "quest", ...(questPoints != null ? { questPoints } : {}) });
const place = (code: string, threat = 1) => definePrinted({ code, name: "Mount Doom", type: "location", threat, questPoints: 9 });
const card = (code: string, eyeIcons?: number) => definePrinted({ code, name: code, type: "treachery", keywords: eyeIcons ? { eyeIcons } : {} });
const orc = definePrinted({ code: "orc", name: "orc", type: "enemy", attack: 2, defense: 1, health: 3, threat: 1, engagementCost: 40 });

type Spec = { stage: "146076" | "146077" | "146078"; seatCount?: 1 | 2; encounter?: readonly string[]; progress?: number; resources?: number; active?: boolean; threat?: number };

// The quest at `stage` (the deck holds the later ones), Mount Doom in the staging area or active, and a hero of Willpower 3 for each seat.
function begin(spec: Spec) {
  const cards = [hero("a", { willpower: 3 }), hero("b", { willpower: 3 }), quest("146076"), quest("146077", 20), quest("146078"), place(MOUNT_DOOM), card("eyes3", 3), card("eyes0"), orc];
  const base = table({ seatCount: spec.seatCount ?? 1, cards, effects: recordsOf(AUTHORED_EFFECTS, "146076", "146077", "146078", MOUNT_DOOM), heroes: [{ code: "a", seat: 0 }, ...(spec.seatCount === 2 ? [{ code: "b", seat: 1 }] : [])], encounter: spec.encounter ?? [], threat: spec.threat ?? 30 });
  const order = ["146076", "146077", "146078"];
  // The quest deck holds four stages: stage 1 has been played, so stage 3 is the third.
  let state: ScenarioState = { ...base.state, stages: ["146075", ...order].map((code) => ({ code })) };
  const ids: Record<string, string> = { ...base.ids };
  for (const code of order.slice(order.indexOf(spec.stage))) {
    const placed = spawn(state, code, { zone: code === spec.stage ? "questStage" : "questDeck" });
    state = placed.state;
    ids[code] = placed.id;
    if (code === spec.stage) state = { ...state, questStage: placed.id };
  }
  const doom = spawn(state, MOUNT_DOOM, { zone: spec.active ? "activeLocation" : "staging" });
  state = spec.active ? { ...doom.state, activeLocation: doom.id } : doom.state;
  ids[MOUNT_DOOM] = doom.id;
  if (spec.progress != null) state = updateCard(state, ids[spec.stage] ?? "", { progress: spec.progress });
  if (spec.resources != null) state = updateCard(state, ids[spec.stage] ?? "", { resources: spec.resources });
  return { ...base, state, ids };
}

type Run = ReturnType<typeof begin>;
// A record's instructions as the frame of the card that owns it, ending in STOP.
function resolve(run: Run, recordId: string, owner: string, state: ScenarioState = run.state, steps: EngineStep[] = []): ScenarioState {
  const record = AUTHORED_EFFECTS.find((effect) => effect.id === recordId);
  const pushed = pushEffectFrame({ ...state, window: null }, { frame: "forced", sourceId: run.ids[owner] ?? null, actor: 0, peril: false, effectId: recordId, instructions: [...(record?.instructions ?? []), STOP], cancel: null, blockCancel: null }, steps);
  return settle(pushed, run.ctx, steps);
}
const commitAll = (run: Run, state: ScenarioState, key: string) => send(state, { type: "CommitFortitude", cardIds: [run.ids[key] ?? ""] }, run.ctx);
const pass = (run: Run, state: ScenarioState) => send(state, { type: "Pass" }, run.ctx);
const engaged = (state: ScenarioState, seat: number) => (state.seats[seat]?.engaged ?? []).map((id) => state.cards[id]?.code);

describe("stage 2B: the Fortitude tests (146076:B:1)", () => {
  // The deck: three cards for X = 3, then an enemy.
  it("places a resource on the stage for a player who passes the test", () => {
    const run = begin({ stage: "146076", encounter: ["eyes0", "eyes0", "eyes0", "orc"] });
    const done = pass(run, commitAll(run, resolve(run, "146076:forced:1", "146076"), "a"));
    expect(done.cards[run.ids["146076"] ?? ""]?.resources).toBe(1);
    expect(engaged(done, 0)).toEqual([]);
  });

  it("discards until an enemy is discarded and engages it with a player who fails the test, placing no resource", () => {
    const run = begin({ stage: "146076", encounter: ["eyes3", "eyes0", "eyes0", "eyes0", "orc", "eyes0"] });
    const done = pass(run, commitAll(run, resolve(run, "146076:forced:1", "146076"), "a"));
    expect(done.cards[run.ids["146076"] ?? ""]?.resources).toBe(0);
    expect(engaged(done, 0)).toEqual(["orc"]);
  });

  it("engages nothing when the deck holds no enemy", () => {
    const run = begin({ stage: "146076", encounter: ["eyes3", "eyes0", "eyes0", "eyes0"] });
    const done = pass(run, commitAll(run, resolve(run, "146076:forced:1", "146076"), "a"));
    expect(engaged(done, 0)).toEqual([]);
  });

  it("asks each player in turn and resolves each test with its consequence before the next: the second player is asked once the first has passed", () => {
    const run = begin({ stage: "146076", seatCount: 2, encounter: ["eyes0", "eyes0", "eyes0", "eyes0", "eyes0", "eyes0", "orc"] });
    const first = resolve(run, "146076:forced:1", "146076");
    expect(first.window).toEqual({ kind: "fortitudeCommit", seat: 0 });
    // Both players pass the action window inside the test before it is measured.
    const second = pass(run, pass(run, commitAll(run, first, "a")));
    expect(second.cards[run.ids["146076"] ?? ""]?.resources).toBe(1);
    expect(second.window).toEqual({ kind: "fortitudeCommit", seat: 1 });
  });
});

describe("stage 2B: advancing (146076:B:2)", () => {
  it("advances to stage 3 at the end of the quest phase when the resources equal the number of players", () => {
    const run = begin({ stage: "146076", resources: 1 });
    const done = resolve(run, "146076:forced:2", "146076");
    expect(done.cards[done.questStage ?? ""]?.code).toBe("146077");
  });

  it("stays on stage 2 with fewer resources than players", () => {
    const run = begin({ stage: "146076", seatCount: 2, resources: 1 });
    const done = resolve(run, "146076:forced:2", "146076");
    expect(done.cards[done.questStage ?? ""]?.code).toBe("146076");
  });

  it("is not advanced by progress: it has no quest points", () => {
    const run = begin({ stage: "146076", progress: 30 });
    const done = advanceFreed({ ...run.state, window: null }, run.ctx, []);
    expect(done.cards[done.questStage ?? ""]?.code).toBe("146076");
  });
});

describe("progress on the stages with no quest points (2B and 4B)", () => {
  it.each(["146076", "146078"] as const)("goes on stage %s and does not defeat it", (stage) => {
    const run = begin({ stage });
    const done = runInstruction({ ...run.state, window: null }, { verb: "ProgressQuest", amount: 30 }, { seat: 0, sourceId: null }, run.ctx, []);
    expect(done.cards[done.questStage ?? ""]?.code).toBe(stage);
    expect(done.cards[done.questStage ?? ""]?.progress).toBe(30);
  });
});

describe("stage 3B (146077:B:2, 146077:B:3)", () => {
  it("caps the progress placed this round at 5 when the first player fails the test", () => {
    const run = begin({ stage: "146077", encounter: ["eyes3", "eyes3", "eyes3"] });
    const done = pass(run, commitAll(run, resolve(run, "146077:forced:1", "146077"), "a"));
    expect(done.modifiers.some((modifier) => modifier.stat === "questProgressCap" && modifier.amount === 5 && modifier.until === "endOfRound")).toBe(true);
  });

  it("sets no cap when the first player passes", () => {
    const run = begin({ stage: "146077", encounter: ["eyes0", "eyes0", "eyes0"] });
    const done = pass(run, commitAll(run, resolve(run, "146077:forced:1", "146077"), "a"));
    expect(done.modifiers.some((modifier) => modifier.stat === "questProgressCap")).toBe(false);
  });

  it("is not defeated with its 20 progress unless Mount Doom is the active location, and is when it is", () => {
    const held = begin({ stage: "146077", progress: 20 });
    const stuck = advanceFreed({ ...held.state, window: null }, held.ctx, []);
    expect(stuck.cards[stuck.questStage ?? ""]?.code).toBe("146077");
    expect(stuck.cards[stuck.questStage ?? ""]?.progress).toBe(20);
    const ready = begin({ stage: "146077", progress: 20, active: true });
    const advanced = advanceFreed({ ...ready.state, window: null }, ready.ctx, []);
    expect(advanced.cards[advanced.questStage ?? ""]?.code).toBe("146078");
  });

  it("lets the players travel to Mount Doom only with 20 progress on stage 3", () => {
    const apart = begin({ stage: "146077", progress: 19 });
    const together = begin({ stage: "146077", progress: 20 });
    expect(runInstruction({ ...apart.state, window: null }, { verb: "TravelTo", target: "self" }, { seat: 0, sourceId: apart.ids[MOUNT_DOOM] ?? null }, apart.ctx, []).activeLocation).toBeNull();
    expect(runInstruction({ ...together.state, window: null }, { verb: "TravelTo", target: "self" }, { seat: 0, sourceId: together.ids[MOUNT_DOOM] ?? null }, together.ctx, []).activeLocation).toBe(together.ids[MOUNT_DOOM]);
  });
});

describe("stage 4B: exploring Mount Doom (146078:B:2)", () => {
  // Willpower 3 against the icons of the cards discarded: X = 3 plus one extra card for each player.
  function explored(encounter: readonly string[]) {
    const run = begin({ stage: "146078", active: true, encounter });
    const heard = fireForced({ ...run.state, window: null }, { trigger: "locationExplored", seat: null, cardId: run.ids[MOUNT_DOOM] ?? "" }, run.ctx, []);
    return { run, state: settle(heard, run.ctx, []) };
  }

  it("wins the game when the first player passes the Fortitude test", () => {
    const { run, state } = explored(["eyes0", "eyes0", "eyes0", "eyes0"]);
    expect(state.window).toEqual({ kind: "fortitudeCommit", seat: 0 });
    const done = pass(run, commitAll(run, state, "a"));
    expect(done.stageCleared).toBe(true);
    expect(done.lost).toBe(false);
  });

  it("discards one extra card for each player before the count: the fourth card's icons count", () => {
    const { run, state } = explored(["eyes0", "eyes0", "eyes0", "eyes3"]);
    const committed = commitAll(run, state, "a");
    expect(committed.encounterDiscard).toHaveLength(4);
    const done = pass(run, committed);
    expect(done.lost).toBe(true);
  });

  it("loses the game when the first player fails the test", () => {
    const { run, state } = explored(["eyes3", "eyes0", "eyes0", "eyes0"]);
    const done = pass(run, commitAll(run, state, "a"));
    expect(done.lost).toBe(true);
    expect(done.stageCleared).toBeFalsy();
  });
});
