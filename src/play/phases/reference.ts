// Rules: rr.framework-steps, rr.attack-resolution-chart, hon.battle, hon.siege (data/rules/entries.json; data/rules/steps.json).
//
// The turn reference behind the rail (the phase carousel, carousel.ts, lays it out): the round as the Rules Reference's framework
// chart lays it out, phase by phase, each step with its rule title (from data/rules) and what the player decides there, the
// current step marked, and the action windows the table can stop at or pass (table-settings.ts). The
// video's "keep a round summary nearby".
import steps from "../../../data/rules/steps.json";

import { flagged, type ModeName, type ScenarioState } from "../../rules/core/state.ts";

import { UNDEFENDED_VILLAGERS_GUIDE } from "../words/scenarios/against-the-shadow/amon-din.ts";
import { UNDEFENDED_GUIDE as OSGILIATH_GUIDE } from "../words/scenarios/against-the-shadow/osgiliath.ts";
import { UNDEFENDED_GUIDE } from "../words/scenarios/against-the-shadow/cair-andros.ts";
import { beforeCombatNote, combatStartDecision } from "../readouts/against-the-shadow/blood.ts";
import { pointNote, pointTitle } from "./rail.ts";
import type { QuestStat } from "./quest-stat.ts";

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

// The two steps that name the quest total say the stat the stage counts instead of Willpower: Attack under Battle, Defense under Siege (hon.battle, hon.siege).
const QUEST_STEPS: Readonly<Record<string, (stat: string) => string>> = {
  "3.2": (stat) => `Commit characters to the quest: they exhaust and add their ${stat}.`,
  "3.4": (stat) => `${stat[0]?.toUpperCase()}${stat.slice(1)} against staging threat: progress, or your threat rises by the difference.`,
};

function decisionOf(step: string, stat: QuestStat | undefined, game: ScenarioState): string | undefined {
  const quest = stat && stat !== "willpower" ? QUEST_STEPS[step] : undefined;
  // While stage 1B of The Siege of Cair Andros is current a Battleground location takes the undefended attack, not a hero (05072:B:2).
  if (step === "6.E" && game.questStage != null && flagged(game, game.questStage, "undefendedToBattleground")) return UNDEFENDED_GUIDE;
  // While stage 2B of Encounter at Amon Dîn is current the undefended attack discards villager tokens from Rescued Villagers, not a hero (06067:B:1).
  if (step === "6.E" && game.questStage != null && game.modifiers.length > 0 && flagged(game, game.questStage, "undefendedToVillagers")) return UNDEFENDED_VILLAGERS_GUIDE;
  // Assault on Osgiliath: the undefended attack still damages a hero, and returns the unique locations a player controls (06096:A:2).
  if (step === "6.E" && game.scenarioId === "assault-on-osgiliath") return OSGILIATH_GUIDE;
  // The Blood of Gondor: on stage 1 the players turn or take hidden cards at the start of combat, before the shadow cards (06117:B:2).
  const hidden = combatStartDecision(game, step);
  if (hidden) return hidden;
  return quest && stat ? quest(stat) : DECISIONS[step];
}

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

/** The round, phase by phase, with the step the engine is in marked. `title` reads a rule span's title; `stat` is the stat the stage counts (phases/quest-stat.ts), Willpower when absent. */
export function turnReference(game: ScenarioState, title: (id: string) => string | null, stat?: QuestStat): ReferencePhase[] {
  const now = STEP_OF[game.mode] ?? null;
  const phases: ReferencePhase[] = [];
  for (const row of steps as readonly StepRow[]) {
    const decision = decisionOf(row.id, stat, game);
    if (!decision) continue;
    const step: ReferenceStep = {
      id: row.id,
      titles: NAMES[row.id] ? [NAMES[row.id] ?? ""] : row.entries.map((entry) => (title(entry) ?? entry).replace(/^[0-9.ab]+\s*/, "")),
      decision,
      current: row.id === now,
      windows: (WINDOWS[row.id] ?? []).map((id) => ({ id, title: pointTitle(id) ?? id, note: beforeCombatNote(game, id) ?? pointNote(id, stat) ?? "" })),
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
export function guideLine(game: ScenarioState, window: boolean, stat?: QuestStat): { key: string; text: string } | null {
  if (window) return { key: "window", text: "An action window: play an event or use an Action now, or pass and the game moves on." };
  const step = stepOf(game);
  const decision = step ? decisionOf(step, stat, game) : undefined;
  if (!step || !decision || game.window?.kind == null || ASKS[step] !== game.window.kind) return null;
  return { key: step, text: decision };
}
