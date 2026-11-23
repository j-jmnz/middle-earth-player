// Rules: hob.riddle-area, rr.attacks-outside-the-combat-phase, rr.step-6-4-1, rr.step-6-4-3 (data/rules/entries.json); ledger lines 131074:A:1, 131030:B:3, 131031:B:2. Gollum's attack on Bilbo Baggins from the riddle area, and who may defend against it.
import { beginEnemyAttack } from "../../combat/combat.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";
import { areaGollum, areaStage, bilbo, GOLLUM, inArea } from "./area.ts";

/** GollumAttacksBilbo: Gollum, in the riddle area, attacks the player who controls Bilbo as an immediate attack with no shadow card; Bilbo is the only defender, and what nobody defends is dealt to Bilbo (onlyHeroes). */
export function gollumAttacksBilbo(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const gollum = areaGollum(state);
  const hero = bilbo(state);
  if (!gollum || !hero || state.pendingAttack != null) return state;
  const begun = beginEnemyAttack(state, hero.controller ?? state.firstPlayer, gollum.id, ctx, steps, { fromStaging: true, shadow: false });
  return begun.pendingAttack ? { ...begun, pendingAttack: { ...begun.pendingAttack, immediate: true, onlyHeroes: [hero.id] } } : begun;
}

/** The `combat.defense` hook: against Gollum in the riddle area only Bilbo defends, and Bilbo defends only against Gollum while he is in the area (hob.riddle-area: "defend (except against Gollum)"). */
export function defenseReason(state: ScenarioState, _defender: PrintedCard, _cards: ReadonlyMap<string, PrintedCard>, defenderId: string): string | null {
  const attacker = state.pendingAttack ? state.cards[state.pendingAttack.enemyId] : undefined;
  if (attacker?.zone === "riddleArea") return defenderId === bilbo(state)?.id ? null : "Only Bilbo Baggins can defend against Gollum in the riddle area";
  return inArea(state, defenderId) ? "Bilbo Baggins cannot defend while he is in the riddle area, except against Gollum" : null;
}

/** Whether Bilbo Baggins, in the riddle area, takes no damage from this source: only Gollum's attack damages him there (hob.riddle-area: "cannot ... take damage from cards other than Gollum"). `sourceId`: the card whose effect deals it, when known. */
export function bilboDamageBarred(state: ScenarioState, id: string, source: string, sourceId: string | null | undefined): boolean {
  if (id !== bilbo(state)?.id || !areaStage(state)) return false;
  const attacker = state.pendingAttack ? state.cards[state.pendingAttack.enemyId] : undefined;
  if (source === "combat" && attacker?.code === GOLLUM) return false;
  return (sourceId != null ? state.cards[sourceId]?.code : undefined) !== GOLLUM;
}

/** The `combat.undefended` hook: damage from the undefended attack of Gollum goes on Bilbo Baggins while the table holds `gollumDamageToBilbo` (stage 3B, 131031:B:2). */
export function undefendedTargets(state: ScenarioState): readonly string[] {
  const attacker = state.pendingAttack ? state.cards[state.pendingAttack.enemyId] : undefined;
  const hero = bilbo(state);
  return attacker?.code === GOLLUM && hero && flagged(state, "table", "gollumDamageToBilbo") ? [hero.id] : [];
}
