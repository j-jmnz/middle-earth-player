// Rules: rr.quest-advancement, rr.step-3-4, rr.engagement-check, rr.optional-engagement, rr.engaged,
// rr.in-play-and-out-of-play, ltp.quest-resolution, ltp.successful-quest, ltp.unsuccessful-quest,
// ltp.explored-active-location, ltp.quest-advancement, ltp.optional-engagement, ltp.engagement-checks-intro,
// ltp.engagement-checks-repeat (data/rules/entries.json).
import { ruleCause } from "./cause.ts";
import { checkCost } from "./families/costs-stats.ts";
import { engagementBarred, noteEngaged } from "./families/quest-engage.ts";
import { noteHostDefeated, withStagingThreat } from "./families/attachments-hold.ts";
import { progressFirstLocations } from "./families/attachments-quest.ts";
import type { EngineStep } from "./intents.ts";
import { destroyCard, modifiedStat, raiseThreat, releaseAttachments } from "./keywords.ts";
import type { PrintedCard } from "./printed.ts";
import { printedOf } from "./printed.ts";
import type { CardInstance, ScenarioState } from "./state.ts";
import { flagged, livingSeats, updateCard, withMode } from "./state.ts";
import { queueEvent } from "./queue.ts";
import { moveCard } from "./zones.ts";
import { placeQuestingProgress } from "./families/defense-damage.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

// Printed quest points with constant effects applied, or null for a card that prints none.
export function questPointsOf(state: ScenarioState, instance: CardInstance, cards: Cards): number | null {
  return printedOf(cards, instance.code).questPoints == null ? null : modifiedStat(state, instance, "questPoints", cards);
}

// Printed engagement cost with constant effects applied, or null for a card that prints none.
export function engagementCostOf(state: ScenarioState, instance: CardInstance, cards: Cards): number | null {
  return printedOf(cards, instance.code).engagementCost == null ? null : modifiedStat(state, instance, "engagementCost", cards);
}

type Gate = (state: ScenarioState) => boolean;

export function stagingThreat(state: ScenarioState, cards: Cards): number {
  let total = 0;
  for (const id of state.staging) {
    const instance = state.cards[id];
    // "Does not contribute its Threat" (a flag on the card).
    if (!instance || flagged(state, id, "noThreatContribution")) continue;
    total += modifiedStat(state, instance, "threat", cards);
  }
  return withStagingThreat(state, total);
}

export function committedWillpower(state: ScenarioState, cards: Cards): number {
  let total = 0;
  for (const seat of state.seats) {
    if (seat.eliminated) continue;
    for (const id of [...seat.heroes, ...seat.play]) {
      const instance = state.cards[id];
      if (!instance?.committed) continue;
      // "Using its Attack instead of its Willpower" (11005:A:2).
      total += modifiedStat(state, instance, flagged(state, id, "questsWithAttack") ? "attack" : "willpower", cards);
    }
  }
  return total;
}

// `canAdvance` is asked each time a stage is ready to advance, so a stage that is held back moves on
// once the card that held it back is gone.
export function resolveQuest(
  state: ScenarioState,
  cards: Cards,
  steps: EngineStep[],
  canAdvance: Gate = () => true,
  // Raises one seat's threat for the failed quest; the quest family's waives it or waits for the Responses (quest-threat.ts).
  raise?: (state: ScenarioState, seat: number, amount: number) => ScenarioState,
): ScenarioState {
  const willpower = committedWillpower(state, cards);
  const threat = stagingThreat(state, cards);
  steps.push({ kind: "quest", willpower, threat, cause: ruleCause("rr.step-3-4") });
  let next = state;
  if (willpower < threat) {
    // Learn to Play p12-13: every player's threat dial goes up by the difference. An eliminated seat has no dial.
    for (const seat of livingSeats(state)) next = raise ? raise(next, seat, threat - willpower) : raiseThreat(next, seat, threat - willpower, steps, ruleCause("rr.step-3-4"));
  } else if (willpower > threat) {
    // Progress may be assigned as damage to an enemy instead (08142).
    next = placeQuestingProgress(next, willpower - threat, cards, steps, canAdvance);
  }
  // Each seat hears how its quest went ("After you quest successfully"; questing exactly equal is neither, rr.step-3-4).
  if (willpower !== threat) {
    for (const seat of livingSeats(state)) next = queueEvent(next, { trigger: willpower > threat ? "questSucceeded" : "questFailed", seat });
  }
  return clearCommitted(advanceReady(next, cards, steps, canAdvance));
}

// A stage that is full and was held back advances as soon as it is allowed to.
function advanceReady(state: ScenarioState, cards: Cards, steps: EngineStep[], canAdvance: Gate): ScenarioState {
  const stage = state.questStage ? state.cards[state.questStage] : undefined;
  if (!stage || state.stageCleared) return state;
  const points = questPointsOf(state, stage, cards);
  if (points == null || stage.progress < points || !canAdvance(state)) return state;
  return advanceStage(state, cards, steps, canAdvance);
}

// Progress on the quest goes on the active location first, up to its quest points, and the rest on the current quest card
// (rr.active-location). A full quest card advances when `canAdvance` allows it (rr.quest-advancement); progress beyond its
// quest points is lost: "Additional progress tokens earned against the quest do not carry over to the next stage."
export function placeQuestProgress(
  state: ScenarioState,
  amount: number,
  cards: Cards,
  steps: EngineStep[],
  canAdvance: Gate,
  // Progress from questing successfully (rr.step-3-4): a location that may take it before the quest does (families/attachments-quest.ts).
  questing = false,
): ScenarioState {
  let remaining = amount;
  let next = state;
  const locationId = next.activeLocation;
  if (locationId && remaining > 0) {
    const location = next.cards[locationId];
    if (location) {
      const points = questPointsOf(next, location, cards);
      if (points != null) {
        const need = Math.max(0, points - location.progress);
        const placed = Math.min(remaining, need);
        if (placed > 0) {
          next = updateCard(next, locationId, { progress: location.progress + placed });
          steps.push({ kind: "progress", targetId: locationId, amount: placed, cause: ruleCause("rr.step-3-4") });
          remaining -= placed;
        }
        const updated = next.cards[locationId];
        if (updated && updated.progress >= points) {
          next = destroyCard(next, locationId, cards, steps, true);
        }
      }
    }
  }
  if (questing && remaining > 0) ({ state: next, remaining } = progressFirstLocations(next, remaining, cards, steps));
  if (remaining > 0 && next.questStage && !next.stageCleared) {
    const stageId = next.questStage;
    const stage = next.cards[stageId];
    if (stage) {
      const points = questPointsOf(next, stage, cards);
      if (points == null) {
        next = updateCard(next, stageId, { progress: stage.progress + remaining });
        steps.push({ kind: "progress", targetId: stageId, amount: remaining, cause: ruleCause("rr.step-3-4") });
      } else {
        // A quest that can advance takes what it needs: the rest does not carry over to the next stage
        // (rr.quest-advancement). One that cannot advance has no upper limit (faq.progress-without-advancing).
        const advancing = canAdvance(next);
        const placed = advancing ? Math.min(remaining, Math.max(0, points - stage.progress)) : remaining;
        if (placed > 0) {
          next = updateCard(next, stageId, { progress: stage.progress + placed });
          steps.push({ kind: "progress", targetId: stageId, amount: placed, cause: ruleCause("rr.step-3-4") });
        }
        const updated = next.cards[stageId];
        if (updated && updated.progress >= points && advancing) {
          next = advanceStage(next, cards, steps, canAdvance);
        }
      }
    }
  }
  return next;
}

// The next stage arrives with no progress on it (rr.quest-advancement), side B up. A stage that prints no quest points
// (141024, 141027) is won some other way, so the quest stops there. One with 0 quest points would be met at once.
function advanceStage(state: ScenarioState, cards: Cards, steps: EngineStep[], canAdvance: Gate): ScenarioState {
  let next = state;
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
    // The defeated quest card leaves play: the cards attached to it hear it and are discarded (rr.attachment-cards).
    next = releaseAttachments(noteHostDefeated(next, currentId), currentId, cards, steps);
    next = moveCard(next, currentId, { zone: "setAside" });
    next = moveCard(next, nextId, { zone: "questStage" });
    next = updateCard(next, nextId, { face: "B" });
    steps.push({ kind: "advance", cardId: nextId });
    const arrived = next.cards[nextId];
    const points = arrived ? questPointsOf(next, arrived, cards) : null;
    if (points == null || (arrived?.progress ?? 0) < points || !canAdvance(next)) return next;
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

// The enemies in the staging area a player may optionally engage: not one that cannot be engaged at all (141048:A:1) or
// cannot be optionally engaged (141051:A:1, 141052:A:1).
export function optionalEnemies(state: ScenarioState, cards: Cards): string[] {
  return stagingEnemies(state, cards).filter((id) => !flagged(state, id, "cannotBeEngaged") && !flagged(state, id, "cannotBeOptionallyEngaged") && !engagementBarred(state, id, state.activeSeat, "engage"));
}

export function stagingEnemies(state: ScenarioState, cards: Cards): string[] {
  return state.staging.filter((id) => {
    const instance = state.cards[id];
    return instance != null && printedOf(cards, instance.code).type === "enemy";
  });
}

// An enemy in the staging area engages the seat: an engagement check, an optional engagement, or an effect that engages
// one there. "Enemies cannot ... be engaged" (141048:A:1) stops it.
export function engageEnemy(state: ScenarioState, seat: number, enemyId: string, steps: EngineStep[]): ScenarioState {
  const instance = state.cards[enemyId];
  if (!instance || instance.zone !== "staging") return state;
  if (flagged(state, enemyId, "cannotBeEngaged") || engagementBarred(state, enemyId, seat, "engage")) return state;
  return engageWith(state, seat, enemyId, steps);
}

// The enemy enters the seat's play area from wherever it is, so it has engaged that player (rr.engaged). An effect that
// puts an out-of-play enemy into play engaged (141045:A:2) comes here directly: "cannot be engaged" (141048:A:1) is held
// only by enemies in play, and card abilities do not reach a card out of play (rr.in-play-and-out-of-play), so it does not
// stop the enemy, which is engaged as it enters play.
export function engageWith(state: ScenarioState, seat: number, enemyId: string, steps: EngineStep[]): ScenarioState {
  if (!state.cards[enemyId] || state.seats[seat]?.eliminated) return state;
  const moved = noteEngaged(moveCard(state, enemyId, { zone: "engaged", seat }), enemyId);
  steps.push({ kind: "engage", seat, enemyId });
  // Responses hear that the player engaged the enemy ("After you engage an enemy with a higher engagement cost ...").
  return queueEvent(moved, { trigger: "engaged", seat, subject: enemyId });
}

export function qualifyingEnemies(state: ScenarioState, seat: number, cards: Cards): string[] {
  const threat = state.seats[seat]?.threat ?? 0;
  const found: { id: string; cost: number }[] = [];
  for (const id of stagingEnemies(state, cards)) {
    const instance = state.cards[id];
    // An enemy that "does not make engagement checks" is passed over (it can still be engaged optionally).
    if (!instance || flagged(state, id, "cannotBeEngaged") || flagged(state, id, "noEngagementChecks") || engagementBarred(state, id, seat, "checks")) continue;
    // With what the enemy gets while checking against this player (Orc Disguise, families/costs-stats.ts).
    const cost = checkCost(state, instance, seat, cards);
    if (cost == null || cost > threat) continue;
    found.push({ id, cost });
  }
  // Highest cost first: the check engages the enemy with the highest cost at or below threat (Learn to Play p14).
  found.sort((left, right) => right.cost - left.cost || left.id.localeCompare(right.id));
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
  const highestId = options[0];
  if (!highestId) return state;
  const highest = state.cards[highestId];
  const highestCost = highest ? checkCost(state, highest, seat, cards) : null;
  const tied = options.filter((id) => {
    const instance = state.cards[id];
    return instance != null && checkCost(state, instance, seat, cards) === highestCost;
  });
  if (tied.length > 1) {
    return {
      ...state,
      engagement: cursor,
      activeSeat: state.firstPlayer,
      window: { kind: "chooseEnemy", reason: "engagement", seat, options: tied },
    };
  }
  const engaged = engageEnemy(state, seat, highestId, steps);
  return {
    ...engaged,
    engagement: { ordinal: cursor.ordinal + 1, engagedThisPass: true },
  };
}
