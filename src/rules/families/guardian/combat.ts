// Rules: sotm.guarding-gollum, ltp.undefended-attack (data/rules/entries.json); ledger line 02130:A:1.
//
// "Damage from undefended attacks against you must be dealt to Gollum": the characters an undefended attack's damage goes to are only the card that holds `undefendedToHolder` and its attacked player controls. The damage a shadow effect or a treachery deals itself (Gollum's Bite,
// Hummerhorns) is not the attack's damage and is not sent there (agent recommendation, docs/brief.md, Return to Mirkwood).
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";

const NONE: readonly string[] = [];

/** The `combat.undefended` hook: the card that must take the attacked player's undefended damage, or none. */
export function undefendedHolders(state: ScenarioState): readonly string[] {
  const seat = state.pendingAttack?.seat;
  if (seat == null || state.modifiers.length === 0) return NONE;
  for (const modifier of state.modifiers) {
    if (modifier.stat !== "undefendedToHolder") continue;
    const card = state.cards[modifier.instanceId];
    if (card && card.zone === "play" && card.controller === seat && flagged(state, card.id, "undefendedToHolder")) return [card.id];
  }
  return NONE;
}
