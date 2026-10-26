// Rules: rr.framework-steps, rr.attack-resolution-chart (data/rules/entries.json; data/rules/steps.json).
//
// The turn reference behind the rail: the round as the Rules Reference's framework chart lays it out, phase by phase, each
// step with its rule title (from data/rules) and what the player decides there, the current step marked, and the action
// windows the table can stop at or pass (table-settings.ts). The video's "keep a round summary nearby".
import steps from "../../data/rules/steps.json";

import type { ModeName, ScenarioState } from "../rules/state.ts";

import { pointNote, pointTitle } from "./rail.ts";

export type ReferenceStep = { id: string; titles: readonly string[]; decision: string; current: boolean; windows: readonly { id: string; title: string; note: string }[] };
export type ReferencePhase = { phase: string; steps: readonly ReferenceStep[] };

// What the player decides at a step, in a few original words.
const DECISIONS: Readonly<Record<string, string>> = {
  "0.0": "The round begins.",
  "1.R": "Each hero gains 1 resource of its sphere; each player draws 1 card.",
  "2.P": "Play allies and attachments, paid from heroes of their sphere.",
  "3.2": "Commit characters to the quest: they exhaust and add their willpower.",
  "3.3": "Each player reveals 1 encounter card; its threat joins staging.",
  "3.4": "Willpower against staging threat: progress, or your threat rises by the difference.",
  "4.2": "Travel to a location in staging, if none is active.",
  "5.2": "You may engage one enemy in staging.",
  "5.3": "Each enemy in staging at or below your threat engages you.",
  "6.2": "Each engaged enemy is dealt a face-down shadow card.",
  "6.E": "Each enemy attacks: declare one defender, or take it undefended on a hero.",
  "6.P": "Attack each engaged enemy once, with as many ready characters as you like.",
  "7.R": "Ready every card; each player's threat rises by 1; the first player token passes.",
};

// A step the chart draws as many boxes (the attack resolution charts) goes by one short name; its windows are listed under it.
const NAMES: Readonly<Record<string, string>> = { "6.E": "Enemy attacks, one at a time", "6.P": "Player attacks, one enemy at a time" };

// The action windows after each step that the table can pass (rail.ts names them), in order.
const WINDOWS: Readonly<Record<string, readonly string[]>> = {
  "1.R": ["resourceActions"],
  "3.3": ["3.3"],
  "3.4": ["3.4"],
  "4.2": ["4.2"],
  "5.2": ["5.2"],
  "5.3": ["5.3"],
  "6.2": ["6.2"],
  "6.E": ["defense", "shadow", "damage", "end"],
  "6.P": ["strike"],
  "7.R": ["7.4"],
};

// The framework step the engine is in, by its mode.
const STEP_OF: Readonly<Partial<Record<ModeName, string>>> = {
  beginRound: "0.0",
  resourceGrant: "1.R",
  resourceActions: "1.R",
  planning: "2.P",
  questCommit: "3.2",
  staging: "3.3",
  resolution: "3.4",
  stopped: "3.4",
  travel: "4.2",
  optionalEngage: "5.2",
  engagement: "5.3",
  combatStart: "6.2",
  combatShadows: "6.2",
  combatActions: "6.2",
  enemyAttacks: "6.E",
  playerAttacks: "6.P",
  refresh: "7.R",
  endRound: "7.R",
};

type StepRow = { id: string; phase: string; entries: readonly string[] };

/** The round, phase by phase, with the step the engine is in marked. `title` reads a rule span's title. */
export function turnReference(game: ScenarioState, title: (id: string) => string | null): ReferencePhase[] {
  const now = STEP_OF[game.mode] ?? null;
  const phases: ReferencePhase[] = [];
  for (const row of steps as readonly StepRow[]) {
    const decision = DECISIONS[row.id];
    if (!decision) continue;
    const step: ReferenceStep = {
      id: row.id,
      titles: NAMES[row.id] ? [NAMES[row.id] ?? ""] : row.entries.map((entry) => (title(entry) ?? entry).replace(/^[0-9.ab]+\s*/, "")),
      decision,
      current: row.id === now,
      windows: (WINDOWS[row.id] ?? []).map((id) => ({ id, title: pointTitle(id) ?? id, note: pointNote(id) ?? "" })),
    };
    const last = phases[phases.length - 1];
    if (last && last.phase === row.phase) phases[phases.length - 1] = { phase: row.phase, steps: [...last.steps, step] };
    else phases.push({ phase: row.phase, steps: [step] });
  }
  return phases;
}

/** The framework step the engine is in (steps.json id), or null outside the round. */
export function stepOf(game: ScenarioState): string | null {
  return STEP_OF[game.mode] ?? null;
}

// The window in which the player makes a step's own decision. The guide explains a step there only, never in a Response, a
// cancel or a pick that comes up inside it (Frodo's Response at staging is not the staging step's decision).
const ASKS: Readonly<Record<string, string>> = { "2.P": "pass", "3.2": "pass", "4.2": "travel", "5.2": "optionalEngage", "6.E": "defense", "6.P": "playerAttack" };

/**
 * The first-game guide's line for the moment (table-settings.ts, guide): the step's decision the first two times it comes up,
 * and what an action window is for. Null when the moment has no line. `key` counts how often it was shown.
 */
export function guideLine(game: ScenarioState, window: boolean): { key: string; text: string } | null {
  if (window) return { key: "window", text: "An action window: play an event or use an Action now, or pass and the game moves on." };
  const step = stepOf(game);
  const decision = step ? DECISIONS[step] : undefined;
  if (!step || !decision || game.window?.kind == null || ASKS[step] !== game.window.kind) return null;
  return { key: step, text: decision };
}
