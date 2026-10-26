// Rules: rr.quest-cards-quest-deck, rr.winning-the-game (data/rules/entries.json).
//
// How the current quest stage is won when it has no quest points to fill: the printed line of the record that wins the game,
// on the stage or on a card in play or in staging (The Ringwraiths Attack, 141027:B:1; Bucklebury Ferry, 141035:A:4). The
// line is the card's printed text from the ledger, never booklet prose.
import type { Instruction } from "../catalog/boundary.ts";
import { questPointsOf } from "../rules/quest.ts";
import type { ReduceContext, ScenarioState } from "../rules/reduce.ts";
import { inPlay } from "../rules/state.ts";

function wins(instructions: readonly Instruction[]): boolean {
  return instructions.some((instruction) => instruction.verb === "WinGame" || ("options" in instruction && Array.isArray(instruction.options) && instruction.options.some((option: { instructions?: readonly Instruction[] }) => wins(option.instructions ?? []))));
}

/** The printed line that says how the stage is won, or null when the stage fills with progress (or nothing says). */
export function questObjective(game: ScenarioState, ctx: ReduceContext, line: (id: string) => string | null): string | null {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (!stage || questPointsOf(game, stage, ctx.cards) != null) return null;
  const codes = new Set([stage.code, ...Object.values(game.cards).filter((card) => card.face !== "down" && (inPlay(card.zone) || card.zone === "staging")).map((card) => card.code)]);
  for (const effect of ctx.effects) {
    if (!codes.has(effect.cardCode) || !wins(effect.instructions)) continue;
    const text = effect.lines[0] ? line(effect.lines[0]) : null;
    if (text) return text;
  }
  return null;
}
