// Rules: rr.action-windows, rr.framework-steps, rr.response (data/rules/entries.json).
//
// When the table answers for the player, on the player's own standing settings (table-settings.ts):
// - a step's action window that is not one of the player's stops is passed, unless a card usable there is new since the
//   last stop (a card just drawn); planning, the quest commit, Responses, cancels and every pick always ask;
// - "Pass to next stop" passes the windows between here and the next stop;
// - a free Response (no cost, nothing to choose) the player set to Always is used when it is offered.
// Every answer is an ordinary intent in the save: Undo takes it back, and the table then asks at that window.
import type { Effect, Instruction } from "../catalog/boundary.ts";
import type { LegalIntent, PlayerIntent, ReduceContext, ScenarioState } from "../rules/reduce.ts";

import { windowPoint } from "./rail.ts";
import type { Sheet } from "./sheet-types.ts";
import { STOP_POINTS, type TableSettings } from "./table-settings.ts";

/** The cards a sheet lets the player use or play now. */
export function usableIds(sheet: Sheet): string[] {
  if (sheet.kind !== "window") return [];
  return [...sheet.plays, ...sheet.triggers.map((item) => item.cardId)];
}

/** True for an ordinary step action window the table may pass: not planning, not the commit, not a pick. */
export function passableWindow(game: ScenarioState, sheet: Sheet, legal: readonly LegalIntent[]): boolean {
  if (sheet.kind !== "window" || sheet.commit || game.mode === "planning" || game.lost || game.stageCleared) return false;
  if (!legal.some((intent) => intent.type === "Pass")) return false;
  return windowPoint(game) != null;
}

export type StopInput = {
  game: ScenarioState;
  sheet: Sheet;
  legal: readonly LegalIntent[];
  settings: TableSettings;
  // "Pass to next stop" is running: pass every window up to the next stop, new cards or not.
  running: boolean;
  // The player went back to this window with Undo: ask here.
  held: boolean;
  // The cards usable at a window the player was last asked at.
  seen: ReadonlySet<string>;
};

/** "pass" when the table answers this window for the player, "ask" otherwise. */
export function stopDecision(input: StopInput): "pass" | "ask" {
  const { game, sheet, legal, settings, running, held, seen } = input;
  if (held || !passableWindow(game, sheet, legal)) return "ask";
  const point = windowPoint(game);
  if (!point || settings.stops.includes(point.id)) return "ask";
  if (running) return "pass";
  if (!settings.stopsOn) return "ask";
  // A card usable here that the player has not been asked about since the last stop: ask.
  return usableIds(sheet).every((id) => seen.has(id)) ? "pass" : "ask";
}

/** The title of the next stop after this window, in round order (rail.ts names it), for "Pass to next stop". */
export function nextStopTitle(game: ScenarioState, settings: TableSettings, titleOf: (point: string) => string | null): string {
  const here = windowPoint(game)?.id ?? null;
  const order = STOP_POINTS as readonly string[];
  const from = here ? order.indexOf(here) + 1 : 0;
  const ahead = [...order.slice(from), ...order.slice(0, from)].find((point) => settings.stops.includes(point));
  return (ahead ? titleOf(ahead) : null) ?? "the next choice";
}

const FREE_VERBS: ReadonlySet<string> = new Set(["Draw", "AddResources", "Ready", "ModifyStat", "LowerThreat", "Heal"]);

// An instruction that names a picked card or player waits on a choice.
function choiceFree(instruction: Instruction): boolean {
  if (!FREE_VERBS.has(instruction.verb)) return false;
  return !Object.values(instruction as Record<string, unknown>).some((value) => value === "picked");
}

/**
 * A Response with no cost, no cancel and nothing to choose (Sam Gamgee readies, Pippin draws, Glóin gains resources): the
 * only kind a player may set to Always.
 */
export function isFreeResponse(effect: Effect | undefined): boolean {
  if (!effect || effect.timing !== "response" || effect.cost != null || effect.cancel != null) return false;
  return effect.instructions.length > 0 && effect.instructions.every(choiceFree);
}

/** The Trigger the table sends for a Response the player set to Always, when one is offered now; else null. */
export function alwaysUseIntent(game: ScenarioState, sheet: Sheet, ctx: ReduceContext, settings: TableSettings, held: boolean): PlayerIntent | null {
  if (held || game.window?.kind !== "response" || sheet.kind !== "trigger") return null;
  for (const item of sheet.options) {
    if (item.pay || !settings.alwaysUse.includes(item.effectId)) continue;
    if (!isFreeResponse(ctx.effects.find((effect) => effect.id === item.effectId))) continue;
    return { type: "Trigger", cardId: item.cardId, effectId: item.effectId };
  }
  return null;
}
