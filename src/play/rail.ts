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
