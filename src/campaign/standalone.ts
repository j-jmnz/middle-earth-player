// Rules: mec109.campaign-mode, rr.campaign-cards, ltp.campaign-cards, rr.boons, rr.burdens, ltp.scoring, rr.scoring,
// faq.scoring (data/rules/entries.json).
//
// A scenario played as a standalone adventure (mec109.campaign-mode: "Saga expansions are designed for campaign play, but
// players can still play the scenarios as standalone adventures if they choose"). The saga rules still run: the
// Ring-bearer, The One Ring and the Fellowship sphere are the saga's (mec109.setting-up-the-game), not the campaign's.
// What Campaign Mode adds is left out: the campaign card is placed only while setting up in Campaign Mode and its
// Resolution followed only after a campaign win (rr.campaign-cards), boons and burdens are earned in Campaign Mode and are
// never in the game until then (rr.boons, rr.burdens), and there is no log, pool, threat penalty or fallen hero. A won
// game is scored by the Learn to Play's system, which is for "players who enjoy playing through the same scenario
// multiple times" (ltp.scoring). Pure.
import { z } from "zod";

import type { Difficulty } from "../catalog/scenario-data.ts";
import type { PlayerIntent } from "../rules/intents.ts";
import type { ScenarioState } from "../rules/reduce.ts";
import { resolutionResult } from "../rules/resolution.ts";
import type { StartScenario } from "../rules/setup.ts";

import { deckHasRingBearer, loadoutProblems, type BriefingSeat, type Problem } from "./briefing.ts";
import { isPlayable } from "./playable.ts";
import { beginActive, recordIntent, replay, type ActiveScenario, type ReplayObserver } from "./replay.ts";
import { activeScenarioSchema } from "./save.ts";
import { scoreOf, type ScenarioScore } from "./score.ts";
import { staleReason, contextOf } from "./session.ts";
import { buildStart } from "./start.ts";
import type { World } from "./world.ts";

// What the standalone briefing chose: the scenario, the difficulty, and each seat's heroes and cards as they were dealt,
// so editing a deck later does not move a game in progress, and Play again can deal the same decks.
export type StandaloneLoadout = {
  scenarioId: string;
  difficulty: Difficulty;
  seats: { deckId: string | null; heroes: string[]; deck: string[] }[];
  ringBearer: string | null;
};

export const standaloneLoadoutSchema = z.strictObject({
  scenarioId: z.string(),
  difficulty: z.enum(["Easy", "Normal"]),
  seats: z.array(z.strictObject({ deckId: z.string().nullable(), heroes: z.array(z.string()), deck: z.array(z.string()) })),
  ringBearer: z.string().nullable(),
});

// How a finished game ended. A win carries its score (lower is better); a loss carries the engine's reason.
export type StandaloneResult = { outcome: "won"; score: ScenarioScore } | { outcome: "lost"; reason: string | null; rounds: number };

export const standaloneResultSchema = z.discriminatedUnion("outcome", [
  z.strictObject({ outcome: z.literal("won"), score: z.strictObject({ rounds: z.number().int(), victoryPoints: z.number().int(), score: z.number().int() }) }),
  z.strictObject({ outcome: z.literal("lost"), reason: z.string().nullable(), rounds: z.number().int() }),
]);

// One standalone game: one deal of one scenario. `active` is the open game (the seed and the intents, never the table);
// `result` is set when it ends. With neither, the open game was dropped (another engine version or card data).
export type StandaloneGame = {
  id: string;
  campaignId: string;
  scenarioId: string;
  seatCount: 1 | 2;
  // Null only when the stored loadout no longer reads: the game cannot be resumed or dealt again.
  loadout: StandaloneLoadout | null;
  active: ActiveScenario | null;
  result: StandaloneResult | null;
};

export type StandaloneStatus = "playing" | "won" | "lost" | "dropped";

export function standaloneStatus(game: StandaloneGame): StandaloneStatus {
  if (game.result) return game.result.outcome;
  return game.active && game.loadout ? "playing" : "dropped";
}

export function parseStandaloneLoadout(value: unknown): StandaloneLoadout | null {
  const parsed = standaloneLoadoutSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseStandaloneResult(value: unknown): StandaloneResult | null {
  if (value == null) return null;
  const parsed = standaloneResultSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseStandaloneActive(value: unknown): ActiveScenario | null {
  if (value == null) return null;
  const parsed = activeScenarioSchema.safeParse(value);
  // The record's intents are the reducer's own, written by recordIntent; the reducer checks them on replay.
  return parsed.success ? { ...parsed.data, intents: parsed.data.intents as unknown as PlayerIntent[] } : null;
}

export type StandaloneInput = {
  world: World;
  seatCount: 1 | 2;
  seats: readonly BriefingSeat[];
  ringBearer: string | null;
  difficulty: Difficulty;
};

export type StandaloneBriefing = { problems: Problem[]; needsRingBearer: boolean; dealable: boolean };

// The briefing of a standalone game: the same deck and saga checks as a campaign deal, with no Campaign Setup Checklist
// (no log to match, no fallen hero, no penalty, no pool), and only a scenario whose dealt cards are all automated.
export function standaloneBriefing(input: StandaloneInput): StandaloneBriefing {
  const needsRingBearer = !deckHasRingBearer(input.world, input.seats[0]);
  const playable = isPlayable(input.world.scenario.id)
    ? []
    : [{ rule: "Not playable yet", message: `${input.world.scenario.name} is not playable yet: some of its cards have no effect record.` }];
  const { problems } = loadoutProblems(input, []);
  const all = [...playable, ...problems];
  return { problems: all, needsRingBearer, dealable: all.length === 0 };
}

function inputOf(world: World, seatCount: 1 | 2, loadout: StandaloneLoadout): StandaloneInput {
  return { world, seatCount, seats: loadout.seats, ringBearer: loadout.ringBearer, difficulty: loadout.difficulty };
}

// The opening state of a standalone game: the scenario's piles and the quest card's Setup, The One Ring on the
// Ring-bearer, the heroes' printed threat with no penalty, and the saved decks as they are. Throws when the briefing
// refuses the loadout, so a caller cannot deal one.
export function standaloneStart(world: World, seatCount: 1 | 2, loadout: StandaloneLoadout, seed: number): StartScenario {
  const input = inputOf(world, seatCount, loadout);
  const result = standaloneBriefing(input);
  if (!result.dealable) throw new Error(result.problems.map((problem) => problem.message).join(" "));
  const { loadout: seats } = loadoutProblems(input, []);
  return buildStart({
    campaign: world.campaign,
    scenario: world.scenario,
    seatCount,
    seed,
    threatModifier: 0,
    seats,
    difficulty: loadout.difficulty,
    effects: world.effects,
    mode: "standalone",
  });
}

export type StandaloneDeal = { ok: true; game: StandaloneGame } | { ok: false; briefing: StandaloneBriefing };

// Deals a new standalone game with its own id. The caller writes it.
export function dealStandalone(id: string, world: World, seatCount: 1 | 2, loadout: StandaloneLoadout, seed: number, dataHash: number): StandaloneDeal {
  const result = standaloneBriefing(inputOf(world, seatCount, loadout));
  if (!result.dealable) return { ok: false, briefing: result };
  const start = standaloneStart(world, seatCount, loadout, seed);
  return { ok: true, game: { id, campaignId: world.campaign.id, scenarioId: loadout.scenarioId, seatCount, loadout, active: beginActive(start, dataHash), result: null } };
}

export type StandaloneResumed = { ok: true; state: ScenarioState } | { ok: false; reason: "none" | "engineVersion" | "dataHash" | "seed" | "intent" | "loadout" };

// Replays the open game. One from another engine version or data hash is not rebuilt; the caller drops it.
export function resumeStandalone(game: StandaloneGame, world: World, dataHash: number, observe?: ReplayObserver): StandaloneResumed {
  const { active, loadout } = game;
  if (!active || !loadout) return { ok: false, reason: "none" };
  const stale = staleReason(active, dataHash);
  if (stale) return { ok: false, reason: stale };
  let start;
  try {
    start = standaloneStart(world, game.seatCount, loadout, active.seed);
  } catch {
    return { ok: false, reason: "loadout" };
  }
  const replayed = replay(active, start, dataHash, contextOf(world), observe);
  return replayed.ok ? { ok: true, state: replayed.state } : { ok: false, reason: replayed.reason };
}

export function recordStandalone(game: StandaloneGame, intent: PlayerIntent): StandaloneGame {
  return game.active ? { ...game, active: recordIntent(game.active, intent) } : game;
}

// Drops the open game and keeps the row, its loadout and any result.
export function dropStandalone(game: StandaloneGame): StandaloneGame {
  return { ...game, active: null };
}

// Ends the open game. A loss records the reason and the rounds played; a win records its score. With no campaign card
// there is nothing to choose: the won state settles at once. A game still in play is returned unchanged.
export function finishStandalone(game: StandaloneGame, world: World, state: ScenarioState): StandaloneGame {
  if (state.lost) return { ...game, active: null, result: { outcome: "lost", reason: state.lossReason, rounds: Math.max(0, state.round - 1) } };
  if (resolutionResult(state) == null) return game;
  return { ...game, active: null, result: { outcome: "won", score: scoreOf(state, world.cards) } };
}
