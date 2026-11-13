// Rules: mec108.reanimated-dead, ltp.scoring, rr.scoring (data/rules/entries.json).
// A hero that was destroyed and then reanimated (Dwimmerlaik, Unholy Crypt's shadow) lies engaged or in the staging area as `<code>~dead` when the game ends: no longer in a discard pile, still a destroyed hero. The score, the report and the campaign log read it here.
import { isReanimatedCode, printedOf, reanimatedBase, type PrintedCard } from "../../../core/printed.ts";
import type { ScenarioState } from "../../../core/state.ts";

export type ReanimatedHero = { id: string; seat: number; code: string };

/** The heroes lying in play as a Reanimated Dead, in card order: `code` is the hero's printed code, `seat` the player who owns it. */
export function reanimatedHeroes(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): ReanimatedHero[] {
  const out: ReanimatedHero[] = [];
  for (const card of Object.values(state.cards)) {
    if (!isReanimatedCode(card.code) || (card.zone !== "engaged" && card.zone !== "staging")) continue;
    const code = reanimatedBase(card.code);
    const seat = card.owner ?? card.controller;
    if (seat != null && cards.has(code) && printedOf(cards, code).type === "hero") out.push({ id: card.id, seat, code });
  }
  return out;
}
