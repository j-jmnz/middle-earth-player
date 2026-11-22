// Rules: rr.triggered-ability, rr.cost, rr.then, rr.initiating-abilities-playing-cards (data/rules/entries.json).
// Whether an ability that a player triggers can change the game state: "A triggered ability on a player card can only be initiated if its effect has the potential
// to change the game state on its own" and "An ability's cost cannot be paid if the resolution of its effect does not have the potential to change the game state".
// The potential is read from the state as it is before the cost is paid. Two functions read an effect differently, because the rules check different things at different steps:
// - noTargetReason reads every instruction of an event's Action (an event's play, planning.ts, and the Action lists of families/deck/play.ts and families/encounter/items.ts): an event's
//   targets are chosen as it is played, step 5 of rr.initiating-abilities-playing-cards, so each choice it makes must have a candidate before it is declared.
// - noChangeReason reads only the first instruction of an Action or a Response on a card in play (usage.ts), except for an effect whose every instruction is idle: a later instruction can
//   depend on it ("Then", rr.then) or be a choice made as the effect resolves, and an ability that does something else after its first instruction has the potential to change the game state.
// An instruction is idle (`idleInstruction`) when the state shows it cannot change the game: a Draw from an empty deck (rr.running-out-of-cards) or of 0 cards, a Ready of a ready card, a Heal of a
// card with no damage, an Each over no card, a ForEachPlayer whose every player has an idle step, a move of resources with no hero to take them (rr.move), a stat change of 0. Whatever the
// state cannot settle is not idle: when in doubt, the ability is offered. A step with `when: thenResolves` after a Draw from an empty deck is not attempted (rr.then).
import type { Amount, Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { isPlayerCardEffect } from "../core/keywords.ts";
import type { CardInstance, GameEvent, ScenarioState } from "../core/state.ts";
import { targetCandidates } from "../interpret/effect-verbs.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { holds } from "../interpret/conditions.ts";
import { resolveAmount, type AmountScope } from "../interpret/amounts.ts";
import { pickCandidates, seatsOf } from "../interpret/pick.ts";
import { livingSeats } from "../core/state.ts";
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
 * Why one Action of an event would change nothing, or null: every instruction of it is idle (see the header). A card with two Actions to choose from is played when one of them is not idle, so the caller
 * reads each Action alone and refuses the card only when none is left.
 */
export function idleEventReason(state: ScenarioState, instructions: readonly Instruction[], cardId: string, seat: number, ctx: ReduceContext): string | null {
  return allIdle(state, instructions, cardId, seat, ctx, { actor: seat, sourceId: cardId }, true) ? IDLE : null;
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

const IDLE = "That effect would change nothing";

// The amount kinds read from the effect as it resolves (its X, the damage it answers) are not read here.
function settledAmount(amount: Amount): boolean {
  return typeof amount === "number" || (!amount.x && !amount.dealt && !amount.excess && !amount.resourcesOn);
}

/** The card a Ready or a Heal names when it is the host or the source itself, or undefined for any other target (not read here). */
function namedCard(state: ScenarioState, target: string | { kind: string } | undefined, source: CardInstance, bare: "self" | "picked"): CardInstance | null | undefined {
  if (target === "host") return source.host ? (state.cards[source.host] ?? null) : null;
  if (target === "self" || (target == null && bare === "self")) return source;
  return undefined;
}

/** Whether a condition on a step reads only the table, so that it holds the same outside the running effect. */
function readsTable(condition: Condition): boolean {
  return condition.kind === "threat" || condition.kind === "count" || condition.kind === "canPick" || condition.kind === "phase";
}

/** Whether the instruction cannot change the game state as the table stands (see the header); false when it cannot be told. `short` is set when a Draw found no card to draw. */
function idleInstruction(state: ScenarioState, instruction: Instruction, sourceId: string, seat: number, ctx: ReduceContext, scope: AmountScope, mark: { short: boolean; event: boolean }): boolean {
  const source = state.cards[sourceId];
  if (!source) return false;
  if ("when" in instruction && instruction.when != null) return mark.short && instruction.when.kind === "thenResolves";
  switch (instruction.verb) {
    case "Ready": {
      const card = namedCard(state, instruction.target, source, "self");
      return !mark.event && card != null && !card.exhausted;
    }
    case "Heal": {
      const card = namedCard(state, instruction.target, source, "picked");
      return !mark.event && card != null && card.damage <= 0;
    }
    case "Draw": {
      const target = instruction.who == null || instruction.who === "actor" ? seat : instruction.who === "firstPlayer" ? state.firstPlayer : null;
      if (target == null) return false;
      if ((state.seats[target]?.deck.length ?? 0) === 0) {
        mark.short = true;
        return true;
      }
      return instruction.perHero == null && instruction.amount != null && settledAmount(instruction.amount) && resolveAmount(state, instruction.amount, scope, ctx) <= 0;
    }
    case "Repeat": {
      // "Discard the top 3 cards of your deck" of an empty deck.
      if (!instruction.instructions.every((step) => step.verb === "DiscardTopOfDeck") || (state.seats[seat]?.deck.length ?? 0) > 0) return false;
      mark.short = true;
      return true;
    }
    case "Each": {
      if (instruction.upTo != null) return false;
      return pickCandidates(state, instruction.pick, seat, [], sourceId, ctx, scope.x, scope.participants, false, { subject: scope.subject ?? null, other: scope.other ?? null }).length === 0;
    }
    case "ForEachPlayer": {
      if (instruction.seats != null) return false;
      return livingSeats(state).every((each) => instruction.instructions.every((step) => {
        if (step.verb === "ReadyAll" && step.when != null && readsTable(step.when)) return !holds(state, step.when, { actor: each, sourceId, returned: 0 }, ctx);
        return false;
      }));
    }
    default:
      return false;
  }
}

/** Whether every instruction of the list is idle: the first alone, and each later one idle or a "Then" part that the first one's empty Draw keeps from resolving. */
function allIdle(state: ScenarioState, instructions: readonly Instruction[], sourceId: string, seat: number, ctx: ReduceContext, scope: AmountScope, event = false): boolean {
  const mark = { short: false, event };
  return instructions.length > 0 && instructions.every((instruction) => idleInstruction(state, instruction, sourceId, seat, ctx, scope, mark));
}

/** A Pick for a move of resources with no hero left to take them (rr.move), or a stat change of 0 that follows the picks: the effect has nothing to change. */
function pickedStepsIdle(state: ScenarioState, instructions: readonly Instruction[], candidates: readonly string[], sourceId: string, seat: number, ctx: ReduceContext, scope: AmountScope): boolean {
  const steps = instructions.slice(1);
  const second = steps[0];
  if (second?.verb === "Pick" && steps.some((step) => step.verb === "MoveResources")) {
    return candidates.every((from) => pickCandidates(state, second.pick, seat, [from], sourceId, ctx).length === 0);
  }
  const act = steps.find((step) => step.verb !== "Pick");
  if (act?.verb === "ModifyStat" && act.when == null && typeof act.amount === "object" && act.amount.stat != null && settledAmount(act.amount)) {
    return resolveAmount(state, act.amount, scope, ctx) === 0;
  }
  return false;
}

/** Why a Trigger of a player card's Action or Response cannot change the game state, or null. `event` is the one a Response answers. */
export function noChangeReason(state: ScenarioState, effect: Effect, sourceId: string, seat: number, ctx: ReduceContext, event?: GameEvent): string | null {
  if ((effect.timing !== "action" && effect.timing !== "response")) return null;
  // An encounter card's ability is the game's, not a player card effect (rr.triggered-ability speaks of player cards).
  if (!isPlayerCardEffect(state, ctx.cards, sourceId)) return null;
  const first = effect.instructions[0];
  const source = state.cards[sourceId];
  if (!first || !source || ("when" in first && first.when != null)) return null;
  const about = event ? aboutCard(event) : undefined;
  const scope: AmountScope = { actor: seat, sourceId, subject: about ?? null, other: event?.other ?? null, ...(event?.participants ? { participants: event.participants } : {}) };
  if (allIdle(state, effect.instructions, sourceId, seat, ctx, scope)) return IDLE;
  if (first.verb !== "Pick") return null;
  const pick = first.pick;
  // A search of a deck with no card in it finds nothing and shuffles nothing; with cards in it, it may find none and still shuffle (rr.search).
  if (pick.from === "deck" && !pick.looked) return seatsOf(state, pick, seat).every((index) => deckPool(state, index, pick).length === 0) ? "That card has no legal target" : null;
  if (searchOrLaterPick(pick, first.when)) return null;
  const found = pickCandidates(state, pick, seat, [], sourceId, ctx, event?.amount, event?.participants, false, event ? { subject: about ?? null, other: event.other ?? null } : undefined);
  if (found.length === 0) return "That card has no legal target";
  return pickedStepsIdle(state, effect.instructions, found, sourceId, seat, ctx, scope) ? IDLE : null;
}
