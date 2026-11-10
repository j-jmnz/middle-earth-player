// Rules: rr.damage, rr.destroy, rr.restricted (data/rules/entries.json); ledger lines 19141:B:1, 19131:A:3, 19143:A:3, 19144:A:3.
// The rows of the picks that put damage on a character of the players in Mount Gundabad: a stage's "deal 2 damage to a questing character you control" and the one damage at a time of an AssignDamage. A row that would destroy its character arms the confirm (damageOutcome reads the
// engine, the flag of a hero who carries Wormsbane included): the first tap says it, the second sends. Told only in Mount Gundabad (words/scenarios/gundabad.ts, inGundabad). Pure.
import type { Instruction } from "../../catalog/boundary.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { inGundabad } from "../words/scenarios/gundabad.ts";
import { damagedCharacterRow, type FireRow } from "./aflame-sheets.ts";

/**
 * The row for `id` in a Pick of a questing character you control that is followed by damage to it, or in an AssignDamage's one damage at a time: "Brand · 2 damage · destroyed", the damage as a mark, "Tap again" when it destroys the character or loses the game. Null for any
 * other pick, and outside Mount Gundabad.
 */
export function gundabadRow(pick: Instruction, next: Instruction | undefined, id: string, game: ScenarioState, ctx: ReduceContext, name: string): FireRow | null {
  if (!inGundabad(game)) return null;
  if (pick.verb === "AssignDamage") return damagedCharacterRow(game, ctx, id, name, 1);
  if (pick.verb !== "Pick" || pick.pick.committed !== true || pick.pick.control !== "you" || pick.pick.type !== "character" || next?.verb !== "DamageCard" || typeof next.amount !== "number") return null;
  return damagedCharacterRow(game, ctx, id, name, next.amount);
}
