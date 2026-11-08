// Rules: rr.in-play-and-out-of-play, rr.attachment-cards, rr.active-location, rr.quest-advancement, rr.effects (data/rules/entries.json).
import { isStatCondition, type Instruction } from "../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "./amounts.ts";
import { runAttackVerb } from "../combat/attack-verbs.ts";
import { characters } from "../combat/combat.ts";
import { hasTrait, holds, outOfPlayChoices } from "./conditions.ts";
import { scheduleDelayed } from "../windows/delayed.ts";
import type { EngineStep } from "../core/intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { destroyCard, eliminateEmpties, isEncounterCardEffect, modifiedStat, placeDamage, raiseThreat, releaseAttachments } from "../core/keywords.ts";
import { lastPicked, otherSeat, seatsFor } from "./player-verbs.ts";
import { queueEvent } from "../windows/queue.ts";
import { patchTop, topFrame } from "../windows/windows.ts";
import { isPlayerType, printedOf } from "../core/printed.ts";
import { engageEnemy, engageWith, placeQuestProgress, stagingEnemies } from "../quest/quest.ts";
import { restricted } from "./restrictions.ts";
import { nextUint, shuffleIds } from "../core/seed.ts";
import { afterProgress } from "../quest/stage-reveal.ts";
import { mayGainResources } from "../families/misc/guards.ts";
import { queueHeard } from "../families/quest/events.ts";
import { refillsAnyTime } from "../families/nightmare/guards.ts";
import { barredFromPlayerDiscard } from "../families/wilderland/pick.ts";
import { encounterRaised } from "../families/quest/threat.ts";
import { flagged, livingSeats, updateCard, type ScenarioState } from "../core/state.ts";
import { attachTo, cardsUnder, moveCard } from "../core/zones.ts";
import { currentCause, ruleCause, UNATTRIBUTED } from "../core/cause.ts";
import { takeProgressOff } from "../core/progress.ts";
import { noteEncounterThreat } from "../families/encounter/reveal.ts";
import { moveEncounter } from "../families/encounter/moves.ts";
import { stagingDest } from "../families/breaking/areas.ts";

export type VerbFocus = { seat: number; sourceId: string | null };

// "otherPlayer" is the next seat in the game after the actor; with no other player it is the actor.
export function seatFor(state: ScenarioState, who: "actor" | "firstPlayer" | "otherPlayer" | undefined, actor: number): number {
  if (who === "otherPlayer") return otherSeat(state, actor) ?? actor;
  return who === "firstPlayer" ? state.firstPlayer : actor;
}

export function shuffleEncounterDeck(state: ScenarioState): ScenarioState {
  const shuffled = shuffleIds(state.encounterDeck, state.seed, state.seedCursor);
  return { ...state, encounterDeck: shuffled.ids, seedCursor: shuffled.cursor };
}

// An encounter deck that is out of cards during the quest phase gets the encounter discard pile back, shuffled
// (rr.running-out-of-cards, rr.step-3-3). Outside the quest phase it stays empty.
export function resetEncounterDeck(state: ScenarioState, steps: EngineStep[]): ScenarioState {
  // In any phase while the Nightmare setup card says so (encounterRefill, 900201:A:3).
  if ((state.phase !== "Quest" && !refillsAnyTime(state)) || state.encounterDeck.length > 0 || state.encounterDiscard.length === 0) return state;
  const count = state.encounterDiscard.length;
  let next = state;
  for (const id of [...state.encounterDiscard]) {
    next = updateCard(moveCard(next, id, { zone: "encounterDeck" }), id, { face: "down" });
  }
  steps.push({ kind: "resetEncounterDeck", count, cause: ruleCause("rr.running-out-of-cards") });
  return shuffleEncounterDeck(next);
}

// The encounter deck emptied while the Nightmare setup card refills it at any time (encounterRefill, 900201:A:3).
export function refillEncounterDeck(state: ScenarioState, steps: EngineStep[]): ScenarioState {
  return state.encounterDeck.length === 0 && state.encounterDiscard.length > 0 && refillsAnyTime(state) ? resetEncounterDeck(state, steps) : state;
}

// A card goes into the encounter deck face down, as every card in a deck is, and the deck is shuffled.
export function shuffleIntoEncounterDeck(state: ScenarioState, id: string): ScenarioState {
  if (!state.cards[id]) return state;
  return shuffleEncounterDeck(updateCard(moveCard(state, id, { zone: "encounterDeck" }), id, { face: "down" }));
}

// Verbs that run to completion with no choice and no child frame. A verb that needs either is handled
// by the effect frame (effect-frames.ts) before it reaches here.
export function runExtraVerb(
  state: ScenarioState,
  instruction: Instruction,
  focus: VerbFocus,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  switch (instruction.verb) {
    case "ShuffleEncounterDeck":
      return shuffleEncounterDeck(state);
    case "AddSetAsideToStaging": {
      const id = state.setAside.find((candidate) => state.cards[candidate]?.code === instruction.code);
      // Into the acting seat's own staging area once stages are separate (mec109.multiple-staging-areas).
      return id ? updateCard(moveCard(state, id, stagingDest(state, focus.seat)), id, { face: "up" }) : state;
    }
    case "ShuffleOutOfPlayIntoEncounterDeck": {
      // Outside an effect frame nobody can be asked, so the first choice goes (effect-frames.ts asks the first player when
      // there are several, rr.first-player).
      const id = outOfPlayChoices(state, instruction.code)[0];
      return id ? shuffleIntoEncounterDeck(state, id) : state;
    }
    case "RemoveQuestProgress":
      return removeQuestProgress(state, questProgressMoved(state, instruction), steps);
    case "PlaceQuestProgress": {
      const before = steps.length;
      const placed = placeQuestProgress(state, questProgressMoved(state, instruction), ctx.cards, steps, (current) => !restricted(current, ctx, "advance").length);
      return afterProgress(placed, before, ctx, steps);
    }
    case "DiscardUntilEnemies":
      return discardUntilEnemies(state, instruction.perPlayer * livingSeats(state).length, ctx, steps, instruction.to);
    case "ShuffleSelfIntoEncounterDeck": {
      return focus.sourceId ? shuffleIntoEncounterDeck(state, focus.sourceId) : state;
    }
    case "DiscardRandomFromHand": {
      // `eachSeat` ("each player discards 1 card at random from his hand", 19040:A:1): every living player, the first player first.
      if (instruction.who === "eachSeat") {
        const amount = instruction.amount == null ? 1 : resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
        const living = livingSeats(state);
        const at = Math.max(0, living.indexOf(state.firstPlayer));
        return [...living.slice(at), ...living.slice(0, at)].reduce((current, seat) => discardRandom(current, seat, amount, focus.sourceId, ctx), state);
      }
      const seat = instruction.who === "firstPlayer" ? state.firstPlayer : focus.seat;
      const discarded = discardRandom(state, seat, instruction.amount == null ? 1 : resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx), focus.sourceId, ctx);
      if (!instruction.remember) return discarded;
      // `remember`: the card discarded is the effect's picked card afterward ("the discarded card's printed cost", 143066:A:2).
      const pile = discarded.seats[seat]?.discard ?? [];
      const id = pile.length > (state.seats[seat]?.discard.length ?? 0) ? pile.at(-1) : undefined;
      const data = topFrame(discarded)?.data;
      return id && data?.kind === "effect" ? patchTop(discarded, { data: { ...data, picked: [...(data.picked ?? []), id] } }) : discarded;
    }
    case "PlaceUnderSelf": {
      const id = lastPicked(state);
      if (!focus.sourceId || !state.cards[id] || !state.cards[focus.sourceId]) return state;
      // The enemy leaves play, so the cards attached to it are discarded with it (rr.attachment-cards).
      return moveCard(releaseAttachments(state, id, ctx.cards, steps), id, { zone: "under", locationId: focus.sourceId });
    }
    case "ReturnUnderToStaging": {
      let next = state;
      for (const id of focus.sourceId ? cardsUnder(state, focus.sourceId) : []) next = updateCard(moveCard(next, id, { zone: "staging" }), id, { face: "up" });
      return next;
    }
    case "DamageAll":
      return damageAllies(state, instruction, focus, ctx, steps);
    case "RemoveFromQuest": {
      const id = lastPicked(state);
      const card = state.cards[id];
      // "After attached character is removed from the quest" (12116:A:3).
      return card?.committed ? queueHeard(updateCard(state, id, { committed: false }), ctx, { trigger: "removedFromQuest", seat: card.controller, subject: id }) : state;
    }
    case "EngageAll": {
      const seat = seatFor(state, instruction.who, focus.seat);
      let next = state;
      for (const id of stagingEnemies(state, ctx.cards, focus.seat)) {
        if (instruction.trait && !hasTrait(state, id, instruction.trait, ctx)) continue;
        next = engageEnemy(next, seat, id, steps);
      }
      return next;
    }
    case "Discard":
      return discardTarget(state, instruction.target.kind, focus, ctx, steps);
    case "UncommitAll": {
      const seat = seatFor(state, instruction.who, focus.seat);
      let next = state;
      for (const id of characters(state, seat, ctx.cards)) next = updateCard(next, id, { committed: false });
      return next;
    }
    case "TakeControl": {
      if (!focus.sourceId || !state.cards[focus.sourceId]) return state;
      const seat = seatFor(state, instruction.who, focus.seat);
      return updateCard(moveCard(state, focus.sourceId, { zone: "play", seat }), focus.sourceId, { face: "up", exhausted: false });
    }
    case "ReduceOpeningHand":
      return { ...state, openingHandReduction: state.openingHandReduction + instruction.amount };
    case "TransferHost":
      return transferHost(state, focus, seatFor(state, instruction.who, focus.seat), steps);
    case "WinGame":
      return { ...state, stageCleared: true };
    case "GainSurge":
      return markSurge(state, focus.sourceId);
    case "AddResources": {
      const scope = frameScope(state, focus.seat, focus.sourceId);
      const id = refCard(state, instruction.to ?? "host", scope);
      const hero = id ? state.cards[id] : undefined;
      const amount = resolveAmount(state, instruction.amount, scope, ctx);
      if (!hero || hero.controller == null || amount <= 0 || !mayGainResources(state, hero.id, focus.sourceId, ctx)) return state;
      for (let added = 0; added < amount; added += 1) {
        steps.push({ kind: "gainResource", seat: hero.controller, heroId: hero.id, cause: currentCause(steps, UNATTRIBUTED) });
      }
      // "After a card effect adds resources to a hero's pool" (rr.resources).
      return queueEvent(updateCard(state, hero.id, { resources: hero.resources + amount }), { trigger: "resourcesAdded", seat: hero.controller, cardId: hero.id });
    }
    case "Delay":
      return scheduleDelayed(state, instruction, focus, ctx, currentCause(steps, UNATTRIBUTED));
    case "ConsiderUndefended":
    case "AfterAttack":
    case "EngageNextPlayer":
      return runAttackVerb(state, instruction, focus, steps);
    default:
      return { ...state, failure: `Unimplemented instruction ${instruction.verb}` };
  }
}

// The host of the source card moves to the seat's heroes with the resources on it. Each card attached to
// it follows, still attached. A seat left with no heroes is eliminated at once.
function transferHost(state: ScenarioState, focus: VerbFocus, seat: number, steps: EngineStep[]): ScenarioState {
  const hostId = focus.sourceId ? state.cards[focus.sourceId]?.host : null;
  const host = hostId ? state.cards[hostId] : undefined;
  if (!hostId || !host || host.controller == null || host.controller === seat) return state;
  const attachments = [...host.attachments];
  // Control changes, ownership does not (rr.ownership-and-control): the hero stays the card of the seat that brought it.
  const owners = new Map([hostId, ...attachments].map((id) => [id, state.cards[id]?.owner ?? state.cards[id]?.controller ?? undefined]));
  let next = moveCard(state, hostId, { zone: "heroes", seat });
  for (const id of attachments) {
    if (next.cards[id]?.zone === "play") next = moveCard(next, id, { zone: "play", seat });
    else next = updateCard(next, id, { controller: seat });
    next = attachTo(next, id, hostId);
  }
  for (const [id, owner] of owners) {
    if (owner != null && owner !== seat) next = updateCard(next, id, { owner });
    else if (owner === seat && next.cards[id]?.owner != null) next = updateCard(next, id, { owner: undefined });
  }
  return eliminateEmpties(next, steps);
}

// The seats a RaiseThreat raises: the host's controller for `hostController`, the seats the actor names for the multi-seat words, else the one seat.
function raisedSeats(state: ScenarioState, who: Extract<Instruction, { verb: "RaiseThreat" }>["who"], actor: number, hostController: number | null | undefined): number[] {
  if (who === "hostController") return [hostController ?? actor];
  if (who === "eachSeat" || who === "picked" || who === "eventSeat") return seatsFor(state, who, actor);
  return [seatFor(state, who, actor)];
}

export function raiseFor(
  state: ScenarioState,
  instruction: Extract<Instruction, { verb: "RaiseThreat" }>,
  focus: VerbFocus,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const who = instruction.who;
  // The controller of the card the source is attached to (a claimed objective on a hero): nobody when it is attached to nothing.
  const host = who === "hostController" && focus.sourceId ? state.cards[state.cards[focus.sourceId]?.host ?? ""] : undefined;
  if (who === "hostController" && host?.controller == null) return state;
  const seats = raisedSeats(state, who, focus.seat, host?.controller);
  const amount = instruction.amount == null ? 1 : resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  let next = state;
  for (const seat of seats) {
    const count = instruction.perCommitted ? committedHeroes(next, seat, instruction.perCommitted.exceptSphere, ctx) : 1;
    next = raiseThreat(next, seat, amount * count, steps, currentCause(steps, UNATTRIBUTED));
    // "After your threat is raised by an encounter card effect" (08062:A:1).
    next = noteEncounterThreat(next, seat, amount * count, focus.sourceId, ctx);
  }
  // An encounter or quest card's raise is heard by Elfhelm (02100:A:1).
  return encounterRaised(next, seats, focus.sourceId, ctx);
}

// The heroes a seat has committed to the quest, leaving out those of one sphere ("each non-Fellowship hero he committed").
function committedHeroes(state: ScenarioState, seat: number, exceptSphere: string | undefined, ctx: ReduceContext): number {
  return (state.seats[seat]?.heroes ?? []).filter((id) => {
    const hero = state.cards[id];
    return hero?.committed === true && (exceptSphere == null || printedOf(ctx.cards, hero.code).sphere !== exceptSphere);
  }).length;
}

// Cards come off the top of the encounter deck into its discard pile until `count` enemies are among them, or the deck is
// empty (rr.effects: as many as there are). Each of those enemies is then put into play engaged with the first player
// (141045:A:2): it has engaged that player (rr.engaged), "cannot be engaged" or not (engageWith).
function discardUntilEnemies(state: ScenarioState, count: number, ctx: ReduceContext, steps: EngineStep[], to?: "staging"): ScenarioState {
  let next = state;
  const enemies: string[] = [];
  while (enemies.length < count) {
    const top = next.encounterDeck[0];
    if (!top) break;
    next = updateCard(moveCard(next, top, { zone: "encounterDiscard" }), top, { face: "up" });
    if (printedOf(ctx.cards, next.cards[top]?.code ?? "").type === "enemy") enemies.push(top);
  }
  // Engaged with the first player, or added to the staging area (They Are Coming!, 142056:A:2).
  for (const id of enemies) next = to === "staging" ? moveEncounter(next, id, "staging", next.firstPlayer, ctx, steps) : engageWith(next, next.firstPlayer, id, steps);
  return next;
}

// Damage on each ally in play, those with willpower at most `maxWillpower` when it is named (141071:A:1). Willpower is read
// once for all of them, before any damage is placed. A player card's effect is a player card effect (immunity applies).
function damageAllies(
  state: ScenarioState,
  instruction: Extract<Instruction, { verb: "DamageAll" }>,
  focus: VerbFocus,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const kind = source && isPlayerType(printedOf(ctx.cards, source.code)) ? "player" : "framework";
  const targets = livingSeats(state)
    .flatMap((seat) => characters(state, seat, ctx.cards))
    .filter((id) => {
      const card = state.cards[id];
      if (!card || printedOf(ctx.cards, card.code).type !== instruction.type) return false;
      return instruction.maxWillpower == null || modifiedStat(state, card, "willpower", ctx.cards) <= instruction.maxWillpower;
    });
  let next = state;
  for (const id of targets) next = placeDamage(next, id, instruction.amount, ctx.cards, steps, kind, currentCause(steps, UNATTRIBUTED));
  return next;
}

// The seat discards cards from its hand chosen by the seed, one roll each.
function discardRandom(state: ScenarioState, seat: number, amount: number, sourceId: string | null, ctx: ReduceContext): ScenarioState {
  let next = state;
  for (let count = 0; count < amount; count += 1) {
    // A card a player card cannot discard (Lost in the Wild, 18026:A:1) is not among the cards drawn at random.
    const hand = (next.seats[seat]?.hand ?? []).filter((held) => !barredFromPlayerDiscard(next, ctx, held, sourceId));
    if (hand.length === 0) break;
    const id = hand[nextUint(next.seed, next.seedCursor) % hand.length];
    next = { ...next, seedCursor: next.seedCursor + 1 };
    const card = id ? next.cards[id] : undefined;
    if (!id || !card) break;
    // "After a card is discarded from your hand" hears a random discard too.
    next = queueEvent(moveCard(next, id, { zone: "discard", seat: card.owner ?? seat }), { trigger: "discardedFromHand", seat: card.owner ?? seat, cardId: id });
  }
  return next;
}

// The progress a quest progress instruction moves: X per player in the game ("remove X progress ... X is the number of
// players", 141026:B:2). A removal takes no more than the current quest card holds, so its count stops at 0.
export function questProgressMoved(
  state: ScenarioState,
  instruction: Extract<Instruction, { verb: "RemoveQuestProgress" | "PlaceQuestProgress" }>,
): number {
  const amount = instruction.perPlayer * livingSeats(state).length;
  if (instruction.verb === "PlaceQuestProgress") return amount;
  const stage = state.questStage ? state.cards[state.questStage] : undefined;
  return Math.max(0, Math.min(amount, stage?.progress ?? 0));
}

// Progress comes off the current quest card, `removed` from questProgressMoved. The step records it as a negative amount.
function removeQuestProgress(state: ScenarioState, removed: number, steps: EngineStep[]): ScenarioState {
  return takeProgressOff(state, state.questStage, removed, steps);
}

function discardTarget(
  state: ScenarioState,
  kind: string,
  focus: VerbFocus,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const id = kind === "self" || kind === "host" || kind === "picked" || kind === "previous" || kind === "subject" || kind === "attacker" ? refCard(state, kind, frameScope(state, focus.seat, focus.sourceId)) : null;
  if (!id || !state.cards[id]) return state;
  // "Unique locations cannot be discarded from play by encounter card effects" (12193:B:1): the card holds the flag.
  if (flagged(state, id, "cannotBeDiscardedByEncounter") && isEncounterCardEffect(state, ctx.cards, focus.sourceId)) return state;
  return destroyCard(state, id, ctx.cards, steps);
}

// The reveal frame of the source card keeps the surge it was given for the rest of that reveal.
export function markSurge(state: ScenarioState, sourceId: string | null): ScenarioState {
  for (let index = state.stack.length - 1; index >= 0; index -= 1) {
    const frame = state.stack[index];
    if (frame?.frame !== "reveal" || frame.cardId !== sourceId || frame.data.kind !== "reveal") continue;
    const stack = state.stack.map((entry, at) =>
      at === index && entry.data.kind === "reveal" ? { ...entry, data: { ...entry.data, surge: true } } : entry,
    );
    return { ...state, stack };
  }
  return state;
}

export function holdsNow(
  state: ScenarioState,
  instruction: Instruction,
  scope: { actor: number; sourceId: string | null; returned: number },
  ctx: ReduceContext,
): boolean {
  if (!("when" in instruction) || !instruction.when) return true;
  // A stat condition is not a gate: the modifier carries it and it is read with the stat (attack-verbs.ts).
  if (instruction.verb === "ModifyStat" && isStatCondition(instruction.when)) return true;
  const frame = frameScope(state, scope.actor, scope.sourceId);
  return holds(state, instruction.when, { ...scope, ...(frame.picked ? { picked: frame.picked } : {}), ...(frame.subject ? { subject: frame.subject } : {}), ...(frame.other ? { other: frame.other } : {}), ...(frame.x != null ? { x: frame.x } : {}), ...(frame.dealt != null ? { dealt: frame.dealt } : {}), ...(frame.excess != null ? { excess: frame.excess } : {}) }, ctx);
}
