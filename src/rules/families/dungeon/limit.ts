// Rules: rr.initiating-abilities-playing-cards (data/rules/entries.json); ledger lines 01123:B:2, 01124:B:2.
//
// "The players, as a group, cannot play more than 1 ally card each round" (LimitPlays): a constant of a card in play. The cards played this
// round are the ones the reducer recorded (state.played); a card put into play without being played is not among them.
import { constantInstructions } from "../../interpret/constant-records.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";

// The card in play whose LimitPlays has been used up for this card (the first one, oldest first), with its limit; null when none has.
export function playLimit(state: ScenarioState, cardId: string, ctx: ReduceContext): { source: string; cardType: string; max: number } | null {
  const printed = printedOf(ctx.cards, state.cards[cardId]?.code ?? "");
  for (const { source, instruction } of constantInstructions(state, ctx)) {
    if (instruction.verb !== "LimitPlays" || instruction.cardType !== printed.type) continue;
    const played = (state.played ?? []).filter((entry) => entry.round === state.round && printedOf(ctx.cards, entry.code).type === instruction.cardType && entry.id !== cardId);
    if (played.length >= instruction.max) return { source: printedOf(ctx.cards, source.code).name, cardType: instruction.cardType, max: instruction.max };
  }
  return null;
}

// The words for a refused play: "The Necromancer's Tower: the players play at most 1 ally card each round, and one was played this round."
export function playLimitReason(limit: NonNullable<ReturnType<typeof playLimit>>): string {
  const cards = `${limit.max} ${limit.cardType} card${limit.max === 1 ? "" : "s"}`;
  return `${limit.source}: the players play at most ${cards} each round, and ${limit.max === 1 ? "one was" : `${limit.max} were`} played this round.`;
}
