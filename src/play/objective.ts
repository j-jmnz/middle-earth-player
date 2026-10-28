// Rules: rr.quest-cards-quest-deck, rr.winning-the-game (data/rules/entries.json).
//
// How the current quest stage is won when it has no quest points to fill: the printed line of the record that wins the game,
// on the stage or on a card in play or in staging (The Ringwraiths Attack, 141027:B:1; Bucklebury Ferry, 141035:A:4). The
// line is the card's printed text from the ledger, never booklet prose.
import type { Instruction } from "../catalog/boundary.ts";
import { questPointsOf } from "../rules/quest.ts";
import { restricted } from "../rules/restrictions.ts";
import type { ReduceContext, ScenarioState } from "../rules/reduce.ts";
import { inPlay, type CardInstance } from "../rules/state.ts";

/**
 * The quest points progress fills on this quest stage, or null when progress never defeats it: it prints none, or has 0 and the
 * stage cannot be advanced now, so it is won some other way ("Don't Leave the Path!", 01121:B:2, cannot be advanced: the players win by defeating Ungoliant's Spawn).
 * Progress may still be placed on it; the table does not count it against a target.
 */
export function stagePoints(game: ScenarioState, stage: CardInstance, ctx: ReduceContext): number | null {
  const points = questPointsOf(game, stage, ctx.cards);
  // A stage at 0 that may still advance (Surprise Attack, 41005:B:2, 4 for each enemy) still fills with progress.
  return points === 0 && restricted(game, ctx, "advance").length > 0 ? null : points;
}

/** A quest stage's printed lines but its When Revealed ones: how it is won or held ("The players must find and defeat Ungoliant's Spawn to win this game", 01121:B:2), or null. */
export function stageText(ctx: ReduceContext, code: string, line: (id: string) => string | null): string | null {
  const ids = [...new Set(ctx.effects.filter((effect) => effect.cardCode === code && effect.timing !== "whenRevealed").flatMap((effect) => effect.lines))].sort();
  const text = ids.flatMap((id) => line(id) ?? []).join(" ");
  return text === "" ? null : text;
}

function wins(instructions: readonly Instruction[]): boolean {
  return instructions.some((instruction) => instruction.verb === "WinGame" || ("options" in instruction && Array.isArray(instruction.options) && instruction.options.some((option: { instructions?: readonly Instruction[] }) => wins(option.instructions ?? []))));
}

/** The printed line that says how the stage is won, or null when the stage fills with progress (or nothing says). */
export function questObjective(game: ScenarioState, ctx: ReduceContext, line: (id: string) => string | null): string | null {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (!stage || stagePoints(game, stage, ctx) != null) return null;
  const codes = new Set([stage.code, ...Object.values(game.cards).filter((card) => card.face !== "down" && (inPlay(card.zone) || card.zone === "staging")).map((card) => card.code)]);
  for (const effect of ctx.effects) {
    if (!codes.has(effect.cardCode) || !wins(effect.instructions)) continue;
    const text = effect.lines[0] ? line(effect.lines[0]) : null;
    if (text) return text;
  }
  return null;
}
