// Rules: dcce.ship-enemies, dcce.ship-objectives, rr.ownership-and-control, rr.destroy (data/rules/entries.json); ledger line 12125:A:3. "Response: After Corsair Skirmisher is destroyed as an enemy, the
// engaged player may discard allies he controls with a total of at least 3 Willpower to take control of Corsair Skirmisher as a Ship-Objective with Willpower equal to its Threat. (It loses the Ship-Enemy
// card type and gains the Ship-Objective card type.)" The Response is the engaged player's (`answeredBy`), offered while their allies total enough Willpower (the condition alliesWillpower). DiscardAlliesForWillpower
// asks for the allies one at a time and discards them once they total enough; TakeControlAsShip then takes the card from the discard pile it was destroyed to and puts it into play as a new card: the code
// `<code>~ship` (rules/core/printed.ts), a Ship-objective with Willpower equal to the enemy's Threat, its Attack, Defense and hit points, and no damage (a destroyed enemy keeps none). The card is an enemy again the
// moment it is out of play (restoreShipEnemies), so it is shuffled back or revealed as the enemy it is when the encounter discard pile is reshuffled; destroyed as a Ship-objective it is a destroyed character, not
// a destroyed enemy, and its Response does not trigger again.
import type { Instruction } from "../../../catalog/boundary.ts";

import { askTarget } from "../../windows/choices.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { destroyCard, modifiedStat } from "../../core/keywords.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { fallenBase, isShipObjectiveCode, shipObjectiveCode } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

type Discard = Extract<Instruction, { verb: "DiscardAlliesForWillpower" }>;

// The allies a seat controls in play, as the Skirmisher (an encounter card, so a ship's "Immune to player card effects" does not bar it) sees them. Ship-objectives "are considered to be allies (and
// characters) for all purposes" (dcce.ship-objectives), so a controlled ship, the Dream-chaser included, may be discarded for its Willpower.
function alliesOf(state: ScenarioState, seat: number, sourceId: string | null, ctx: ReduceContext): string[] {
  return pickCandidates(state, { type: "ally", control: "you" }, seat, [], sourceId, ctx);
}

const willpowerOf = (state: ScenarioState, id: string, ctx: ReduceContext): number => {
  const card = state.cards[id];
  return card ? modifiedStat(state, card, "willpower", ctx.cards) : 0;
};

/** The condition alliesWillpower: the allies the seat controls total at least `min` Willpower. */
export function alliesWillpowerHolds(state: ScenarioState, seat: number, min: number, sourceId: string | null, ctx: ReduceContext): boolean {
  return alliesOf(state, seat, sourceId, ctx).reduce((sum, id) => sum + willpowerOf(state, id, ctx), 0) >= min;
}

/** DiscardAlliesForWillpower: the actor chooses allies they control until their Willpower totals at least `willpower`, then they are discarded together. With too few allies to reach it, nothing is discarded and the instructions after it do not run (the discard is a cost). */
export function discardAlliesForWillpower(state: ScenarioState, instruction: Discard, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const taken = [...(instruction.taken ?? [])];
  let answer = focus.chosen;
  for (;;) {
    if (answer && !taken.includes(answer)) taken.push(answer);
    answer = undefined;
    if (taken.reduce((sum, id) => sum + willpowerOf(state, id, ctx), 0) >= instruction.willpower) break;
    const options = alliesOf(state, focus.seat, focus.sourceId, ctx).filter((id) => !taken.includes(id));
    // Too few allies to reach the total: the discard, a cost, is not paid, so the instructions after it (TakeControlAsShip) are dropped.
    if (options.length === 0) return dropQueued(state);
    // The last ally left is the only choice.
    if (options.length === 1) {
      answer = options[0];
      continue;
    }
    const cause = currentCause(steps, UNATTRIBUTED);
    return effectData(state) ? askTarget(state, { instruction: { ...instruction, taken }, seat: focus.seat, chosen: null, cause }, options) : state;
  }
  return taken.reduce((next, id) => destroyCard(next, id, ctx.cards, steps), state);
}

// The instructions still queued in the running effect frame are dropped.
function dropQueued(state: ScenarioState): ScenarioState {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" && data.queue.length > 0 ? patchTop(state, { data: { ...data, queue: [] } }) : state;
}

/** TakeControlAsShip: the source Ship enemy, in the discard pile it was destroyed to, goes into play under the actor as a Ship-objective. */
export function takeControlAsShip(state: ScenarioState, focus: Focus): ScenarioState {
  const id = focus.sourceId;
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || isShipObjectiveCode(card.code) || (card.zone !== "encounterDiscard" && card.zone !== "corsairDiscard")) return state;
  const moved = moveCard(state, id, { zone: "play", seat: focus.seat });
  return updateCard(moved, id, { code: shipObjectiveCode(card.code), face: "up", damage: 0, exhausted: false, progress: 0, resources: 0 });
}

/** The settle sweep: a Ship-objective made from an enemy that is out of play is the enemy again. */
export function restoreShipEnemies(state: ScenarioState): ScenarioState {
  let next = state;
  for (const card of Object.values(state.cards)) {
    if (isShipObjectiveCode(card.code) && !inPlay(card.zone)) next = updateCard(next, card.id, { code: fallenBase(card.code) });
  }
  return next;
}
