// Rules: rr.damage, rr.destroy, rr.attachment-cards, rr.in-play-and-out-of-play, rr.immune, mec109.immune-to-player-card-effects, rr.objective-cards
// (data/rules/entries.json); the cards of Journey in the Dark (142040 to 142059, 142087, 142088).
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope } from "../../interpret/amounts.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { destroyCard, destroyOverwhelmed, placeDamage } from "../../core/keywords.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlayByCode, updateCard } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";
import { threatCostOf } from "../costs/stats.ts";

// The verbs src/catalog/families/moria.ts adds. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "PlaceDamageOn":
      return changeDamage(state, instruction.code, instruction.amount, steps);
    case "RemoveDamageFrom":
      return changeDamage(state, instruction.code, -instruction.amount, steps);
    case "SacrificeForDamage":
      return sacrificeForDamage(state, instruction.code, ctx, steps);
    case "AttachToSubject":
      return attachToSubject(state, focus);
    default:
      return null;
  }
}

// Damage tokens come on (positive) or off (negative, no further than 0) the card in play with this code: tokens, not dealt damage, so nothing
// answers them and no keyword changes them (142040:A:1, 142043:A:1). The step records the change.
function changeDamage(state: ScenarioState, code: string, change: number, steps: EngineStep[]): ScenarioState {
  const id = inPlayByCode(state, code)?.id;
  const card = id ? state.cards[id] : undefined;
  if (!id || !card) return state;
  const amount = change > 0 ? change : -Math.min(card.damage, -change);
  if (amount === 0) return state;
  steps.push({ kind: "damage", targetId: id, amount, cause: currentCause(steps, UNATTRIBUTED) });
  return updateCard(state, id, { damage: card.damage + amount });
}

// SacrificeForDamage (142050:A:2): the last picked hero is discarded from play, the card with `code` takes damage equal to the hero's threat cost,
// and loses every keyword from then on. An Indestructible enemy that loses the keyword while its damage is at its hit points is destroyed.
function sacrificeForDamage(state: ScenarioState, code: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const heroId = lastPicked(state);
  const hero = state.cards[heroId];
  const targetId = inPlayByCode(state, code)?.id;
  if (!hero || hero.zone !== "heroes" || !targetId) return state;
  const cause = currentCause(steps, UNATTRIBUTED);
  const amount = threatCostOf(state, heroId, ctx);
  let next = destroyCard(state, heroId, ctx.cards, steps);
  if (amount > 0) next = placeDamage(next, targetId, amount, ctx.cards, steps, "framework", cause);
  next = { ...next, modifiers: [...next.modifiers, { instanceId: targetId, sourceId: targetId, stat: "losesKeywords", amount: 1, until: "whileSourceInPlay" }] };
  return destroyOverwhelmed(next, ctx.cards, steps);
}

// AttachToSubject (142088:A:2): the source objective leaves the staging area and attaches to the hero the answered event was about. It is faceup,
// and no player controls it, as the cards an encounter card attaches. Nothing happens when the source is attached already or the subject is not a hero in play.
function attachToSubject(state: ScenarioState, focus: Focus): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const subject = frameScope(state, focus.seat, focus.sourceId).subject;
  const host = subject ? state.cards[subject] : undefined;
  if (!source || source.zone !== "staging" || !host || host.zone !== "heroes") return state;
  return updateCard(attachTo(moveCard(state, source.id, { zone: "attached" }), source.id, host.id), source.id, { face: "up" });
}

export const manifest: RulesFamily = { name: "moria", verbs: ["PlaceDamageOn", "RemoveDamageFrom", "SacrificeForDamage", "AttachToSubject"], run };
