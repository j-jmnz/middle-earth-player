// Rules: rr.lasting-effects, rr.modifiers (data/rules/entries.json).
import { isStatCondition, type Instruction } from "../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../interpret/amounts.ts";
import { characters } from "./combat.ts";
import { hasTrait } from "../interpret/conditions.ts";
import type { EngineStep } from "../core/intents.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { pickCandidates } from "../interpret/pick.ts";
import { lastPicked, seatOf } from "../interpret/player-verbs.ts";
import { topFrame } from "../windows/windows.ts";
import { addModifier } from "../core/keywords.ts";
import { addClassModifier, ALLIES_CLASS, CHARACTERS_CLASS, DAMAGED_CHARACTERS_CLASS, ENEMIES_CLASS, isClassHolder, isTraitedEnemies, isTraitedStaging, STAGING_CLASS, traitedEnemies, traitedStaging, ownCharacters } from "../core/holder-classes.ts";
import type { ScenarioState } from "../core/state.ts";
import { livingSeats } from "../core/state.ts";
import type { VerbFocus } from "../interpret/verbs.ts";
import { moveCard } from "../core/zones.ts";
import { currentCause, UNATTRIBUTED } from "../core/cause.ts";

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
    // Every hero the picked player controls (10144).
    case "pickedPlayerHeroes": {
      const seat = seatOf(lastPicked(state));
      targets = seat == null ? [] : [...(state.seats[seat]?.heroes ?? [])];
      break;
    }
    // The character defending the attack in progress (141052:A:2).
    case "defender":
      targets = state.pendingAttack?.defenderId && !state.pendingAttack.undefended ? [state.pendingAttack.defenderId] : [];
      break;
    // The quest card being attempted: it gains Battle or Siege (hon.battle, hon.siege).
    case "currentQuest":
      targets = state.questStage ? [state.questStage] : [];
      break;
    // Every ally, now and entering play later, until the effect ends: an encounter card's lasting effect (rr.lasting-effects,
    // 141071:A:1). The holder is the class, read by modifiedStat.
    case "allies":
      targets = [ALLIES_CLASS];
      break;
    // Every character, hero or ally, now and entering play later (19020:A:2): the holder is the class, read by heldBy.
    case "characters":
      targets = [CHARACTERS_CLASS];
      break;
    // Every character the actor controls, now and entering play later (145028:A:2): the holder is the class, read by heldBy.
    case "ownCharacters":
      targets = [ownCharacters(focus.seat)];
      break;
    // Every character that is damaged, now and when it is damaged later (143061:A:2): the holder is the class, read by heldBy.
    case "damagedCharacters":
      targets = [DAMAGED_CHARACTERS_CLASS];
      break;
    // Every enemy in play, staged or engaged, now and entering later (143041:A:2): the holder is the class, read by heldBy.
    case "enemies":
      targets = [instruction.trait != null ? traitedEnemies(instruction.trait) : ENEMIES_CLASS];
      break;
    // Every enemy and location in the staging area, now and arriving later (19167:A:1): the holder is the class, read by heldBy.
    case "stagingCards":
      targets = [instruction.trait != null ? traitedStaging(instruction.trait) : STAGING_CLASS];
      break;
    // The card the answered event was about ("that ally gets +2 Attack"), the source's host.
    case "subject":
    case "other":
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
    // A lasting effect held by the table, every seat (Lost in the Dark's `noQuestProgress`, 41039:A:1): read as the holder "table".
    case "table":
      targets = ["table"];
      break;
    default:
      targets = [sourceId];
  }
  // "Each Dwarf character gets +1 Willpower until the end of the phase": the holders are the cards that match now.
  if (instruction.holders) targets = pickCandidates(state, instruction.holders, focus.seat, [], sourceId, ctx);
  // "+X Attack, where X is the discarded card's cost": X is read from the frame once, and so is any other amount.
  const data = topFrame(state)?.data;
  const scope = frameScope(state, focus.seat, sourceId);
  const base = resolveAmount(state, instruction.amount, scope, ctx);
  const read = instruction.per === "x" ? base * (data?.kind === "effect" ? (data.x ?? 0) : 0) : base;
  const amount = instruction.subtract ? -read : read;
  let next = state;
  const trait = instruction.trait;
  for (const id of targets) {
    if (trait != null && !id.startsWith("seat:") && !isTraitedEnemies(id) && !isTraitedStaging(id) && !hasTrait(next, id, trait, ctx)) continue;
    if (id === "table") next = { ...next, modifiers: [...next.modifiers, { instanceId: "table", sourceId, stat: instruction.stat, amount, until: instruction.until }] };
    else if (id.startsWith("seat:")) next = { ...next, modifiers: [...next.modifiers, { instanceId: id, sourceId, stat: instruction.stat, amount, until: instruction.until }] };
    else next = isClassHolder(id)
      ? addClassModifier(next, id, sourceId, instruction.stat, amount, instruction.until)
      : addModifier(next, id, sourceId, instruction.stat, amount, instruction.until);
  }
  // A condition read each time the stat is read stays on the modifiers it made ("+3 Attack while attacking an enemy with a
  // higher engagement cost than your threat", 04004:A:1).
  const kept = instruction.when;
  if (!isStatCondition(kept) || next.modifiers.length === state.modifiers.length) return next;
  return { ...next, modifiers: [...state.modifiers, ...next.modifiers.slice(state.modifiers.length).map((modifier) => ({ ...modifier, when: kept }))] };
}
