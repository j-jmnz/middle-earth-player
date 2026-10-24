import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { scenarioDefinitionSchema, type ScenarioDefinition } from "../catalog/boundary.ts";
import { fixtureCards, parseScenarioFixture, type ScenarioFixture } from "../catalog/scenario-fixture.ts";
import { characters } from "../rules/combat.ts";
import { byCode, expectOk } from "../rules/fixture.ts";
import type { EngineStep } from "../rules/intents.ts";
import { definePrinted, type PrintedCard } from "../rules/printed.ts";
import { legalIntents, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import { pushDue } from "../rules/delayed.ts";
import { pushCardEffects } from "../rules/effect-frames.ts";
import { advanceFrame } from "../rules/frames.ts";
import { settle } from "../rules/machine.ts";
import { blankScenario, updateCard, withThreat } from "../rules/state.ts";
import { fireForced } from "../rules/triggers.ts";
import { topFrame } from "../rules/windows.ts";
import { attachTo, spawn } from "../rules/zones.ts";
import { loadDefinition, loadPrinted } from "../../scripts/test-catalog.ts";

import { scriptFor } from "./registry.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixture: ScenarioFixture = parseScenarioFixture(
  JSON.parse(readFileSync(path.join(root, "fixtures", "a-shadow-of-the-past.json"), "utf8")) as unknown,
);

const FRODO = "141001";
const SAM = "141002";
const MERRY = "141003";
const RING = "141085";
const RIDER = "141039";

let definition: ScenarioDefinition;
let cards: Map<string, PrintedCard>;

beforeAll(async () => {
  definition = scenarioDefinitionSchema.parse(await loadDefinition("a-shadow-of-the-past"));
  const codes = [...new Set([...fixtureCards(fixture).map((card) => card.code), FRODO, SAM, MERRY, RING])];
  cards = new Map(await loadPrinted(codes));
  for (const [code, threat] of [["f0", 0], ["f3", 3]] as const) {
    cards.set(code, definePrinted({ code, name: code, type: "enemy", threat, engagementCost: 50, attack: 1, defense: 1, health: 3 }));
  }
});

type Layout = {
  seats?: 1 | 2;
  stage?: string;
  progress?: number;
  deck?: readonly string[];
  discard?: readonly string[];
  staging?: readonly string[];
  setAside?: readonly string[];
  victory?: readonly string[];
  engaged?: readonly { code: string; seat: number }[];
  active?: string;
  ring?: "ready" | "exhausted" | "none";
  resources?: number;
};

function table(layout: Layout = {}): { state: ScenarioState; ctx: ReduceContext } {
  const seats = layout.seats ?? 1;
  const stage = layout.stage ?? "141022";
  let state = blankScenario({ seatCount: seats, seed: 3, definition });
  for (const code of fixture.stages) {
    const placed =
      code === stage ? { zone: "questStage" as const } : fixture.stages.indexOf(code) > fixture.stages.indexOf(stage) ? { zone: "questDeck" as const } : { zone: "setAside" as const };
    const spawned = spawn(state, code, placed, placed.zone === "questStage" ? "B" : "A");
    state = code === stage ? updateCard(spawned.state, spawned.id, { progress: layout.progress ?? 0 }) : spawned.state;
  }
  const frodo = spawn(state, FRODO, { zone: "heroes", seat: 0 });
  state = spawn(frodo.state, SAM, { zone: "heroes", seat: 0 }).state;
  if (seats === 2) state = spawn(state, MERRY, { zone: "heroes", seat: 1 }).state;
  if ((layout.ring ?? "ready") !== "none") {
    const ring = spawn(state, RING, { zone: "play", seat: 0 });
    state = attachTo(ring.state, ring.id, frodo.id);
    state = updateCard(state, ring.id, { exhausted: layout.ring === "exhausted" });
  }
  state = updateCard(state, frodo.id, { resources: layout.resources ?? 0 });
  state = withThreat(state, 0, 8);
  if (seats === 2) state = withThreat(state, 1, 6);
  for (const code of layout.deck ?? []) state = spawn(state, code, { zone: "encounterDeck" }).state;
  for (const code of layout.discard ?? []) state = spawn(state, code, { zone: "encounterDiscard" }).state;
  for (const code of layout.staging ?? []) state = spawn(state, code, { zone: "staging" }).state;
  for (const code of layout.setAside ?? []) state = spawn(state, code, { zone: "setAside" }).state;
  for (const code of layout.victory ?? []) state = spawn(state, code, { zone: "victory" }).state;
  for (const row of layout.engaged ?? []) state = spawn(state, row.code, { zone: "engaged", seat: row.seat }).state;
  if (layout.active) state = spawn(state, layout.active, { zone: "activeLocation" }).state;
  state = { ...state, phase: "Quest", boundaryPhase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0 };
  return { state, ctx: { effects: EFFECTS, cards } };
}

type Run = { state: ScenarioState; steps: EngineStep[] };

function send(run: Run, intent: PlayerIntent, ctx: ReduceContext): Run {
  const result = expectOk(reduce(run.state, intent, ctx));
  return { state: result.state, steps: [...run.steps, ...result.steps] };
}

function start(state: ScenarioState): Run {
  return { state, steps: [] };
}

// Passes the quest commit step, which moves to staging and reveals.
function reveal(state: ScenarioState, ctx: ReduceContext, seats = 1): Run {
  let run = start(state);
  for (let seat = 0; seat < seats; seat += 1) run = send(run, { type: "Pass" }, ctx);
  return run;
}

function frames(steps: readonly EngineStep[]): string[] {
  return steps.flatMap((step) => (step.kind === "push" || step.kind === "pop" ? [`${step.kind}:${step.frame}`] : []));
}

function codeOf(state: ScenarioState, id: string | null): string {
  return (id ? state.cards[id]?.code : undefined) ?? "";
}

function codesOf(state: ScenarioState, ids: readonly string[]): string[] {
  return ids.map((id) => codeOf(state, id));
}

function first(state: ScenarioState, code: string): string {
  return byCode(state, code)[0] ?? "";
}

describe("failed Hide test", () => {
  it("141022 triggered effect resolves, then 141039 Forced effect, then play goes on", () => {
    const { state, ctx } = table({ deck: [RIDER, "f3", "f3", "f0"] });
    let run = reveal(state, ctx);
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    run = send(run, { type: "CommitHide", cardIds: [] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    const rider = first(run.state, RIDER);
    const sam = first(run.state, SAM);
    expect(run.state.hideFailures).toEqual([{ seat: 0, round: 0, phase: "Quest" }]);
    expect(run.state.cards[rider]?.zone).toBe("engaged");
    expect(run.state.cards[rider]?.controller).toBe(0);
    expect(run.state.window).toEqual({ kind: "defense", enemyId: rider, seat: 0 });
    // 141022 resolves before 141039.
    const engageAt = run.steps.findIndex((step) => step.kind === "engage");
    const attackAt = run.steps.findIndex((step) => step.kind === "attack");
    expect(engageAt).toBeGreaterThanOrEqual(0);
    expect(attackAt).toBeGreaterThan(engageAt);
    expect(frames(run.steps)).toEqual(["push:reveal", "push:hide", "push:event", "push:forced", "pop:forced", "push:forced"]);
    run = send(run, { type: "Undefended", heroId: sam }, ctx);
    expect(frames(run.steps).slice(6)).toEqual(["pop:forced", "pop:event", "pop:hide", "pop:reveal"]);
    expect(run.state.cards[sam]?.damage).toBe(5);
    expect(run.state.stack).toEqual([]);
    expect(run.state.lost).toBe(false);
    expect(run.state.resolvedAttacks).toEqual([]);
    expect(run.state.mode).toBe("travel");
  });

  it("141039 Forced condition fails for a Rider engaged with another seat", () => {
    const { state, ctx } = table({
      seats: 2,
      deck: ["141041", "f3", "f3", "f0"],
      engaged: [{ code: RIDER, seat: 1 }],
    });
    let run = reveal(state, ctx, 2);
    // 141041 has Hide 2. Seat 0 commits nobody and fails.
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    run = send(run, { type: "CommitHide", cardIds: [] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    expect(run.state.hideFailures).toHaveLength(1);
    const rider = first(run.state, RIDER);
    expect(run.state.cards[rider]?.zone).toBe("engaged");
    expect(run.state.cards[rider]?.controller).toBe(1);
    expect(run.steps.some((step) => step.kind === "attack")).toBe(false);
  });

  it("141038 Forced effect", () => {
    const { state, ctx } = table({ deck: ["141041", "f3", "f3", "f0"], discard: [RIDER], staging: ["141038"] });
    let run = reveal(state, ctx);
    const rider = first(run.state, RIDER);
    expect(run.state.cards[rider]?.zone).toBe("encounterDiscard");
    run = send(run, { type: "CommitHide", cardIds: [] }, ctx);
    const cursor = run.state.seedCursor;
    run = send(run, { type: "Pass" }, ctx);
    expect(run.state.cards[rider]?.zone).toBe("encounterDeck");
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
  });
});

describe("141041 Crawling Towards Him", () => {
  it("Hide runs before When Revealed, and a failed test applies the conditional instruction", () => {
    const { state, ctx } = table({ deck: ["141041", "f3", "f3", "f0"] });
    const sam = first(state, SAM);
    const frodo = first(state, FRODO);
    let run = send(start(state), { type: "Commit", cardIds: [sam] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    expect(run.state.cards[sam]?.committed).toBe(true);
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    run = send(run, { type: "CommitHide", cardIds: [] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    expect(frames(run.steps).filter((entry) => entry.includes("reveal") || entry.includes("hide") || entry.includes("whenRevealed"))).toEqual([
      "push:reveal",
      "push:hide",
      "pop:hide",
      "push:whenRevealed",
      "pop:whenRevealed",
      "pop:reveal",
    ]);
    expect(run.state.cards[sam]?.committed).toBe(false);
    expect(run.state.cards[sam]?.exhausted).toBe(true);
    expect(run.state.cards[frodo]?.exhausted).toBe(false);
  });

  it("a successful test leaves the conditional instruction unapplied", () => {
    const { state, ctx } = table({ deck: ["141041", "f0", "f0", "f0"] });
    const sam = first(state, SAM);
    const frodo = first(state, FRODO);
    let run = send(start(state), { type: "Commit", cardIds: [sam] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    run = send(run, { type: "CommitHide", cardIds: [frodo] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    expect(run.steps.filter((step) => step.kind === "hideTest")).toMatchObject([{ success: true }]);
    expect(run.state.hideFailures).toEqual([]);
    expect(run.state.cards[sam]?.committed).toBe(false);
  });
});

describe("When Revealed and Forced on locations and treacheries", () => {
  it("141033 with an active location", () => {
    const { state, ctx } = table({ deck: ["141033"], active: "141031" });
    const run = reveal(state, ctx);
    expect(codeOf(run.state, run.state.activeLocation)).toBe("141033");
    expect(codesOf(run.state, run.state.staging)).toEqual(["141031"]);
  });

  it("141033 with no active location", () => {
    const { state, ctx } = table({ deck: ["141033"] });
    const run = reveal(state, ctx);
    expect(codeOf(run.state, run.state.activeLocation)).toBe("141033");
    expect(run.state.staging).toEqual([]);
  });

  it("141073 opens a choice window, then shuffles", () => {
    const { state, ctx } = table({ deck: ["141073", "f0", "f0", "f0"], discard: [RIDER] });
    const opened = reveal(state, ctx);
    expect(opened.state.window).toEqual({ kind: "choose", seat: 0, options: ["staging", "engage"] });
    const rider = first(opened.state, RIDER);
    const cursor = opened.state.seedCursor;
    const engaged = send(opened, { type: "Choose", optionId: "engage" }, ctx);
    expect(engaged.state.cards[rider]?.zone).toBe("engaged");
    expect(engaged.state.cards[rider]?.controller).toBe(0);
    expect(engaged.state.seedCursor).toBeGreaterThan(cursor);
    const staged = send(opened, { type: "Choose", optionId: "staging" }, ctx);
    expect(staged.state.cards[rider]?.zone).toBe("staging");
  });

  it("141073 with no match only shuffles", () => {
    const { state, ctx } = table({ deck: ["141073", "f0", "f0", "f0"] });
    const run = reveal(state, ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.seedCursor).toBeGreaterThan(state.seedCursor);
  });

  it("141076 opens a choice window, then surges", () => {
    const { state, ctx } = table({ deck: ["141076", "f0"] });
    const opened = reveal(state, ctx);
    expect(opened.state.window).toEqual({ kind: "choose", seat: 0, options: ["exhaust", "threat"] });
    const ring = first(opened.state, RING);
    const exhausted = send(opened, { type: "Choose", optionId: "exhaust" }, ctx);
    expect(exhausted.state.cards[ring]?.exhausted).toBe(true);
    expect(exhausted.state.seats[0]?.threat).toBe(8);
    expect(codesOf(exhausted.state, exhausted.state.staging)).toContain("f0");
    const raised = send(opened, { type: "Choose", optionId: "threat" }, ctx);
    expect(raised.state.seats[0]?.threat).toBe(11);
    expect(raised.state.cards[ring]?.exhausted).toBe(false);
  });

  it("141076 skips the choice when only one option is legal", () => {
    for (const ring of ["exhausted", "none"] as const) {
      const { state, ctx } = table({ deck: ["141076", "f0"], ring });
      const run = reveal(state, ctx);
      expect(run.state.window?.kind).not.toBe("choose");
      expect(run.state.seats[0]?.threat).toBe(11);
    }
  });

  it("141043 When Revealed attaches to the chosen hero, and its Forced effect fires on a failed test", () => {
    const { state, ctx } = table({ deck: ["141043", "f0"] });
    const opened = reveal(state, ctx);
    const sam = first(opened.state, SAM);
    const frodo = first(opened.state, FRODO);
    expect(opened.state.window).toEqual({ kind: "choose", seat: 0, options: [frodo, sam] });
    const attached = send(opened, { type: "Choose", optionId: sam }, ctx);
    const card = first(attached.state, "141043");
    expect(attached.state.cards[card]).toMatchObject({ zone: "attached", host: sam });
    expect(attached.state.cards[sam]?.attachments).toEqual([card]);
    // Surge: the next card was revealed too.
    expect(codesOf(attached.state, attached.state.staging)).toContain("f0");
    const steps: EngineStep[] = [];
    const idle = { ...attached.state, window: null, mode: "stopped" as const };
    const failed = settle(fireForced(idle, { trigger: "hideFailed", seat: 0 }, ctx, steps), ctx, steps);
    expect(failed.cards[sam]?.zone).toBe("discard");
    expect(failed.cards[card]?.zone).toBe("encounterDiscard");
    expect(failed.cards[frodo]?.zone).toBe("heroes");
  });

  it("141074 When Revealed attaches to a Nazgul, and its Forced effect fires at the end of Refresh", () => {
    const { state, ctx } = table({ deck: ["141074", "f0"], engaged: [{ code: RIDER, seat: 0 }] });
    const run = reveal(state, ctx);
    const rider = first(run.state, RIDER);
    const steed = first(run.state, "141074");
    expect(run.state.cards[steed]).toMatchObject({ zone: "attached", host: rider });
    // Only the end of the Refresh phase matters here.
    const refresh = { ...run.state, window: null, stack: [], mode: "stopped" as const, phase: "Refresh" as const, boundaryPhase: "Refresh" as const };
    const steps: EngineStep[] = [];
    const ended = settle({ ...refresh, phase: "End of round" }, ctx, steps);
    expect(ended.cards[rider]?.zone).toBe("staging");
    expect(ended.cards[rider]?.controller).toBeNull();
    expect(ended.cards[steed]).toMatchObject({ zone: "attached", host: rider });
    // A different phase ending does not fire it.
    const other = settle({ ...refresh, boundaryPhase: "Combat", phase: "Refresh" }, ctx, []);
    expect(other.cards[rider]?.zone).toBe("engaged");
  });

  it("141074 with no Nazgul in play stays unattached", () => {
    const { state, ctx } = table({ deck: ["141074", "f0"] });
    const run = reveal(state, ctx);
    const steed = first(run.state, "141074");
    expect(run.state.cards[steed]?.zone).toBe("staging");
    expect(run.state.cards[steed]?.host).toBeNull();
  });

  it("141075 returns engaged Nazgul, and gains surge only when none was returned", () => {
    const withRider = table({ deck: ["141075", "f0"], engaged: [{ code: RIDER, seat: 0 }] });
    const returned = reveal(withRider.state, withRider.ctx);
    const rider = first(returned.state, RIDER);
    expect(returned.state.cards[rider]?.zone).toBe("staging");
    expect(returned.state.cards[rider]?.controller).toBeNull();
    expect(returned.state.encounterDeck).toHaveLength(1);
    const without = table({ deck: ["141075", "f0"] });
    const surged = reveal(without.state, without.ctx);
    expect(surged.state.encounterDeck).toHaveLength(0);
    expect(codesOf(surged.state, surged.state.staging)).toEqual(["141075", "f0"]);
  });
});

describe("141042 Hunting for the Ring", () => {
  it("asks the last player first, and a seat with no engaged Nazgul takes the Hide test", () => {
    const { state, ctx } = table({
      seats: 2,
      deck: ["141042", "f0", "f0", "f0", "f0"],
      engaged: [{ code: RIDER, seat: 1 }],
    });
    let run = reveal(state, ctx, 2);
    // Doomed raised both seats.
    expect(run.state.seats[0]?.threat).toBe(10);
    expect(run.state.seats[1]?.threat).toBe(8);
    expect(run.state.window).toEqual({ kind: "choose", seat: 1, options: ["return", "hide"] });
    expect(legalIntents(run.state, ctx)).toEqual([
      { type: "Choose", optionId: "return" },
      { type: "Choose", optionId: "hide" },
    ]);
    run = send(run, { type: "Choose", optionId: "return" }, ctx);
    const rider = first(run.state, RIDER);
    expect(run.state.cards[rider]?.zone).toBe("staging");
    // Seat 0 has no engaged Nazgul, so one option is legal and the Hide 2 test starts.
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
  });

  it("a seat that chooses the Hide test starts it", () => {
    const { state, ctx } = table({
      seats: 2,
      deck: ["141042", "f0", "f0", "f0", "f0"],
      engaged: [{ code: RIDER, seat: 1 }],
    });
    let run = reveal(state, ctx, 2);
    run = send(run, { type: "Choose", optionId: "hide" }, ctx);
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 1 });
    expect(run.state.cards[first(run.state, RIDER)]?.zone).toBe("engaged");
  });
});

describe("141077 Gildor Inglorion", () => {
  function gildorInPlay(resources: number) {
    const { state, ctx } = table({ deck: ["141077", "f0"], resources });
    const run = reveal(state, ctx);
    const gildor = first(run.state, "141077");
    return { run, ctx, gildor, frodo: first(run.state, FRODO), sam: first(run.state, SAM) };
  }

  it("When Revealed puts it in the first player's play area as a character", () => {
    const { run, ctx, gildor } = gildorInPlay(0);
    expect(run.state.cards[gildor]).toMatchObject({ zone: "play", controller: 0 });
    expect(characters(run.state, 0, ctx.cards)).toContain(gildor);
  });

  function atEndOfRound(run: ScenarioState, ctx: ReduceContext): ScenarioState {
    const steps: EngineStep[] = [];
    const idle = { ...run, window: null, stack: [], mode: "stopped" as const, phase: "End of round" as const, boundaryPhase: "End of round" as const };
    return settle({ ...idle, phase: "Beginning of round" }, ctx, steps);
  }

  it("Forced effect offers a paid cancel; paying keeps it and passing discards it", () => {
    const { run, ctx, gildor, frodo, sam } = gildorInPlay(1);
    const offered = atEndOfRound(run.state, ctx);
    expect(offered.window).toEqual({ kind: "cancelOffer", seat: 0 });
    const wrong = reduce(
      updateCard(offered, sam, { resources: 2 }),
      { type: "Trigger", cardId: gildor, effectId: "141077:forced:1", payments: [{ heroId: sam, amount: 1 }] },
      ctx,
    );
    expect(wrong.ok).toBe(false);
    const paid = expectOk(
      reduce(offered, { type: "Trigger", cardId: gildor, effectId: "141077:forced:1", payments: [{ heroId: frodo, amount: 1 }] }, ctx),
    );
    expect(paid.state.cards[gildor]?.zone).toBe("play");
    expect(paid.state.cards[frodo]?.resources).toBe(0);
    const passed = expectOk(reduce(offered, { type: "Pass" }, ctx));
    expect(passed.state.cards[gildor]?.zone).toBe("discard");
    expect(passed.state.seats[0]?.discard).toContain(gildor);
  });

  it("Forced effect makes no offer when nobody can pay", () => {
    const { run, ctx, gildor } = gildorInPlay(0);
    const ended = atEndOfRound(run.state, ctx);
    expect(ended.window).toBeNull();
    expect(ended.cards[gildor]?.zone).toBe("discard");
  });
});

describe("141079 The Ring Draws Them", () => {
  it("gains surge from its keyword, and its delayed instruction fires at the end of the phase", () => {
    const { state, ctx } = table({ deck: ["141079", "f0", "f0"], staging: [RIDER] });
    const pass = send(start(state), { type: "Pass" }, ctx);
    const rider = first(pass.state, RIDER);
    const filler = first(pass.state, "f0");
    // Scheduled during the reveal, then resolved when the Quest phase ended.
    expect(pass.steps.filter((step) => step.kind === "engage")).toEqual([
      { kind: "engage", seat: 0, enemyId: rider },
      { kind: "engage", seat: 0, enemyId: filler },
    ]);
    expect(pass.state.cards[rider]?.zone).toBe("engaged");
    expect(pass.state.cards[filler]?.zone).toBe("engaged");
    expect(pass.state.delayed).toEqual([]);
    expect(pass.state.phase).toBe("Travel");
  });

  it("schedules a delayed instruction whose uncancelable condition reads the Ring", () => {
    for (const ring of ["ready", "exhausted"] as const) {
      const { state, ctx } = table({ staging: [RIDER], ring });
      const card = spawn(state, "141079", { zone: "staging" });
      const stopped = { ...card.state, mode: "stopped" as const, window: null };
      const steps: EngineStep[] = [];
      const effects = EFFECTS.filter((effect) => effect.cardCode === "141079");
      const scheduled = settle(pushCardEffects(stopped, "whenRevealed", card.id, 0, false, effects, ctx, steps), ctx, steps);
      expect(scheduled.delayed).toHaveLength(1);
      expect(scheduled.delayed[0]).toMatchObject({
        until: "endOfPhase",
        phase: "Quest",
        uncancelable: { kind: "exhausted", code: RING, is: true },
      });
      const due = pushDue(scheduled, "Quest", "endOfPhase", steps);
      const begun = advanceFrame(due, ctx, steps);
      const data = topFrame(begun)?.data;
      expect(data?.kind === "effect" && data.uncancelable).toBe(ring === "exhausted");
      // No cancel source exists in this scenario, so the instruction runs either way.
      const crossed = settle({ ...scheduled, phase: "Travel" }, ctx, steps);
      expect(crossed.cards[first(crossed, RIDER)]?.zone).toBe("engaged");
    }
  });
});

describe("quest stages", () => {
  it("141023 When Revealed runs when the quest advances, with a Hide test inside it", () => {
    const { state, ctx } = table({ progress: 0, deck: ["f0", "f0", "f0", RIDER, "f0", "f0", "f0"], stage: "141022", victory: ["141031"] });
    const sam = first(state, SAM);
    let run = send(start(state), { type: "Commit", cardIds: [sam] }, ctx);
    const cursor = run.state.seedCursor;
    run = send(run, { type: "Pass" }, ctx);
    // A filler staged, the quest advanced, and 141039 is being revealed with its Hide test.
    expect(codeOf(run.state, run.state.questStage)).toBe("141023");
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    expect(frames(run.steps)).toEqual(["push:reveal", "pop:reveal", "push:whenRevealed", "push:reveal", "push:hide"]);
    expect(run.state.mode).toBe("resolution");
    const frodo = first(run.state, FRODO);
    run = send(run, { type: "CommitHide", cardIds: [frodo] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    expect(codesOf(run.state, run.state.staging)).toContain(RIDER);
    expect(run.state.seedCursor).toBeGreaterThan(cursor);
    expect(run.state.mode).toBe("travel");
    expect(run.state.stack).toEqual([]);
  });

  it("141024 When Revealed effects run when the quest advances", () => {
    const { state, ctx } = table({ stage: "141023", progress: 13, deck: ["f0", "f0", "f0", RIDER, "f0"], setAside: ["141035"] });
    const sam = first(state, SAM);
    let run = send(start(state), { type: "Commit", cardIds: [sam] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    expect(codeOf(run.state, run.state.questStage)).toBe("141024");
    expect(codesOf(run.state, run.state.staging)).toContain("141035");
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    const frodo = first(run.state, FRODO);
    run = send(run, { type: "CommitHide", cardIds: [frodo] }, ctx);
    run = send(run, { type: "Pass" }, ctx);
    expect(codesOf(run.state, run.state.staging)).toContain(RIDER);
    // The successful Hide test offers 141024's Response. Passing it lets the phase finish.
    expect(run.state.window).toEqual({ kind: "response", seat: 0 });
    run = send(run, { type: "Pass" }, ctx);
    expect(run.state.mode).toBe("travel");
  });
});

describe("Setup records", () => {
  const SETUP_CODES = ["141022", "141078", "141017"];

  function isSubsequence(part: readonly unknown[], whole: readonly unknown[]): boolean {
    let at = 0;
    for (const item of whole) {
      if (at < part.length && JSON.stringify(item) === JSON.stringify(part[at])) at += 1;
    }
    return at === part.length;
  }

  it("mirror the instructions the definition and the script already run", () => {
    const run = [...definition.setup, { verb: "ShuffleEncounterDeck" }];
    for (const code of SETUP_CODES) {
      const record = EFFECTS.find((effect) => effect.cardCode === code && effect.timing === "setup");
      expect(record, code).toBeDefined();
      expect(isSubsequence(record?.instructions ?? [], run), code).toBe(true);
    }
    // The campaign script, not the definition, runs the 141085 Setup record.
    expect(definition.setup.some((instruction) => "code" in instruction && instruction.code === RING)).toBe(false);
  });

  it("never place a card a second time", () => {
    const start = scriptFor("a-shadow-of-the-past").start({
      fixture,
      definition,
      seatCount: 1,
      seed: 5,
      threatModifier: 0,
      seats: [{ heroes: [FRODO, SAM], deck: [] }],
    });
    const ctx: ReduceContext = { effects: EFFECTS, cards };
    const started = startScenario(start, ctx);
    const kept = expectOk(reduce(started, { type: "Keep" }, ctx)).state;
    for (const code of ["141078", "141017", "141031", "141035"]) {
      expect(byCode(kept, code), code).toHaveLength(1);
    }
    expect(codesOf(kept, kept.staging).sort()).toEqual(["141039", "141078"]);
    expect(kept.encounterDeck).toHaveLength(42);
  });
});

describe("Gandalf's Delay", () => {
  it("141078 Gandalf's Delay: second Setup sentence needs a cited source", () => {
    const records = EFFECTS.filter((effect) => effect.cardCode === "141078" && effect.timing === "setup");
    expect(
      records.length,
      "141078 Gandalf's Delay: cite the quest card or Learn to Play pages 28-30, then author its second Setup sentence",
    ).toBeGreaterThanOrEqual(2);
  });
});
