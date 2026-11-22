// Rules: rr.triggered-ability, rr.cost, rr.then, rr.initiating-abilities-playing-cards (data/rules/entries.json).
// Whether an ability that a player triggers can change the game state: "A triggered ability on a player card can only be initiated if its effect has the potential
// to change the game state on its own" and "An ability's cost cannot be paid if the resolution of its effect does not have the potential to change the game state".
// The potential is read from the state as it is before the cost is paid. Two functions read an effect differently, because the rules check different things at different steps:
// - noTargetReason reads every instruction of an event's Action (an event's play, planning.ts, and the Action lists of families/deck/play.ts and families/encounter/items.ts): an event's
//   targets are chosen as it is played, step 5 of rr.initiating-abilities-playing-cards, so each choice it makes must have a candidate before it is declared.
// - noChangeReason reads only the first instruction of an Action or a Response on a card in play (usage.ts): a later instruction can depend on it ("Then", rr.then) or be a
//   choice made as the effect resolves, and an ability that does something else after its first instruction has the potential to change the game state.
import type { Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";
import { costOfKind } from "../../catalog/costs.ts";

import { isPlayerCardEffect } from "../core/keywords.ts";
import type { GameEvent, ScenarioState } from "../core/state.ts";
import { targetCandidates } from "../interpret/effect-verbs.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { pickCandidates, seatsOf } from "../interpret/pick.ts";
import { deckPool } from "../families/uncharted/pick.ts";
import { aboutCard } from "../windows/listen.ts";

/**
 * A Pick that does not keep an event from being played when it finds nothing: one that depends on an earlier pick, a search of a deck or of the cards the effect looked at
 * (rr.search: a search is not a target, and finding nothing still resolves), or one made only if a condition holds when the effect resolves.
 */
export function searchOrLaterPick(pick: PickSpec, when: unknown): boolean {
  return pick.different === true || pick.attackableByPicked === true || pick.from === "deck" || pick.looked === true || when != null;
}

/**
 * Why an event's instructions have nothing to act on, or null. A target the effect must choose (a bar on an engaged enemy, progress on a location, a Pick that is not a
 * search) with no candidate is "no valid target" (rr.the-word-choose); a search finds what it finds, and a later or conditional choice is made as the effect resolves (rr.search).
 */
export function noTargetReason(state: ScenarioState, instructions: readonly Instruction[], cardId: string, seat: number, ctx: ReduceContext): string | null {
  for (const instruction of instructions) {
    // "Choose an enemy engaged with a player" with none engaged (Feint): there is no valid target (rr.the-word-choose).
    if ((instruction.verb === "BarAttack" || instruction.verb === "PlaceProgressOnLocation") && !instruction.when) {
      if (targetCandidates(state, instruction, seat, ctx).length === 0) return "That card has no legal target";
      continue;
    }
    if (instruction.verb !== "Pick" || searchOrLaterPick(instruction.pick, instruction.when)) continue;
    if (pickCandidates(state, instruction.pick, seat, [], cardId, ctx).length === 0) return "That card has no legal target";
  }
  return null;
}

/** Whether the card a Ready names is ready already: the host, or the source itself (no target or "self"). A Ready of any other target is not read here. */
function readyTargetIsReady(state: ScenarioState, ready: Extract<Instruction, { verb: "Ready" }>, source: ScenarioState["cards"][string]): boolean {
  if (ready.target === "host") {
    const host = source.host ? state.cards[source.host] : undefined;
    return host != null && !host.exhausted;
  }
  if (ready.target == null || ready.target === "self") return !source.exhausted;
  return false;
}

/** Why a Trigger of a player card's Action or Response cannot change the game state, or null. `event` is the one a Response answers. */
export function noChangeReason(state: ScenarioState, effect: Effect, sourceId: string, seat: number, ctx: ReduceContext, event?: GameEvent): string | null {
  if ((effect.timing !== "action" && effect.timing !== "response") || costOfKind(effect, "playEvent")) return null;
  // An encounter card's ability is the game's, not a player card effect (rr.triggered-ability speaks of player cards).
  if (!isPlayerCardEffect(state, ctx.cards, sourceId)) return null;
  const first = effect.instructions[0];
  const source = state.cards[sourceId];
  if (!first || !source || ("when" in first && first.when != null)) return null;
  // Readying a card that is ready changes nothing; only an effect that does nothing else is refused.
  if (first.verb === "Ready") return effect.instructions.length === 1 && readyTargetIsReady(state, first, source) ? "That card is already ready" : null;
  if (first.verb !== "Pick") return null;
  const pick = first.pick;
  // A search of a deck with no card in it finds nothing and shuffles nothing; with cards in it, it may find none and still shuffle (rr.search).
  if (pick.from === "deck" && !pick.looked) return seatsOf(state, pick, seat).every((index) => deckPool(state, index, pick).length === 0) ? "That card has no legal target" : null;
  if (searchOrLaterPick(pick, first.when)) return null;
  const about = event ? aboutCard(event) : undefined;
  const found = pickCandidates(state, pick, seat, [], sourceId, ctx, event?.amount, event?.participants, false, event ? { subject: about ?? null, other: event.other ?? null } : undefined);
  return found.length === 0 ? "That card has no legal target" : null;
}
