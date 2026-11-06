// Rules: rr.damage, rr.destroy, rr.restricted (data/rules/entries.json); ledger lines 19141:B:1, 19131:A:3, 19143:A:3, 19144:A:3.
// The rows of the picks that put damage on a character of the players in Mount Gundabad: a stage's "deal 2 damage to a questing character you control" and the one damage at a time of an AssignDamage. A hero who carries Wormsbane cannot leave play without losing the game, so a row
// that would destroy such a hero (damageOutcome reads the engine, the flag included) arms the confirm: the first tap says it, the second sends. Pure.
import type { Instruction } from "../../catalog/boundary.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { damageOutcome } from "../store/foresight.ts";
import type { FireRow } from "./aflame-sheets.ts";

/**
 * The row for `id` in a Pick of a questing character that is followed by damage to it ("Brand · 2 damage · destroyed", the damage as a mark, "Tap again" when it destroys the character or loses the game), or in an AssignDamage's one damage at a time (a caution only when the
 * damage loses the game, since each damage is one the player may place elsewhere). Null for any other pick, and for a character that survives an AssignDamage.
 */
export function gundabadRow(pick: Instruction, next: Instruction | undefined, id: string, game: ScenarioState, ctx: ReduceContext, name: string): FireRow | null {
  if (pick.verb === "AssignDamage") {
    const outcome = damageOutcome(game, ctx, id, 1);
    return outcome.loss ? { label: name, mark: { icon: "damage", value: 1, danger: true }, caution: `Tap again: ${name} falls and the game is lost` } : null;
  }
  if (pick.verb !== "Pick" || pick.pick.committed !== true || pick.pick.type !== "character" || next?.verb !== "DamageCard" || typeof next.amount !== "number") return null;
  const outcome = damageOutcome(game, ctx, id, next.amount);
  const caution = outcome.destroyed ? (outcome.loss ? `Tap again: ${name} falls and the game is lost` : `Tap again: ${name} is destroyed`) : undefined;
  return { label: `${name} · ${next.amount} damage${outcome.destroyed ? " · destroyed" : ""}`, mark: { icon: "damage", value: next.amount, danger: outcome.destroyed }, ...(caution ? { caution } : {}) };
}
