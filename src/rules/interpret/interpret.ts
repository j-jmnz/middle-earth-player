import { withTwin } from "../families/nightmare/guards.ts";
import type { Effect, Instruction } from "../../catalog/boundary.ts";

import { currentCause, effectCause, inCause, ruleCause, UNATTRIBUTED, type Cause } from "../core/cause.ts";
import type { EngineStep } from "../core/intents.ts";
import { placeDamage, playerCardEffectCanChoose, sourcePrinted } from "../core/keywords.ts";
import { isPlayerType, printedOf, type PrintedCard } from "../core/printed.ts";
import { modifyStat } from "../combat/attack-verbs.ts";
import { frameScope, refCard } from "./amounts.ts";
import { namedTargetImmune } from "./immune-targets.ts";
import { collectAllyResources } from "../families/costs/pay.ts";
import { runFamilyVerb } from "../families/index.ts";
import { commitCard } from "../families/attack/index.ts";
import { exhaustCard, placePlayerDamage, readyWithThen, runPlayerVerb } from "./player-verbs.ts";
import { drawVerb } from "./effect-verbs.ts";
import { revealNow } from "../windows/frames.ts";
import { runSetupVerb } from "../setup/verbs.ts";
import { engageEnemy, engageWith, stagingEnemies, stagingLocations } from "../quest/quest.ts";
import { effectMadeActive, travelNow, travelTaken } from "../quest/travel.ts";
import type { ScenarioState } from "../core/state.ts";
import { flagged, heldAmount, updateCard } from "../core/state.ts";
import { raiseFor, refillEncounterDeck, runExtraVerb } from "./verbs.ts";
import { readyNamedCard, seatBarred } from "./restrictions.ts";
import { withFrame } from "../windows/windows.ts";
import { moveCard, turnedUp } from "../core/zones.ts";
import { refillDeck } from "../core/decks.ts";
import { DECKS } from "../core/piles.ts";
import { shadowFace } from "../families/defense/shadow.ts";
import { drawCards } from "../families/dungeon/deck.ts";
import { withView } from "../families/breaking/areas.ts";
import { isBreakingVerb } from "../families/breaking/index.ts";
import { announceDraw } from "../families/dreamchaser/index.ts";
import { heroDrawn } from "../families/deck/hero.ts";
import { announceEnteredHand } from "../families/island/hand.ts";
import { playerSource } from "../families/quest/threat.ts";
import { queueHeard } from "../families/quest/events.ts";
import { announceSetupActive } from "../families/quest/places.ts";
import { exhaustAnnounced } from "../windows/exhaust.ts";

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
  return updateCard(moved, id, { face: turnedUp(moved, id) });
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
  const twin = withTwin(state, instruction, ctx.cards);
  // Once stages are separate "the staging area", "this stage" and "the quest" of an instruction are the acting seat's (mec109.multiple-staging-areas): the
  // instruction runs on the state as that seat sees it, with its own staging area and stage in the shared fields (families/breaking/areas.ts). The verbs of the
  // breaking family are about the areas themselves and run on the whole state.
  if (state.separate && !isBreakingVerb(twin.verb)) return withView(state, focus.seat, (view) => runTwinned(view, twin, focus, ctx, steps));
  return runTwinned(state, twin, focus, ctx, steps);
}

// runInstruction with a code already read as its Nightmare twin (families/nightmare/guards.ts).
function runTwinned(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // A card the instruction names without a pick, immune to its source, ignores it (rr.immune, immune-targets.ts).
  if (namedTargetImmune(state, instruction, focus, ctx)) return state;
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
      const locationId = instruction.to === "self" ? focus.sourceId : stagingLocations(state, ctx.cards, focus.seat)[0];
      if (!locationId) return state;
      // The active location is immune to card effects (East-gate, dwd.immune-to-card-effects): nothing returns it to the staging area, so the travel cannot happen and the card stays where it is.
      if (state.activeLocation != null && flagged(state, state.activeLocation, "immuneToCardEffects")) return state;
      const traveled = travelNow(state, locationId, ctx, steps);
      // A player the cost of the travel eliminated (a threat raise to 50 earlier in the effect) travels nowhere: this instruction changes nothing, later instructions of the effect still run and the game goes on (rr.player-elimination).
      if (traveled) return traveled;
      // The Travel effect itself made another location the active location (Dark-wood Grove reveals Giant Web, 51146:A:2, 51131:A:1), or took the location out of the staging area: the travel does not take place and the opportunity is over (docs/scenarios/standalone-scenarios/the-woodland-realm.md, The Woodland Realm, reading 20).
      if (instruction.to === "self" && (effectMadeActive(state) || state.cards[locationId]?.zone !== "staging")) return state.mode === "travel" ? travelTaken(state) : state;
      return state.seats[focus.seat]?.eliminated ? state : { ...state, failure: "Travel was refused" };
    }
    case "Engage": {
      const enemyId = instruction.target ? refCard(state, instruction.target, frameScope(state, focus.seat, focus.sourceId)) : stagingEnemies(state, ctx.cards, focus.seat)[0];
      const enemy = enemyId ? state.cards[enemyId] : undefined;
      if (!enemyId || !enemy || (enemy.zone === "engaged" && enemy.controller === focus.seat)) return state;
      // An enemy engaged with another player moves to the actor (01015:A:1, rr.engaged).
      if (enemy.zone === "engaged") return flagged(state, enemyId, "cannotBeEngaged") ? state : engageWith(state, focus.seat, enemyId, steps);
      return engageEnemy(state, focus.seat, enemyId, steps);
    }
    case "DealShadow":
      if (!focus.sourceId) return state;
      return instruction.additional ? dealAdditionalShadow(state, focus.sourceId, steps, ctx) : dealOneShadow(state, focus.sourceId, steps, ctx);
    case "ResolveEffect":
      return withFrame(state, "ResolveEffect", focus.sourceId, false, (framed) => framed, steps);
    case "ModifyStat":
      return modifyStat(state, instruction, focus, ctx);
    case "Exhaust": {
      const target = instruction.target;
      const id = target?.kind === "byCode" || target?.kind === "byName" ? readyNamedCard(state, ctx, target, instruction.who === "firstPlayer" ? state.firstPlayer : null)?.id : focus.sourceId;
      return id ? exhaustCard(state, id) : state;
    }
    case "Ready":
      return focus.sourceId ? readyWithThen(state, focus.sourceId, ctx, playerSource(state, focus.sourceId, ctx)) : state;
    case "Commit":
      // A card the effect names commits as it is, and is announced (families/attack.ts).
      if (instruction.target) return commitCard(state, instruction.target, focus);
      return focus.sourceId ? exhaustAnnounced(state, focus.sourceId, ctx, { committed: true }) : state;
    case "MakeActiveLocation":
      return announceSetupActive(runSetupVerb(state, instruction, ctx, focus.sourceId), ctx, steps);
    case "AddToStaging":
    case "SetAside":
    case "AttachToRingBearer":
      return runSetupVerb(state, instruction, ctx, focus.sourceId);
    default:
      return runExtraVerb(state, instruction, focus, ctx, steps);
  }
}

// Setup (rr.setup step 5) and a mulligan (rr.mulligan) draw the opening hand.
export function drawOpeningHand(state: ScenarioState, seat: number, steps: EngineStep[], ctx: ReduceContext, cause: Cause = ruleCause("rr.setup")): ScenarioState {
  let next = state;
  const count = Math.max(0, 6 - state.openingHandReduction);
  next = drawMany(next, seat, count, steps, cause, ctx, false, false, true);
  return next;
}

// A draw of `count` cards: one draw action, which Iron Shackles on the deck replaces as a whole (families/dungeon/deck.ts).
// An eliminated player and a table that "cannot draw" draw nothing, so nothing is replaced either. `bottom`: the cards come off the bottom of the deck.
// `byPlayerCard`: a player card's effect draws them, which a card that hears the draw can ask (143059:A:1). `framework`: the framework draws them (the opening hand, the resource phase's draw), which a rule about drawing "through card effects" does not
// bar (900404:A:1).
export function drawMany(state: ScenarioState, seat: number, count: number, steps: EngineStep[], fallback: Cause, ctx: ReduceContext, bottom = false, byPlayerCard = false, framework = false): ScenarioState {
  if (state.seats[seat]?.eliminated || heldAmount(state, "table", "cannotDraw") > 0 || (!framework && (seatBarred(state, ctx, seat, "draw") || (state.modifiers.length > 0 && flagged(state, `seat:${seat}`, "noCardDraw"))))) return state;
  const drawn = drawCards(state, seat, count, (current) => drawOne(current, seat, steps, fallback, bottom));
  // A hero a card shuffled into the deck is put into play as it is drawn (families/deck/hero.ts).
  return heroDrawn(announceEnteredHand(state, announceDraw(state, drawn, seat, ctx, byPlayerCard), seat, ctx), seat);
}

function drawOne(state: ScenarioState, seat: number, steps: EngineStep[], fallback: Cause, bottom: boolean): ScenarioState {
  const id = bottom ? state.seats[seat]?.deck.at(-1) : state.seats[seat]?.deck[0];
  if (!id) return state;
  const next = moveCard(state, id, { zone: "hand", seat });
  steps.push({ kind: "draw", seat, cardId: id, cause: currentCause(steps, fallback) });
  return next;
}

export function gainSeatResources(state: ScenarioState, seat: number, steps: EngineStep[], fallback: Cause): ScenarioState {
  // "Players cannot gain resources" (143078:B:1) bars the resource phase's collection.
  if (state.modifiers.length > 0 && flagged(state, "table", "cannotGainResources")) return state;
  const heroes = state.seats[seat]?.heroes ?? [];
  let next = state;
  for (const heroId of heroes) {
    const hero = next.cards[heroId];
    if (!hero) continue;
    // A hero that "does not collect resources during the resource phase" (No Rest, 10080:A:1) holds noCollection.
    if (next.modifiers.length > 0 && flagged(next, heroId, "noCollection")) continue;
    // A hero that "collects 1 additional resource" holds an extraResource.
    const gained = 1 + Math.max(0, heldAmount(next, heroId, "extraResource"));
    next = updateCard(next, heroId, { resources: hero.resources + gained });
    for (let count = 0; count < gained; count += 1) steps.push({ kind: "gainResource", seat, heroId, cause: currentCause(steps, fallback) });
  }
  // An ally that "collects 1 resource each resource phase" (families/costs/pay.ts).
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

// The enemy's shadow card, when it has none yet. `steps` hears the encounter deck being refilled for it.
export function dealOneShadow(state: ScenarioState, enemyId: string, steps: EngineStep[], ctx: ReduceContext): ScenarioState {
  if (state.cards[enemyId]?.shadowId) return state;
  const dealt = dealAdditionalShadow(state, enemyId, steps, ctx);
  // "Deal it a number of shadow cards equal to ..." (the flag dealtShadows, 19098:A:3): the card above is the first, each other an additional one.
  let next = dealt;
  for (let more = heldAmount(dealt, enemyId, "dealtShadows") - 1; more > 0 && dealt.cards[enemyId]?.shadowId != null; more -= 1) next = dealAdditionalShadow(next, enemyId, steps, ctx);
  return next;
}

// One more shadow card for an enemy, beside any it has (141069:A:2). With none yet it is simply its shadow card. An empty
// encounter deck deals nothing (rr.step-6-2).
// An enemy that holds `shadowsFromBalrog` is dealt from the Balrog deck, which is refilled from its discard pile when it is empty (901801:A:3, A:4); `fromEncounter` deals from the encounter deck whatever the enemy holds ("from the encounter deck (not the Balrog deck)", 901806:A:1).
export function dealAdditionalShadow(given: ScenarioState, enemyId: string, steps: EngineStep[], ctx: ReduceContext, fromEncounter = false): ScenarioState {
  const balrog = !fromEncounter && given.piles?.balrogDeck !== undefined && flagged(given, enemyId, "shadowsFromBalrog");
  // An empty deck is refilled at once while the Nightmare setup card says so (encounterRefill, 900201:A:3); the reset is logged.
  const state = balrog ? refillDeck(given, DECKS.balrog, steps) : refillEncounterDeck(given, steps, ctx);
  const enemy = state.cards[enemyId];
  const top = balrog ? state.piles?.balrogDeck?.[0] : state.encounterDeck[0];
  // "Do not deal Nazgûl enemies a shadow card" (141061:A:1).
  if (!enemy || !top || flagged(state, enemyId, "noShadowDealt")) return state;
  // Face down, or face up while the player it is engaged with holds shadowsFaceUp (07009).
  const face = shadowFace(state, enemyId);
  const moved = moveCard(state, top, { zone: "shadow", enemyId });
  // The enemy hears that it was dealt the card (Thaurdir's stage 1B, the Werewolf of Angmar, 10125:B:3, 10131:A:2).
  return queueHeard(updateCard(moved, top, { face }), ctx, { trigger: "shadowDealtTo", seat: null, cardId: enemyId, subject: enemyId, other: top });
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
    next = playerEffect ? placePlayerDamage(next, focus.seat, id, 1, ctx, steps, focus.sourceId) : placeDamage(next, id, 1, ctx.cards, steps, "framework", currentCause(steps, UNATTRIBUTED));
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
    if (playerEffect && !playerCardEffectCanChoose(printed, state, id, sourcePrinted(state, ctx.cards, sourceId))) continue;
    ids.push(id);
  }
  return ids;
}
