// Rules: hob.venom-poison (data/rules/entries.json); ledger line 132034:A:1.
import type { Amount } from "../../../catalog/boundary.ts";

import type { AmountScope } from "../../interpret/amounts.ts";
import { refCard } from "../../interpret/amounts.ts";
import type { ScenarioState } from "../../core/state.ts";
import { poisonOf } from "./poison.ts";

/** The amount `poison`: the poison under the card the reference names, 0 with no card. Null for any other amount. */
export function poisonAmount(state: ScenarioState, amount: Exclude<Amount, number>, scope: AmountScope): number | null {
  if (amount.poison == null) return null;
  const id = refCard(state, amount.poison, scope);
  return id ? poisonOf(state, id) : 0;
}
