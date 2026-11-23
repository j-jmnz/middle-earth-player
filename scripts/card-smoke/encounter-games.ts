import { beginActive, recordIntent, replay } from "../../src/campaign/replay.ts";
import { characters, declarableEnemies } from "../../src/rules/combat/combat.ts";
import { legalIntents, legalTargets, reduce, type LegalIntent, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../src/rules/setup/setup.ts";

import { nextIntent } from "../../test/harness/auto-player.ts";
import { idleWatcher, type IdleHit } from "./idle.ts";
import { dice, playIntent, seedOf, triggerIntent, type Dice } from "./policy.ts";
import { encounterStart, kept, type EncounterWorld, type Profile } from "./encounter-world.ts";
import { POLICY } from "./world.ts";
import { tableFaults } from "./invariants.ts";
import { flagged } from "../../src/rules/core/state.ts";
import { escapeCommitLimit } from "../../src/rules/families/escape/commit.ts";
import { describeError } from "../log.ts";

// Seeded games of one scenario played with random legal intents (the second half of scripts/card-smoke/encounter.ts). Every
// intent sent is one the engine offered, completed the way the table's sheets would (a random target, a random share of the
// players' characters); the auto-player's answer is taken instead on a fixed share of the steps, so a game moves through the
// rounds and the stages instead of passing forever. A game must end (lost, or its last stage cleared and every Resolution
// choice answered) inside the step cap without a throw, a refusal or `state.failure`, and its intents must replay from the
// start to the same final state (src/campaign/replay.ts, the save's replay). Every table it reaches must be sound (scripts/card-smoke/invariants.ts),
// and on every PROBE-th table each intent the engine offers must be one it accepts, not only the one the game takes.

// Games a scenario plays: the profile, the seat count and the seed of each follow from its number.
export const GAMES = 24;
// The intents a game may take, and the rounds it may last, before it counts as stalled.
export const STEP_CAP = 2500;
export const ROUND_CAP = 60;
// The share of steps that take the auto-player's answer rather than a random legal intent. The mix is chosen for what each kind of game is for, not for any card it passes: a game of an even number follows
// the auto-player closely with the heroes that can win (strong, steady), so some games clear the last stage and play the Resolution (at 0.6 none does); a game of an odd number takes a random legal intent
// on 40% of its steps (MIXED) whatever its heroes, so unusual intents and their order are covered, and each profile plays both kinds across the games of a scenario.
const GUIDED: Readonly<Record<Profile, number>> = { strong: 0.97, weak: 0.6, brittle: 0.6, tense: 0.6, steady: 0.85 };
export const MIXED = 0.6;
// The tables on which every offered intent is tried: one in this many.
export const PROBE = 12;
// A fixed data hash for the replay: the save only compares it with itself.
const HASH = 1;
// The profiles the games rotate through (test/harness/game-kit.ts, HERO_STATS): strong heroes that win when the dice allow, weak ones that lose on threat, brittle ones that die.
const PROFILES: readonly Profile[] = ["strong", "weak", "brittle", "tense", "steady"];

export type GameProblem = { game: number; seed: number; profile: Profile; seats: 1 | 2; step: number; round: number; window: string | null; intent: PlayerIntent | null; message: string };
export type GameSummary = { game: number; seed: number; profile: Profile; seats: 1 | 2; steps: number; rounds: number; ended: "lost" | "won" | "problem"; problem: GameProblem | null; idle: readonly IdleHit[] };

type Offered<T extends LegalIntent["type"]> = Extract<LegalIntent, { type: T }>;

function pickOne<T>(roll: Dice, items: readonly T[]): T | undefined {
  return roll.pick(items);
}

// A non-empty random subset (a share of the ids, at least one).
function subset(roll: Dice, ids: readonly string[]): string[] {
  const chosen = ids.filter(() => roll.roll() < 0.6);
  return chosen.length > 0 ? chosen : ids.slice(0, 1);
}

// The whole intent for one the engine offered, or null when this one cannot be built from what the engine lists (the caller tries another).
function complete(state: ScenarioState, ctx: ReduceContext, offer: LegalIntent, roll: Dice): PlayerIntent | null {
  switch (offer.type) {
    case "Keep":
    case "Mulligan":
    case "Pass":
    case "DeclineTravel":
    case "DeclineEngage":
    case "DeclineAttack":
      return { type: offer.type };
    case "Choose":
    case "ChooseResolution":
      return { type: offer.type, optionId: offer.optionId };
    case "PlayCard":
      return playIntent(state, ctx, offer.cardId, roll);
    case "Trigger":
      return triggerIntent(state, ctx, offer.cardId, offer.effectId, roll);
    case "Commit": {
      const ids = legalTargets(state, { type: "Commit" }, ctx);
      return ids.length > 0 ? { type: "Commit", cardIds: subset(roll, ids) } : null;
    }
    case "CommitHide": {
      const ids = legalTargets(state, { type: "CommitHide" }, ctx);
      return { type: "CommitHide", cardIds: ids.length > 0 ? subset(roll, ids) : [] };
    }
    case "CommitEscape": {
      const ids = legalTargets(state, { type: "CommitEscape" }, ctx);
      const limit = state.window?.kind === "escapeCommit" ? escapeCommitLimit(state, state.window.seat) : null;
      return { type: "CommitEscape", cardIds: (ids.length > 0 ? subset(roll, ids) : []).slice(0, limit ?? undefined) };
    }
    case "CommitFortitude": {
      const ids = legalTargets(state, { type: "CommitFortitude" }, ctx);
      return { type: "CommitFortitude", cardIds: ids.length > 0 ? subset(roll, ids) : [] };
    }
    case "Travel": {
      const locationId = pickOne(roll, legalTargets(state, { type: "Travel" }, ctx));
      return locationId ? { type: "Travel", locationId } : null;
    }
    case "Engage": {
      const enemyId = pickOne(roll, legalTargets(state, { type: "Engage" }, ctx));
      return enemyId ? { type: "Engage", enemyId } : null;
    }
    case "ChooseEnemy": {
      const enemyId = pickOne(roll, legalTargets(state, { type: "ChooseEnemy" }, ctx));
      return enemyId ? { type: "ChooseEnemy", enemyId } : null;
    }
    case "DeclareDefender": {
      const defenderId = pickOne(roll, legalTargets(state, { type: "DeclareDefender" }, ctx));
      return defenderId ? { type: "DeclareDefender", defenderId } : null;
    }
    case "Undefended": {
      const heroId = pickOne(roll, legalTargets(state, { type: "Undefended" }, ctx));
      return heroId ? { type: "Undefended", heroId } : null;
    }
    case "DeclareAttackers": {
      const seat = state.activeSeat;
      const ready = characters(state, seat, ctx.cards).filter((id) => legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
      const enemyId = pickOne(roll, [...new Set(ready.flatMap((id) => declarableEnemies(state, seat, id, ctx.cards)))]);
      if (!enemyId) return null;
      const attackers = ready.filter((id) => declarableEnemies(state, seat, id, ctx.cards).includes(enemyId));
      // An enemy that cannot be attacked by more than 1 character at a time (The Great Bridge's lasting flag, 145050:A:1) gets one attacker.
      const chosen = subset(roll, attackers);
      return { type: "DeclareAttackers", enemyId, attackerIds: flagged(state, enemyId, "singleAttacker") ? chosen.slice(0, 1) : chosen };
    }
    case "Distribute": {
      const cardId = pickOne(roll, legalTargets(state, { type: "Distribute" }, ctx));
      return cardId ? { type: "Distribute", assignments: [{ cardId, amount: (offer as Offered<"Distribute">).total }] } : null;
    }
  }
}

// The first offered intent the reducer refuses, throws on or fails with, as a sentence; null when it accepts them all. The table is left as it was: each offer is tried on its own.
function refusedOffer(state: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], roll: Dice): string | null {
  for (const offer of legal) {
    const intent = complete(state, ctx, offer, roll);
    if (!intent) continue;
    const result = reduce(state, intent, ctx);
    if (!result.ok) return `The reducer refused an offered ${offer.type} that the game did not take (${JSON.stringify(intent)}): ${result.reason}`;
    if (result.state.failure) return `An offered ${offer.type} that the game did not take (${JSON.stringify(intent)}) gives state.failure: ${result.state.failure}`;
  }
  return null;
}

/** The next intent: the auto-player's answer on a share of the steps, else a random offered intent completed, else the auto-player's. */
export function randomIntent(state: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], roll: Dice, memory: Set<string>, guided = MIXED): PlayerIntent {
  if (roll.roll() >= guided) {
    for (const offer of roll.shuffle(legal)) {
      const intent = complete(state, ctx, offer, roll);
      if (intent) return intent;
    }
  }
  return nextIntent(state, ctx, POLICY, memory, legal);
}

// The number of the game gives the profile, the seat count and the seed, so game n of a scenario is the same game every run.
function gameOf(game: number): { profile: Profile; seats: 1 | 2; seed: number } {
  return { profile: PROFILES[game % PROFILES.length] ?? "strong", seats: game % 3 === 2 ? 2 : 1, seed: 1 + game };
}

function ended(state: ScenarioState): boolean {
  return state.lost || (state.stageCleared && state.window == null);
}

// The first difference between the replayed state and the played one, by field name.
function difference(left: ScenarioState, right: ScenarioState): string {
  const keys = Object.keys(left) as (keyof ScenarioState)[];
  return keys.filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key])).join(", ") || "none";
}

/** Plays one numbered game of the scenario with random legal intents and replays it. */
export function playGame(world: EncounterWorld, number: number): GameSummary {
  return recordGame(world, number).summary;
}

/**
 * A numbered game with what it played: its start, its context, the intents the reducer accepted (the first seat's Keep first) and the one that failed, if any.
 * `pnpm game show encounter:<scenario-id>:<game>` replays it (scripts/game/source.ts).
 */
export type GameRecord = { summary: GameSummary; start: StartScenario | null; ctx: ReduceContext; intents: PlayerIntent[]; failing: PlayerIntent | null };

export function recordGame(world: EncounterWorld, number: number): GameRecord {
  const { profile, seats, seed } = gameOf(number);
  const ctx = world.contexts[profile];
  const record: GameRecord = { summary: { game: number, seed, profile, seats, steps: 0, rounds: 0, ended: "problem", problem: null, idle: [] }, start: null, ctx, intents: [], failing: null };
  record.summary = runGame(world, number, record);
  return record;
}

function runGame(world: EncounterWorld, number: number, record: GameRecord): GameSummary {
  const { profile, seats, seed } = gameOf(number);
  const { ctx, summary, intents } = record;
  const roll = dice(seedOf(world.scenario.id, seed * 7919 + number));
  // The probe's own dice, so the game is the same game with or without it.
  const probe = dice(seedOf(world.scenario.id, seed * 104729 + number));
  const memory = new Set<string>();
  const watcher = idleWatcher(ctx);
  summary.idle = watcher.hits;
  let start: StartScenario | null = null;
  let state: ScenarioState | null = null;
  let intent: PlayerIntent | null = null;
  const problem = (message: string): GameSummary => {
    summary.problem = { game: number, seed, profile, seats, step: intents.length, round: state?.round ?? 0, window: state?.window?.kind ?? null, intent, message };
    record.failing = intent;
    return summary;
  };
  try {
    start = encounterStart(world, seats, seed);
    record.start = start;
    state = kept(start, ctx);
    intents.push({ type: "Keep" });
    for (let step = 0; !ended(state); step += 1) {
      if (step >= STEP_CAP) return problem(`The game has not ended after ${STEP_CAP} intents (round ${state.round})`);
      if (state.round > ROUND_CAP) return problem(`The game has not ended after ${ROUND_CAP} rounds`);
      const legal = legalIntents(state, ctx);
      if (legal.length === 0) return problem(`The engine offers no intent (window ${state.window?.kind ?? "none"}) and the game is not over`);
      const refused = step % PROBE === 0 ? refusedOffer(state, ctx, legal, probe) : null;
      if (refused) return problem(refused);
      intent = randomIntent(state, ctx, legal, roll, memory, number % 2 === 0 ? GUIDED[profile] : MIXED);
      const result = reduce(state, intent, ctx);
      if (!result.ok) return problem(`The reducer refused an offered intent: ${result.reason}`);
      if (result.state.failure) return problem(`state.failure: ${result.state.failure}`);
      watcher.observe(state, intent, result.state, result.steps);
      state = result.state;
      intents.push(intent);
      const fault = tableFaults(state, ctx)[0];
      if (fault) return problem(`The table is not sound after the intent: ${fault}`);
      intent = null;
    }
    summary.steps = intents.length;
    summary.rounds = state.round;
    summary.ended = state.lost ? "lost" : "won";
    let active = beginActive(start, HASH);
    for (const sent of intents) active = recordIntent(active, sent);
    const replayed = replay(JSON.parse(JSON.stringify(active)), start, HASH, ctx);
    if (!replayed.ok) {
      summary.ended = "problem";
      return problem(`The game's intents did not replay (${replayed.reason})`);
    }
    if (JSON.stringify(replayed.state) !== JSON.stringify(state)) {
      summary.ended = "problem";
      return problem(`The replay ended in another state (differs in: ${difference(replayed.state, state)})`);
    }
    return summary;
  } catch (error) {
    return problem(describeError(error));
  }
}
