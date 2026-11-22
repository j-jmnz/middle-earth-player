// Rules: rr.triggered-ability, rr.cost, rr.then (data/rules/entries.json).
// Whether an ability that a player triggers can change the game state: "A triggered ability on a player card can only be initiated if its effect has the potential
// to change the game state on its own" and "An ability's cost cannot be paid if the resolution of its effect does not have the potential to change the game state".
// An event's play (planning.ts) and a Trigger of an Action or a Response on a card in play (usage.ts) ask the same question here. The potential is read from the state
// as it is before the cost is paid, and from the effect's first instruction: a later instruction can depend on it ("Then", rr.then) or be a choice made as the effect resolves.
import type { Effect, Instruction } from "../../catalog/boundary.ts";
import { costOfKind } from "../../catalog/costs.ts";

import { isPlayerCardEffect } from "../core/keywords.ts";
import type { GameEvent, ScenarioState } from "../core/state.ts";
import { searchOrLaterPick } from "../families/deck/play.ts";
import { targetCandidates } from "../interpret/effect-verbs.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { pickCandidates } from "../interpret/pick.ts";
import { aboutCard } from "../windows/listen.ts";

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

/** Why a Trigger of a player card's Action or Response cannot change the game state, or null. `event` is the one a Response answers. */
export function noChangeReason(state: ScenarioState, effect: Effect, sourceId: string, seat: number, ctx: ReduceContext, event?: GameEvent): string | null {
  if ((effect.timing !== "action" && effect.timing !== "response") || costOfKind(effect, "playEvent")) return null;
  // An encounter card's ability is the game's, not a player card effect (rr.triggered-ability speaks of player cards).
  if (!isPlayerCardEffect(state, ctx.cards, sourceId)) return null;
  const first = effect.instructions[0];
  const source = state.cards[sourceId];
  if (!first || !source || ("when" in first && first.when != null)) return null;
  if (first.verb === "Ready") {
    // Readying a card that is ready changes nothing; only an effect that does nothing else is refused.
    const target = first.target === "host" ? (source.host ? state.cards[source.host] : undefined) : first.target == null || first.target === "self" ? source : undefined;
    return target != null && !target.exhausted && effect.instructions.length === 1 ? "That card is already ready" : null;
  }
  if (first.verb !== "Pick") return null;
  const pick = first.pick;
  // A search of a deck with no card in it finds nothing and shuffles nothing; with cards in it, it may find none and still shuffle (rr.search).
  if (pick.from === "deck" && !pick.looked) {
    const cards = pickCandidates(state, { type: "card", control: pick.control, from: "deck", ...(pick.top != null ? { top: pick.top } : {}) }, seat, [], sourceId, ctx);
    return cards.length === 0 ? "That card has no legal target" : null;
  }
  if (searchOrLaterPick(pick, first.when)) return null;
  const about = event ? aboutCard(event) : undefined;
  const found = pickCandidates(state, pick, seat, [], sourceId, ctx, event?.amount, event?.participants, false, event ? { subject: about ?? null, other: event.other ?? null } : undefined);
  return found.length === 0 ? "That card has no legal target" : null;
}
