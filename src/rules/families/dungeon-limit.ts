// Rules: rr.initiating-abilities-playing-cards (data/rules/entries.json); ledger lines 01123:B:2, 01124:B:2.
//
// "The players, as a group, cannot play more than 1 ally card each round" (LimitPlays): a constant of a card in play. The cards played this
// round are the ones the reducer recorded (state.played); a card put into play without being played is not among them.
import { constantInstructions } from "../constant-records.ts";
import type { ReduceContext } from "../interpret.ts";
import { printedOf } from "../printed.ts";
import type { ScenarioState } from "../state.ts";

export function playLimited(state: ScenarioState, cardId: string, ctx: ReduceContext): boolean {
  const printed = printedOf(ctx.cards, state.cards[cardId]?.code ?? "");
  for (const { instruction } of constantInstructions(state, ctx)) {
    if (instruction.verb !== "LimitPlays" || instruction.cardType !== printed.type) continue;
    const played = (state.played ?? []).filter((entry) => entry.round === state.round && printedOf(ctx.cards, entry.code).type === instruction.cardType && entry.id !== cardId);
    if (played.length >= instruction.max) return true;
  }
  return false;
}
