// Rules: mec112.defense, rr.quest-cards-quest-deck (data/rules/entries.json); ledger lines 143033:A:3, 143073:B:1, 143075:B:3.
//
// What the table says of Helm's Deep's pieces (docs/design-system-table.md, Cards): the tokens on The Defense of Helm's Deep against the number that ends it, whether the current stage has Defense (questing then
// places progress for the encounter deck, never for the players), and whether filling a stage loses the game (stage 4B) or advances it. The engine decided each; nothing here changes one. Pure, so a test reads it.
import { useMemo } from "react";

import { flagged, inPlay } from "../../rules/core/state.ts";
import { effectsOf } from "../../rules/windows/listen.ts";
import { stageNumber } from "../../rules/families/caves/progress.ts";
import { resolveQuest } from "../../rules/quest/quest.ts";
import { DEFENSE_STAGE, defenseFillsWords, type DefenseOutcome } from "../words/scenarios/fortress.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { cairAndrosStageLines } from "./against-the-shadow/cair-andros.ts";
import { druadanStageLines } from "./against-the-shadow/druadan.ts";
import { amonDinHeld, amonDinStageLines } from "./against-the-shadow/amon-din.ts";
import { bloodStageLines } from "./against-the-shadow/blood.ts";
import { valeStageLines } from "./against-the-shadow/vale.ts";
import { stewardsFearStageLines } from "./against-the-shadow/stewards-fear.ts";

/** The tokens on The Defense of Helm's Deep, the number that ends it, the quest stage the players advance to and its name, for the top bar's Defense dial. */
export type DefenseTokens = { name: string; value: number; limit: number; stage: number };

/** The Defense dial's numbers while the objective is in play, or null for a scenario that declares none, before the objective joins the staging area, and once it is in the victory display. */
export function defenseTokens(game: ScenarioState, nameOf: (code: string) => string): DefenseTokens | null {
  const tracker = game.widgets.defenseTracker;
  if (!tracker) return null;
  const card = Object.values(game.cards).find((entry) => entry.code === tracker.code && inPlay(entry.zone));
  return card ? { name: nameOf(card.code), value: card.resources, limit: tracker.limit, stage: tracker.stage } : null;
}

/** The Defense dial's numbers for the top bar: the same object while its value, its limit and its name are the same, so the bar re-renders only when a token moves. */
export function useDefenseTokens(game: ScenarioState, nameOf: (code: string) => string): DefenseTokens | null {
  const now = defenseTokens(game, nameOf);
  const name = now?.name ?? null;
  const value = now?.value ?? null;
  const limit = now?.limit ?? null;
  const stage = now?.stage ?? null;
  return useMemo(() => (name == null || value == null || limit == null || stage == null ? null : { name, value, limit, stage }), [name, value, limit, stage]);
}

/** Whether the current quest stage has the Defense keyword (`defenseKeyword` on the stage, mec112.defense). */
export function stageHasDefense(game: ScenarioState): boolean {
  return game.questStage != null && flagged(game, game.questStage, "defenseKeyword");
}

/** Whether the stage's defeat loses the game: a Forced record of the stage that hears it defeated and loses (The Wall is Breached!, 143075:B:3). */
export function stageDefeatLoses(ctx: ReduceContext, code: string): boolean {
  return effectsOf(ctx, code).some((effect) => effect.timing === "forced" && effect.trigger === "questCardDefeated" && effect.instructions.some((instruction) => instruction.verb === "LoseGame"));
}

/**
 * What a stage tells of how it ends, as the lines of its preview and of the screen that tells the advance to it, in order: when it is full ("The encounter deck advances it at 8 progress", or "The players lose at 8 progress"
 * on a stage whose defeat loses, which replaces `plain`, the ordinary "N quest points to complete it"), what holds it back (`hold`), then the Defense keyword. `points` null: the stage has no quest points. Empty for any other stage.
 */
export function stageDetail(game: ScenarioState, ctx: ReduceContext, code: string, points: number | null, hold: string | null, plain: string | null): string[] {
  const defense = stageHasDefense(game) && game.questStage != null && game.cards[game.questStage]?.code === code;
  const loses = stageDefeatLoses(ctx, code);
  const fills = points != null && (defense || loses) ? defenseFillsWords(points, loses) : null;
  // Stage 3 of The Drúadan Forest says its own win bar: the printed win line that holds it back and the quest-point line would only repeat it (06044:B:3, 06045:A:3).
  const druadan = druadanStageLines(game, ctx, code, (id) => ctx.cards.get(id)?.name ?? id);
  // A stage of Encounter at Amon Dîn that is defeated with the end held says its held line first: the quest-point line would only say it is done.
  const own = druadan.length > 0 || amonDinHeld(game, code) ? [] : [hold ?? (fills ? null : plain)];
  return [fills, ...own, defense ? DEFENSE_STAGE : null, ...cairAndrosStageLines(game, ctx, code), ...druadan, ...stewardsFearStageLines(game, ctx, code), ...amonDinStageLines(game, code), ...bloodStageLines(game, code), ...valeStageLines(game, ctx, code)].filter((text) => text != null);
}

/**
 * What resolving the quest now would do to the current stage, which has Defense, found on a copy as the engine resolves it (as `eliminationWords` fails the quest on one): whether the progress the encounter deck places
 * fills the stage and so advances the quest or loses the game, and whether the stage's own record has the first player reveal a card for want of progress on it (143074:B:2).
 */
export function defenseOutcome(game: ScenarioState, ctx: ReduceContext): DefenseOutcome {
  const id = game.questStage;
  const stage = id ? game.cards[id] : undefined;
  if (!id || !stage) return { fills: "nothing", reveals: false };
  const after = resolveQuest(game, ctx.cards, []);
  const advanced = after.questStage !== id;
  const reveals = !advanced && after.defensePlaced !== true && effectsOf(ctx, stage.code).some((effect) => effect.trigger === "defenseQuestResolved" && effect.instructions.some((instruction) => instruction.verb === "RevealEncounter"));
  if (!advanced) return { fills: "nothing", reveals };
  return { fills: stageDefeatLoses(ctx, stage.code) ? "loses" : { advancesTo: stageNumber(after) }, reveals: false };
}
