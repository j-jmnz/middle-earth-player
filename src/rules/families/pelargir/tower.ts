// Rules: rr.in-play-and-out-of-play, rr.removed-from-game, rr.objective-cards, ats.setup-the-morgul-vale-to-the-tower (data/rules/entries.json); ledger lines 06147:A:2, 06149:A:2, 06150:A:2, 06152:A:1.
// The two verbs of The Morgul Vale that work on a card by its title: progress tokens placed on To the Tower, and every copy of Faramir removed from the game at Setup.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { isPlayerType, printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { placeProgress } from "../../interpret/effect-verbs.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { namedInPlay } from "../misc/amounts.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** PlaceProgressOnNamed: `amount` progress tokens go on the card in play with the title, in one placement (the engine's own, so the cards that hear progress placed hear it once). Nothing happens with no such card in play. */
export function placeProgressOnNamed(state: ScenarioState, instruction: Verb<"PlaceProgressOnNamed">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = namedInPlay(state, instruction.name, ctx);
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  return id == null || amount <= 0 ? state : placeProgress(state, id, amount, ctx, steps);
}

/** RemoveAllNamedFromGame: each player card with the title, whatever zone it lies in, goes out of the game with the cards attached to it; no leaving of play is announced ("no version of Faramir can be used by the players"). */
export function removeAllNamedFromGame(state: ScenarioState, instruction: Verb<"RemoveAllNamedFromGame">, ctx: ReduceContext): ScenarioState {
  const found = Object.values(state.cards).filter((card) => card.zone !== "removed" && isPlayerType(printedOf(ctx.cards, card.code)) && printedOf(ctx.cards, card.code).name === instruction.name);
  const gone = new Set(found.flatMap((card) => [card.id, ...card.attachments]));
  let next = state;
  for (const id of gone) next = moveCard(next, id, { zone: "removed" });
  return gone.size === 0 ? state : { ...next, pendingEvents: (next.pendingEvents ?? []).filter((event) => !(event.trigger === "leftPlay" && event.cardId != null && gone.has(event.cardId))) };
}
