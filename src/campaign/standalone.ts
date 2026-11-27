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

import type { ScenarioState } from "../rules/engine/reduce.ts";
import { resolutionResult } from "../rules/setup/resolution.ts";
import type { StartScenario } from "../rules/setup/setup.ts";

import { comingSoonProblems, difficultyProblems, loadoutProblems, needsRingBearerSlot, type LoadoutInput, type Problem } from "./briefing.ts";
import type { LoadoutSeat } from "./loadout.ts";
import type { Checkpoint } from "./checkpoint.ts";
import { beginActive, type ActiveScenario, type ReplayObserver } from "./replay.ts";
import { dealtLoadoutSchema, parseActive } from "./save.ts";
import { completedRounds, scoreOf, type ScenarioScore } from "./score.ts";
import { continueFrom, resumeFrom, type Continued, type Resumed } from "./session.ts";
import { buildStart } from "./start.ts";
import { dealtCodes, worldHash, type World } from "./world.ts";

// What the standalone briefing chose: the scenario, the difficulty, each seat's deck as it was dealt (so editing a deck
// later does not move a game in progress) and the Ring-bearer slot. Play again picks the same decks by id, as they are now.
export type StandaloneLoadout = z.infer<typeof dealtLoadoutSchema>;

// How a finished game ended. A win carries its score (lower is better); a loss carries the engine's reason.
export type StandaloneResult = { outcome: "won"; score: ScenarioScore } | { outcome: "lost"; reason: string | null; rounds: number };

const resultSchema = z.discriminatedUnion("outcome", [
  z.strictObject({ outcome: z.literal("won"), score: z.strictObject({ rounds: z.number().int(), victoryPoints: z.number().int(), score: z.number().int() }) }),
  z.strictObject({ outcome: z.literal("lost"), reason: z.string().nullable(), rounds: z.number().int() }),
]);

// One standalone game: one deal of one scenario. `active` is the open game (the seed and the intents, never the table);
// `result` is set when it ends. With neither, the open game was dropped (it did not read at all).
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

// A game as the lists show it: the open game is its engine version, data hash and world, never its intents (a list row does not parse a long game).
// `needsChoice` is set by the store's list (needsChoiceBeforeOpen) on an open game that will ask for a choice when it opens: the row is as it was stored.
export type ListedStandalone = Omit<StandaloneGame, "active"> & { active: Pick<ActiveScenario, "engineVersion" | "dataHash" | "world"> | null; needsChoice?: true; ended?: "won" | "lost" };

export type StandaloneStatus = "playing" | "needsChoice" | "won" | "lost" | "dropped";

export function standaloneStatus(game: ListedStandalone): StandaloneStatus {
  if (game.result) return game.result.outcome;
  if (!game.active || !game.loadout) return "dropped";
  return game.needsChoice ? "needsChoice" : "playing";
}

// Whether the game is still open: playing, or waiting for the player to continue it or restart it.
// How a game that is over and was never left stands (the list reads `ended` from its open game, replay.ts): History words it by that result, as it will read once the outcome is left.
export function unsettledOutcome(game: ListedStandalone): "won" | "lost" | null {
  return game.result == null && game.active != null && !game.needsChoice ? (game.ended ?? null) : null;
}

export function isOpenStatus(status: StandaloneStatus): boolean {
  return status === "playing" || status === "needsChoice";
}

export function parseStandaloneLoadout(value: unknown): StandaloneLoadout | null {
  const parsed = dealtLoadoutSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseStandaloneResult(value: unknown): StandaloneResult | null {
  if (value == null) return null;
  const parsed = resultSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// The open game as stored, or null when it does not read: it is only a cache of the intents.
export function parseStandaloneActive(value: unknown): ActiveScenario | null {
  try {
    return parseActive(value);
  } catch {
    return null;
  }
}

export type StandaloneInput = LoadoutInput & { difficulty: StandaloneLoadout["difficulty"] };

export type StandaloneBriefing = { problems: Problem[]; needsRingBearer: boolean; dealable: boolean };

// The briefing and the seats it would deal, from one pass over the loadout.
function plan(input: StandaloneInput): { briefing: StandaloneBriefing; seats: LoadoutSeat[] } {
  const needsRingBearer = needsRingBearerSlot(input.world, input.seats[0]);
  const { problems, loadout } = loadoutProblems(input, []);
  const all = [...comingSoonProblems(input.world), ...difficultyProblems(input.world, input.difficulty), ...problems];
  return { briefing: { problems: all, needsRingBearer, dealable: all.length === 0 }, seats: loadout };
}

// The briefing of a standalone game: the same deck and saga checks as a campaign deal, with no Campaign Setup Checklist
// (no log to match, no fallen hero, no penalty, no pool), and only a scenario whose dealt cards are all automated.
export function standaloneBriefing(input: StandaloneInput): StandaloneBriefing {
  return plan(input).briefing;
}

function inputOf(world: World, seatCount: 1 | 2, loadout: StandaloneLoadout): StandaloneInput {
  return { world, seatCount, seats: loadout.seats, ringBearer: loadout.ringBearer, difficulty: loadout.difficulty };
}

function startOf(world: World, seatCount: 1 | 2, loadout: StandaloneLoadout, seats: readonly LoadoutSeat[], seed: number): StartScenario {
  return buildStart({ campaign: world.campaign, scenario: world.scenario, seatCount, seed, threatModifier: 0, seats, difficulty: loadout.difficulty, effects: world.effects, mode: "standalone" });
}

// The opening state of a standalone game: the scenario's piles and the quest card's Setup, The One Ring on the
// Ring-bearer, the heroes' printed threat with no penalty, and the saved decks as they are. Throws when the briefing
// refuses the loadout, so a caller cannot deal one.
export function standaloneStart(world: World, seatCount: 1 | 2, loadout: StandaloneLoadout, seed: number): StartScenario {
  const { briefing, seats } = plan(inputOf(world, seatCount, loadout));
  if (!briefing.dealable) throw new Error(briefing.problems.map((problem) => problem.message).join(" "));
  return startOf(world, seatCount, loadout, seats, seed);
}

export type StandaloneDeal = { ok: true; game: StandaloneGame } | { ok: false; briefing: StandaloneBriefing };

// Deals a new standalone game with its own id. `startedAt` is when it was dealt, which a run reads as its start. The caller writes it.
export function dealStandalone(id: string, world: World, seatCount: 1 | 2, loadout: StandaloneLoadout, seed: number, startedAt?: number): StandaloneDeal {
  const { briefing, seats } = plan(inputOf(world, seatCount, loadout));
  if (!briefing.dealable) return { ok: false, briefing };
  const start = startOf(world, seatCount, loadout, seats, seed);
  return { ok: true, game: { id, campaignId: world.campaign.id, scenarioId: loadout.scenarioId, seatCount, loadout, active: beginActive(start, worldHash(world, dealtCodes(loadout)), startedAt), result: null } };
}

// Replays the open game. One from another engine version or data hash is not rebuilt; the table asks for a choice (continueStandalone, restartStandalone).
export function resumeStandalone(game: StandaloneGame, world: World, observe?: ReplayObserver): Resumed {
  const { loadout } = game;
  return resumeFrom(game.active, loadout ? (seed) => standaloneStart(world, game.seatCount, loadout, seed) : null, world, worldHash(world, dealtCodes(loadout)), observe, game.seatCount);
}

// Drops the open game and keeps the row, its loadout and any result.
export function dropStandalone(game: StandaloneGame): StandaloneGame {
  return { ...game, active: null };
}

// Continue: the open game rebased onto its checkpoint when it has one that passes the check, otherwise replayed on the current rules as far as its intents
// are accepted, stamped with what it now plays on (session.ts, continueFrom). The caller writes the game it gets back.
export function continueStandalone(game: StandaloneGame, world: World, checkpoint: Checkpoint | null = null): Continued<StandaloneGame> {
  const { loadout } = game;
  return continueFrom(game, loadout ? (seed) => standaloneStart(world, game.seatCount, loadout, seed) : null, world, worldHash(world, dealtCodes(loadout)), checkpoint, game.seatCount);
}

// Restart: deals the same game again with its stored loadout and a new seed. The row, its id and its loadout stay.
export function restartStandalone(game: StandaloneGame, world: World, seed: number, startedAt?: number): StandaloneDeal | { ok: false; briefing: null } {
  return game.loadout ? dealStandalone(game.id, world, game.seatCount, game.loadout, seed, startedAt) : { ok: false, briefing: null };
}

// Ends the open game. A loss records the reason and the rounds completed; a win records its score. With no campaign card
// there is nothing to choose: the won state settles at once. A game still in play is returned unchanged.
export function finishStandalone(game: StandaloneGame, world: World, state: ScenarioState): StandaloneGame {
  if (state.lost) return { ...game, active: null, result: { outcome: "lost", reason: state.lossReason, rounds: completedRounds(state) } };
  if (resolutionResult(state) == null) return game;
  return { ...game, active: null, result: { outcome: "won", score: scoreOf(state, world.cards) } };
}
