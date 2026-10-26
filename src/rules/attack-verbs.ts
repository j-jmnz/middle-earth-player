// Rules: rr.lasting-effects, rr.modifiers (data/rules/entries.json).
import type { Instruction } from "../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "./amounts.ts";
import { characters } from "./combat.ts";
import { hasTrait } from "./conditions.ts";
import type { EngineStep } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { pickCandidates } from "./pick.ts";
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
    // The character defending the attack in progress (141052:A:2).
    case "defender":
      targets = state.pendingAttack?.defenderId && !state.pendingAttack.undefended ? [state.pendingAttack.defenderId] : [];
      break;
    // Every ally, now and entering play later, until the effect ends: an encounter card's lasting effect (rr.lasting-effects,
    // 141071:A:1). The holder is the class, read by modifiedStat.
    case "allies":
      targets = [ALLIES_CLASS];
      break;
    // The card the answered event was about ("that ally gets +2 Attack"), the source's host.
    case "subject":
    case "host": {
      const id = refCard(state, instruction.target, frameScope(state, focus.seat, sourceId));
      targets = id ? [id] : [];
      break;
    }
    // A number a seat holds (the cards it draws in the resource phase): the actor's, or the picked player's.
    case "actorSeat":
      targets = [`seat:${focus.seat}`];
      break;
    case "pickedSeat": {
      const seat = seatOf(lastPicked(state));
      targets = seat == null ? [] : [`seat:${seat}`];
      break;
    }
    default:
      targets = [sourceId];
  }
  // "Each Dwarf character gets +1 Willpower until the end of the phase": the holders are the cards that match now.
  if (instruction.holders) targets = pickCandidates(state, instruction.holders, focus.seat, [], sourceId, ctx);
  // "+X Attack, where X is the discarded card's cost": X is read from the frame once, and so is any other amount.
  const data = topFrame(state)?.data;
  const scope = frameScope(state, focus.seat, sourceId);
  const base = resolveAmount(state, instruction.amount, scope, ctx);
  const amount = instruction.per === "x" ? base * (data?.kind === "effect" ? (data.x ?? 0) : 0) : base;
  let next = state;
  const trait = instruction.trait;
  for (const id of targets) {
    if (trait != null && !id.startsWith("seat:") && !hasTrait(next, id, trait, ctx)) continue;
    if (id.startsWith("seat:")) next = { ...next, modifiers: [...next.modifiers, { instanceId: id, sourceId, stat: instruction.stat, amount, until: instruction.until }] };
    else next = id === ALLIES_CLASS
      ? addClassModifier(next, ALLIES_CLASS, sourceId, instruction.stat, amount, instruction.until)
      : addModifier(next, id, sourceId, instruction.stat, amount, instruction.until);
  }
  return next;
}
