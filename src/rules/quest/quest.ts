// Rules: hon.battle, hon.siege, rr.quest-advancement, rr.step-3-4, rr.engagement-check, rr.optional-engagement, rr.engaged,
// rr.in-play-and-out-of-play, ltp.quest-resolution, ltp.successful-quest, ltp.unsuccessful-quest,
// ltp.explored-active-location, ltp.quest-advancement, ltp.optional-engagement, ltp.engagement-checks-intro,
// ltp.engagement-checks-repeat (data/rules/entries.json).
import { ruleCause, type Cause } from "../core/cause.ts";
import { checkCost } from "../families/costs/stats.ts";
import { engagementBarred, noteEngaged } from "../families/quest/engage.ts";
import { currentQuestHas } from "../families/quest/conditions.ts";
import { noteHostDefeated, withStagingThreat } from "../families/attachments/hold.ts";
import { progressFirstLocations } from "../families/attachments/quest.ts";
import { seatThreat } from "../families/play/hooks.ts";
import type { EngineStep } from "../core/intents.ts";
import { modifiedStat, raiseThreat, releaseAttachments } from "../core/keywords.ts";
import type { PrintedCard } from "../core/printed.ts";
import { hasQuestPoints, isLocationCard, printedOf } from "../core/printed.ts";
import type { CardInstance, ScenarioState } from "../core/state.ts";
import { flagged, livingSeats, updateCard, updateCards, withMode } from "../core/state.ts";
import { queueEvent } from "../windows/queue.ts";
import { moveCard } from "../core/zones.ts";
import { placeQuestingProgress } from "../families/defense/damage.ts";
import { travelsOverActive } from "../families/grapple/travel.ts";
import { freeSlot, makeActiveIn, placeOnActive } from "../families/south/locations.ts";
import { noteQuestPlaced, questRoom } from "../families/caves/progress.ts";
import { noteQuestPhase, overflowWaits } from "../families/wizardry/progress.ts";
import { branchFrom, reached as reachedStage } from "../families/quest/branch.ts";
import { randomStageFrom } from "../families/wilderland/random-stage.ts";
import { viewOf, withView } from "../families/breaking/areas.ts";
import { oweDiscards } from "../families/breaking/progress.ts";
import { arrivalFace, orderedNext, stageToVictory } from "../families/quest/order.ts";
import { caughtUp } from "../families/stormcaller/values.ts";
import { islandTravelTo } from "../families/island/travel.ts";
import { hasSideQuests, placeOnCurrentSideQuest } from "../families/wilderland/night-quest.ts";
import { familyOptionalEngageBarred, familyQuestResult } from "../interpret/family-hooks.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

// Printed quest points with constant effects applied, or null for a card that prints none.
export function questPointsOf(state: ScenarioState, instance: CardInstance, cards: Cards): number | null {
  const printed = printedOf(cards, instance.code);
  // A Lost Island has no quest points and cannot be explored by progress (dcce.uncharted).
  return !hasQuestPoints(printed) || (instance.face === "B" && printed.keywords.uncharted) ? null : modifiedStat(state, instance, "questPoints", cards);
}

// Printed engagement cost with constant effects applied, or null for a card that prints none.
export function engagementCostOf(state: ScenarioState, instance: CardInstance, cards: Cards): number | null {
  return printedOf(cards, instance.code).engagementCost == null ? null : modifiedStat(state, instance, "engagementCost", cards);
}

type Gate = (state: ScenarioState) => boolean;

// One card's part of the total Threat in the staging area: where it stands (in staging, engaged but contributing, or the active location
// that contributes) and the Threat it adds now.
export type ThreatSource = { id: string; threat: number; from: "staging" | "engaged" | "active" };

// The cards that make up the total Threat in the staging area, and what the table's held effects add to or take from their sum
// (withStagingThreat; the total never falls below 0). A card that "does not contribute its Threat" is left out.
export function stagingThreatSources(state: ScenarioState, cards: Cards, seat?: number): { sources: ThreatSource[]; adjust: number } {
  const view = viewOf(state, seat);
  const sources: ThreatSource[] = [];
  for (const id of view.staging) {
    const instance = view.cards[id];
    // "Does not contribute its Threat" (a flag on the card).
    if (!instance || flagged(view, id, "noThreatContribution")) continue;
    sources.push({ id, threat: modifiedStat(view, instance, "threat", cards), from: "staging" });
  }
  // An enemy engaged with a player that contributes its Threat to the staging area's ("each Ship enemy engaged with you contributes its Threat", 11060:A:1; "While engaged with a player, Faithless Desecrator
  // contributes its Threat", 12075:A:1). Only the games with ships (`sea`) or an Uncharted deck (`uncharted`) have such a card, so no other game reads the engaged enemies here.
  // `engagedThreatSeat` on a seat ("each enemy engaged with you adds its Threat ... until the end of the round", 143065:A:2) is read live: an enemy that engages that seat later counts too (rr.lasting-effects).
  const hasEngagedContributors = view.sea || view.uncharted || view.modifiers.some((modifier) => modifier.stat === "engagedThreat" || modifier.stat === "engagedThreatSeat");
  if (hasEngagedContributors) {
    view.seats.forEach((seat, index) => {
      const whole = flagged(view, `seat:${index}`, "engagedThreatSeat");
      for (const id of seat.engaged) {
        const instance = view.cards[id];
        if (instance && (whole || flagged(view, id, "engagedThreat")) && !flagged(view, id, "noThreatContribution")) sources.push({ id, threat: modifiedStat(view, instance, "threat", cards), from: "engaged" });
      }
    });
  }
  // An active location that contributes its Threat to the staging area's ("While Flooded Ruins is the active location, it contributes its Threat", 11072:A:1).
  for (const id of [view.activeLocation, view.secondActiveLocation]) {
    const instance = id ? view.cards[id] : undefined;
    if (instance && flagged(view, instance.id, "activeThreat") && !flagged(view, instance.id, "noThreatContribution")) sources.push({ id: instance.id, threat: modifiedStat(view, instance, "threat", cards), from: "active" });
  }
  const sum = sources.reduce((total, source) => total + source.threat, 0);
  return { sources, adjust: withStagingThreat(view, sum) - sum };
}

// The total Threat in the staging area; with `seat`, once stages are separate, in that seat's staging area (families/breaking/areas.ts).
export function stagingThreat(state: ScenarioState, cards: Cards, seat?: number): number {
  const { sources, adjust } = stagingThreatSources(state, cards, seat);
  return sources.reduce((total, source) => total + source.threat, adjust);
}

// Which stat a character counts when it is committed to the current quest: Attack for a quest with Battle (hon.battle), Defense for
// one with Siege (hon.siege), Willpower otherwise. A quest that has both counts Willpower: the two replacements contradict each other.
// "Using its Attack instead of its Willpower" (11005:A:2) holds whatever the quest says.
export function questStatOf(state: ScenarioState, id: string, cards: Cards): "willpower" | "attack" | "defense" {
  if (flagged(state, id, "questsWithAttack")) return "attack";
  const battle = currentQuestHas(state, "battle", cards);
  const siege = currentQuestHas(state, "siege", cards);
  return battle === siege ? "willpower" : battle ? "attack" : "defense";
}

// The Willpower (or Attack or Defense) committed to the quest; with `only`, that seat's alone (stages are separate).
export function committedWillpower(state: ScenarioState, cards: Cards, only?: number): number {
  // The quest a seat commits to is its own stage's once stages are separate (Battle and Siege read it).
  const view = viewOf(state, only);
  let total = 0;
  for (const [index, seat] of view.seats.entries()) {
    if (seat.eliminated || (only != null && index !== only)) continue;
    for (const id of [...seat.heroes, ...seat.play]) {
      const instance = view.cards[id];
      // A character committed to a side quest places its Willpower on that quest, not against the staging area (families/sidequests/quest.ts).
      if (!instance?.committed || instance.questTo != null) continue;
      // "Using its Attack instead of its Willpower" (11005:A:2).
      total += modifiedStat(view, instance, questStatOf(view, id, cards), cards);
    }
  }
  return total;
}

// Questing unsuccessfully: each seat that quested (every living seat, or the `seats` named) raises its threat by the shortfall (rr.step-3-4); `raise`
// replaces the plain raise (the quest family's waives it or waits for the Responses). The table's commit readout runs it on a copy to say whether
// a seat would reach 50.
export function failQuest(
  state: ScenarioState,
  shortfall: number,
  steps: EngineStep[],
  seats?: readonly number[],
  raise?: (state: ScenarioState, seat: number, amount: number) => ScenarioState,
): ScenarioState {
  const hearing = seats ?? livingSeats(state);
  return hearing.reduce((current, seat) => (raise ? raise(current, seat, shortfall) : raiseThreat(current, seat, shortfall, steps, ruleCause("rr.step-3-4"))), state);
}

// `canAdvance` is asked each time a stage is ready to advance, so a stage that is held back moves on
// once the card that held it back is gone.
export function resolveQuest(
  state: ScenarioState,
  cards: Cards,
  steps: EngineStep[],
  canAdvance: Gate = () => true,
  // Raises one seat's threat for the failed quest; the quest family's waives it or waits for the Responses (quest/threat.ts).
  raise?: (state: ScenarioState, seat: number, amount: number) => ScenarioState,
  // Stages are separate (mec109.multiple-staging-areas): the quest of this seat alone. Its committed Willpower is compared with the Threat in its own staging
  // area, progress goes on its own stage (or on the active location first) and only its threat rises. The commitments stay until every seat has resolved.
  only?: number,
  // The game has a card whose record answers a failed quest with an X amount (gameReadsOnTrigger): the event carries the shortfall for it.
  stampAmount = false,
): ScenarioState {
  const started = steps.length;
  const willpower = committedWillpower(state, cards, only);
  const threat = stagingThreat(state, cards, only);
  steps.push({ kind: "quest", willpower, threat, cause: ruleCause("rr.step-3-4") });
  // The seats that hear it: the one that quested, or every living seat.
  const hearing = only == null ? livingSeats(state) : [only];
  let next = state;
  // A family that places the progress or the threat itself (the Defense keyword, families/fortress) answers first; the core resolves the quest otherwise.
  const family = familyQuestResult(state, { willpower, threat, ...(only != null ? { only } : {}) }, cards, steps, canAdvance);
  if (family) next = family;
  else if (willpower < threat) {
    // Learn to Play p12-13: every player's threat dial goes up by the difference. An eliminated seat has no dial.
    next = failQuest(next, threat - willpower, steps, hearing, raise);
  } else if (willpower > threat) {
    // Progress may be assigned as damage to an enemy instead (08142).
    next = withView(next, only, (view) => placeQuestingProgress(view, willpower - threat, cards, steps, canAdvance));
  }
  // Each seat hears how its quest went ("After you quest successfully"; questing exactly equal is neither, rr.step-3-4).
  if (willpower !== threat) {
    // The failed quest's event carries the amount the threat would rise by when a record answers it with X ("place X progress here", 19051:B:2); no other game's events change.
    const stamped = willpower < threat && stampAmount;
    for (const seat of hearing) next = queueEvent(next, { trigger: willpower > threat ? "questSucceeded" : "questFailed", seat, ...(stamped ? { amount: threat - willpower } : {}) });
  }
  // A full stage whose progress an explored location's Forced effect may cancel advances once it has resolved (advanceFreed; families/wizardry/progress.ts).
  const ready = overflowWaits(next, steps, started, cards) ? next : withView(next, only, (view) => advanceReady(view, cards, steps, canAdvance));
  return only == null ? clearCommitted(ready) : ready;
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
  // Progress from questing successfully (rr.step-3-4): a location that may take it before the quest does (families/attachments/quest.ts).
  questing = false,
): ScenarioState {
  const started = steps.length;
  // The active locations take it first (rr.active-location); stage 4 of The Ring Goes South has two (families/south/locations.ts).
  const placedOn = placeOnActive(state, amount, cards, steps);
  let next = placedOn.state;
  let remaining = placedOn.remaining;
  if (remaining > 0) ({ state: next, remaining } = progressFirstLocations(next, remaining, cards, steps, questing));
  // Progress a stage turns into discards from the encounter deck (families/breaking/progress.ts).
  if (remaining > 0 && next.questStage && flagged(next, next.questStage, "progressDiscards")) {
    next = oweDiscards(next, remaining);
    remaining = 0;
  }
  // Progress a stage turns into the removal of damage from locations in play (families/aflame.ts, 11037:B:1): its record hears the amount.
  if (remaining > 0 && next.questStage && flagged(next, next.questStage, "progressHeals")) {
    next = queueEvent(next, { trigger: "progressReplaced", seat: null, cardId: next.questStage, amount: remaining });
    remaining = 0;
  }
  // Progress a stage lets the players place on a location in the staging area instead (families/island.ts, 12067:B:2): its record hears the amount.
  if (remaining > 0 && next.questStage && flagged(next, next.questStage, "progressToStaging")) {
    next = queueEvent(next, { trigger: "progressReplaced", seat: null, cardId: next.questStage, amount: remaining });
    remaining = 0;
  }
  // A side quest that is the current quest takes it instead of the main quest card; what it cannot take is discarded (emce.side-quests-in-play, families/wilderland/night-quest.ts).
  if (remaining > 0 && hasSideQuests(next)) ({ state: next, remaining } = placeOnCurrentSideQuest(next, remaining, cards, steps));
  if (remaining > 0 && next.questStage && !next.stageCleared) {
    const stageId = next.questStage;
    const stage = next.cards[stageId];
    // A card in play may limit the progress the quest card takes this round, or stop it (families/caves/progress.ts).
    remaining = Math.min(remaining, questRoom(next));
    if (stage && remaining > 0) {
      // The explored location's Forced effect may cancel this progress (Orthanc): the stage takes what it needs and advances once those effects have resolved (families/wizardry/progress.ts).
      const waits = overflowWaits(next, steps, started, cards);
      const points = questPointsOf(next, stage, cards);
      next = putOnStage(next, stageId, waits && points != null ? Math.min(remaining, Math.max(0, points - stage.progress)) : remaining, points, cards, steps, waits ? () => false : canAdvance, ruleCause("rr.step-3-4"), true);
    }
  }
  return next;
}

// Progress put on the current quest card: a quest that can advance takes what it needs, the rest does not carry over to the next stage (rr.quest-advancement); one that cannot advance
// has no upper limit (faq.progress-without-advancing); a full one advances. `counted`: the progress counts toward what a card in play limits this round (families/caves/progress.ts).
export function putOnStage(state: ScenarioState, stageId: string, amount: number, points: number | null, cards: Cards, steps: EngineStep[], canAdvance: Gate, cause: Cause, counted: boolean): ScenarioState {
  const stage = state.cards[stageId];
  if (!stage) return state;
  const advancing = points != null && canAdvance(state);
  const placed = advancing ? Math.min(amount, Math.max(0, points - stage.progress)) : amount;
  let next = state;
  if (placed > 0) {
    next = updateCard(next, stageId, { progress: stage.progress + placed });
    if (counted) next = noteQuestPlaced(next, placed);
    next = noteQuestPhase(next, placed);
    steps.push({ kind: "progress", targetId: stageId, amount: placed, cause });
  }
  const updated = next.cards[stageId];
  return advancing && updated && updated.progress >= points ? advanceStage(next, cards, steps, canAdvance) : next;
}

// The next stage arrives with no progress on it (rr.quest-advancement), side B up. A stage that prints no quest points
// (141024, 141027) is won some other way, so the quest stops there. One with 0 quest points is checked when it next takes progress.
export function advanceStage(state: ScenarioState, cards: Cards, steps: EngineStep[], canAdvance: Gate): ScenarioState {
  let next = state;
  const guard = next.stages.length + 1;
  for (let hop = 0; hop < guard; hop += 1) {
    const currentId = next.questStage;
    if (!currentId) return { ...next, stageCleared: true };
    const current = next.cards[currentId];
    if (!current) return { ...next, stageCleared: true };
    // A defeated stage that waits for the first player to choose the next one (LookAtStages) stays where it is until the choice is made.
    if (next.stageChoice === "due") return next;
    // Defeating a stage when the Stormcaller is at its stage means the players have caught up to it and win (families/stormcaller/values.ts, 12013:B:3).
    if (caughtUp(next, current.code)) return clearStage(next);
    const index = next.stages.findIndex((stage) => stage.code === current.code);
    // A quest that is ordered by its quest deck (ShuffleStages, LookAtStages, families/quest/order.ts) goes to the top stage of the deck, or asks.
    const ordered = orderedNext(next, current.code);
    if (ordered?.kind === "ask") return { ...next, stageChoice: "due" };
    if (ordered?.kind === "end") return clearStage(next);
    // A quest that branches (BranchStage, 01120:B:1) chooses the next stage at random and ends at a stage it led to.
    const branched = ordered ? null : branchFrom(next, current.code);
    if (branched) next = branched.state;
    // A stage that names AdvanceToRandomStage (19048:B:2) proceeds to one of the stages it lists at random, each played once.
    const rolled = ordered || branched ? null : randomStageFrom(next, current.code);
    if (rolled) next = rolled.state;
    const nextId = ordered ? ordered.id : rolled ? rolled.id : (() => {
      const nextCode = branched ? branched.code : index < 0 ? undefined : next.stages[index + 1]?.code;
      return nextCode ? next.questDeck.find((id) => next.cards[id]?.code === nextCode) : undefined;
    })();
    if (!nextId) return clearStage(next);
    const nextCode = next.cards[nextId]?.code;
    // The defeated quest card leaves play: the cards attached to it hear it and are discarded (rr.attachment-cards).
    next = releaseAttachments(noteHostDefeated(next, currentId), currentId, cards, steps);
    next = moveCard(next, currentId, { zone: stageToVictory(next, cards, current.code) ? "victory" : rolled?.remove ? "removed" : "setAside" });
    if (rolled || (ordered && next.stages.some((stage) => stage.deck === true))) next = { ...next, stageLeft: { to: nextId, from: currentId } };
    next = moveCard(next, nextId, { zone: "questStage" });
    next = updateCard(next, nextId, { face: arrivalFace(next, nextCode) });
    if (next.stageChoice) next = withoutStageChoice(next);
    if (nextCode) next = reachedStage(next, nextCode);
    steps.push({ kind: "advance", cardId: nextId });
    const arrived = next.cards[nextId];
    const points = arrived ? questPointsOf(next, arrived, cards) : null;
    // A stage that arrives with 0 quest points (Surprise Attack, 41005:B:2, prints 0 and adds 4 for each enemy in play) is not met at once: its When Revealed
    // effects have not resolved yet, and the check comes with the next progress it takes (advanceReady, placeQuestProgress).
    if (points == null || points === 0 || (arrived?.progress ?? 0) < points || !canAdvance(next)) return next;
  }
  return { ...next, stageCleared: true };
}

function withoutStageChoice(state: ScenarioState): ScenarioState {
  const { stageChoice: _asked, ...rest } = state;
  return rest;
}

function clearStage(state: ScenarioState): ScenarioState {
  return { ...state, stageCleared: true };
}

export function clearCommitted(state: ScenarioState): ScenarioState {
  return updateCards(state, Object.values(state.cards).filter((instance) => instance.committed).map((instance) => [instance.id, { committed: false }]));
}

export function travelTo(state: ScenarioState, locationId: string, cards: Cards, steps: EngineStep[] = []): ScenarioState | null {
  // Exploration: the active location stays where it lies and the players travel from it to the next (families/island/travel.ts).
  const mapped = islandTravelTo(state, locationId, cards, steps);
  if (mapped !== undefined) return mapped;
  // A second active location slot may be free (families/south/locations.ts).
  const slot = freeSlot(state);
  // With no slot free the active location returns to the staging area when a stage lets the players travel anyway (12041:B:1).
  if (!slot && !travelsOverActive(state)) return null;
  const instance = state.cards[locationId];
  if (!instance || instance.zone !== "staging") return null;
  if (!isLocationCard(printedOf(cards, instance.code))) return null;
  return slot ? moveCard(state, locationId, { zone: slot }) : makeActiveIn(state, locationId);
}

// The locations in the staging area; with `seat`, once stages are separate, in that seat's staging area (families/breaking/areas.ts).
export function stagingLocations(state: ScenarioState, cards: Cards, seat?: number): string[] {
  const view = viewOf(state, seat);
  return view.staging.filter((id) => {
    const instance = view.cards[id];
    return instance != null && isLocationCard(printedOf(cards, instance.code));
  });
}

// The enemies in the staging area a player may optionally engage: not one that cannot be engaged at all (141048:A:1) or
// cannot be optionally engaged (141051:A:1, 141052:A:1), and none at all while the table holds the flag ("Until the end of the round, enemies cannot be optionally engaged", 12164:A:1).
// Once stages are separate a seat optionally engages only an enemy in its own staging area (mec109.multiple-staging-areas): the acting seat, or `seat`.
export function optionalEnemies(state: ScenarioState, cards: Cards, seat?: number): string[] {
  const acting = seat ?? state.activeSeat;
  if (flagged(state, "table", "cannotBeOptionallyEngaged")) return [];
  return stagingEnemies(state, cards, acting).filter((id) => !flagged(state, id, "cannotBeEngaged") && !flagged(state, id, "cannotBeOptionallyEngaged") && !engagementBarred(state, id, acting, "engage") && !familyOptionalEngageBarred(state, id, acting, cards));
}

// The enemies in the staging area; with `seat`, once stages are separate, in that seat's staging area (families/breaking/areas.ts).
export function stagingEnemies(state: ScenarioState, cards: Cards, seat?: number): string[] {
  const view = viewOf(state, seat);
  return view.staging.filter((id) => {
    const instance = view.cards[id];
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
  // Boarding resolves only for an engagement from the staging area (dcce.boarding; families/sea/boarding.ts).
  const fromStaging = state.sea != null && state.cards[enemyId]?.zone === "staging";
  const moved = noteEngaged(moveCard(state, enemyId, { zone: "engaged", seat }), enemyId);
  steps.push({ kind: "engage", seat, enemyId });
  // Responses hear that the player engaged the enemy ("After you engage an enemy with a higher engagement cost ...").
  return queueEvent(moved, { trigger: "engaged", seat, subject: enemyId, ...(fromStaging ? { fromStaging } : {}) });
}

export function qualifyingEnemies(state: ScenarioState, seat: number, cards: Cards): string[] {
  // "Do not make engagement checks during the encounter phase" (01127:B:1): the table holds noEngagementChecks.
  if (flagged(state, "table", "noEngagementChecks")) return [];
  // The threat the seat is treated as having (families/play/hooks.ts).
  const threat = seatThreat(state, seat);
  const found: { id: string; cost: number }[] = [];
  // Engagement checks use only the seat's own staging area once stages are separate (mec109.multiple-staging-areas).
  for (const id of stagingEnemies(state, cards, seat)) {
    const instance = state.cards[id];
    // An enemy that "does not make engagement checks" is passed over (it can still be engaged optionally).
    if (!instance || flagged(state, id, "cannotBeEngaged") || flagged(state, id, "noEngagementChecks") || engagementBarred(state, id, seat, "checks")) continue;
    // With what the enemy gets while checking against this player (Orc Disguise, families/costs/stats.ts).
    const cost = checkCost(state, instance, seat, cards);
    if (cost == null || cost > threat) continue;
    found.push({ id, cost });
  }
  // Highest cost first: the check engages the enemy with the highest cost at or below threat (Learn to Play p14).
  found.sort((left, right) => right.cost - left.cost || left.id.localeCompare(right.id));
  return found.map((entry) => entry.id);
}

/** What one seat's engagement check does (rr.engagement-check): no enemy qualifies, one enemy is engaged, or several are tied for the highest engagement cost and the first player chooses among `options`. */
export type EngagementCheck = { kind: "none" } | { kind: "one"; enemyId: string } | { kind: "tied"; options: string[] };

export function engagementCheck(state: ScenarioState, seat: number, cards: Cards): EngagementCheck {
  const options = qualifyingEnemies(state, seat, cards);
  const highestId = options[0];
  if (highestId == null) return { kind: "none" };
  const highest = state.cards[highestId];
  const highestCost = highest ? checkCost(state, highest, seat, cards) : null;
  const tied = options.filter((id) => {
    const instance = state.cards[id];
    return instance != null && checkCost(state, instance, seat, cards) === highestCost;
  });
  return tied.length > 1 ? { kind: "tied", options: tied } : { kind: "one", enemyId: highestId };
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
  const check = engagementCheck(state, seat, cards);
  if (check.kind === "none") {
    return { ...state, engagement: { ...cursor, ordinal: cursor.ordinal + 1 } };
  }
  if (check.kind === "tied") {
    return {
      ...state,
      engagement: cursor,
      activeSeat: state.firstPlayer,
      window: { kind: "chooseEnemy", reason: "engagement", seat, options: check.options },
    };
  }
  const highestId = check.enemyId;
  const engaged = engageEnemy(state, seat, highestId, steps);
  return {
    ...engaged,
    engagement: { ordinal: cursor.ordinal + 1, engagedThisPass: true },
  };
}

/**
 * Which seat each enemy in staging would engage if the engagement checks ran at the threats now (rr.engagement-check): the
 * checks themselves (engagementStep) run on a copy, and a tie the first player breaks is taken as its first option. For the
 * table's foresight; it changes nothing.
 */
export function engagementForecast(state: ScenarioState, cards: Cards): ReadonlyMap<string, number> {
  const engaged = new Map<string, number>();
  let copy: ScenarioState = { ...state, engagement: null, window: null };
  for (let guard = 0; guard < 4 * (state.staging.length + 1) * state.seatCount; guard += 1) {
    const steps: EngineStep[] = [];
    let next = engagementStep(copy, cards, steps);
    if (next.window?.kind === "chooseEnemy" && next.window.options[0] != null) {
      const ordinal = (next.engagement?.ordinal ?? 0) + 1;
      next = { ...engageEnemy({ ...next, window: null }, next.window.seat, next.window.options[0], steps), engagement: { ordinal, engagedThisPass: true } };
    }
    for (const step of steps) if (step.kind === "engage") engaged.set(step.enemyId, step.seat);
    if (next.mode === "combatStart" || next === copy) break;
    copy = next;
  }
  return engaged;
}
