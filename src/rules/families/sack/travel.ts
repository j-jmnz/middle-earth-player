// Rules: rr.travel, rr.resources (data/rules/entries.json); ledger line 131037:A:2. Troll Cave's travel cost: Baggins resources from Bilbo Baggins' pool, owed only while he holds the Troll Key.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";

type Verb = Pick<Extract<Instruction, { verb: "SpendBagginsToTravel" }>, "amount" | "reduced" | "key" | "purse">;

const BILBO = "Bilbo Baggins";

/** Bilbo Baggins in play, any player's hero. */
function bilbo(state: ScenarioState, ctx: ReduceContext): CardInstance | undefined {
  for (const seat of Object.values(state.seats)) for (const id of seat.heroes) if (printedOf(ctx.cards, state.cards[id]?.code ?? "").name === BILBO) return state.cards[id];
  return undefined;
}

function holds(state: ScenarioState, host: CardInstance, code: string): boolean {
  return host.attachments.some((id) => state.cards[id]?.code === code);
}

/** What Bilbo owes: `reduced` with the Purse attached, otherwise `amount`; null while he is not in play or has no Key attached. */
function owed(state: ScenarioState, instruction: Verb, ctx: ReduceContext): { host: CardInstance; cost: number } | null {
  const host = bilbo(state, ctx);
  if (!host || !holds(state, host, instruction.key)) return null;
  return { host, cost: holds(state, host, instruction.purse) ? instruction.reduced : instruction.amount };
}

/** Whether the players can pay the travel cost now: Bilbo has the Troll Key attached and his pool holds the cost. */
export function canPayTravel(state: ScenarioState, condition: { amount: number; reduced: number; key: string; purse: string }, ctx: ReduceContext): boolean {
  const due = owed(state, condition, ctx);
  return due != null && due.host.resources >= due.cost;
}

export function spendBaggins(state: ScenarioState, instruction: Verb, ctx: ReduceContext): ScenarioState {
  const due = owed(state, instruction, ctx);
  return due == null || due.host.resources < due.cost ? state : updateCard(state, due.host.id, { resources: due.host.resources - due.cost });
}
