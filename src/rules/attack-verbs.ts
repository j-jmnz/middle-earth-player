// Rules: rr.lasting-effects, rr.modifiers (data/rules/entries.json).
import type { Instruction } from "../catalog/boundary.ts";

import { characters } from "./combat.ts";
import { hasTrait } from "./conditions.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { lastPicked, seatOf } from "./player-verbs.ts";
import { topFrame } from "./windows.ts";
import { addClassModifier, addModifier, ALLIES_CLASS } from "./keywords.ts";
import type { ScenarioState } from "./state.ts";
import { livingSeats } from "./state.ts";
import type { VerbFocus } from "./verbs.ts";
import { moveCard } from "./zones.ts";
import { currentCause, UNATTRIBUTED } from "./cause.ts";

// Verbs that read or change the enemy attack in progress.
export function runAttackVerb(state: ScenarioState, instruction: Instruction, focus: VerbFocus, steps: EngineStep[]): ScenarioState {
  const attack = state.pendingAttack;
  switch (instruction.verb) {
    case "ConsiderUndefended":
      return attack ? { ...state, pendingAttack: { ...attack, undefended: true } } : state;
    case "AfterAttack":
      return attack ? { ...state, pendingAttack: { ...attack, after: [...(attack.after ?? []), ...instruction.instructions], afterCause: currentCause(steps, UNATTRIBUTED) } } : state;
    case "EngageNextPlayer": {
      const enemy = focus.sourceId ? state.cards[focus.sourceId] : undefined;
      if (!focus.sourceId || enemy?.zone !== "engaged" || enemy.controller == null) return state;
      // With no other player there is no next player to engage (faq.next-player).
      const seats = livingSeats(state);
      const at = seats.indexOf(enemy.controller);
      const next = seats[(at + 1) % seats.length];
      if (next == null || next === enemy.controller) return state;
      steps.push({ kind: "engage", seat: next, enemyId: focus.sourceId });
      return moveCard(state, focus.sourceId, { zone: "engaged", seat: next });
    }
    default:
      return state;
  }
}

// A stat change goes on the source card, on the attacker while an enemy attack is in progress, or on the cards a Pick
// chose or the seat it names. A lasting effect from a player card holds for the cards in play when it resolves
// (rr.lasting-effects), so each card gets its own record.
export function modifyStat(
  state: ScenarioState,
  instruction: Extract<Instruction, { verb: "ModifyStat" }>,
  focus: VerbFocus,
  ctx: ReduceContext,
): ScenarioState {
  const sourceId = focus.sourceId;
  if (!sourceId) return state;
  let targets: string[];
  switch (instruction.target) {
    case "attacker":
      targets = state.pendingAttack ? [state.pendingAttack.enemyId] : [];
      break;
    case "picked":
      targets = [lastPicked(state)];
      break;
    case "pickedPlayerCharacters": {
      const seat = seatOf(lastPicked(state));
      targets = seat == null ? [] : characters(state, seat, ctx.cards);
      break;
    }
    case "ownHeroes":
      targets = [...(state.seats[focus.seat]?.heroes ?? [])];
      break;
    // The character defending the attack in progress (141052:A:2). With several defenders (Stand Together), the first
    // declared: rr.multiple-defenders does not say which "the defending character" is, an open reading in the brief.
    case "defender":
      targets = state.pendingAttack?.defenderId && !state.pendingAttack.undefended ? [state.pendingAttack.defenderId] : [];
      break;
    // Every ally, now and entering play later, until the effect ends: an encounter card's lasting effect (rr.lasting-effects,
    // 141071:A:1). The holder is the class, read by modifiedStat.
    case "allies":
      targets = [ALLIES_CLASS];
      break;
    // The card the source is attached to ("give attached hero +1 Defense", 01070:A:2).
    case "host": {
      const host = state.cards[sourceId]?.host;
      targets = host ? [host] : [];
      break;
    }
    // Every character in play now ("all characters get +1 Attack", 01022:A:1, rr.lasting-effects).
    case "allCharacters":
      targets = livingSeats(state).flatMap((seat) => characters(state, seat, ctx.cards));
      break;
    // A flag the picked player holds ("That player may declare any number of ... defenders", 01038:A:1).
    case "pickedPlayer": {
      const seat = seatOf(lastPicked(state));
      return seat == null ? state : { ...state, modifiers: [...state.modifiers, { instanceId: `seat:${seat}`, sourceId, stat: instruction.stat, amount: instruction.amount, until: instruction.until, seat }] };
    }
    default:
      targets = [sourceId];
  }
  // "+X Attack, where X is the discarded card's cost": X is read from the frame once.
  const data = topFrame(state)?.data;
  const amount = instruction.per === "x" ? instruction.amount * (data?.kind === "effect" ? (data.x ?? 0) : 0) : instruction.amount;
  let next = state;
  const trait = instruction.trait;
  for (const id of targets) {
    if (trait != null && !hasTrait(next, id, trait, ctx)) continue;
    next = id === ALLIES_CLASS
      ? addClassModifier(next, ALLIES_CLASS, sourceId, instruction.stat, amount, instruction.until)
      : addModifier(next, id, sourceId, instruction.stat, amount, instruction.until);
  }
  return next;
}
