// Rules: ltp.scoring, rr.scoring, faq.scoring (data/rules/entries.json). A run is one scenario that ended, won or lost: the
// record History lists. Every number in it comes from the engine's final state (the score from scoreOf, the loss cause from
// the state's lossReason, each seat's threat from the seat); nothing is typed. It sits beside the campaign log, not in it: the
// log's rule that a loss writes nothing stays, and a loss writes a run. A run is written once and never rewritten. Pure.
import { resolutionResult } from "../rules/setup/resolution.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import type { ScenarioState } from "../rules/core/state.ts";

import type { CampaignLog } from "./log.ts";
import { completedRounds, scoreOf } from "./score.ts";
import type { StandaloneResult } from "./standalone.ts";

export type RunKind = "campaign" | "standalone";
export type RunResult = "won" | "lost";

// A field a back-filled run could not know is null: the screen leaves it out, and never invents it.
export type RunRecord = {
  id: string;
  kind: RunKind;
  // The save id (campaign) or the standalone game id.
  refId: string;
  // The campaign played; null for a standalone game.
  campaignId: string | null;
  // The box the scenario is printed in.
  box: string;
  scenarioId: string;
  result: RunResult;
  // The engine's lossReason on a loss ("Threat reached 50", a quest card's loss line).
  lossCause: string | null;
  seatCount: 1 | 2;
  // Each seat's heroes as dealt. A back-filled campaign win lists the log's current fellowship (the log keeps no earlier one).
  heroes: string[][];
  rounds: number | null;
  // Each seat's final threat.
  threats: number[] | null;
  // On a win: the victory points and the score (lower is better).
  victoryPoints: number | null;
  score: number | null;
  // On a campaign win: the codes the Resolution's choices earned.
  reward: string[] | null;
  startedAt: number | null;
  endedAt: number | null;
  // The ms the table was on screen with the app in the foreground; null when the store never counted it.
  activeMs: number | null;
  engineVersion: number | null;
  // True for a row written from what the store already knew, when the table was added.
  backfilled: boolean;
};

// The seed alone repeats (the e2e saves all deal seed 1), so the deal time joins the id when the open scenario has one.
export function campaignRunId(saveId: string, scenarioId: string, seed: number, startedAt?: number | null): string {
  return `campaign:${saveId}:${scenarioId}:${seed}${startedAt == null ? "" : `:${startedAt}`}`;
}

// A back-filled win has no seed: one row per scenario on a save's log.
export function backfilledCampaignRunId(saveId: string, scenarioId: string): string {
  return `campaign:${saveId}:${scenarioId}`;
}

// The heroes as dealt, the Ring-bearer with the first seat's.
export function dealtHeroes(seats: readonly { heroes: readonly string[] }[], ringBearer: string | null): string[][] {
  return seats.map((seat, index) => [...seat.heroes, ...(index === 0 && ringBearer && !seat.heroes.includes(ringBearer) ? [ringBearer] : [])]);
}

export function standaloneRunId(gameId: string): string {
  return `standalone:${gameId}`;
}

export type RunInput = {
  id: string;
  kind: RunKind;
  refId: string;
  campaignId: string | null;
  box: string;
  state: ScenarioState;
  cards: ReadonlyMap<string, PrintedCard>;
  heroes: readonly (readonly string[])[];
  reward: readonly string[] | null;
  startedAt: number | null;
  endedAt: number;
  activeMs: number | null;
  engineVersion: number;
};

// The run a finished game makes, read from its final state; null while the game is still going (neither lost nor won).
export function runOf(input: RunInput): RunRecord | null {
  const { state } = input;
  const won = !state.lost && resolutionResult(state) != null;
  if (!state.lost && !won) return null;
  const score = won ? scoreOf(state, input.cards) : null;
  return {
    id: input.id,
    kind: input.kind,
    refId: input.refId,
    campaignId: input.campaignId,
    box: input.box,
    scenarioId: state.scenarioId,
    result: won ? "won" : "lost",
    lossCause: won ? null : state.lossReason,
    seatCount: state.seatCount === 2 ? 2 : 1,
    heroes: input.heroes.map((seat) => [...seat]),
    rounds: score ? score.rounds : completedRounds(state),
    threats: state.seats.slice(0, state.seatCount).map((seat) => seat.threat),
    victoryPoints: score ? score.victoryPoints : null,
    score: score ? score.score : null,
    reward: won && input.reward ? [...input.reward] : null,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    activeMs: input.activeMs,
    engineVersion: input.engineVersion,
    backfilled: false,
  };
}

export type KnownSave = { id: string; campaignId: string; seatCount: 1 | 2; log: CampaignLog };
export type KnownGame = { id: string; campaignId: string; scenarioId: string; seatCount: 1 | 2; seats: readonly (readonly string[])[]; result: StandaloneResult | null; createdAt: number };

// The runs the store already knows when the table is added: each won scenario on a save's log (a loss never wrote one, so none
// is invented) and each standalone game with a result. What they cannot know (the end time, each seat's threat, the engine
// version, and for a campaign win the start) is null. `boxOf` names the box a scenario is printed in.
export function backfillRuns(saves: readonly KnownSave[], games: readonly KnownGame[], boxOf: (scenarioId: string) => string | null): RunRecord[] {
  const out: RunRecord[] = [];
  for (const save of saves) {
    for (const scenarioId of save.log.completed) {
      const score = save.log.scenarios[scenarioId];
      out.push({
        id: backfilledCampaignRunId(save.id, scenarioId),
        kind: "campaign",
        refId: save.id,
        campaignId: save.campaignId,
        box: boxOf(scenarioId) ?? save.campaignId,
        scenarioId,
        result: "won",
        lossCause: null,
        seatCount: save.seatCount,
        // The log keeps the fellowship as it stands now, so a back-filled win lists that, not the heroes dealt for it.
        heroes: dealtHeroes(save.log.heroesBySeat.map((heroes) => ({ heroes })), null),
        rounds: score?.rounds ?? null,
        threats: null,
        victoryPoints: score?.victoryPoints ?? null,
        score: score?.score ?? null,
        reward: save.log.earned[scenarioId] ? [...(save.log.earned[scenarioId] ?? [])] : null,
        startedAt: null,
        endedAt: null,
        activeMs: null,
        engineVersion: null,
        backfilled: true,
      });
    }
  }
  for (const game of games) {
    const { result } = game;
    if (!result) continue;
    out.push({
      id: standaloneRunId(game.id),
      kind: "standalone",
      refId: game.id,
      campaignId: null,
      box: boxOf(game.scenarioId) ?? game.campaignId,
      scenarioId: game.scenarioId,
      result: result.outcome,
      lossCause: result.outcome === "lost" ? result.reason : null,
      seatCount: game.seatCount,
      heroes: game.seats.map((seat) => [...seat]),
      rounds: result.outcome === "won" ? result.score.rounds : result.rounds,
      threats: null,
      victoryPoints: result.outcome === "won" ? result.score.victoryPoints : null,
      score: result.outcome === "won" ? result.score.score : null,
      reward: null,
      startedAt: game.createdAt,
      endedAt: null,
      activeMs: null,
      engineVersion: null,
      backfilled: true,
    });
  }
  return out;
}
