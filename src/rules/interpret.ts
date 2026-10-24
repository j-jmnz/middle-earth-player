import type { Effect, Instruction } from "../catalog/boundary.ts";

import type { EngineStep } from "./intents.ts";
import { placeDamage, playerCardEffectCanChoose, raiseThreat } from "./keywords.ts";
import { isPlayerType, printedOf, type PrintedCard } from "./printed.ts";
import { engageEnemy, stagingEnemies, stagingLocations, travelTo } from "./quest.ts";
import type { ScenarioState } from "./state.ts";
import { livingSeats, updateCard } from "./state.ts";
import { withFrame } from "./windows.ts";
import { moveCard } from "./zones.ts";

export type ReduceContext = {
  effects: readonly Effect[];
  cards: ReadonlyMap<string, PrintedCard>;
};

type Focus = { seat: number; sourceId: string | null };

export function addToStaging(state: ScenarioState, id: string): ScenarioState {
  const instance = state.cards[id];
  if (!instance) return state;
  const moved = moveCard(state, id, { zone: "staging" });
  return updateCard(moved, id, { face: "up" });
}

export function revealEncounter(
  state: ScenarioState,
  seat: number,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const id = state.encounterDeck[0];
  if (!id) return state;
  let next = moveCard(state, id, { zone: "staging" });
  next = updateCard(next, id, { face: "up", controller: seat });
  steps.push({ kind: "reveal", seat, cardId: id });
  const printed = printedOf(ctx.cards, next.cards[id]?.code ?? "");
  if (printed.keywords.peril) next = { ...next, perilSeat: seat };
  if (printed.keywords.doomed != null && printed.keywords.doomed > 0) {
    for (let index = 0; index < next.seatCount; index += 1) {
      next = raiseThreat(next, index, printed.keywords.doomed, steps);
    }
  }
  next = runRevealed(next, id, seat, printed.keywords.peril, ctx, steps);
  const revealing = next.seats[seat];
  if (printed.keywords.surge && !next.lost && !next.failure && revealing && !revealing.eliminated) {
    next = revealEncounter(next, seat, ctx, steps);
  }
  if (printed.keywords.peril) next = { ...next, perilSeat: null };
  return next;
}

function runRevealed(
  state: ScenarioState,
  id: string,
  seat: number,
  peril: boolean,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const code = state.cards[id]?.code;
  if (!code) return state;
  const matching = ctx.effects.some((effect) => effect.cardCode === code && effect.timing === "whenRevealed");
  if (!matching) return state;
  return withFrame(state, "whenRevealed", id, peril, (framed) => {
    return runEffects(framed, id, ["whenRevealed"], seat, ctx, steps);
  }, steps);
}

export function stageAll(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const seat of livingSeats(state)) {
    if (next.lost || next.failure) return next;
    if (next.seats[seat]?.eliminated) continue;
    next = revealEncounter(next, seat, ctx, steps);
  }
  return next;
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

function runEffect(
  state: ScenarioState,
  effect: Effect,
  sourceId: string,
  seat: number,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  let next = state;
  for (const instruction of effect.instructions) {
    next = runInstruction(next, instruction, { seat, sourceId }, ctx, steps);
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
  switch (instruction.verb) {
    case "Draw":
      return drawOne(state, focus.seat, steps);
    case "GainResources":
      return gainSeatResources(state, focus.seat, steps);
    case "RevealStaging":
      return revealEncounter(state, focus.seat, ctx, steps);
    case "RaiseThreat":
      return raiseThreat(state, focus.seat, 1, steps);
    case "PlaceProgress":
      return placeOneProgress(state, focus.sourceId, steps);
    case "DealDamage":
      return dealInstructionDamage(state, focus, ctx, steps);
    case "Travel": {
      const locationId = stagingLocations(state, ctx.cards)[0];
      if (!locationId) return state;
      const traveled = travelTo(state, locationId, ctx.cards);
      if (!traveled) return { ...state, failure: "Travel was refused" };
      return traveled;
    }
    case "Engage": {
      const enemyId = stagingEnemies(state, ctx.cards)[0];
      if (!enemyId) return state;
      return engageEnemy(state, focus.seat, enemyId, steps);
    }
    case "DealShadow":
      return focus.sourceId ? dealOneShadow(state, focus.sourceId) : state;
    case "ResolveEffect":
      return withFrame(state, "ResolveEffect", focus.sourceId, false, (framed) => framed, steps);
    case "Exhaust":
      return focus.sourceId ? updateCard(state, focus.sourceId, { exhausted: true }) : state;
    case "Ready":
      return focus.sourceId ? updateCard(state, focus.sourceId, { exhausted: false }) : state;
    case "Commit":
      return focus.sourceId
        ? updateCard(state, focus.sourceId, { committed: true, exhausted: true })
        : state;
    default:
      return { ...state, failure: `Unimplemented instruction ${instruction.verb}` };
  }
}

export function drawOpeningHand(state: ScenarioState, seat: number, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (let draw = 0; draw < 6; draw += 1) next = drawOne(next, seat, steps);
  return next;
}

export function drawOne(state: ScenarioState, seat: number, steps: EngineStep[]): ScenarioState {
  if (state.seats[seat]?.eliminated) return state;
  const id = state.seats[seat]?.deck[0];
  if (!id) return state;
  const next = moveCard(state, id, { zone: "hand", seat });
  steps.push({ kind: "draw", seat, cardId: id });
  return next;
}

export function gainSeatResources(state: ScenarioState, seat: number, steps: EngineStep[]): ScenarioState {
  const heroes = state.seats[seat]?.heroes ?? [];
  let next = state;
  for (const heroId of heroes) {
    const hero = next.cards[heroId];
    if (!hero) continue;
    next = updateCard(next, heroId, { resources: hero.resources + 1 });
    steps.push({ kind: "gainResource", seat, heroId });
  }
  return next;
}

function placeOneProgress(state: ScenarioState, sourceId: string | null, steps: EngineStep[]): ScenarioState {
  const id = sourceId ?? state.questStage;
  if (!id || !state.cards[id]) return state;
  const instance = state.cards[id];
  if (!instance) return state;
  steps.push({ kind: "progress", targetId: id, amount: 1 });
  return updateCard(state, id, { progress: instance.progress + 1 });
}

export function dealOneShadow(state: ScenarioState, enemyId: string): ScenarioState {
  const enemy = state.cards[enemyId];
  const top = state.encounterDeck[0];
  if (!enemy || enemy.shadowId || !top) return state;
  const moved = moveCard(state, top, { zone: "shadow", enemyId });
  return updateCard(moved, top, { face: "down" });
}

export function searchSetup(
  state: ScenarioState,
  kind: "player" | "encounter",
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const effects = ctx.effects.filter((effect) => effect.timing === "setup");
  if (effects.length === 0) return state;
  let next = state;
  for (const effect of effects) {
    const found = setupIds(next, effect.cardCode, kind);
    for (const foundId of found) {
      const seat = next.cards[foundId]?.controller ?? next.firstPlayer;
      next = moveCard(next, foundId, { zone: "setAside" });
      next = runEffectBody(next, effect, foundId, seat, ctx, steps);
      if (next.failure || next.lost) return next;
    }
  }
  return next;
}

function runEffectBody(
  state: ScenarioState,
  effect: Effect,
  sourceId: string,
  seat: number,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  return withFrame(state, "setup", sourceId, false, (framed) => {
    return runEffect(framed, effect, sourceId, seat, ctx, steps);
  }, steps);
}

function dealInstructionDamage(
  state: ScenarioState,
  focus: Focus,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const printed = source ? printedOf(ctx.cards, source.code) : undefined;
  const playerEffect = printed != null && isPlayerType(printed.type);
  let next = state;
  for (const id of damageTargets(state, ctx, focus.sourceId, playerEffect)) {
    next = placeDamage(next, id, 1, ctx.cards, steps, playerEffect ? "player" : "framework");
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

function setupIds(state: ScenarioState, code: string, kind: "player" | "encounter"): string[] {
  if (kind === "encounter") {
    return state.encounterDeck.filter((id) => state.cards[id]?.code === code);
  }
  const ids: string[] = [];
  for (let seat = 0; seat < state.seatCount; seat += 1) {
    for (const id of state.seats[seat]?.deck ?? []) {
      if (state.cards[id]?.code === code) ids.push(id);
    }
  }
  return ids;
}
