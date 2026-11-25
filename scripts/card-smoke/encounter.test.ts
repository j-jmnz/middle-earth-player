import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../src/catalog/boundary.ts";
import type { ReduceContext } from "../../src/rules/engine/reduce.ts";

import { countOf, formatSummary, KNOWN, knownOf, lossesOf, probeTable, problemsOf, replayCommand, smokeScenario, soakNote, soakDeadline, soakStart, type EncounterSummary, type KnownFailure } from "./encounter.ts";
import { encounterCards, probeCard, type Probe } from "./encounter-cards.ts";
import { playGame, type GameSummary } from "./encounter-games.ts";
import type { EncounterWorld } from "./encounter-world.ts";
import { encounterWorld } from "./encounter-world.ts";

// The encounter smoke (scripts/card-smoke/encounter.ts) on one scenario, and proof that it reports what it should: a record the engine
// cannot run fails the probe that plays it, a game replays to the same state. The whole sweep (every playable scenario) runs in
// `pnpm test scenario <id>` and `pnpm test encounter --all`, not here: it takes minutes.
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
    // Two whole games: well over the default 5 s when other work shares the cores.
  }, 30_000);

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

describe("known failures and flags", () => {
  const game = (over: Partial<NonNullable<GameSummary["problem"]>> & { game?: number; seed?: number } = {}): GameSummary => ({
    game: over.game ?? 5,
    seed: over.seed ?? 6,
    profile: "strong",
    seats: 2,
    steps: 0,
    rounds: 0,
    ended: "problem",
    lossReason: null,
    idle: [],
    problem: { game: over.game ?? 5, seed: over.seed ?? 6, profile: "strong", seats: 2, step: 80, round: 3, window: "response", intent: { type: "Trigger", cardId: "i3", effectId: "141024:response:1" }, message: "The reducer refused an offered intent: Travel was refused", ...over },
  });
  const summary = (games: GameSummary[]): EncounterSummary => ({ scenario: "a-shadow-of-the-past", cards: [], games, ms: 0 });

  // The list holds no entry while no engine failure is open, so the matching is tested on a stand-in entry.
  const listed: readonly KnownFailure[] = [{ scenario: "a-shadow-of-the-past", game: 5, seed: 6, intent: "141024:response:1", error: "Travel was refused", note: "stand-in" }];

  it("reports the listed failure as known and fails on anything else", () => {
    expect(problemsOf(summary([game()]), listed)).toEqual([]);
    expect(knownOf(summary([game()]), listed)).toHaveLength(1);
    // Another message, another seed, another game or another scenario is not the known one.
    expect(problemsOf(summary([game({ message: "The reducer refused an offered intent: something else" })]), listed)).toHaveLength(1);
    expect(problemsOf(summary([game({ seed: 7 })]), listed)).toHaveLength(1);
    expect(problemsOf(summary([game({ game: 6 })]), listed)).toHaveLength(1);
    expect(problemsOf({ ...summary([game()]), scenario: "the-oath" }, listed)).toHaveLength(1);
    expect(problemsOf(summary([game({ intent: { type: "Pass" } })]), listed)).toHaveLength(1);
    expect(problemsOf(summary([game()]), KNOWN)).toHaveLength(1);
  });

  it("says how many games were won and lost, and the lost ones by reason, most frequent first", () => {
    const ended = (ended: GameSummary["ended"], lossReason: string | null = null): GameSummary => ({ ...game(), ended, lossReason, problem: null });
    const games = [ended("lost", "No seats remain"), ended("won"), ended("lost", "Faramir left play"), ended("lost", "No seats remain"), ended("lost", "no reason recorded")];
    expect(lossesOf(games)).toEqual([["No seats remain", 2], ["Faramir left play", 1], ["no reason recorded", 1]]);
    expect(formatSummary(summary(games))).toContain("5 games (1 won, 4 lost (No seats remain x2, Faramir left play x1, no reason recorded x1), 0 problems)");
    // A soak that wins nothing says so: 0 won, with no loss list when nothing was lost either.
    expect(formatSummary(summary([ended("won")]))).toContain("1 games (1 won, 0 lost, 0 problems)");
    expect(lossesOf([game()])).toEqual([]);
  });

  it("prints the command that plays a soak's games again, and says KNOWN is not matched in a soak", () => {
    expect(replayCommand("the-oath", 123456, 40)).toBe("pnpm test encounter the-oath --from=123456 --games=40 --games-only");
    expect(soakNote("the-oath", 123456, 40)).toContain("--from=123456 --games=40 --games-only");
    expect(soakNote("the-oath", 123456, 40)).toContain("does not match KNOWN");
  });

  it("rejects a count that is not a whole number", () => {
    expect(countOf("games", "12")).toBe(12);
    expect(countOf("games", "0")).toBe(0);
    expect(() => countOf("games", "abc")).toThrow(/--games=abc/);
    expect(() => countOf("games", "")).toThrow();
    expect(() => countOf("games", "-1")).toThrow();
  });

  it("numbers the games from --from, so a soak plays seeds the committed 0 to 23 do not", async () => {
    const summary = await smokeScenario(SCENARIO, { games: 2, from: 5000, cards: false });
    expect(summary.games.map((one) => [one.game, one.seed])).toEqual([
      [5000, 5001],
      [5001, 5002],
    ]);
    expect(summary.cards).toEqual([]);
    expect(problemsOf(summary)).toEqual([]);
  }, 60_000);

  it("plays games until its deadline and at least one, and starts a soak past the committed games", async () => {
    const summary = await smokeScenario(SCENARIO, { from: 7000, until: performance.now() - 1, cards: false });
    expect(summary.games.map((one) => one.game)).toEqual([7000]);
    expect(soakStart(12)).toBe(12);
    expect(soakStart(undefined, () => 0)).toBe(24);
    expect(soakStart(undefined, () => 0.5)).toBeGreaterThanOrEqual(24);
    // The time left is shared by the scenarios left, this one included; none is left with a negative share.
    expect(soakDeadline(1000, 4000, 3)).toBe(2000);
    expect(soakDeadline(1000, 4000, 1)).toBe(4000);
    expect(soakDeadline(5000, 4000, 2)).toBe(5000);
  }, 60_000);
});
