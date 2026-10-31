import type { Condition } from "../catalog/boundary.ts";

import { questSucceeded } from "./families/costs-pay.ts";
import { spendablePools } from "./families/costs-verbs.ts";
import { engagedThisRound } from "./families/attack-events.ts";
import { attackingHolds } from "./families/attack-strike.ts";
import { seatThreat } from "./families/play-hooks.ts";
import { distinctTraitCount, flaggedTrait } from "./families/misc-traits.ts";
import type { ReduceContext } from "./interpret.ts";
import { currentQuestHas, engagedThisPhase, questHasKeywords, stepHolds } from "./families/quest-conditions.ts";
import { modifiedStat, versusHighEngagement } from "./keywords.ts";
import { effectsOf } from "./listen.ts";
import { countMatching, matchesPick, pickCandidates } from "./pick.ts";
import { cardTypeOf, printedOf, type Sphere } from "./printed.ts";
import type { ScenarioState } from "./state.ts";
import { inPlay, livingSeats } from "./state.ts";
import { combatStepIs } from "./families/defense-conditions.ts";
import { faceUp, flagHeld } from "./families/sidequests-contract.ts";
import { copyInVictory } from "./families/sidequests-pick.ts";
import { shadowCards } from "./zones.ts";
import { freeOfEncounters } from "./families/objectives.ts";
import { prisonerHero } from "./families/prisoner.ts";
import { tokensOn } from "./families/campaign.ts";
import { headingIs } from "./families/sea-heading.ts";
import { lastHideFailed, onStage, withTwin } from "./families/nightmare-guards.ts";

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
  // The seat the event a Response answers happened to.
  eventSeat?: number | null;
  // What the running effect has picked, and the other card the answered event names.
  picked?: readonly string[];
  other?: string;
  // The running effect's X.
  x?: number;
  // The damage the answered event placed.
  dealt?: number;
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
    case "attacker":
      return state.pendingAttack?.enemyId ?? state.pendingStrike?.enemyId ?? null;
    case "defender":
      return state.pendingAttack?.defenderId ?? null;
  }
}

export function holds(state: ScenarioState, named: Condition, scope: Scope, ctx: ReduceContext): boolean {
  // A card named by code is the Nightmare card of its title when the recipe replaced it (families/nightmare-guards.ts).
  const condition = withTwin(state, named, ctx.cards);
  switch (condition.kind) {
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
      return tokensOn(state, condition.code) >= condition.min;
    case "heading":
      return headingIs(state, condition.is);
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
      return pickCandidates(state, condition.pick, scope.actor, [], scope.sourceId, ctx, undefined, undefined, false, { subject: scope.subject, other: scope.other }).length > 0;
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
      const found = Object.values(state.cards).some(
        (card) => inPlay(card.zone) && printedOf(ctx.cards, card.code).type === "enemy" && (trait == null || hasTrait(state, card.id, trait, ctx)),
      );
      return found === condition.is;
    }
    case "count": {
      const found = countMatching(state, condition.pick, scope.actor, scope.sourceId, ctx);
      return (condition.min == null || found >= condition.min) && (condition.max == null || found <= condition.max);
    }
    case "allMatch": {
      const of = pickCandidates(state, condition.of, scope.actor, [], scope.sourceId, ctx, undefined, undefined, true);
      const at = { seat: scope.actor, sourceId: scope.sourceId, counting: true };
      return of.length > 0 && of.every((id) => matchesPick(state, id, condition.match, at, ctx));
    }
    case "threat": {
      const threat = seatThreat(state, scope.actor);
      return (condition.min == null || threat >= condition.min) && (condition.max == null || threat <= condition.max);
    }
    case "matches": {
      const id = conditionCard(state, condition.card, scope);
      const card = id ? state.cards[id] : undefined;
      if (!id || !card) return false;
      if (condition.inPlay != null && inPlay(card.zone) !== condition.inPlay) return false;
      // "While attached enemy is engaged with you": an enemy filter's `engaged` is read against the actor here too.
      if (condition.pick?.type === "enemy" && condition.pick.engaged && !engagedAs(card, condition.pick.engaged, scope.actor)) return false;
      return condition.pick == null || matchesPick(state, id, condition.pick, { seat: scope.actor, sourceId: null, counting: true }, ctx);
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
    case "step":
      return stepHolds(state, condition.is);
    case "engagedThisPhase":
      return engagedThisPhase(state) === condition.is;
    case "questKeyword":
      return currentQuestHas(state, condition.keyword, ctx.cards) === condition.is;
    case "questKeywords":
      return questHasKeywords(state, ctx) === condition.is;
    // The attack family's conditions (families/attack-strike.ts, families/attack-events.ts).
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
    case "x":
      return (scope.x ?? 0) >= condition.min;
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
    case "xReachesRemaining": {
      const picked = scope.picked?.at(-1);
      const card = picked ? state.cards[picked] : undefined;
      return card != null && (scope.x ?? 0) >= modifiedStat(state, card, "hitPoints", ctx.cards) - card.damage;
    }
    // Every seat of the game counts, and an eliminated player's threat is raised to 50 (rr.scoring).
    case "highestThreat":
      return Math.max(0, ...state.seats.slice(0, state.seatCount).map((seat, index) => (seat.eliminated ? 50 : seatThreat(state, index)))) <= condition.max;
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
      return shadowCards(scope.sourceId ? state.cards[scope.sourceId] : undefined).some((id) => {
        const code = state.cards[id]?.code;
        return code != null && !ctx.effects.some((effect) => effect.cardCode === code && effect.timing === "shadow");
      });
  }
}

// An enemy engaged with the seat (`you`) or with another player (`other`).
function engagedAs(card: { zone: string; controller: number | null }, engaged: "you" | "other", seat: number): boolean {
  if (card.zone !== "engaged") return false;
  return engaged === "you" ? card.controller === seat : card.controller !== seat;
}

function sourceIn(state: ScenarioState, sourceId: string | null, zone: "activeLocation" | "staging" | "engaged" | "questStage" | "play" | "victory" | "hand"): boolean {
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (!source) return false;
  // The second active location slot is an active location too (mec109.stage-4).
  if (zone === "activeLocation") return source.zone === "activeLocation" || source.zone === "secondActiveLocation";
  return zone === "play" ? inPlay(source.zone) : source.zone === zone;
}

export function hasTrait(state: ScenarioState, id: string, trait: string, ctx: ReduceContext): boolean {
  const instance = state.cards[id];
  return (
    instance != null &&
    (printedOf(ctx.cards, instance.code).traits.includes(trait) || grantedTraits(state, id, ctx).includes(trait) || flaggedTrait(state, id, trait) || countedTraits(state, id, ctx).includes(trait))
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
    // A hero card attached to Thorongil lends its host its resource icon (families/misc-text.ts).
    const lent = attachment.lends ? state.cards[attachment.lends] : undefined;
    const lentSphere = lent ? printedOf(ctx.cards, lent.code).sphere : null;
    if (lentSphere && lentSphere !== "neutral" && lentSphere !== "fellowship" && lentSphere !== "baggins") found.push({ sphere: lentSphere });
    for (const effect of effectsOf(ctx, attachment.code)) {
      if (effect.timing !== "constant") continue;
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

// Cards in the encounter deck, then the discard pile, that match a code, a trait and a printed type.
// The out-of-play copies of a card that "shuffle 1 out of play Ringwraith into the encounter deck" (141026:B:2, 141051:A:2,
// 141053:A:1, 141054:A:2) can take. "Out of play" is the Rules Reference's list (rr.in-play-and-out-of-play): of the zones an
// encounter card can be in, cards set aside, the encounter discard pile and the victory display; a card under Weather Hills
// is out of play by that card's text (141049:A:1). Not the encounter deck itself, which the copy is shuffled into, and not a
// card removed from the game, which "has no further interaction with the game in any manner" (rr.removed-from-game). An
// encounter card is never in a player's hand, deck or discard pile.
export function outOfPlayCopies(state: ScenarioState, code: string): string[] {
  const under = Object.values(state.cards).filter((card) => card.zone === "under").map((card) => card.id);
  return [...state.setAside, ...state.encounterDiscard, ...state.victory, ...under].filter((id) => state.cards[id]?.code === code);
}

// The out-of-play copies the first player chooses among when one is shuffled into the encounter deck. Copies in one pile are
// the same choice; copies in different zones are not (one under Weather Hills would come back to staging, one in the discard
// pile is found by a search, one set aside is not), so there is one per zone, and one per location for cards under one.
export function outOfPlayChoices(state: ScenarioState, code: string): string[] {
  const seen = new Set<string>();
  return outOfPlayCopies(state, code).filter((id) => {
    const card = state.cards[id];
    const key = `${card?.zone ?? id}:${card?.host ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function searchable(
  state: ScenarioState,
  selector: { code?: string; trait?: string; type?: string },
  ctx: ReduceContext,
  zones: readonly ("encounterDeck" | "encounterDiscard")[] = ["encounterDeck", "encounterDiscard"],
): string[] {
  const found: string[] = [];
  for (const zone of zones) {
    for (const id of state[zone]) {
      const instance = state.cards[id];
      if (!instance) continue;
      const printed = printedOf(ctx.cards, instance.code);
      if (selector.code != null && printed.code !== selector.code) continue;
      if (selector.trait != null && !printed.traits.includes(selector.trait)) continue;
      if (selector.type != null && printed.type !== selector.type) continue;
      found.push(id);
    }
  }
  return found;
}
