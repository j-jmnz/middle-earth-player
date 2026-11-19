// Rules: rr.the-word-choose, rr.discard-pile-and-victory-display, rr.printed (data/rules/entries.json); ledger line 901701:A:2.
//
// "Each player must also discard allies he controls until the total printed cost of allies he controls is 6 or less": the actor chooses one ally at a time (a card with no printed cost counts 0) and the verb comes round again until the allies cost no more than the number.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { askTarget } from "../../windows/choices.ts";
import { characters } from "../../combat/combat.ts";
import { queueFront } from "../play/refs.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** DiscardAlliesToCost: see the schema entry. */
export function discardAlliesToCost(state: ScenarioState, instruction: Verb<"DiscardAlliesToCost">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const cost = (id: string) => printedOf(ctx.cards, state.cards[id]?.code ?? "").cost ?? 0;
  const allies = characters(state, focus.seat, ctx.cards).filter((id) => state.cards[id]?.zone === "play" && printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "ally");
  if (allies.reduce((sum, id) => sum + cost(id), 0) <= instruction.cost) return state;
  const cause = currentCause(steps, UNATTRIBUTED);
  const chosen = focus.chosen && allies.includes(focus.chosen) ? focus.chosen : undefined;
  if (!chosen) return askTarget(state, { instruction, seat: focus.seat, chosen: null, cause }, allies);
  const owner = state.cards[chosen]?.owner ?? focus.seat;
  return queueFront(moveCard(state, chosen, { zone: "discard", seat: owner }), [{ instruction, seat: focus.seat, chosen: null, cause }]);
}
