// Rules: rr.player-elimination, rr.ownership-and-control, rr.in-play-and-out-of-play, mec112.permanent (data/rules/entries.json); ledger lines 143022:A:1, 143024:A:1, 143024:A:2, 143069:A:1, 143070:B:3.
// The Captives of The Uruk-hai: a hero lying faceup under To Isengard! (or attached to the enemy that holds it), in play and controlled by nobody (the captive zone the Ring-bearer under the Watcher uses,
// families/south/captive.ts). It keeps its damage, tokens and attachments (a Permanent boon included); it is not among its owner's heroes, so nothing the owner controls reaches it, yet its owner is not out
// of heroes while it is held (core/keywords.ts eliminateEmpties). It is flagged `captive` and remembers its owner and its place among that owner's heroes.
import type { Condition, Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import { placeDamage } from "../../core/keywords.ts";
import { inPlay, updateCard, type CardInstance, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { heldFrom } from "../south/captive.ts";
import type { Focus } from "../index.ts";
import { captiveHeldBy, captivesOf } from "./values.ts";

/** The hero lies faceup under `hostId` as a Captive (the Setup's choice, a test table's layout). */
export function holdCaptive(state: ScenarioState, heroId: string, hostId: string): ScenarioState {
  return hold(state, heroId, hostId);
}

// The hero lies faceup under `hostId`: it leaves its seat's list of heroes (remembering where it was), keeps what it has, and nobody controls it.
function hold(state: ScenarioState, heroId: string, hostId: string): ScenarioState {
  const hero = state.cards[heroId];
  if (!hero) return state;
  const held = hero.captive === true ? {} : heldFrom(state, heroId);
  return updateCard(moveCard(state, heroId, { zone: "captive", hostId }), heroId, { face: "up", captive: true, committed: false, ...held });
}

// The card in play with this code, where the Captives lie.
function cardInPlay(state: ScenarioState, code: string): CardInstance | undefined {
  return Object.values(state.cards).find((card) => card.code === code && inPlay(card.zone) && card.zone !== "captive");
}

function takeLogged(state: ScenarioState, under: string): ScenarioState {
  const host = cardInPlay(state, under);
  const logged = state.campaignFacts?.heroLog?.captives ?? [];
  if (!host) return state;
  let next = state;
  for (const entry of logged) {
    const seat = next.seats[entry.seat];
    const heroId = seat?.heroes.find((id) => next.cards[id]?.code === entry.hero);
    if (heroId) next = hold(next, heroId, host.id);
  }
  return next;
}

function make(state: ScenarioState, under: string): ScenarioState {
  const heroId = lastPicked(state);
  const hero = state.cards[heroId];
  const host = cardInPlay(state, under);
  if (!hero || !host || hero.zone !== "heroes") return state;
  return hold(state, heroId, host.id);
}

function holdPicked(state: ScenarioState, focus: Focus): ScenarioState {
  const hero = state.cards[lastPicked(state)];
  if (!hero || hero.captive !== true || focus.sourceId == null) return state;
  return hold(state, hero.id, focus.sourceId);
}

function returnHeld(state: ScenarioState, under: string, focus: Focus): ScenarioState {
  const held = captiveHeldBy(state, focus.sourceId);
  const host = cardInPlay(state, under);
  return held && host ? hold(state, held.id, host.id) : state;
}

function damageHeld(state: ScenarioState, amount: number, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const held = captiveHeldBy(state, focus.sourceId);
  return held && amount > 0 ? placeDamage(state, held.id, amount, ctx.cards, steps, "framework", currentCause(steps, UNATTRIBUTED)) : state;
}

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "TakeLoggedCaptives":
      return takeLogged(state, instruction.under);
    case "MakeCaptive":
      return make(state, instruction.under);
    case "HoldCaptive":
      return holdPicked(state, focus);
    case "ReturnCaptive":
      return returnHeld(state, instruction.under, focus);
    case "DamageHeldCaptive":
      return damageHeld(state, resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx), focus, ctx, steps);
    default:
      return null;
  }
}

// "If there are no Captives in play" (143022:A:1), "a seat with no Captive" (143069:A:1): the count of Captives in play, or the acting seat's own.
function condition(state: ScenarioState, found: Condition, scope: { actor: number }): boolean | null {
  if (found.kind !== "captives") return null;
  const count = captivesOf(state).filter((card) => found.of !== "actor" || card.owner === scope.actor).length;
  return count >= (found.min ?? 0) && count <= (found.max ?? Infinity);
}

export const manifest: RulesFamily = {
  name: "captives",
  verbs: ["TakeLoggedCaptives", "MakeCaptive", "HoldCaptive", "ReturnCaptive", "DamageHeldCaptive"],
  run,
  condition: (state, found, scope) => condition(state, found, scope),
};
