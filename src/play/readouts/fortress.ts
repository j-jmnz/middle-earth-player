// Rules: mec112.defense, rr.quest-cards-quest-deck (data/rules/entries.json); ledger lines 143033:A:3, 143073:B:1, 143075:B:3.
//
// What the table says of Helm's Deep's pieces (docs/design-system-table.md, Cards): the tokens on The Defense of Helm's Deep against the number that ends it, whether the current stage has Defense (questing then
// places progress for the encounter deck, never for the players), and whether filling a stage loses the game (stage 4B). The engine decided each; nothing here changes one. Pure, so a test reads it.
import { useMemo } from "react";

import { flagged, inPlay } from "../../rules/core/state.ts";
import { effectsOf } from "../../rules/windows/listen.ts";
import { DEFENSE_STAGE, STAGE_DEFEAT_LOSS } from "../words/scenarios/fortress.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

/** The tokens on The Defense of Helm's Deep, the number that ends it and its name, for the top bar's Defense dial. */
export type DefenseTokens = { name: string; value: number; limit: number };

/** The Defense dial's numbers while the objective is in play, or null for a scenario that declares none, before the objective joins the staging area, and once it is in the victory display. */
export function defenseTokens(game: ScenarioState, nameOf: (code: string) => string): DefenseTokens | null {
  const tracker = game.widgets.defenseTracker;
  if (!tracker) return null;
  const card = Object.values(game.cards).find((entry) => entry.code === tracker.code && inPlay(entry.zone));
  return card ? { name: nameOf(card.code), value: card.resources, limit: tracker.limit } : null;
}

/** The Defense dial's numbers for the top bar: the same object while its value, its limit and its name are the same, so the bar re-renders only when a token moves. */
export function useDefenseTokens(game: ScenarioState, nameOf: (code: string) => string): DefenseTokens | null {
  const now = defenseTokens(game, nameOf);
  const name = now?.name ?? null;
  const value = now?.value ?? null;
  const limit = now?.limit ?? null;
  return useMemo(() => (name == null || value == null || limit == null ? null : { name, value, limit }), [name, value, limit]);
}

/** Whether the current quest stage has the Defense keyword (`defenseKeyword` on the stage, mec112.defense). */
export function stageHasDefense(game: ScenarioState): boolean {
  return game.questStage != null && flagged(game, game.questStage, "defenseKeyword");
}

/** Whether the stage's defeat loses the game: a Forced record of the stage that hears it defeated and loses (The Wall is Breached!, 143075:B:3). */
export function stageDefeatLoses(ctx: ReduceContext, code: string): boolean {
  return effectsOf(ctx, code).some((effect) => effect.timing === "forced" && effect.trigger === "questCardDefeated" && effect.instructions.some((instruction) => instruction.verb === "LoseGame"));
}

/** The lines a stage adds to its preview and to the screen that tells the advance to it: Defense (the current stage's flag), and the loss when it is filled. Empty for any other stage. */
export function stageRuleLines(game: ScenarioState, ctx: ReduceContext, code: string): string[] {
  return [...(stageHasDefense(game) && game.questStage != null && game.cards[game.questStage]?.code === code ? [DEFENSE_STAGE] : []), ...(stageDefeatLoses(ctx, code) ? [STAGE_DEFEAT_LOSS] : [])];
}
