// Rules: rr.destroy, rr.damage, rr.lasting-effects (data/rules/entries.json); ledger line 10107:A:2. "Raise your threat by the destroyed character's Willpower": the character's Willpower as it was in play, read when the attack damages it (so a card that lowered it, Decipher Ancient Texts, still counts) and kept on the character
// as `lastWillpower` until the end of the phase. Only an attack whose effect for its end reads `destroyedWillpower` notes anything.
import type { Amount } from "../../../catalog/boundary.ts";

import { modifiedStat } from "../../core/keywords.ts";
import { isCharacterType, printedOf } from "../../core/printed.ts";
import { heldAmount, type ScenarioState } from "../../core/state.ts";
import { readsAmount, refCard, type AmountScope } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";

/** The attack in progress damages the character `targetId`: when its effect for the end of the attack reads the destroyed character's Willpower, the character's Willpower now is kept (the latest value replaces an earlier one). */
export function noteWillpower(state: ScenarioState, targetId: string, ctx: ReduceContext): ScenarioState {
  const attack = state.pendingAttack;
  const target = state.cards[targetId];
  if (!attack?.after || !target || !readsAmount(attack.after, "destroyedWillpower") || !isCharacterType(printedOf(ctx.cards, target.code))) return state;
  const kept = state.modifiers.filter((modifier) => !(modifier.instanceId === targetId && modifier.stat === "lastWillpower"));
  return { ...state, modifiers: [...kept, { instanceId: targetId, sourceId: attack.enemyId, stat: "lastWillpower", amount: modifiedStat(state, target, "willpower", ctx.cards), until: "endOfPhase" }] };
}

/** The amount `destroyedWillpower`: the Willpower kept for the other card of the effect (the character the attack destroyed), 0 when none was kept. Null for any other amount. */
export function destroyedWillpowerAmount(state: ScenarioState, found: Exclude<Amount, number>, scope: AmountScope): number | null {
  if (!found.destroyedWillpower) return null;
  const id = refCard(state, "other", scope);
  return id ? heldAmount(state, id, "lastWillpower") : 0;
}
