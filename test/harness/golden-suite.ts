import { beforeAll, describe, expect, it } from "vitest";

import { applyResolution, emptyLog, type CampaignLog } from "../../src/campaign/log.ts";
import { campaignPath, nextStep, type PathNode } from "../../src/campaign/path.ts";
import { beginActive, recordIntent, replay } from "../../src/campaign/replay.ts";
import { xpAwarded } from "../../src/campaign/xp.ts";
import type { CampaignData, ScenarioData } from "../../src/catalog/scenario-data.ts";
import type { PrintedCard } from "../../src/rules/core/printed.ts";
import { expectOk } from "../../src/rules/core/test-fixture.ts";
import type { Cause } from "../../src/rules/core/cause.ts";
import type { EngineStep } from "../../src/rules/core/intents.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";

import { causeProblems, NUMBER_STEPS } from "./cause-check.ts";
import type { CampaignGoldenBase, PlayedGame } from "./game-kit.ts";
import { nextPartId, nextPartStatus, nextStepKind } from "./next-part.ts";
import { NO_COPY_LIMITS } from "../../src/campaign/wilderland.ts";

// Test helper. The suite every campaign scenario's golden test (src/campaign/scenarios/<scenario-id>/golden.test.ts) registers: the
// snapshot of the games, the opening, the cause of every number (the scenario's own records among them), a golden replayed from its
// save, the won loop (the Resolution, the XP, the next part on the campaign path) and the lost loop (nothing is written). The scenario
// passes its opening assertions, its expected XP and its own checks. Each golden is played once, here.

export type SuiteWorld = { cards: Map<string, PrintedCard>; ctx: ReduceContext };
export type SuiteGolden<D extends string> = CampaignGoldenBase & { name: string; decks: D; outcome: "won" | "lost"; lossReason?: string };

export type WonGame<G> = { state: ScenarioState; golden: G; world: SuiteWorld; log: CampaignLog; path: readonly PathNode[] };

export type GoldenSuiteSpec<G extends SuiteGolden<D>, D extends string, P extends PlayedGame = PlayedGame> = {
  /** The scenario's name, as the suite's title reads it. */
  title: string;
  /** The golden.json beside the test: `new URL("./golden.json", import.meta.url).pathname`. */
  file: string;
  campaign: CampaignData;
  scenario: ScenarioData;
  goldens: readonly G[];
  world: (decks: D) => Promise<SuiteWorld>;
  play: (golden: G, ctx: ReduceContext) => P;
  /** The Setup's questions: the option each takes (the first by default) and how many it may ask (40). */
  pick?: (options: readonly string[]) => string;
  guard?: number;
  /** The opening test's title and what it asserts of the game started and its Setup played. */
  opening: { title: string; check: (state: ScenarioState, golden: G, world: SuiteWorld) => void };
  /** The tail of each won test's title, after the golden's name. */
  wins: string | ((golden: G) => string);
  /** What a won game shows before its Resolution runs (the stage it ended on, the cards it earned). */
  won: (state: ScenarioState, golden: G, world: SuiteWorld) => void;
  /** The XP the campaign card's list awards, counted from the final state (absent in a campaign without XP). */
  expectedXp?: (state: ScenarioState, golden: G, world: SuiteWorld) => number;
  /** The log the Resolution is written onto: the earlier parts completed, or this one when it must carry more (the pool). */
  before?: (golden: G, game: P) => CampaignLog;
  /** What a lost game shows besides nothing being written. */
  lost?: (state: ScenarioState, golden: G, world: SuiteWorld, game: P) => void;
  /** The cause test's title when it says more, and what it also checks of each game. */
  causeTitle?: string;
  cause?: (game: P, golden: G) => void;
  /** What the log and the path show once the Resolution is written. */
  afterWin?: (won: WonGame<G>) => void;
  /** The scenario's own tests, registered after the cause test. */
  checks?: (suite: { game: (golden: G) => P; world: (golden: G) => SuiteWorld; opened: (golden: G) => ScenarioState }) => void;
};

/** The causes of the number-changing steps that name a record of the scenario's own cards (its campaign card, quest cards and encounter cards). */
export function ownCauses(scenario: ScenarioData, steps: readonly EngineStep[]): Cause[] {
  const own = new Set([scenario.campaignCard, ...scenario.stages, ...scenario.cards.map((card) => card.code)]);
  return steps
    .filter((step) => NUMBER_STEPS.has(step.kind))
    .map((step) => (step as { cause: Cause }).cause)
    .filter((cause) => "effect" in cause && own.has(cause.effect.split(":")[0] ?? ""));
}

/** Expects the game, saved as its intents (src/campaign/replay.ts) and read back as JSON, to replay to the state it was played to. */
export function expectReplays(game: Pick<PlayedGame, "start" | "intents" | "state">, ctx: ReduceContext): void {
  const HASH = 7;
  let active = beginActive(game.start, HASH);
  for (const intent of [{ type: "Keep" } as const, ...game.intents]) active = recordIntent(active, intent);
  const replayed = replay(JSON.parse(JSON.stringify(active)), game.start, HASH, ctx);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(game.state);
}

/** The log of a campaign whose parts before this scenario were won (nothing else written). */
export function logBefore(campaign: CampaignData, scenario: ScenarioData, seatCount: 1 | 2): CampaignLog {
  return { ...emptyLog(seatCount), completed: campaign.scenarios.slice(0, campaign.scenarios.indexOf(scenario.id)) };
}

export function goldenSuite<G extends SuiteGolden<D>, D extends string, P extends PlayedGame = PlayedGame>(spec: GoldenSuiteSpec<G, D, P>): void {
  const worlds = new Map<D, SuiteWorld>();
  const games = new Map<string, P>();
  const index = spec.campaign.scenarios.indexOf(spec.scenario.id);

  beforeAll(async () => {
    for (const golden of spec.goldens) {
      // The checklist reads the cards of the world it deals for.
      const world = await spec.world(golden.decks);
      worlds.set(golden.decks, world);
      games.set(golden.name, spec.play(golden, world.ctx));
    }
  }, 240_000);

  const game = (golden: G): P => games.get(golden.name)!;
  const worldOf = (golden: G): SuiteWorld => worlds.get(golden.decks)!;

  // The opening: the game started and the Setup played, every question answered.
  function opened(golden: G): ScenarioState {
    const { ctx } = worldOf(golden);
    let state = startScenario(game(golden).start, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    for (let guard = 0; guard < (spec.guard ?? 40) && state.window?.kind === "choose"; guard += 1) {
      const options = state.window.options;
      state = expectOk(reduce(state, { type: "Choose", optionId: spec.pick ? spec.pick(options) : (options[0] ?? "") }, ctx)).state;
    }
    return state;
  }

  describe(`golden: a whole game of ${spec.title}`, () => {
    it("plays the same intents to the same state on fixed seeds", async () => {
      const out = spec.goldens.map((golden) => {
        const played = games.get(golden.name);
        return { ...golden, intents: played?.intents, state: played?.state };
      });
      await expect(JSON.stringify(out)).toMatchFileSnapshot(spec.file);
    });

    it(spec.opening.title, () => {
      for (const golden of spec.goldens) spec.opening.check(opened(golden), golden, worldOf(golden));
    });

    it(spec.causeTitle ?? "names a cause for every number a step changes", () => {
      for (const golden of spec.goldens) {
        expect(causeProblems(game(golden).steps), golden.name).toEqual([]);
        spec.cause?.(game(golden), golden);
      }
      // Across the goldens the scenario's own records move numbers too, not only the rules and the player cards.
      expect(ownCauses(spec.scenario, spec.goldens.flatMap((golden) => game(golden).steps)).length).toBeGreaterThan(0);
    });

    it("replays a golden from its save to the same final state", () => {
      // One golden is enough: the save holds plain intents and the reducer is deterministic, which the snapshot pins for every golden.
      const golden = spec.goldens[0];
      if (!golden) throw new Error(`${spec.title} has no golden`);
      expectReplays(game(golden), worldOf(golden).ctx);
    });

    spec.checks?.({ game, world: worldOf, opened });

    for (const golden of spec.goldens.filter((item) => item.outcome === "won")) {
      it(`${golden.name}: ${typeof spec.wins === "function" ? spec.wins(golden) : spec.wins}`, () => {
        const { state } = game(golden);
        const world = worldOf(golden);
        expect(state.lost).toBe(false);
        expect(state.stageCleared).toBe(true);
        expect(state.failure).toBeNull();
        expect(state.window).toBeNull();
        spec.won(state, golden, world);
        const xp = spec.expectedXp?.(state, golden, world);
        if (xp != null) expect(state.resolutionLog.xp).toBe(xp);
        const earlier = spec.campaign.scenarios.slice(0, index);
        const before = spec.before ? spec.before(golden, game(golden)) : golden.after ? { ...emptyLog(golden.seatCount), completed: earlier } : emptyLog(golden.seatCount);
        const log = applyResolution(before, state.scenarioId, state, world.cards, NO_COPY_LIMITS);
        expect(log.completed).toEqual([...before.completed, spec.scenario.id]);
        if (xp != null) expect(log.xpGained[spec.scenario.id]).toBe(xpAwarded(xp));
        expect(log.modes).toEqual(golden.mode ? { [spec.scenario.id]: golden.mode } : {});
        // The part after this one is the one the path offers now: the log this Resolution writes onto a campaign that won the parts before it.
        const path = campaignPath(spec.campaign, {}, applyResolution(logBefore(spec.campaign, spec.scenario, golden.seatCount), state.scenarioId, state, world.cards, NO_COPY_LIMITS));
        // The last part of a campaign has none after it.
        const last = index + 1 >= spec.campaign.scenarios.length;
        expect(path.map((node) => node.status).slice(0, index + 2)).toEqual([...Array.from({ length: index + 1 }, () => "completed"), ...(last ? [] : [nextPartStatus(spec.campaign, spec.scenario.id)])]);
        // What the next tap offers: Begin on a playable next part, Coming soon on one that is not, nothing after the last.
        const step = nextStep(path, null);
        const expectedStep = nextStepKind(spec.campaign, spec.scenario.id);
        expect(step.kind === "finished" ? null : step.kind).toBe(expectedStep);
        if (step.kind !== "finished") expect(step.node.id).toBe(nextPartId(spec.campaign, spec.scenario.id));
        expect(path[index + 1]?.id).toBe(spec.campaign.scenarios[index + 1]);
        expect(spec.campaign.scenarios[index]).toBe(spec.scenario.id);
        spec.afterWin?.({ state, golden, world, log, path });
      });
    }

    for (const golden of spec.goldens.filter((item) => item.outcome === "lost")) {
      it(`${golden.name}: loses (${golden.lossReason}) and writes nothing`, () => {
        const { state } = game(golden);
        const { cards } = worldOf(golden);
        expect(state.lost).toBe(true);
        expect(state.lossReason).toContain(golden.lossReason);
        expect(state.failure).toBeNull();
        expect(state.resolutionLog.earned).toEqual([]);
        expect(state.resolutionLog.xp).toBeUndefined();
        const log = emptyLog(golden.seatCount);
        expect(applyResolution(log, state.scenarioId, state, cards, NO_COPY_LIMITS)).toBe(log);
        spec.lost?.(state, golden, worldOf(golden), game(golden));
      });
    }
  });
}
