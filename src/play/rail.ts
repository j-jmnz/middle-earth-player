// Rules: rr.framework-steps, rr.step-1-1, rr.planning-phase, rr.step-3-1, rr.step-3-4, rr.travel, rr.optional-engagement,
// rr.engagement-check, rr.combat-phase, rr.refresh-phase (data/rules/entries.json).
//
// The phase rail names, in words, the step the engine is in, with the step before and the step after. It reads the
// engine's mode and nothing else, so it cannot skip a step the engine runs. It is not a control.
import type { ModeName, ScenarioState } from "../rules/state.ts";

export type Rail = { previous: string; current: string; next: string; phase: string; round: number };

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
  const base = { phase: game.phase, round: game.round };
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
