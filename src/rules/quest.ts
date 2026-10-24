import type { EngineStep } from "./intents.ts";
import { destroyCard, modifiedStat, raiseThreat } from "./keywords.ts";
import type { PrintedCard } from "./printed.ts";
import { printedOf } from "./printed.ts";
import type { ScenarioState } from "./state.ts";
import { livingSeats, updateCard, withMode } from "./state.ts";
import { moveCard } from "./zones.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

export function stagingThreat(state: ScenarioState, cards: Cards): number {
  let total = 0;
  for (const id of state.staging) {
    const instance = state.cards[id];
    if (!instance) continue;
    total += modifiedStat(state, instance, "threat", cards);
  }
  return total;
}

export function committedWillpower(state: ScenarioState, cards: Cards): number {
  let total = 0;
  for (const seat of state.seats) {
    if (seat.eliminated) continue;
    for (const id of [...seat.heroes, ...seat.play]) {
      const instance = state.cards[id];
      if (!instance?.committed) continue;
      total += modifiedStat(state, instance, "willpower", cards);
    }
  }
  return total;
}

export function resolveQuest(state: ScenarioState, cards: Cards, steps: EngineStep[]): ScenarioState {
  const willpower = committedWillpower(state, cards);
  const threat = stagingThreat(state, cards);
  let next = state;
  if (willpower < threat) {
    const seat = next.seats[next.firstPlayer];
    if (seat && !seat.eliminated) next = raiseThreat(next, next.firstPlayer, threat - willpower, steps);
  } else if (willpower > threat) {
    next = placeQuestProgress(next, willpower - threat, cards, steps);
  }
  return clearCommitted(next);
}

function placeQuestProgress(
  state: ScenarioState,
  amount: number,
  cards: Cards,
  steps: EngineStep[],
): ScenarioState {
  let remaining = amount;
  let next = state;
  const locationId = next.activeLocation;
  if (locationId && remaining > 0) {
    const location = next.cards[locationId];
    if (location) {
      const printed = printedOf(cards, location.code);
      if (printed.questPoints != null) {
        const need = Math.max(0, printed.questPoints - location.progress);
        const placed = Math.min(remaining, need);
        if (placed > 0) {
          next = updateCard(next, locationId, { progress: location.progress + placed });
          steps.push({ kind: "progress", targetId: locationId, amount: placed });
          remaining -= placed;
        }
        const updated = next.cards[locationId];
        if (updated && updated.progress >= printed.questPoints) {
          next = destroyCard(next, locationId, cards, steps);
        }
      }
    }
  }
  if (remaining > 0 && next.questStage && !next.stageCleared) {
    const stageId = next.questStage;
    const stage = next.cards[stageId];
    if (stage) {
      const printed = printedOf(cards, stage.code);
      if (printed.questPoints == null) {
        next = updateCard(next, stageId, { progress: stage.progress + remaining });
        steps.push({ kind: "progress", targetId: stageId, amount: remaining });
      } else {
        const need = Math.max(0, printed.questPoints - stage.progress);
        const placed = Math.min(remaining, need);
        if (placed > 0) {
          next = updateCard(next, stageId, { progress: stage.progress + placed });
          steps.push({ kind: "progress", targetId: stageId, amount: placed });
        }
        const updated = next.cards[stageId];
        if (updated && updated.progress >= printed.questPoints) {
          next = advanceStage(next, cards, steps, remaining - placed);
        }
      }
    }
  }
  return next;
}

function advanceStage(state: ScenarioState, cards: Cards, steps: EngineStep[], overflow: number): ScenarioState {
  let next = state;
  let carried = overflow;
  const guard = next.stages.length + 1;
  for (let hop = 0; hop < guard; hop += 1) {
    const currentId = next.questStage;
    if (!currentId) return { ...next, stageCleared: true };
    const current = next.cards[currentId];
    if (!current) return { ...next, stageCleared: true };
    const index = next.stages.findIndex((stage) => stage.code === current.code);
    const nextCode = index < 0 ? undefined : next.stages[index + 1]?.code;
    const nextId = nextCode ? next.questDeck.find((id) => next.cards[id]?.code === nextCode) : undefined;
    if (!nextId) return clearStage(next);
    next = moveCard(next, currentId, { zone: "setAside" });
    next = moveCard(next, nextId, { zone: "questStage" });
    const arrived = next.cards[nextId];
    const printed = printedOf(cards, arrived?.code ?? "");
    const before = arrived?.progress ?? 0;
    if (printed.questPoints == null) {
      if (carried > 0) {
        next = updateCard(next, nextId, { face: "B", progress: before + carried });
        steps.push({ kind: "progress", targetId: nextId, amount: carried });
      } else {
        next = updateCard(next, nextId, { face: "B" });
      }
      steps.push({ kind: "advance", cardId: nextId });
      return next;
    }
    const need = Math.max(0, printed.questPoints - before);
    const placed = Math.min(carried, need);
    next = updateCard(next, nextId, { face: "B", progress: before + placed });
    if (placed > 0) steps.push({ kind: "progress", targetId: nextId, amount: placed });
    steps.push({ kind: "advance", cardId: nextId });
    const updated = next.cards[nextId];
    if (!updated || updated.progress < printed.questPoints) return next;
    carried -= placed;
  }
  return { ...next, stageCleared: true };
}

function clearStage(state: ScenarioState): ScenarioState {
  return { ...state, stageCleared: true };
}

function clearCommitted(state: ScenarioState): ScenarioState {
  let next = state;
  for (const instance of Object.values(state.cards)) {
    if (!instance.committed) continue;
    next = updateCard(next, instance.id, { committed: false });
  }
  return next;
}

export function travelTo(state: ScenarioState, locationId: string, cards: Cards): ScenarioState | null {
  if (state.activeLocation) return null;
  const instance = state.cards[locationId];
  if (!instance || instance.zone !== "staging") return null;
  if (printedOf(cards, instance.code).type !== "location") return null;
  return moveCard(state, locationId, { zone: "activeLocation" });
}

export function stagingLocations(state: ScenarioState, cards: Cards): string[] {
  return state.staging.filter((id) => {
    const instance = state.cards[id];
    return instance != null && printedOf(cards, instance.code).type === "location";
  });
}

export function stagingEnemies(state: ScenarioState, cards: Cards): string[] {
  return state.staging.filter((id) => {
    const instance = state.cards[id];
    return instance != null && printedOf(cards, instance.code).type === "enemy";
  });
}

export function engageEnemy(state: ScenarioState, seat: number, enemyId: string, steps: EngineStep[]): ScenarioState {
  const instance = state.cards[enemyId];
  if (!instance || instance.zone !== "staging") return state;
  if (state.seats[seat]?.eliminated) return state;
  const moved = moveCard(state, enemyId, { zone: "engaged", seat });
  steps.push({ kind: "engage", seat, enemyId });
  return moved;
}

export function qualifyingEnemies(state: ScenarioState, seat: number, cards: Cards): string[] {
  const threat = state.seats[seat]?.threat ?? 0;
  const found: { id: string; cost: number }[] = [];
  for (const id of stagingEnemies(state, cards)) {
    const instance = state.cards[id];
    if (!instance) continue;
    const cost = printedOf(cards, instance.code).engagementCost;
    if (cost == null || cost > threat) continue;
    found.push({ id, cost });
  }
  found.sort((left, right) => left.cost - right.cost || left.id.localeCompare(right.id));
  return found.map((entry) => entry.id);
}

export function engagementStep(state: ScenarioState, cards: Cards, steps: EngineStep[]): ScenarioState {
  const seats = livingSeats(state);
  const cursor = state.engagement ?? { ordinal: 0, engagedThisPass: false };
  if (cursor.ordinal >= seats.length) {
    if (!cursor.engagedThisPass) return { ...withMode(state, "combatStart"), engagement: null };
    return { ...state, engagement: { ordinal: 0, engagedThisPass: false } };
  }
  const seat = seats[cursor.ordinal];
  if (seat == null) return { ...withMode(state, "combatStart"), engagement: null };
  const options = qualifyingEnemies(state, seat, cards);
  if (options.length === 0) {
    return { ...state, engagement: { ...cursor, ordinal: cursor.ordinal + 1 } };
  }
  const lowestId = options[0];
  if (!lowestId) return state;
  const lowestCost = printedOf(cards, state.cards[lowestId]?.code ?? "").engagementCost;
  const tied = options.filter((id) => {
    const instance = state.cards[id];
    return instance != null && printedOf(cards, instance.code).engagementCost === lowestCost;
  });
  if (tied.length > 1) {
    return {
      ...state,
      engagement: cursor,
      activeSeat: state.firstPlayer,
      window: { kind: "chooseEnemy", reason: "engagement", seat, options: tied },
    };
  }
  const engaged = engageEnemy(state, seat, lowestId, steps);
  return {
    ...engaged,
    engagement: { ordinal: cursor.ordinal + 1, engagedThisPass: true },
  };
}
