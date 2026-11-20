// Rules: rr.replacement-effects, mec108.captured-cards (data/rules/entries.json); ledger lines 10043:A:2, 10051:A:2.
// The damage step's side of the captured family, a module of its own that imports no rules code beyond the zones, so the combat damage (families/defense/excess.ts) can read it without a cycle.
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { captureAlly } from "./pile.ts";

// The damage step of an attack (defense/excess.ts combatDamage): an ally the attack would damage is captured underneath the attacking enemy instead, whatever the damage, a lethal blow included; nothing is dealt, so nothing is destroyed (rr.replacement-effects). Null when
// it does not apply: no damage, a hero, or an attack that does not capture (a shadow card marked the attack in progress, or the enemy's own record says so: Cruel Torturer).
export function captureInstead(state: ScenarioState, enemyId: string, assigned: string, raw: number, ctx: { readonly cards: ReadonlyMap<string, PrintedCard> }): ScenarioState | null {
  if (!state.capture || raw <= 0) return null;
  const ally = state.cards[assigned];
  if (!ally || ally.zone !== "play" || printedOf(ctx.cards, ally.code).type !== "ally") return null;
  const enemy = state.cards[enemyId];
  if (state.pendingAttack?.captures !== true && !(enemy != null && state.capture.instead.includes(enemy.code))) return null;
  return captureAlly(state, assigned, enemyId, ctx.cards);
}
