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

import type { ScenarioState } from "../rules/reduce.ts";
import { resolutionResult } from "../rules/resolution.ts";
import type { StartScenario } from "../rules/setup.ts";

import { loadoutProblems, needsRingBearerSlot, type LoadoutInput, type Problem } from "./briefing.ts";
import type { LoadoutSeat } from "./loadout.ts";
import { isPlayable } from "./playable.ts";
import { beginActive, type ActiveScenario, type ReplayObserver } from "./replay.ts";
import { dealtLoadoutSchema, parseActive } from "./save.ts";
import { printedScenarioName } from "./printed-name.ts";
import { completedRounds, scoreOf, type ScenarioScore } from "./score.ts";
import { resumeFrom, staleReason, type Resumed } from "./session.ts";
import { buildStart } from "./start.ts";
import type { World } from "./world.ts";

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

// A game as the lists show it: the open game is its engine version and data hash, never its intents (a list row does not parse a long game).
export type ListedStandalone = Omit<StandaloneGame, "active"> & { active: Pick<ActiveScenario, "engineVersion" | "dataHash"> | null };

export type StandaloneStatus = "playing" | "won" | "lost" | "dropped";

export function standaloneStatus(game: ListedStandalone): StandaloneStatus {
  if (game.result) return game.result.outcome;
  return game.active && game.loadout ? "playing" : "dropped";
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
  const playable = isPlayable(input.world.scenario.id)
    ? []
    : [{ rule: "Not playable yet", message: `${printedScenarioName(input.world.scenario.name)} is not playable yet: some of its cards have no effect record.` }];
  const { problems, loadout } = loadoutProblems(input, []);
  const all = [...playable, ...problems];
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

// Deals a new standalone game with its own id. The caller writes it.
export function dealStandalone(id: string, world: World, seatCount: 1 | 2, loadout: StandaloneLoadout, seed: number, dataHash: number): StandaloneDeal {
  const { briefing, seats } = plan(inputOf(world, seatCount, loadout));
  if (!briefing.dealable) return { ok: false, briefing };
  const start = startOf(world, seatCount, loadout, seats, seed);
  return { ok: true, game: { id, campaignId: world.campaign.id, scenarioId: loadout.scenarioId, seatCount, loadout, active: beginActive(start, dataHash), result: null } };
}

// Replays the open game. One from another engine version or data hash is not rebuilt; the caller drops it.
export function resumeStandalone(game: StandaloneGame, world: World, dataHash: number, observe?: ReplayObserver): Resumed {
  const { loadout } = game;
  return resumeFrom(game.active, loadout ? (seed) => standaloneStart(world, game.seatCount, loadout, seed) : null, world, dataHash, observe);
}

// Drops the open game and keeps the row, its loadout and any result.
export function dropStandalone(game: StandaloneGame): StandaloneGame {
  return { ...game, active: null };
}

// The game with its open game dropped when that was played on another engine version or against other data; null when
// nothing needs dropping.
export function droppedIfStale<G extends ListedStandalone>(game: G, dataHash: number): (Omit<G, "active"> & { active: null }) | null {
  return game.active && staleReason(game.active, dataHash) ? { ...game, active: null } : null;
}

// Ends the open game. A loss records the reason and the rounds completed; a win records its score. With no campaign card
// there is nothing to choose: the won state settles at once. A game still in play is returned unchanged.
export function finishStandalone(game: StandaloneGame, world: World, state: ScenarioState): StandaloneGame {
  if (state.lost) return { ...game, active: null, result: { outcome: "lost", reason: state.lossReason, rounds: completedRounds(state) } };
  if (resolutionResult(state) == null) return game;
  return { ...game, active: null, result: { outcome: "won", score: scoreOf(state, world.cards) } };
}
