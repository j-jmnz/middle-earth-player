// Rules: sotm.escape-test, sotm.escape-test-example (data/rules/entries.json); ledger lines 02114:A:1, 900803:A:1 and the `Escape: N` lines. What an escape test counts: the Escape value of each card dealt and of each card in play that adds its own to every test, and the committed characters' stat.
import type { ReduceContext } from "../../interpret/interpret.ts";
import { heldStat, NO_COUNTS } from "../../interpret/constants.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, inPlay } from "../../core/state.ts";
import { effectsOf } from "../../windows/listen.ts";

/** The Escape value the card prints: the sum of the `EscapeValue` constants its records carry (0 with none). It counts only while the card is dealt for an escape test, or through `escapeSelfValue`. */
export function escapeValueOf(state: ScenarioState, id: string, ctx: ReduceContext): number {
  const code = state.cards[id]?.code;
  if (code == null) return 0;
  let total = 0;
  for (const effect of effectsOf(ctx, code)) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) if (instruction.verb === "EscapeValue") total += instruction.amount;
  }
  return total;
}

/** The Escape an escape test counts for the cards dealt: each card's value and what the table adds to each (`escapeValueBonus`), and the value of every card in play that adds its own (`escapeSelfValue`). */
export function escapeTotal(state: ScenarioState, dealtIds: readonly string[], ctx: ReduceContext): number {
  const bonus = heldStat(state, 0, "escapeValueBonus", NO_COUNTS);
  let total = 0;
  for (const id of dealtIds) total += escapeValueOf(state, id, ctx) + bonus;
  for (const card of Object.values(state.cards)) if (inPlay(card.zone) && flagged(state, card.id, "escapeSelfValue")) total += escapeValueOf(state, card.id, ctx);
  return total;
}

/** The counted stat of the committed characters still in play, added up. */
export function committedTotal(state: ScenarioState, committedIds: readonly string[], stat: "willpower" | "attack" | "defense", ctx: ReduceContext): number {
  let total = 0;
  for (const id of committedIds) {
    const instance = state.cards[id];
    if (instance && inPlay(instance.zone)) total += modifiedStat(state, instance, stat, ctx.cards);
  }
  return total;
}

// A tie fails: the committed total must be higher than the Escape counted (sotm.escape-test).
export function escapePassed(committed: number, escape: number): boolean {
  return committed > escape;
}
