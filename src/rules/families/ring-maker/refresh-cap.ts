// Rules: rr.refresh-phase, rr.the-word-choose, rr.cannot (data/rules/entries.json); ledger line 07036:A:1.
// Heart of Fangorn: "each player cannot refresh more than 5 characters during the refresh phase". Its Forced effect at the beginning of the refresh phase runs this verb for each player: the exhausted characters the player controls beyond the cap are chosen by that player and stay exhausted
// (`doesNotReady` until the end of the phase, which the refresh step already reads), so the engine's refresh step needs no change.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { addModifier } from "../../core/modified-stat.ts";
import { isCharacterType, printedOf } from "../../core/printed.ts";
import { flagged, inPlay, type ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData } from "../encounter/moves.ts";
import { queueFront } from "../play/refs.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The exhausted characters the seat controls that the refresh step would ready: not held down by an effect already. */
function readying(state: ScenarioState, seat: number, ctx: ReduceContext): string[] {
  return Object.values(state.cards)
    .filter((card) => inPlay(card.zone) && card.controller === seat && card.exhausted && isCharacterType(printedOf(ctx.cards, card.code)) && !flagged(state, card.id, "doesNotReady") && !flagged(state, card.id, "cannotReady"))
    .map((card) => card.id);
}

/**
 * CapRefresh: the characters the actor controls that would ready are `readying`. With more than `amount` of them the actor holds one back at a time, chosen among all of them that would still ready (asked once for each character held back, the last one too; with no effect
 * frame to ask in, the first one is held). Each holds `doesNotReady` until the end of the phase and leaves `readying`, so the choices stop when `amount` remain and a second Heart of Fangorn finds the cap met and holds none more. With `amount` or fewer to ready nothing happens.
 */
export function capRefresh(state: ScenarioState, instruction: Verb<"CapRefresh">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const seat = focus.seat;
  const options = readying(state, seat, ctx);
  if (options.length <= instruction.amount) return state;
  const chosen = focus.chosen != null && options.includes(focus.chosen) ? focus.chosen : !effectData(state) ? options[0] : undefined;
  if (chosen == null) return askTarget(state, { instruction, seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options);
  const next = addModifier(state, chosen, focus.sourceId ?? chosen, "doesNotReady", 1, "endOfPhase");
  return options.length - 1 > instruction.amount ? queueFront(next, [{ instruction, seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }]) : next;
}
