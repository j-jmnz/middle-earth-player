// Rules: rr.cancel, rr.damage (data/rules/entries.json); ledger line 12166:A:2. "The next time that character would be dealt damage this round, cancel 1 of that damage": a character holding the flag damageShield (a ModifyStat that lasts
// until the end of the round or the phase) has that many points of the next damage placed on it canceled, and the flag is spent. Pure.
import type { ScenarioState } from "../../core/state.ts";
import { modifierActive, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";

/** The damage left after the shields of the card, and the state with the shields it used up taken off. */
export function damageShield(state: ScenarioState, id: string, amount: number): { state: ScenarioState; amount: number } {
  if (amount <= 0) return { state, amount };
  const shields = state.modifiers.filter((modifier) => modifier.stat === "damageShield" && modifier.instanceId === id && modifierActive(state, modifier));
  if (shields.length === 0) return { state, amount };
  let left = amount;
  for (const shield of shields) left = Math.max(0, left - shield.amount);
  return { state: { ...state, modifiers: state.modifiers.filter((modifier) => !shields.includes(modifier)) }, amount: left };
}

/**
 * The flag cancelsDamage, granted to the host by a constant of Dragon Scales (18059:A:2: "When attached enemy would take any amount of damage, cancel all of that damage. Then, discard Dragon Scales"): the damage that
 * would be placed on the card is canceled, and the card granting the flag goes to the encounter discard pile. The state after, or null when the card holds no such flag or no damage would be placed.
 */
export function cancelAllDamage(state: ScenarioState, id: string, amount: number): ScenarioState | null {
  if (amount <= 0) return null;
  const grant = state.modifiers.find((modifier) => modifier.stat === "cancelsDamage" && modifier.instanceId === id && modifierActive(state, modifier));
  const source = grant ? state.cards[grant.sourceId] : undefined;
  return source ? updateCard(moveCard(state, source.id, { zone: "encounterDiscard" }), source.id, { face: "up", controller: null, host: null }) : null;
}
