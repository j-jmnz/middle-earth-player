import { describe, expect, it } from "vitest";

import type { Effect } from "../catalog/boundary.ts";

import { byCode, cardMap, codes, expectOk, fixtureDefinition, hero } from "./fixture.ts";
import type { EngineStep } from "./intents.ts";
import { definePrinted, type PrintedCard } from "./printed.ts";
import { legalIntents, reduce, replay, startScenario, type ScenarioState } from "./reduce.ts";
import { modifiedStat } from "./keywords.ts";
import { stagingThreat } from "./quest.ts";
import { blankScenario, withMode } from "./state.ts";
import { spawn } from "./zones.ts";

const BOOST: Effect = {
  id: "sam:action:1",
  cardCode: "sam",
  timing: "action",
  instructions: [{ verb: "ModifyStat", stat: "willpower", amount: 2, until: "endOfPhase" }],
};

function rider(code: string, extra: Partial<PrintedCard["keywords"]> = {}, hide: number | null = null) {
  return definePrinted({
    code,
    name: code,
    type: "enemy",
    threat: 0,
    engagementCost: 50,
    keywords: { ...extra, hide },
  });
}

function filler(code: string, threat: number) {
  return definePrinted({ code, name: code, type: "enemy", threat, engagementCost: 50 });
}

const WOLF = "wolf";
const TREACHERY = definePrinted({ code: "mist", name: "mist", type: "treachery" });

function table(input: {
  deck: readonly string[];
  cards: readonly PrintedCard[];
  seats?: 1 | 2;
  effects?: readonly Effect[];
}) {
  const cards = cardMap([
    hero("frodo", "spirit", 8, 1),
    hero("sam", "spirit", 8, 1),
    hero("merry", "tactics", 8, 1),
    TREACHERY,
    ...input.cards,
  ]);
  const seatCount = input.seats ?? 1;
  let state = blankScenario({ seatCount, seed: 3, definition: fixtureDefinition(["stage"]) });
  state = spawn(state, "frodo", { zone: "heroes", seat: 0 }).state;
  state = spawn(state, "sam", { zone: "heroes", seat: 0 }).state;
  if (seatCount === 2) state = spawn(state, "merry", { zone: "heroes", seat: 1 }).state;
  for (const code of input.deck) state = spawn(state, code, { zone: "encounterDeck" }).state;
  state = {
    ...state,
    phase: "Quest",
    mode: "questCommit",
    window: { kind: "pass" },
    activeSeat: 0,
    firstPlayer: 0,
  };
  return { state, ctx: { effects: input.effects ?? [], cards } };
}

function begin(state: ScenarioState, ctx: Parameters<typeof reduce>[2], seats: 1 | 2 = 1) {
  const steps: EngineStep[] = [];
  let current = state;
  for (let pass = 0; pass < seats; pass += 1) {
    const result = expectOk(reduce(current, { type: "Pass" }, ctx));
    steps.push(...result.steps);
    current = result.state;
  }
  return { state: current, steps };
}

function frames(steps: readonly EngineStep[]): string[] {
  return steps.flatMap((step) => (step.kind === "push" || step.kind === "pop" ? [`${step.kind}:${step.frame}`] : []));
}

function hideTests(steps: readonly EngineStep[]) {
  return steps.flatMap((step) => (step.kind === "hideTest" ? [step] : []));
}

const BOOKLET_DECK = ["hider", "d1", "d2", "mist", "tail"];
const BOOKLET_CARDS = [rider("hider", {}, 3), filler("d1", 2), filler("d2", 2), filler("tail", 5)];

describe("hide", () => {
  it("passes the booklet fixture when an action raises willpower to meet the discarded threat", () => {
    const { state, ctx } = table({ deck: BOOKLET_DECK, cards: BOOKLET_CARDS, effects: [BOOST] });
    const opened = begin(state, ctx);
    expect(opened.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    expect(opened.state.stack.map((frame) => frame.frame)).toEqual(["reveal", "hide"]);
    const [frodo = "", sam = ""] = [byCode(opened.state, "frodo")[0], byCode(opened.state, "sam")[0]];
    const committed = expectOk(reduce(opened.state, { type: "CommitHide", cardIds: [frodo, sam] }, ctx));
    expect(committed.state.cards[frodo]?.exhausted).toBe(true);
    expect(committed.state.cards[sam]?.exhausted).toBe(true);
    expect(committed.state.cards[sam]?.committed).toBe(false);
    expect(committed.state.window).toEqual({ kind: "frameAction" });
    expect(committed.state.encounterDiscard).toHaveLength(3);
    expect(legalIntents(committed.state, ctx)).toContainEqual({ type: "Trigger", cardId: sam, effectId: "sam:action:1" });
    const boosted = expectOk(reduce(committed.state, { type: "Trigger", cardId: sam, effectId: "sam:action:1" }, ctx));
    expect(frames(boosted.steps)).toEqual(["push:ResolveEffect", "pop:ResolveEffect"]);
    expect(boosted.state.modifiers).toHaveLength(1);
    const done = expectOk(reduce(boosted.state, { type: "Pass" }, ctx));
    const [test] = hideTests(done.steps);
    expect(test).toMatchObject({ willpower: 4, threat: 4, success: true });
    expect(done.state.stack).toEqual([]);
    expect(done.state.cards[frodo]?.exhausted).toBe(true);
  });

  it("fails the same deal when no action is taken", () => {
    const { state, ctx } = table({ deck: BOOKLET_DECK, cards: BOOKLET_CARDS, effects: [BOOST] });
    const opened = begin(state, ctx);
    const ids = [byCode(opened.state, "frodo")[0] ?? "", byCode(opened.state, "sam")[0] ?? ""];
    const committed = expectOk(reduce(opened.state, { type: "CommitHide", cardIds: ids }, ctx));
    const done = expectOk(reduce(committed.state, { type: "Pass" }, ctx));
    expect(hideTests(done.steps)).toMatchObject([{ willpower: 2, threat: 4, success: false }]);
  });

  it("reveals from an action effect while a window is already open", () => {
    const scout: Effect = {
      id: "sam:action:2",
      cardCode: "sam",
      timing: "action",
      instructions: [{ verb: "RevealStaging" }],
    };
    const { state, ctx } = table({ deck: ["d1"], cards: [filler("d1", 1)], effects: [scout] });
    const sam = byCode(state, "sam")[0] ?? "";
    const result = expectOk(reduce(state, { type: "Trigger", cardId: sam, effectId: "sam:action:2" }, ctx));
    expect(result.state.staging).toHaveLength(1);
    expect(result.state.window).toEqual({ kind: "pass" });
  });

  it("fails an action-effect reveal that opens a Hide window", () => {
    const scout: Effect = {
      id: "sam:action:2",
      cardCode: "sam",
      timing: "action",
      instructions: [{ verb: "RevealStaging" }],
    };
    const { state, ctx } = table({
      deck: ["hider", "d1"],
      cards: [rider("hider", {}, 1), filler("d1", 0)],
      effects: [scout],
    });
    const sam = byCode(state, "sam")[0] ?? "";
    const result = reduce(state, { type: "Trigger", cardId: sam, effectId: "sam:action:2" }, ctx);
    expect(result.ok).toBe(false);
  });

  it("lets a seat commit nobody", () => {
    const { state, ctx } = table({ deck: ["hider", "d1"], cards: [rider("hider", {}, 1), filler("d1", 0)] });
    const opened = begin(state, ctx);
    const committed = expectOk(reduce(opened.state, { type: "CommitHide", cardIds: [] }, ctx));
    const done = expectOk(reduce(committed.state, { type: "Pass" }, ctx));
    expect(hideTests(done.steps)).toMatchObject([{ willpower: 0, threat: 0, success: true }]);
  });

  it("refuses a commit of an exhausted character, a repeat, or a seat that is not revealing", () => {
    const { state, ctx } = table({ deck: BOOKLET_DECK, cards: BOOKLET_CARDS, seats: 2 });
    const opened = begin(state, ctx, 2);
    const frodo = byCode(opened.state, "frodo")[0] ?? "";
    const merry = byCode(opened.state, "merry")[0] ?? "";
    const repeat = reduce(opened.state, { type: "CommitHide", cardIds: [frodo, frodo] }, ctx);
    expect(repeat.ok).toBe(false);
    const other = reduce(opened.state, { type: "CommitHide", cardIds: [merry] }, ctx);
    expect(other.ok).toBe(false);
    const tired = { ...opened.state, cards: { ...opened.state.cards, [frodo]: { ...opened.state.cards[frodo]!, exhausted: true } } };
    expect(reduce(tired, { type: "CommitHide", cardIds: [frodo] }, ctx).ok).toBe(false);
    const stray = reduce(opened.state, { type: "Pass" }, ctx);
    expect(stray.ok).toBe(false);
  });

  it("runs Hide before the card's When Revealed", () => {
    const effects: Effect[] = [
      { cardCode: "hider", timing: "whenRevealed", instructions: [{ verb: "RaiseThreat" }] },
    ];
    const { state, ctx } = table({ deck: ["hider", "d1"], cards: [rider("hider", {}, 1), filler("d1", 0)], effects });
    const opened = begin(state, ctx);
    const committed = expectOk(reduce(opened.state, { type: "CommitHide", cardIds: [] }, ctx));
    const done = expectOk(reduce(committed.state, { type: "Pass" }, ctx));
    const steps = [...opened.steps, ...committed.steps, ...done.steps];
    expect(frames(steps)).toEqual([
      "push:reveal",
      "push:hide",
      "pop:hide",
      "push:whenRevealed",
      "pop:whenRevealed",
      "pop:reveal",
    ]);
    const hideAt = steps.findIndex((step) => step.kind === "hideTest");
    const threatAt = steps.findIndex((step) => step.kind === "threat");
    expect(hideAt).toBeGreaterThanOrEqual(0);
    expect(threatAt).toBeGreaterThan(hideAt);
  });

  it("holds a surge reveal until the Hide frame pops", () => {
    const { state, ctx } = table({
      deck: ["hider", "d1", "next"],
      cards: [rider("hider", { surge: true }, 1), filler("d1", 0), filler("next", 0)],
    });
    const opened = begin(state, ctx);
    expect(opened.state.staging).toHaveLength(1);
    expect(opened.state.encounterDeck).toHaveLength(2);
    const committed = expectOk(reduce(opened.state, { type: "CommitHide", cardIds: [] }, ctx));
    expect(committed.state.staging).toHaveLength(1);
    const done = expectOk(reduce(committed.state, { type: "Pass" }, ctx));
    expect(done.state.staging).toHaveLength(2);
    expect(frames([...opened.steps, ...committed.steps, ...done.steps])).toEqual([
      "push:reveal",
      "push:hide",
      "pop:hide",
      "push:reveal",
      "pop:reveal",
      "pop:reveal",
    ]);
  });

  it("waits for the first seat's frames before the second seat reveals", () => {
    const { state, ctx } = table({
      deck: ["hider", "d1", "other"],
      cards: [rider("hider", {}, 1), filler("d1", 0), filler("other", 0)],
      seats: 2,
    });
    const opened = begin(state, ctx, 2);
    expect(opened.state.staging).toHaveLength(1);
    const committed = expectOk(reduce(opened.state, { type: "CommitHide", cardIds: [] }, ctx));
    const afterActions = expectOk(reduce(committed.state, { type: "Pass" }, ctx));
    expect(afterActions.state.activeSeat).toBe(1);
    const done = expectOk(reduce(afterActions.state, { type: "Pass" }, ctx));
    expect(done.state.staging).toHaveLength(2);
    const second = done.state.staging[1] ?? "";
    expect(done.state.cards[second]?.controller).toBe(1);
  });

  it("limits the action window to the revealing seat under peril", () => {
    const { state, ctx } = table({
      deck: ["hider", "d1", "other"],
      cards: [rider("hider", { peril: true }, 1), filler("d1", 0), filler("other", 0)],
      seats: 2,
    });
    const opened = begin(state, ctx, 2);
    const committed = expectOk(reduce(opened.state, { type: "CommitHide", cardIds: [] }, ctx));
    expect(committed.state.window).toEqual({ kind: "frameAction" });
    expect(committed.state.activeSeat).toBe(0);
    const intruder = reduce({ ...committed.state, activeSeat: 1 }, { type: "Pass" }, ctx);
    expect(intruder).toMatchObject({ ok: false, reason: "Peril: other seats cannot act" });
    const closed = expectOk(reduce(committed.state, { type: "Pass" }, ctx));
    expect(closed.state.perilSeat).toBeNull();
    expect(closed.state.stack).toEqual([]);
    expect(closed.state.activeSeat).not.toBe(1);
    expect(closed.state.staging).toHaveLength(2);
  });

  it("gives the other seat its pass when nothing has peril", () => {
    const { state, ctx } = table({
      deck: ["hider", "d1"],
      cards: [rider("hider", {}, 1), filler("d1", 0)],
      seats: 2,
    });
    const opened = begin(state, ctx, 2);
    const committed = expectOk(reduce(opened.state, { type: "CommitHide", cardIds: [] }, ctx));
    const first = expectOk(reduce(committed.state, { type: "Pass" }, ctx));
    expect(first.state.window).toEqual({ kind: "frameAction" });
    expect(first.state.activeSeat).toBe(1);
  });

  it("discards without revealing, so discarded cards run no When Revealed", () => {
    const effects: Effect[] = [
      { cardCode: "d1", timing: "whenRevealed", instructions: [{ verb: "RaiseThreat" }] },
    ];
    const { state, ctx } = table({ deck: ["hider", "d1"], cards: [rider("hider", {}, 1), filler("d1", 1)], effects });
    const opened = begin(state, ctx);
    expect(opened.steps.some((step) => step.kind === "threat")).toBe(false);
    const committed = expectOk(reduce(opened.state, { type: "CommitHide", cardIds: [] }, ctx));
    const done = expectOk(reduce(committed.state, { type: "Pass" }, ctx));
    expect([...committed.steps, ...done.steps].some((step) => step.kind === "threat")).toBe(false);
    expect(done.state.encounterDiscard).toHaveLength(1);
  });

  it("restores state and seed cursor when undo replays across a Hide frame", () => {
    const deck = codes("d", 12);
    const cards = cardMap([
      hero("frodo", "spirit", 8, 1),
      hero("sam", "spirit", 8, 1),
      definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 8 }),
      rider("hider", {}, 1),
      ...deck.map((code) => definePrinted({ code, name: code, type: "event", cost: 0, sphere: "neutral" })),
    ]);
    const ctx = { effects: [], cards };
    let live = startScenario(
      {
        seatCount: 1,
        seed: 42,
        threatModifier: 0,
        definition: fixtureDefinition(["stage"]),
        seats: [{ heroes: ["frodo", "sam"], deck }],
        encounterDeck: ["hider", "hider", "hider"],
        questDeck: ["stage"],
      },
      ctx,
    );
    for (const type of ["Keep", "Pass", "Pass", "Pass"] as const) live = expectOk(reduce(live, { type }, ctx)).state;
    expect(live.window).toEqual({ kind: "hideCommit", seat: 0 });
    const sam = byCode(live, "sam")[0] ?? "";
    const replayOf = (at: ScenarioState, more: Parameters<typeof reduce>[1][]) => {
      const { snapshot, cards: instances, intents } = at.undo;
      if (!snapshot || !instances) throw new Error("missing phase snapshot");
      return replay(snapshot, [...intents, ...more], ctx, instances);
    };
    const bare = (value: ScenarioState) => ({ ...value, undo: null });
    expect(bare(replayOf(live, []))).toEqual(bare(live));
    const committed = expectOk(reduce(live, { type: "CommitHide", cardIds: [sam] }, ctx)).state;
    const closed = expectOk(reduce(committed, { type: "Pass" }, ctx)).state;
    expect(bare(replayOf(closed, []))).toEqual(bare(closed));
    expect(replayOf(closed, []).seedCursor).toBe(closed.seedCursor);
    expect(bare(replayOf(committed, []))).toEqual(bare(committed));
  });
});

describe("modifier durations", () => {
  function boosted(until: "endOfPhase" | "endOfRound" | "endOfAttack" | "whileSourceInPlay") {
    const { state } = table({ deck: [], cards: [] });
    const sam = byCode(state, "sam")[0] ?? "";
    return { state: { ...state, modifiers: [{ instanceId: sam, sourceId: sam, stat: "willpower" as const, amount: 2, until }] }, sam };
  }

  it("expires end-of-phase modifiers when the phase changes and keeps them inside a phase", () => {
    const { state } = boosted("endOfPhase");
    expect(withMode(state, "staging").modifiers).toHaveLength(1);
    expect(withMode(state, "travel").modifiers).toHaveLength(0);
  });

  it("expires end-of-round modifiers at the next round and not at the next phase", () => {
    const { state } = boosted("endOfRound");
    expect(withMode(state, "travel").modifiers).toHaveLength(1);
    expect(withMode(state, "beginRound").modifiers).toHaveLength(0);
  });

  it("drops a modifier once its source leaves play", () => {
    const { state, sam } = boosted("whileSourceInPlay");
    const cards = cardMap([hero("sam", "spirit", 8, 1)]);
    const instance = state.cards[sam];
    if (!instance) throw new Error("missing hero");
    expect(modifiedStat(state, instance, "willpower", cards)).toBe(3);
    const gone = { ...state, cards: { ...state.cards, [sam]: { ...instance, zone: "discard" as const } } };
    expect(modifiedStat(gone, gone.cards[sam] ?? instance, "willpower", cards)).toBe(1);
  });

  it("reads a threat modifier in the staging total", () => {
    const { state } = table({ deck: [], cards: [filler(WOLF, 2)] });
    const spawned = spawn(state, WOLF, { zone: "staging" });
    const cards = cardMap([filler(WOLF, 2)]);
    expect(stagingThreat(spawned.state, cards)).toBe(2);
    const raised = {
      ...spawned.state,
      modifiers: [{ instanceId: spawned.id, sourceId: spawned.id, stat: "threat" as const, amount: 3, until: "endOfPhase" as const }],
    };
    expect(stagingThreat(raised, cards)).toBe(5);
  });
});
