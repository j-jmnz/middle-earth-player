// Rules: rr.framework-steps, rr.step-1-1, rr.planning-phase, rr.step-3-1, rr.step-3-4, rr.travel, rr.optional-engagement,
// rr.engagement-check, rr.combat-phase, rr.refresh-phase (data/rules/entries.json).
//
// The phase rail names, in words, the step the engine is in, with the step before and the step after. It reads the
// engine's mode and phase and nothing else, so it cannot skip a step the engine runs. The pill also names the phase and the
// phases beside it (carousel.ts lays the whole round out for the strip a tap on the pill opens).
import type { ModeName, ScenarioState } from "../rules/core/state.ts";

// `phase` is the word the pill shows over the step ("" when there is none: Setup, Mulligan); `previousPhase` and `nextPhase` are
// the phases beside it in the round ("" before the first). `previous` and `next` are the steps beside the step.
export type Rail = { previous: string; current: string; next: string; phase: string; round: number; previousPhase: string; nextPhase: string };

/** The round's seven phases in order (steps.json; the carousel's cards). Beginning of round and End of round are not phases of play. */
export const ROUND_PHASES: readonly string[] = ["Resource", "Planning", "Quest", "Travel", "Encounter", "Combat", "Refresh"];

// Where the game is among ROUND_PHASES: -1 before the Resource phase (setup, the mulligan, the beginning of the round), the
// phase's index inside the round, and ROUND_PHASES.length once the round has ended.
export function phaseIndex(game: ScenarioState): number {
  const at = ROUND_PHASES.indexOf(game.phase);
  if (at >= 0) return at;
  return game.phase === "End of round" ? ROUND_PHASES.length : -1;
}

// The pill's word for the phase: steps.json names the two outside the seven "Beginning" and "End".
const PILL_PHASE: Readonly<Record<string, string>> = { "Beginning of round": "Beginning", "End of round": "End", Setup: "", Mulligan: "" };

// The round in the order the engine runs it (Learn to Play, Rules Reference framework steps).
const ROUND: readonly ModeName[] = [
  "beginRound",
  "resourceGrant",
  "resourceActions",
  "planning",
  "questCommit",
  "staging",
  "resolution",
  "travel",
  "optionalEngage",
  "engagement",
  "combatStart",
  "combatShadows",
  "combatActions",
  "enemyAttacks",
  "playerAttacks",
  "refresh",
  "endRound",
];

export const STEP_WORDS: Readonly<Record<ModeName, string>> = {
  afterOpening: "Setup",
  mulligan: "Mulligan",
  beginRound: "Beginning of round",
  resourceGrant: "Resources",
  resourceActions: "Resource actions",
  planning: "Planning",
  questCommit: "Commit to the quest",
  staging: "Staging",
  resolution: "Quest resolution",
  stopped: "Quest",
  travel: "Travel",
  optionalEngage: "Optional engagement",
  engagement: "Engagement checks",
  combatStart: "Combat begins",
  combatShadows: "Shadow cards",
  combatActions: "Combat actions",
  enemyAttacks: "Enemy attacks",
  playerAttacks: "Player attacks",
  refresh: "Refresh",
  endRound: "End of round",
};

/** The rail for a state: the engine's step in words, the one before and the one after; Victory or Defeat once it is over. */
export function railFor(game: ScenarioState): Rail {
  const phaseAt = phaseIndex(game);
  const count = ROUND_PHASES.length;
  const base = {
    phase: PILL_PHASE[game.phase] ?? game.phase,
    round: game.round,
    previousPhase: phaseAt < 0 ? "" : (ROUND_PHASES[(Math.min(phaseAt, count) + count - 1) % count] ?? ""),
    nextPhase: ROUND_PHASES[phaseAt >= count ? 0 : (phaseAt + 1) % count] ?? "",
  };
  if (game.lost) return { ...base, previous: STEP_WORDS[game.mode], current: "Defeat", next: "" };
  if (game.stageCleared) return { ...base, previous: STEP_WORDS[game.mode], current: "Victory", next: "Resolution" };
  if (game.mode === "afterOpening" || game.mode === "mulligan") {
    return { ...base, previous: game.mode === "mulligan" ? "Setup" : "", current: STEP_WORDS[game.mode], next: STEP_WORDS.beginRound };
  }
  const at = ROUND.indexOf(game.mode === "stopped" ? "resolution" : game.mode);
  const previous = ROUND[(at + ROUND.length - 1) % ROUND.length] ?? "beginRound";
  const next = ROUND[(at + 1) % ROUND.length] ?? "beginRound";
  return { ...base, previous: STEP_WORDS[previous], current: STEP_WORDS[game.mode], next: STEP_WORDS[next] };
}

/**
 * Where an action window sits in the round, named by what comes next (Rules Reference framework chart, rr.framework-steps;
 * rr.attack-resolution-chart): the dock's title for the window, and one line on what the window is for. The point is the
 * engine's own: an attack's `awaiting` step, else the round's last framework point (`stepWindows`), else the mode.
 */
export type WindowPoint = { id: string; title: string; note: string };

const POINTS: Readonly<Record<string, Omit<WindowPoint, "id">>> = {
  resourceActions: { title: "Before planning", note: "Resources are added and a card is drawn." },
  "3.3": { title: "Before the quest resolves", note: "Staging is done. Willpower raised now counts against its threat." },
  "3.4": { title: "Before travel", note: "The quest has resolved." },
  "4.2": { title: "Before the encounter phase", note: "Travel is done." },
  "5.2": { title: "Before the engagement checks", note: "Each enemy in staging at or below your threat engages next." },
  "5.3": { title: "Before combat", note: "Engagement is done. Shadow cards are dealt next." },
  "6.2": { title: "Before the enemies attack", note: "Shadow cards are dealt. Each engaged enemy attacks next." },
  defense: { title: "Before the defender", note: "The enemy attacks. A defender is declared next." },
  shadow: { title: "Before the shadow card turns", note: "Ready or strengthen the defender now; the shadow card turns next." },
  damage: { title: "Before damage", note: "The shadow card has resolved. Damage is dealt next." },
  end: { title: "Before the attack ends", note: "Damage is dealt." },
  strike: { title: "Before damage", note: "The attackers are declared. Damage is dealt next." },
  "7.4": { title: "Before the next round", note: "The first player token has passed." },
};

export function windowPoint(game: ScenarioState): WindowPoint | null {
  const awaiting = game.pendingAttack?.awaiting ?? game.pendingStrike?.awaiting;
  const last = [...game.stepWindows].reverse().find((key) => key.startsWith(`${game.round}:`))?.slice(`${game.round}:`.length);
  const id = game.window?.kind === "frameAction" ? (awaiting ?? last ?? null) : game.mode === "resourceActions" ? "resourceActions" : null;
  const point = id ? POINTS[id] : undefined;
  return id && point ? { id, ...point } : null;
}

/** The title of a window point by its id ("Before the quest resolves"), or null for an unknown id. */
export function pointTitle(id: string): string | null {
  return POINTS[id]?.title ?? null;
}

/** The note of a window point by its id, or null. */
export function pointNote(id: string): string | null {
  return POINTS[id]?.note ?? null;
}
