// Rules: bts.valour (data/rules/entries.json): the `threat` condition marked `valour` holds from 40 threat, from 80 while the main quest has Dire (mec113.dire).
import { encounterHolds, underBurnHolds } from "../families/aflame/values.ts";
import { familyCondition } from "./family-hooks.ts";
import { outOfPlayCopies, searchable } from "./search.ts";
import { locationThreatHolds } from "../families/grapple/values.ts";
import { islandHolds } from "../families/island/pick.ts";
import { DIRE_VALOUR_SHIFT } from "../families/black-gate/dire.ts";
import type { Condition } from "../../catalog/boundary.ts";

import { resolveAmount, type AmountScope } from "./amounts.ts";
import { questSucceeded } from "../families/costs/pay.ts";
import { discardedCost } from "../families/uncharted/cards.ts";
import { spendablePools } from "../families/costs/verbs.ts";
import { engagedThisRound } from "../families/attack/events.ts";
import { attackingHolds } from "../families/attack/strike.ts";
import { seatThreat } from "../families/play/hooks.ts";
import { distinctTraitCount, flaggedTrait, lostTrait } from "../families/misc/traits.ts";
import type { ReduceContext } from "./interpret.ts";
import { currentQuestHas, engagedThisPhase, questHasKeywords, stepHolds } from "../families/quest/conditions.ts";
import { headOf, inAreaOf } from "../families/breaking/areas.ts";
import { victoryPointsOf } from "../core/printed-stat.ts";
import { modifiedStat, versusDefender, versusHighEngagement } from "../core/keywords.ts";
import { defendingAgainst } from "../families/angmar/combat.ts";
import { effectsOf } from "../windows/listen.ts";
import { countMatching, matchesPick, pickCandidates } from "./pick.ts";
import { committedWillpower, stagingThreat } from "../quest/quest.ts";
import { cardTypeOf, printedOf, type Sphere } from "../core/printed.ts";
import type { ScenarioState } from "../core/state.ts";
import { flagged, inPlay, livingSeats } from "../core/state.ts";
import { combatStepIs } from "../families/defense/conditions.ts";
import { faceUp, flagHeld } from "../families/sidequests/contract.ts";
import { copyInVictory } from "../families/sidequests/pick.ts";
import { shadowCards } from "../core/zones.ts";
import { freeOfEncounters } from "../families/objectives/index.ts";
import { controlledByPlayers } from "../families/objectives/control.ts";
import { prisonerHero } from "../families/prisoner/index.ts";
import { tokensOn } from "../families/campaign/index.ts";
import { headingIs } from "../families/sea/heading.ts";
import { alliesWillpowerHolds } from "../families/sea/skirmisher.ts";
import { corsairHolds } from "../families/sea/corsair.ts";
import { stormcallerHolds } from "../families/stormcaller/values.ts";
import { areaOf } from "../families/stormcaller/zone.ts";
import { lastHideFailed, onStage, withTwin } from "../families/nightmare/guards.ts";
import { campaignHolds } from "../families/campaign/picks.ts";

// Who the condition is asked about. `returned` is the count the running effect has returned to staging.
// `phase` overrides the current phase for an end-of-phase event, which fires after the phase has moved on.
// `holderId` is the card a stat is read for, and `against` the enemy it attacks.
export type Scope = {
  actor: number;
  sourceId: string | null;
  returned: number;
  phase?: string;
  holderId?: string;
  against?: string;
  subject?: string;
  explored?: boolean;
  // The event a Forced effect answers was made by a player card's effect (a heal or a ready).
  byPlayerCard?: boolean;
  // The engagement a Forced effect answers was from the staging area (kept only in a game with ships).
  fromStaging?: boolean;
  // The seat the event a Response answers happened to.
  eventSeat?: number | null;
  // What the running effect has picked, and the other card the answered event names.
  picked?: readonly string[];
  other?: string;
  // The characters that took part in the player attack the effect answers (enemyAttacked).
  participants?: readonly string[];
  // The running effect's X.
  x?: number;
  // The damage the answered event placed.
  dealt?: number;
  // The damage the attack sent on past its defender (excessToShip).
  excess?: number;
  // The attack an `attackResolved` event answers dealt its enemy a shadow card with no effect, which was discarded when it resolved (18022:A:1).
  shadowBlank?: boolean;
};

// The card a `matches` condition reads.
function conditionCard(state: ScenarioState, card: Extract<Condition, { kind: "matches" }>["card"], scope: Scope): string | null {
  const source = scope.sourceId ? state.cards[scope.sourceId] : undefined;
  switch (card) {
    case "self":
      return scope.sourceId;
    case "host":
      return source?.host ?? null;
    case "subject":
      return scope.subject ?? null;
    case "other":
      return scope.other ?? null;
    case "activeLocation":
      return state.activeLocation;
    case "picked":
      return scope.picked?.at(-1) || null;
    case "previous":
      return scope.picked?.at(-2) || null;
    case "attacker":
      return state.pendingAttack?.enemyId ?? state.pendingStrike?.enemyId ?? null;
    case "defender":
      return state.pendingAttack?.defenderId ?? null;
  }
}

export function holds(state: ScenarioState, named: Condition, scope: Scope, ctx: ReduceContext): boolean {
  // A card named by code is the Nightmare card of its title when the recipe replaced it (families/nightmare/guards.ts).
  const condition = withTwin(state, named, ctx.cards);
  // A family's own condition kind (interpret/family-hooks.ts): asked first, null when it is not the family's, so the cases below stand.
  const familial = familyCondition(state, condition, scope, ctx);
  if (familial !== null) return familial;
  switch (condition.kind) {
    // A family's condition hook answers these before this switch (south: noneDiscarded; black-gate: embassy; wilderland: the campaign log, the Caves deck, the quest deck, Discover, the Fate of Wilderland's); the cases only complete the switch.
    case "noneDiscarded": case "lastPlayer": case "logged": case "treasuresLogged": case "beldisBox": case "cavesDeck": case "pileHas": case "facedownUnder": case "questDeck": case "soleAttacker": case "captives": case "discardedHasShadowOrTentacle": case "firstLetterMatches":
    case "attackedThisPhase": case "namedFlag": case "discoverUnavailable": case "encounterPlacedOnStage": case "playerUnengaged": case "hasWizardry": case "questProgressNoted": case "guardianCanChange": case "onDial": case "canAttachToDial": case "embassy": case "lastFortitudeFailed": case "lastEscapeFailed": case "lastEscapePassed": case "lastLocateFailed": case "lastLocatePassed": case "hasPass": case "playerWithoutReady": case "firstTreachery": case "lastFortitudePassed": case "captured": case "fortitudeFailed": case "hostControlledByActor": case "currentQuest": case "currentQuestProgress": case "questLeads": case "hitPointsLeft": case "timeOfDay": case "safeActive": case "setAsideHas":
      return false;
    case "hideFailed":
      return state.hideFailures.some(
        (failure) =>
          failure.seat === scope.actor &&
          failure.round === state.round &&
          (condition.scope === "round" || failure.phase === state.phase),
      );
    case "lastHideFailed":
      return lastHideFailed(state);
    case "onStage":
      return onStage(state, condition.stage);
    case "hasEngaged": {
      const trait = condition.trait;
      return (state.seats[scope.actor]?.engaged ?? []).some((id) => trait == null || hasTrait(state, id, trait, ctx));
    }
    case "sourceIn":
      return sourceIn(state, scope.sourceId, condition.zone);
    // The objectives and prisoner families (families/objectives.ts, families/prisoner.ts).
    case "freeOfEncounters":
      return freeOfEncounters(state, scope.sourceId);
    case "controlledByPlayers":
      return controlledByPlayers(state, scope.sourceId);
    case "island":
      return islandHolds(state, condition);
    case "handSize":
      return livingSeats(state).every((seat) => (state.seats[seat]?.hand.length ?? 0) <= condition.max);
    case "pursuit":
    case "picked":
    case "anyHand":
      return campaignHolds(state, condition);
    case "prisoner":
      return (prisonerHero(state) != null) === condition.is;
    case "inVictory":
      return state.victory.some((id) => state.cards[id]?.code === condition.code) === condition.is;
    case "faceUp":
      return faceUp(state, scope.sourceId, condition.side);
    case "flag":
      return flagHeld(state, condition, scope.sourceId, scope.actor);
    case "copyInVictory":
      return copyInVictory(state, conditionCard(state, condition.card, scope), ctx) === (condition.is !== false);
    case "otherLocationInPlay":
      return [...state.staging, state.activeLocation, state.secondActiveLocation].some(
        (id) => id != null && id !== scope.sourceId && printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "location",
      );
    case "firstPlayer":
      return scope.actor === state.firstPlayer;
    case "tokens":
      return tokensOn(state, condition.code) >= condition.min * (condition.perPlayer ? livingSeats(state).length : 1);
    case "stagingThreat":
      return stagingThreat(state, ctx.cards, scope.actor) <= condition.max;
    case "damageHere":
      return (scope.sourceId ? (state.cards[scope.sourceId]?.damage ?? 0) : 0) <= condition.max;
    case "less": {
      const read: AmountScope = { actor: scope.actor, sourceId: scope.sourceId, ...(scope.picked ? { picked: scope.picked } : {}), ...(scope.subject ? { subject: scope.subject } : {}), ...(scope.other ? { other: scope.other } : {}), ...(scope.x != null ? { x: scope.x } : {}), ...(scope.participants ? { participants: scope.participants } : {}) };
      return resolveAmount(state, condition.left, read, ctx) < resolveAmount(state, condition.right, read, ctx);
    }
    case "heading":
      return headingIs(state, condition.is);
    case "stormcaller":
      return stormcallerHolds(state, condition);
    case "committedWillpower":
      return committedWillpower(state, ctx.cards, scope.actor) >= condition.min;
    case "alliesWillpower":
      return alliesWillpowerHolds(state, scope.actor, condition.min, scope.sourceId, ctx);
    case "survivorsThreat":
      return livingSeats(state).every((seat) => (state.seats[seat]?.threat ?? 0) <= condition.max);
    case "heroesAll": {
      const heroes = state.seats[scope.actor]?.heroes ?? [];
      return heroes.length > 0 && heroes.every((id) => hasTrait(state, id, condition.trait, ctx));
    }
    case "heroExhausted":
      return (state.seats[scope.actor]?.heroes ?? []).some((id) => state.cards[id]?.exhausted === true);
    case "exhausted": {
      const found = Object.values(state.cards).find((card) => card.code === condition.code && inPlay(card.zone));
      return found != null && found.exhausted === condition.is;
    }
    case "engagedWithActor": {
      const source = scope.sourceId ? state.cards[scope.sourceId] : undefined;
      return source != null && source.zone === "engaged" && source.controller === scope.actor;
    }
    case "noneReturned":
      return scope.returned === 0;
    case "returnedBelow":
      return scope.returned < condition.than;
    case "phase":
      // The action window after 7.4 (the engine's "End of round" step) is still in the refresh phase (rr.step-7-4,
      // rr.step-7-5): a Refresh Action may be used there. An ended phase an event names is read as it is.
      if (scope.phase == null && condition.is === "Refresh" && state.phase === "End of round") return true;
      return (scope.phase ?? state.phase) === condition.is;
    case "undefended":
      return state.pendingAttack != null && (state.pendingAttack.defenderId == null || state.pendingAttack.undefended === true);
    case "searchable":
      return searchable(state, condition, ctx).length > 0;
    case "stageReached":
      return (state.stagesReached ?? []).includes(condition.code) === condition.is;
    case "inPlay":
      return Object.values(state.cards).some((card) => card.code === condition.code && inPlay(card.zone)) === condition.is;
    case "defendingAgainst": {
      const holder = state.cards[scope.holderId ?? scope.sourceId ?? ""];
      return holder != null && defendingAgainst(state, holder, condition.trait, ctx);
    }
    case "versusDefender": {
      const holder = state.cards[scope.holderId ?? scope.sourceId ?? ""];
      return holder != null && versusDefender(state, holder, condition, ctx.cards);
    }
    case "inArea": {
      const holder = state.cards[scope.holderId ?? scope.sourceId ?? ""];
      return holder != null && inAreaOf(state, holder, condition.seat);
    }
    // Answered by the captured family's condition hook above (families/captured/values.ts).
    case "versusVictoryTrait":
      return false;
    case "versusHighEngagement": {
      const holder = state.cards[scope.holderId ?? scope.sourceId ?? ""];
      return holder != null && versusHighEngagement(state, condition.role, holder, ctx.cards, scope.against);
    }
    case "hostNamed": {
      const source = scope.sourceId ? state.cards[scope.sourceId] : undefined;
      const host = source?.host ? state.cards[source.host] : undefined;
      return host != null && printedOf(ctx.cards, host.code).name === condition.name;
    }
    case "subjectExplored": {
      // Decided when the location left play (destroyCard), while its attachments still gave their quest points.
      return scope.explored === true;
    }
    case "canPick":
      // A pick for the copy of the last picked card (`sameTitleAs: picked`) reads what the effect picked; every other filter asks as if nothing were picked (its `different` has nothing to leave out).
      return pickCandidates(state, condition.pick, scope.actor, condition.pick.sameTitleAs === "picked" ? (scope.picked ?? []) : [], scope.sourceId, ctx, undefined, undefined, false, { subject: scope.subject, other: scope.other }).length > 0;
    case "handHasCard":
      return (state.seats[scope.actor]?.hand ?? []).some((id) => id !== scope.sourceId);
    case "engagedAboveThreat": {
      const enemy = scope.subject ? state.cards[scope.subject] : undefined;
      if (!enemy || scope.eventSeat !== scope.actor || enemy.controller !== scope.actor || printedOf(ctx.cards, enemy.code).engagementCost == null) return false;
      return modifiedStat(state, enemy, "engagementCost", ctx.cards) > seatThreat(state, scope.actor);
    }
    case "otherPlayer":
      return livingSeats(state).some((seat) => seat !== scope.actor);
    case "controls":
      return Object.values(state.cards).some(
        (card) => card.code === condition.code && card.controller === scope.actor && (card.zone === "heroes" || card.zone === "play"),
      );
    case "outOfPlay":
      return outOfPlayCopies(state, condition.code).length > 0;
    case "questProgress": {
      const stage = state.questStage ? state.cards[state.questStage] : undefined;
      return stage != null && stage.progress > 0;
    }
    case "enemyInPlay": {
      const trait = condition.trait;
      // Mount Gram: while the staging areas are separate an enemy "in play" is one in the asking player's own area (mec108.create-staging-area).
      const area = state.separate && state.capture ? headOf(state, scope.actor) : null;
      const found = Object.values(state.cards).some(
        (card) =>
          inPlay(card.zone) && card.asAttachment == null && printedOf(ctx.cards, card.code).type === "enemy" && (condition.other !== true || card.id !== scope.sourceId) && (trait == null || hasTrait(state, card.id, trait, ctx)) && (area == null || inAreaOf(state, card, area)),
      );
      return found === condition.is;
    }
    case "count": {
      const found = countMatching(state, condition.pick, scope.actor, scope.sourceId, ctx, undefined, condition.pick.sameTitleAs === "picked" ? scope.picked : undefined);
      return (condition.min == null || found >= condition.min) && (condition.max == null || found <= condition.max);
    }
    case "allMatch": {
      const of = pickCandidates(state, condition.of, scope.actor, [], scope.sourceId, ctx, undefined, undefined, true);
      const at = { seat: scope.actor, sourceId: scope.sourceId, counting: true };
      return of.length > 0 && of.every((id) => matchesPick(state, id, condition.match, at, ctx));
    }
    case "threat": {
      const threat = seatThreat(state, scope.actor);
      // Valour's threshold is 80 while the main quest has Dire (mec113.dire): the marked bounds move up by 40.
      const shift = condition.valour && state.dire ? DIRE_VALOUR_SHIFT : 0;
      return (condition.min == null || threat >= condition.min + shift) && (condition.max == null || threat <= condition.max + shift);
    }
    case "matches": {
      const id = conditionCard(state, condition.card, scope);
      const card = id ? state.cards[id] : undefined;
      if (!id || !card) return false;
      if (condition.inPlay != null && inPlay(card.zone) !== condition.inPlay) return false;
      if (condition.inStaging != null && (card.zone === "staging") !== condition.inStaging) return false;
      // "While attached enemy is engaged with you": an enemy filter's `engaged` is read against the actor here too.
      if (condition.pick?.type === "enemy" && condition.pick.engaged && !engagedAs(card, condition.pick.engaged, scope.actor)) return false;
      // `isSource` (the fortress family's pick hook, 143036:A:2) reads the scope's source; every other filter reads none.
      const sourceId = condition.pick?.isSource ? scope.sourceId : null;
      return condition.pick == null || matchesPick(state, id, condition.pick, { seat: scope.actor, sourceId, counting: true }, ctx);
    }
    case "copiesPlayedThisRound": {
      const code = scope.sourceId ? state.cards[scope.sourceId]?.code : undefined;
      const plays = (state.played ?? []).filter((entry) => entry.round === state.round && entry.code === code && (!condition.you || entry.seat === scope.actor));
      // The card's own latest play is not another copy; an earlier play of the same card (returned to the hand) is.
      const played = plays.length - (plays.some((entry) => entry.id === scope.sourceId) ? 1 : 0);
      return played <= condition.max;
    }
    case "resources":
      return spendablePools(state, scope.actor, condition, ctx).total >= condition.min;
    case "questSucceeded":
      return questSucceeded(state, scope.actor, scope.sourceId, condition.committed === true);
    case "questFailed":
      return state.quested?.round === state.round && (state.quested.failed ?? []).includes(scope.actor);
    case "step":
      return stepHolds(state, condition.is);
    case "engagedThisPhase":
      return engagedThisPhase(state) === condition.is;
    case "questKeyword":
      return currentQuestHas(state, condition.keyword, ctx.cards) === condition.is;
    case "questKeywords":
      return questHasKeywords(state, ctx) === condition.is;
    // The attack family's conditions (families/attack/strike.ts, families/attack/events.ts).
    case "attacking": {
      const source = scope.sourceId ? state.cards[scope.sourceId] : undefined;
      const id = scope.holderId ?? (condition.card === "host" ? source?.host : condition.card === "subject" ? scope.subject : scope.sourceId);
      return attackingHolds(state, condition, id ? state.cards[id] : undefined, ctx, scope.against);
    }
    case "engagedThisRound":
      return engagedThisRound(state, scope.actor) === condition.is;
    // The burden deck, Campaign Mode and the effect's X (families/burden.ts).
    case "burdenDeck":
      return (state.burdenDeck?.length ?? 0) >= (condition.min ?? 1);
    case "campaign":
      return Object.values(state.cards).some((card) => card.zone === "campaign");
    case "upgraded":
      return state.campaignFacts?.upgraded?.includes(condition.code) === true;
    case "campaignCopyOutside":
      return holds(state, { kind: "campaign" }, scope, ctx) && !Object.values(state.cards).some((card) => card.code === condition.code && (inPlay(card.zone) || card.zone === "removed"));
    case "x":
      return (scope.x ?? 0) >= condition.min;
    case "discardedCost":
      return discardedCost(state, ctx) <= condition.max;
    case "byPlayerCard":
      return scope.byPlayerCard === true;
    case "fromStaging":
      return scope.fromStaging === true;
    case "excess":
      return (scope.excess ?? 0) >= condition.min;
    case "dealt":
      return (scope.dealt ?? 0) >= (condition.min ?? 1);
    case "distinctTraits":
      return distinctTraitCount(state, scope.actor, ctx) >= condition.min;
    case "damageReached": {
      const damage = scope.sourceId ? (state.cards[scope.sourceId]?.damage ?? 0) : 0;
      return damage >= condition.nth && damage - (scope.dealt ?? 0) < condition.nth;
    }
    case "stageProgress": {
      const stage = state.questStage ? state.cards[state.questStage] : undefined;
      return stage != null && stage.progress >= condition.min;
    }
    case "victoryPoints":
      return state.victory.reduce((sum, id) => sum + victoryPointsOf(state, id, ctx.cards), 0) >= condition.min;
    case "xReachesRemaining": {
      const picked = scope.picked?.at(-1);
      const card = picked ? state.cards[picked] : undefined;
      return card != null && (scope.x ?? 0) >= modifiedStat(state, card, "hitPoints", ctx.cards) - card.damage;
    }
    // Every seat of the game counts, and an eliminated player's threat is raised to 50 (rr.scoring).
    case "highestThreat":
      return Math.max(0, ...state.seats.slice(0, state.seatCount).map((seat, index) => (seat.eliminated ? 50 : seatThreat(state, index)))) <= condition.max;
    // The aflame family's: the cards underneath The Havens Burn (families/aflame/values.ts). `revealing`: the source's own When Revealed is on the stack.
    case "encounterHas":
      return encounterHolds(state, condition, ctx);
    case "underBurn":
      return underBurnHolds(state, condition, ctx);
    case "corsairHas":
      return corsairHolds(state);
    case "locationThreat":
      return locationThreatHolds(state, condition, ctx);
    case "revealing":
      return state.stack.some((frame) => frame.frame === "whenRevealed" && frame.cardId === scope.sourceId);
    case "not":
      return !holds(state, condition.condition, scope, ctx);
    case "all":
      return condition.conditions.every((inner) => holds(state, inner, scope, ctx));
    case "any":
      return condition.conditions.some((inner) => holds(state, inner, scope, ctx));
    // The combat step a card may be played in (09008, 02118, 143012).
    case "combatStep":
      return combatStepIs(state, condition.is);
    case "attachedToHero":
      return (
        Object.values(state.cards).some((card) => {
          const host = card.host ? state.cards[card.host] : undefined;
          return card.code === condition.code && card.zone === "attached" && host != null && cardTypeOf(host, printedOf(ctx.cards, host.code)) === "hero";
        }) === condition.is
      );
    case "hostActive": {
      const host = scope.sourceId ? state.cards[scope.sourceId]?.host : null;
      return host != null && (host === state.activeLocation || host === state.secondActiveLocation);
    }
    case "shadowBlank":
      return scope.shadowBlank === true || shadowBlankOf(state, scope.sourceId, ctx);
  }
}

/** Whether the enemy holds a shadow card with no shadow effect. */
export function shadowBlankOf(state: ScenarioState, enemyId: string | null, ctx: Pick<ReduceContext, "effects">): boolean {
  return shadowCards(enemyId ? state.cards[enemyId] : undefined).some((id) => {
    const code = state.cards[id]?.code;
    return code != null && !ctx.effects.some((effect) => effect.cardCode === code && effect.timing === "shadow");
  });
}

// An enemy engaged with the seat (`you`) or with another player (`other`).
function engagedAs(card: { zone: string; controller: number | null }, engaged: "you" | "other", seat: number): boolean {
  if (card.zone !== "engaged") return false;
  return engaged === "you" ? card.controller === seat : card.controller !== seat;
}

function sourceIn(state: ScenarioState, sourceId: string | null, zone: "activeLocation" | "staging" | "engaged" | "questStage" | "play" | "victory" | "hand" | "stormcallerArea" | "encounterDeck" | "attached"): boolean {
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (!source) return false;
  // The second active location slot is an active location too (mec109.stage-4).
  if (zone === "activeLocation") return source.zone === "activeLocation" || source.zone === "secondActiveLocation";
  // A card of the Stormcaller's area stays one while it stands in the staging area at the Stormcaller's stage (dcce.stormcallers-area-stages: "considered to be in the staging area").
  if (zone === "stormcallerArea") return areaOf(state)?.members.includes(source.id) ?? false;
  return zone === "play" ? inPlay(source.zone) : source.zone === zone;
}

export function hasTrait(state: ScenarioState, id: string, trait: string, ctx: ReduceContext): boolean {
  const instance = state.cards[id];
  if (instance != null && lostTrait(state, id, trait)) return false;
  return (
    instance != null &&
    ((printedOf(ctx.cards, instance.code).traits.includes(trait) && !flagged(state, id, "blanksTraits")) || grantedTraits(state, id, ctx).includes(trait) || flaggedTrait(state, id, trait) || countedTraits(state, id, ctx).includes(trait))
  );
}

// An encounter card its own text attached to a card "counts as" an attachment with a trait while it is attached ("Counts as a
// Condition attachment", 141043:A:2, 141055:A:2; rr.attachment-cards): the traits its CountsAs records give it.
function countedTraits(state: ScenarioState, id: string, ctx: ReduceContext): string[] {
  const instance = state.cards[id];
  if (!instance || instance.zone !== "attached" || instance.host == null) return [];
  return ctx.effects.flatMap((effect) =>
    effect.cardCode === instance.code && effect.timing === "constant" ? effect.instructions.flatMap((instruction) => (instruction.verb === "CountsAs" ? [instruction.trait] : [])) : [],
  );
}

export function countsAsAttachment(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  return countedTraits(state, id, ctx).length > 0;
}

// What the constant records of a card's attachments give it: the Gondor trait from Steward of Gondor, a resource icon
// from Celebrían's Stone. Read where the trait or the icon is asked about.
function grants(state: ScenarioState, id: string, ctx: ReduceContext): { trait?: string; sphere?: Sphere }[] {
  const instance = state.cards[id];
  if (!instance || instance.attachments.length === 0) return [];
  const found: { trait?: string; sphere?: Sphere }[] = [];
  for (const attachmentId of instance.attachments) {
    const attachment = state.cards[attachmentId];
    if (!attachment) continue;
    // A hero card attached to Thorongil lends its host its resource icon (families/misc/text.ts).
    const lent = attachment.lends ? state.cards[attachment.lends] : undefined;
    const lentSphere = lent ? printedOf(ctx.cards, lent.code).sphere : null;
    if (lentSphere && lentSphere !== "neutral" && lentSphere !== "fellowship" && lentSphere !== "baggins") found.push({ sphere: lentSphere });
    for (const effect of effectsOf(ctx, attachment.code)) {
      if (effect.timing !== "constant") continue;
      // Only a record that grants a trait or an icon is read here: another record's condition may itself ask for a trait (Esquire of Gondor, 145015:A:4), which would read this one again.
      if (!effect.instructions.some((instruction) => instruction.verb === "GrantTrait" || instruction.verb === "GrantIcon")) continue;
      const scope = { actor: attachment.controller ?? state.firstPlayer, sourceId: attachment.id, returned: 0 };
      if (effect.condition && !holds(state, effect.condition, scope, ctx)) continue;
      for (const instruction of effect.instructions) {
        if (instruction.verb !== "GrantTrait" && instruction.verb !== "GrantIcon") continue;
        if (instruction.when && !holds(state, instruction.when, scope, ctx)) continue;
        found.push(instruction.verb === "GrantTrait" ? { trait: instruction.trait } : { sphere: instruction.sphere });
      }
    }
  }
  return found;
}

export function grantedTraits(state: ScenarioState, id: string, ctx: ReduceContext): string[] {
  return grants(state, id, ctx).flatMap((grant) => (grant.trait ? [grant.trait] : []));
}

export function grantedIcons(state: ScenarioState, id: string, ctx: ReduceContext): Sphere[] {
  return grants(state, id, ctx).flatMap((grant) => (grant.sphere ? [grant.sphere] : []));
}
