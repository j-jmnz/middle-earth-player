// Rules: rr.objective-cards, rr.quest-advancement, rr.in-play-and-out-of-play, rr.then (data/rules/entries.json); ledger lines 900301:A:2,
// 900302:A:2, 900307:A:1, 900308:A:3.
//
// The nightmare family's verbs for Escape from Dol Guldur Nightmare: prisoners, the return to an earlier stage, the Nazgûl out of play and
// the Dol Guldur locations' resource tokens. Dispatched by families/nightmare.ts run.
import type { Amount, CardRef } from "../../../catalog/boundary.ts";

import { frameScope, refCard, resolveAmount } from "../../interpret/amounts.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { releaseAttachments } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, livingSeats, updateCard } from "../../core/state.ts";
import { patchTop } from "../../windows/windows.ts";
import { moveCard } from "../../core/zones.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { twinCode } from "./guards.ts";
import { campaignTurnsDown, heroesOf, prisonerHeroes, prisonersOfSeat } from "../prisoner/index.ts";
import { captureHero } from "../south/captive.ts";

// TakeMorePrisoners: heroes are captured at random, from the players who have none captured, until 1 (1 or 2 players), 2 (3 players) or 3
// (4 players) are the prisoner (900301:A:2).
export function takeMorePrisoners(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const players = livingSeats(state).length;
  const wanted = players <= 2 ? 1 : players - 1;
  let next = state;
  while (prisonerHeroes(next).length < wanted) {
    const free = heroesOf(next, ctx).filter((id) => {
      const seat = next.cards[id]?.controller;
      return seat != null && prisonersOfSeat(next, seat).length === 0;
    });
    const rolled = shuffleIds(free, next.seed, next.seedCursor);
    const chosen = rolled.ids[0];
    if (!chosen) return next;
    next = captureHero({ ...next, seedCursor: rolled.cursor }, chosen, null, true, campaignTurnsDown(next));
  }
  return next;
}

// TakeHeroPrisoner: the hero this attack damaged, still in play and not yet a prisoner, is turned facedown as one, keeping its damage (900302:A:2).
// The effect's X is 1 when a hero was captured and 0 otherwise, so the part after "Then" resolves only when this one did (rr.then).
export function takeHeroPrisoner(state: ScenarioState, card: CardRef, focus: Focus, ctx: ReduceContext): ScenarioState {
  const data = effectData(state);
  const id = refCard(state, card, frameScope(state, focus.seat, focus.sourceId));
  const hero = id ? state.cards[id] : undefined;
  let next = state;
  let captured = 0;
  if (id && hero && (data?.dealt ?? 0) > 0 && hero.zone === "heroes" && printedOf(ctx.cards, hero.code).type === "hero") {
    next = updateCard(captureHero(state, id, null, true, campaignTurnsDown(state)), id, { damage: hero.damage });
    captured = 1;
  }
  const after = effectData(next);
  return after ? patchTop(next, { data: { ...after, x: captured } }) : next;
}

// ReturnToStage: the current quest card goes back into the quest deck, faceup on side A with no progress, and the quest card of stage `stage`
// (set aside when it was defeated) is the current quest again on side B, with no progress (900302:A:2).
export function returnToStage(state: ScenarioState, stage: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const currentId = state.questStage;
  const code = state.stages[stage - 1]?.code;
  const earlier = code ? Object.values(state.cards).find((card) => card.code === code && card.zone === "setAside") : undefined;
  if (!currentId || !earlier || state.cards[currentId]?.code === code) return state;
  let next = releaseAttachments(state, currentId, ctx.cards, steps);
  next = updateCard(moveCard(next, currentId, { zone: "questDeck" }), currentId, { face: "A", progress: 0 });
  next = updateCard(moveCard(next, earlier.id, { zone: "questStage" }), earlier.id, { face: "B", progress: 0 });
  steps.push({ kind: "advance", cardId: earlier.id });
  return next;
}

// EngageOutOfPlay: the first copy found out of play (set aside, the encounter deck, its discard pile, the victory display) enters play engaged
// with the first player (900307:A:1).
export function engageOutOfPlay(state: ScenarioState, code: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const twin = twinCode(state, code, ctx.cards);
  if (Object.values(state.cards).some((card) => card.code === twin && inPlay(card.zone))) return state;
  const id = [...state.setAside, ...state.encounterDeck, ...state.encounterDiscard, ...state.victory].find((entry) => state.cards[entry]?.code === twin);
  if (!id) return state;
  return moveEncounter(updateCard(state, id, { face: "up" }), id, "engaged", state.firstPlayer, ctx, steps);
}

// PlaceResourceTokens: resource tokens go on the card named, while it is in play (900302:A:1, 900305:A:2, 900306:A:2).
export function placeResourceTokens(state: ScenarioState, on: CardRef, amount: Amount, focus: Focus, ctx: ReduceContext): ScenarioState {
  const scope = frameScope(state, focus.seat, focus.sourceId);
  const id = refCard(state, on, scope);
  const card = id ? state.cards[id] : undefined;
  const count = resolveAmount(state, amount, scope, ctx);
  return card && inPlay(card.zone) && count > 0 ? updateCard(state, card.id, { resources: card.resources + count }) : state;
}

// MoveResourceFromHeroes: each hero the actor controls with a resource gives 1 to the card named (900308:A:3).
export function moveResourceFromHeroes(state: ScenarioState, to: CardRef, focus: Focus): ScenarioState {
  const target = refCard(state, to, frameScope(state, focus.seat, focus.sourceId));
  if (!target || !state.cards[target]) return state;
  let next = state;
  for (const heroId of state.seats[focus.seat]?.heroes ?? []) {
    const hero = next.cards[heroId];
    const card = next.cards[target];
    if (!hero || !card || hero.resources <= 0) continue;
    next = updateCard(updateCard(next, heroId, { resources: hero.resources - 1 }), target, { resources: card.resources + 1 });
  }
  return next;
}
