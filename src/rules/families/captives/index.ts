// Rules: rr.player-elimination, rr.ownership-and-control, rr.in-play-and-out-of-play, mec112.permanent (data/rules/entries.json); ledger lines 143022:A:1, 143024:A:1, 143024:A:2, 143069:A:1, 143070:B:3 (the rescue at the win).
// The Captives of The Uruk-hai: a hero lying faceup under To Isengard! (or attached to the enemy that holds it), in play and controlled by nobody (the captive zone the Ring-bearer under the Watcher uses,
// families/south/captive.ts). It keeps its damage, tokens and attachments (a Permanent boon included); it is not among its owner's heroes, so nothing the owner controls reaches it, yet its owner is not out
// of heroes while it is held (core/eliminate.ts eliminateEmpties). It is flagged `captive` and remembers its owner and its place among that owner's heroes.
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
import { backInPlace } from "../prisoner/index.ts";
import { heldFrom, releaseHero } from "../south/captive.ts";
import type { Focus } from "../index.ts";
import { captiveHeldBy, captivesOf } from "./values.ts";

/** The hero lies faceup under `hostId` as a Captive: it leaves its seat's list of heroes (remembering where it was), keeps what it has, and nobody controls it (the Setup's choice, a test table's layout). */
export function holdCaptive(state: ScenarioState, heroId: string, hostId: string | null): ScenarioState {
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
    if (heroId) next = holdCaptive(next, heroId, host.id);
  }
  return next;
}

function make(state: ScenarioState, under: string): ScenarioState {
  const heroId = lastPicked(state);
  const hero = state.cards[heroId];
  const host = cardInPlay(state, under);
  if (!hero || !host || hero.zone !== "heroes") return state;
  return holdCaptive(state, heroId, host.id);
}

function holdPicked(state: ScenarioState, focus: Focus): ScenarioState {
  const hero = state.cards[lastPicked(state)];
  if (!hero || hero.captive !== true || focus.sourceId == null) return state;
  return holdCaptive(state, hero.id, focus.sourceId);
}

function returnHeld(state: ScenarioState, under: string, focus: Focus): ScenarioState {
  const held = captiveHeldBy(state, focus.sourceId);
  const host = cardInPlay(state, under);
  return held && host ? holdCaptive(state, held.id, host.id) : state;
}

/**
 * A held hero (a Captive, a hero in the staging area, a guarded hero) comes back among its owner's heroes in the place it held, faceup, controlled by its owner again, with its damage, tokens and attachments kept; `exhausted` as the card that
 * releases it says. One rule for every release (the rescue, a stage, a guard that leaves play): each attachment changes control with the hero, so a card another player played on it goes to the hero's owner's play area
 * (rr.ownership-and-control, "Attachments on a card that changes control also change control to the same new controller"); a card no player controls (an encounter card's) stays controlled by nobody.
 */
export function releaseCaptive(state: ScenarioState, heroId: string, options: { exhausted: boolean }): ScenarioState {
  const hero = state.cards[heroId];
  if (!hero || hero.owner == null) return state;
  const seat = hero.owner;
  // `owner` on an attachment is what makes the release move it (families/south/captive.ts releaseHero): set it on each card another player controls.
  let next = state;
  for (const id of hero.attachments ?? []) {
    const attached = state.cards[id];
    if (attached && attached.owner == null && attached.controller != null && attached.controller !== seat) next = updateCard(next, id, { owner: attached.controller });
  }
  const patch = { face: "up" as const, captive: undefined, guardedHero: undefined, owner: undefined, heroSlot: undefined, host: null, ...(options.exhausted ? { exhausted: true } : {}) };
  const released = releaseHero(next, heroId, seat, patch, { owner: undefined });
  return hero.heroSlot == null ? released : backInPlace(released, seat, heroId, hero.heroSlot);
}

/**
 * The players win by defeating Rescue the Captives (143070:B:3, "they have rescued each Captive hero"; 143071:B:1 reads the rescued heroes): each Captive returns among its owner's heroes in the place it held, controlled by its owner
 * again, with its damage, tokens and attachments kept. It is no longer a Captive, so To Isengard!'s blank no longer reaches it. No event. The settle loop calls it as soon as the stage is cleared, in a campaign game and in a standalone one alike, before the score or the Resolution reads the heroes.
 */
export function rescueCaptives(state: ScenarioState): ScenarioState {
  let next = state;
  for (const held of captivesOf(state)) next = releaseCaptive(next, held.id, { exhausted: false });
  return next;
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
  settle: { after: (state) => (state.stageCleared && !state.lost ? rescueCaptives(state) : state) },
  verbs: ["TakeLoggedCaptives", "MakeCaptive", "HoldCaptive", "ReturnCaptive", "DamageHeldCaptive"],
  run,
  condition: (state, found, scope) => condition(state, found, scope),
};
