import type { Effect, Instruction } from "../catalog/boundary.ts";

import { currentCause, effectCause, inCause, ruleCause, UNATTRIBUTED, type Cause } from "./cause.ts";
import type { EngineStep } from "./intents.ts";
import { placeDamage, playerCardEffectCanChoose } from "./keywords.ts";
import { isPlayerType, printedOf, type PrintedCard } from "./printed.ts";
import { modifyStat } from "./attack-verbs.ts";
import { frameScope, refCard } from "./amounts.ts";
import { collectAllyResources } from "./families/costs-pay.ts";
import { runFamilyVerb } from "./families/index.ts";
import { commitCard } from "./families/attack.ts";
import { exhaustCard, readyCard, runPlayerVerb } from "./player-verbs.ts";
import { drawVerb } from "./effect-verbs.ts";
import { revealNow } from "./frames.ts";
import { runSetupVerb } from "./setup-verbs.ts";
import { engageEnemy, engageWith, stagingEnemies, stagingLocations } from "./quest.ts";
import { travelNow } from "./travel.ts";
import type { ScenarioState } from "./state.ts";
import { flagged, heldAmount, inPlay, updateCard } from "./state.ts";
import { raiseFor, runExtraVerb } from "./verbs.ts";
import { withFrame } from "./windows.ts";
import { moveCard } from "./zones.ts";
import { shadowFace } from "./families/defense-shadow.ts";

export type ReduceContext = {
  effects: readonly Effect[];
  cards: ReadonlyMap<string, PrintedCard>;
};

// `chosen`: the card a player chose for this instruction when it asked (a family verb that asks for a target).
type Focus = { seat: number; sourceId: string | null; chosen?: string };

export function addToStaging(state: ScenarioState, id: string): ScenarioState {
  const instance = state.cards[id];
  if (!instance) return state;
  const moved = moveCard(state, id, { zone: "staging" });
  return updateCard(moved, id, { face: "up" });
}

export function runEffects(
  state: ScenarioState,
  sourceId: string,
  timings: readonly Effect["timing"][],
  seat: number,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const code = state.cards[sourceId]?.code;
  if (!code || ctx.effects.length === 0) return state;
  let next = state;
  for (const timing of timings) {
    for (const effect of ctx.effects) {
      if (effect.cardCode !== code || effect.timing !== timing) continue;
      next = runEffect(next, effect, sourceId, seat, ctx, steps);
      if (next.lost || next.failure) return next;
    }
  }
  return next;
}

export function runEffect(
  state: ScenarioState,
  effect: Effect,
  sourceId: string,
  seat: number,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  let next = state;
  const cause = effectCause(effect);
  for (const instruction of effect.instructions) {
    next = inCause(steps, cause, () => runInstruction(next, instruction, { seat, sourceId }, ctx, steps));
    if (next.lost || next.failure) return next;
  }
  return next;
}

export function runInstruction(
  state: ScenarioState,
  instruction: Instruction,
  focus: Focus,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  if (state.failure) return state;
  const family = runFamilyVerb(state, instruction, focus, ctx, steps);
  if (family) return family;
  const player = runPlayerVerb(state, instruction, focus, ctx, steps);
  if (player) return player;
  switch (instruction.verb) {
    case "Draw":
      return drawVerb(state, instruction, focus.seat, ctx, steps);
    case "GainResources":
      return gainSeatResources(state, focus.seat, steps, UNATTRIBUTED);
    case "RevealStaging":
      return revealNow(state, focus.seat, ctx, steps);
    case "RaiseThreat":
      return raiseFor(state, instruction, focus, ctx, steps);
    case "PlaceProgress":
      return placeOneProgress(state, focus.sourceId, steps);
    case "DealDamage":
      return dealInstructionDamage(state, focus, ctx, steps);
    case "Travel": {
      const locationId = instruction.to === "self" ? focus.sourceId : stagingLocations(state, ctx.cards)[0];
      if (!locationId) return state;
      const traveled = travelNow(state, locationId, ctx, steps);
      return traveled ?? { ...state, failure: "Travel was refused" };
    }
    case "Engage": {
      const enemyId = instruction.target ? refCard(state, instruction.target, frameScope(state, focus.seat, focus.sourceId)) : stagingEnemies(state, ctx.cards)[0];
      const enemy = enemyId ? state.cards[enemyId] : undefined;
      if (!enemyId || !enemy || (enemy.zone === "engaged" && enemy.controller === focus.seat)) return state;
      // An enemy engaged with another player moves to the actor (01015:A:1, rr.engaged).
      if (enemy.zone === "engaged") return flagged(state, enemyId, "cannotBeEngaged") ? state : engageWith(state, focus.seat, enemyId, steps);
      return engageEnemy(state, focus.seat, enemyId, steps);
    }
    case "DealShadow":
      if (!focus.sourceId) return state;
      return instruction.additional ? dealAdditionalShadow(state, focus.sourceId) : dealOneShadow(state, focus.sourceId);
    case "ResolveEffect":
      return withFrame(state, "ResolveEffect", focus.sourceId, false, (framed) => framed, steps);
    case "ModifyStat":
      return modifyStat(state, instruction, focus, ctx);
    case "Exhaust": {
      const code = instruction.target?.kind === "byCode" ? instruction.target.code : undefined;
      const payer = instruction.who === "firstPlayer" ? state.firstPlayer : null;
      const id = code
        ? Object.values(state.cards).find((card) => card.code === code && inPlay(card.zone) && (payer == null || card.controller === payer))?.id
        : focus.sourceId;
      return id ? exhaustCard(state, id) : state;
    }
    case "Ready":
      return focus.sourceId ? readyCard(state, focus.sourceId) : state;
    case "Commit":
      // A card the effect names commits as it is, and is announced (families/attack.ts).
      if (instruction.target) return commitCard(state, instruction.target, focus);
      return focus.sourceId
        ? updateCard(state, focus.sourceId, { committed: true, exhausted: true })
        : state;
    case "AddToStaging":
    case "MakeActiveLocation":
    case "SetAside":
    case "AttachToRingBearer":
      return runSetupVerb(state, instruction, ctx, focus.sourceId);
    default:
      return runExtraVerb(state, instruction, focus, ctx, steps);
  }
}

// Setup (rr.setup step 5) and a mulligan (rr.mulligan) draw the opening hand.
export function drawOpeningHand(state: ScenarioState, seat: number, steps: EngineStep[], cause: Cause = ruleCause("rr.setup")): ScenarioState {
  let next = state;
  const count = Math.max(0, 6 - state.openingHandReduction);
  for (let draw = 0; draw < count; draw += 1) next = drawOne(next, seat, steps, cause);
  return next;
}

export function drawOne(state: ScenarioState, seat: number, steps: EngineStep[], fallback: Cause): ScenarioState {
  if (state.seats[seat]?.eliminated) return state;
  const id = state.seats[seat]?.deck[0];
  if (!id) return state;
  const next = moveCard(state, id, { zone: "hand", seat });
  steps.push({ kind: "draw", seat, cardId: id, cause: currentCause(steps, fallback) });
  return next;
}

export function gainSeatResources(state: ScenarioState, seat: number, steps: EngineStep[], fallback: Cause): ScenarioState {
  const heroes = state.seats[seat]?.heroes ?? [];
  let next = state;
  for (const heroId of heroes) {
    const hero = next.cards[heroId];
    if (!hero) continue;
    // A hero that "collects 1 additional resource" holds an extraResource.
    const gained = 1 + Math.max(0, heldAmount(next, heroId, "extraResource"));
    next = updateCard(next, heroId, { resources: hero.resources + gained });
    for (let count = 0; count < gained; count += 1) steps.push({ kind: "gainResource", seat, heroId, cause: currentCause(steps, fallback) });
  }
  // An ally that "collects 1 resource each resource phase" (families/costs-pay.ts).
  return collectAllyResources(next, seat, steps, currentCause(steps, fallback));
}

function placeOneProgress(state: ScenarioState, sourceId: string | null, steps: EngineStep[]): ScenarioState {
  const id = sourceId ?? state.questStage;
  if (!id || !state.cards[id]) return state;
  const instance = state.cards[id];
  if (!instance) return state;
  steps.push({ kind: "progress", targetId: id, amount: 1, cause: currentCause(steps, UNATTRIBUTED) });
  return updateCard(state, id, { progress: instance.progress + 1 });
}

// The enemy's shadow card, when it has none yet.
export function dealOneShadow(state: ScenarioState, enemyId: string): ScenarioState {
  return state.cards[enemyId]?.shadowId ? state : dealAdditionalShadow(state, enemyId);
}

// One more shadow card for an enemy, beside any it has (141069:A:2). With none yet it is simply its shadow card. An empty
// encounter deck deals nothing (rr.step-6-2).
export function dealAdditionalShadow(state: ScenarioState, enemyId: string): ScenarioState {
  const enemy = state.cards[enemyId];
  const top = state.encounterDeck[0];
  // "Do not deal Nazgûl enemies a shadow card" (141061:A:1).
  if (!enemy || !top || flagged(state, enemyId, "noShadowDealt")) return state;
  // Face down, or face up while the player it is engaged with holds shadowsFaceUp (07009).
  const face = shadowFace(state, enemyId);
  const moved = moveCard(state, top, { zone: "shadow", enemyId });
  return updateCard(moved, top, { face });
}

function dealInstructionDamage(
  state: ScenarioState,
  focus: Focus,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const printed = source ? printedOf(ctx.cards, source.code) : undefined;
  const playerEffect = printed != null && isPlayerType(printed);
  let next = state;
  for (const id of damageTargets(state, ctx, focus.sourceId, playerEffect)) {
    next = placeDamage(next, id, 1, ctx.cards, steps, playerEffect ? "player" : "framework", currentCause(steps, UNATTRIBUTED));
  }
  return next;
}

function damageTargets(
  state: ScenarioState,
  ctx: ReduceContext,
  sourceId: string | null,
  playerEffect: boolean,
): string[] {
  const consider = [...state.staging];
  for (const seat of state.seats) {
    if (seat.eliminated) continue;
    consider.push(...seat.engaged);
  }
  const ids: string[] = [];
  for (const id of consider) {
    if (id === sourceId) continue;
    const instance = state.cards[id];
    if (!instance) continue;
    const printed = printedOf(ctx.cards, instance.code);
    if (printed.type !== "enemy") continue;
    if (playerEffect && !playerCardEffectCanChoose(printed)) continue;
    ids.push(id);
  }
  return ids;
}
