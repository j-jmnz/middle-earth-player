import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../src/catalog/boundary.ts";
import type { ReduceContext } from "../../src/rules/engine/reduce.ts";

import { probeTable, problemsOf, smokeScenario } from "./encounter.ts";
import { encounterCards, probeCard, type Probe } from "./encounter-cards.ts";
import { playGame } from "./encounter-games.ts";
import type { EncounterWorld } from "./encounter-world.ts";
import { encounterWorld } from "./encounter-world.ts";

// The encounter smoke (scripts/card-smoke/encounter.ts) on one scenario, and proof that it reports what it should: a record the engine
// cannot run fails the probe that plays it, a game replays to the same state. The whole sweep (every playable scenario) runs in
// `pnpm test:scenario <id>` and `node --experimental-strip-types scripts/card-smoke/encounter.ts --all`, not here: it takes minutes.
const SCENARIO = "the-thing-in-the-depths";
// A Forced-free card of the scenario for each probe: a treachery with a Shadow, a location, a stage with a Setup.
const REVEALED = "12048";
const SHADOWED = "11067";
const LOCATION = "12044";
const STAGE = "12040";

let world: EncounterWorld;

beforeAll(async () => {
  world = await encounterWorld(SCENARIO);
}, 60_000);

function broken(ctx: ReduceContext, code: string, timing: Effect["timing"]): ReduceContext {
  const effect: Effect = { id: `${code}:${timing}:99`, cardCode: code, lines: [`${code}:A:1`], timing, instructions: [{ verb: "NoSuchVerb" } as unknown as Instruction] };
  return { ...ctx, effects: [...ctx.effects.filter((one) => !(one.cardCode === code && one.timing === timing)), effect] };
}

describe(`encounter smoke: ${SCENARIO}`, () => {
  it("plays every encounter card and a few seeded games with no problem", async () => {
    const summary = await smokeScenario(SCENARIO, { games: 3 });
    expect(problemsOf(summary)).toEqual([]);
    expect(summary.cards.length).toBeGreaterThan(40);
    expect(summary.cards.map((result) => result.probe)).toEqual(expect.arrayContaining(["reveal", "shadow", "shadow (undefended)", "travel", "setup"]));
    expect(summary.games).toHaveLength(3);
  }, 60_000);

  it("deals every card of the scenario once, its quest cards apart", () => {
    const { cards, stages } = encounterCards(world.scenario);
    expect(stages).toEqual(world.scenario.stages);
    expect(new Set(cards.map((card) => card.code)).size).toBe(cards.length);
    expect(cards.map((card) => card.code)).toContain(REVEALED);
  });

  it.each([
    ["reveal", REVEALED, "whenRevealed"],
    ["shadow", SHADOWED, "shadow"],
    ["shadow (undefended)", SHADOWED, "shadow"],
    ["travel", LOCATION, "travel"],
    ["setup", STAGE, "setup"],
  ] as const satisfies readonly (readonly [Probe, string, Effect["timing"]])[])("reports a record the engine cannot run in the %s probe", (probe, code, timing) => {
    const ctx = world.contexts.strong;
    const base = probeTable(world);
    expect(probeCard(base, ctx, code, probe).problem, "the unbroken card").toBeNull();
    const result = probeCard(base, broken(ctx, code, timing), code, probe);
    expect(result.problem).toContain("NoSuchVerb");
  });

  it("plays a numbered game the same way every time, to its end, and replays it", () => {
    const first = playGame(world, 0);
    expect(first.problem).toBeNull();
    expect(first.ended).not.toBe("problem");
    expect(first.steps).toBeGreaterThan(5);
    expect(playGame(world, 0)).toEqual(first);
  });

  it("reports a game a broken record stops, with its seed, step and intent", () => {
    // Every game reveals encounter cards: break all of the scenario's When Revealed records.
    const effects = world.contexts.strong.effects.map((effect): Effect => (effect.timing === "whenRevealed" ? { ...effect, instructions: [{ verb: "NoSuchVerb" } as unknown as Instruction] } : effect));
    const stopped = { ...world, contexts: { ...world.contexts, strong: { ...world.contexts.strong, effects } } };
    const results = [0, 5, 10].map((number) => playGame(stopped, number));
    expect(results.every((game) => game.profile === "strong")).toBe(true);
    const failed = results.filter((game) => game.problem != null);
    expect(failed.length).toBeGreaterThan(0);
    expect(failed[0]?.problem?.message).toContain("NoSuchVerb");
    expect(failed[0]?.problem?.step).toBeGreaterThan(0);
  });
});
