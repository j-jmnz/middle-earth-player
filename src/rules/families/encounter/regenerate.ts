// Rules: dwd.regenerate, rr.refresh-phase (data/rules/entries.json); ledger lines 04072:A:1.
//
// Regenerate X: an enemy with the keyword, in the staging area or engaged, heals X damage from itself each round, right after the first player token passes in the Refresh phase and before player actions. It heals no more than it has. The
// keyword is printed (`keywords.regenerate`); a card whose text box is blank has none (printedKeywordsBlank). An enemy lying as a Tentacle attachment is no enemy and heals nothing.
import type { EngineStep } from "../../core/intents.ts";
import { printedKeywordsBlank } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import { inPlay, type ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { healDamage } from "../dreamchaser/heal-cap.ts";

export function regenerateEnemies(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const card of Object.values(state.cards)) {
    if (!inPlay(card.zone) || card.zone === "attached" || card.damage <= 0) continue;
    const printed = printedOf(ctx.cards, card.code);
    const amount = printed.keywords.regenerate;
    if (printed.type !== "enemy" || amount == null || printedKeywordsBlank(next, card.id, ctx.cards)) continue;
    const healed = healDamage(next, card.id, amount, ctx);
    if (healed.healed <= 0) continue;
    next = healed.state;
    steps.push({ kind: "damage", targetId: card.id, amount: -healed.healed, cause: { rule: "dwd.regenerate" } });
  }
  return next;
}
