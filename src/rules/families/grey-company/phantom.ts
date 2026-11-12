// Rules: mec113.phantom, rr.step-6-4-3, rr.defending-player (data/rules/entries.json); ledger lines 146071:A:2, 145022:A:1, 145023:A:1, 145023:A:3, 145024:A:1, 145025:A:1, 145065:B:1, 145067:A:1.
//
// Phantom: "During the 'determine combat damage' step of an attack made by an enemy with Phantom, if any damage would be dealt by the attack it is canceled and the defending player raises their threat by an equal amount instead."
// Every place an enemy attack deals its damage to a character goes through `combatDamage` (families/defense/excess.ts), so the cancel is made there: before any damage window opens (rr.cancel answers damage that was dealt), for a
// defended and an undefended attack, an immediate attack, an attack from the staging area and an additional attack. Archery and a card effect's damage are not an attack's combat damage and never come here.
import type { EngineStep } from "../../core/intents.ts";
import { ruleCause } from "../../core/cause.ts";
import { raiseThreat } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";

/** Whether the enemy deals its damage as Phantom does now: it has the keyword, printed and not lost for this attack or while the Stone of Erech is the active location (`losesPhantom`), or it holds the flag `phantom` (a printed Forced that does the same, 146071:A:2, which nothing takes away). */
export function hasPhantom(state: ScenarioState, enemyId: string, ctx: ReduceContext): boolean {
  const enemy = state.cards[enemyId];
  if (!enemy) return false;
  return flagged(state, enemyId, "phantom") || (printedOf(ctx.cards, enemy.code).keywords.phantom && !flagged(state, enemyId, "losesPhantom"));
}

/** The state after a Phantom enemy's `raw` combat damage is canceled and the defending player (the attacked player) raises their threat by as much, or null when the enemy has no Phantom or the attack would deal none. */
export function cancelPhantomDamage(state: ScenarioState, enemyId: string, raw: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  if (raw <= 0 || !hasPhantom(state, enemyId, ctx)) return null;
  const seat = state.pendingAttack?.seat ?? state.cards[enemyId]?.controller;
  return seat == null ? null : raiseThreat(state, seat, raw, steps, ruleCause("mec113.phantom"));
}
