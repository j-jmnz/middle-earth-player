// Rules: emce.campaign-pool-encounter (data/rules/entries.json); ledger line 12167:A:2. "Set aside the topmost non-unique, non-objective, non-burden encounter card in the encounter discard pile. During quest resolution, add a copy of
// that card to the campaign pool, if able." The card is set aside and the Resolution is told to add a copy of it to the pool.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { Focus } from "../index.ts";
import { printedOf } from "../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";

/**
 * SetAsideDiscardForPool: the most recently discarded card of the encounter discard pile that is none of the `exclude` kinds goes out of play, set aside facedown, and the Resolution (state.resolution) gets an AddEncounterToPool of its code after the
 * campaign card's own lines. "If able" is the log's cap at the copies one collection holds. The Evil Creatures discard pile is not the encounter discard pile, so an enemy from that deck is not found here.
 */
export function setAsideDiscardForPool(state: ScenarioState, instruction: Extract<Instruction, { verb: "SetAsideDiscardForPool" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const barred = new Set(instruction.exclude);
  const id = [...state.encounterDiscard].reverse().find((candidate) => {
    const printed = printedOf(ctx.cards, state.cards[candidate]?.code ?? "");
    return !(barred.has("unique") && printed.isUnique) && !(barred.has("objective") && printed.type === "objective") && !(barred.has("burden") && printed.campaignKind === "burden");
  });
  const card = id ? state.cards[id] : undefined;
  if (!id || !card) return state;
  const aside = updateCard(moveCard(state, id, { zone: "setAside" }), id, { face: "down", controller: null });
  if (focus.sourceId) steps.push({ kind: "setAsideForPool", sourceId: focus.sourceId, cardId: id, cause: currentCause(steps, UNATTRIBUTED) });
  return { ...aside, resolution: [...aside.resolution, { verb: "AddEncounterToPool", codes: [card.code] }] };
}
