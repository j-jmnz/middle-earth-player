import type { Condition } from "../catalog/boundary.ts";

import { questSucceeded } from "./families/costs-pay.ts";
import { spendablePools } from "./families/costs-verbs.ts";
import { engagedThisRound } from "./families/attack-events.ts";
import { attackingHolds } from "./families/attack-strike.ts";
import { seatThreat } from "./families/play-hooks.ts";
import type { ReduceContext } from "./interpret.ts";
import { engagedThisPhase, questHasKeywords, stepHolds } from "./families/quest-conditions.ts";
import { modifiedStat, versusHighEngagement } from "./keywords.ts";
import { effectsOf } from "./listen.ts";
import { countMatching, matchesPick, pickCandidates } from "./pick.ts";
import { printedOf, type Sphere } from "./printed.ts";
import type { ScenarioState } from "./state.ts";
import { inPlay, livingSeats } from "./state.ts";
import { combatStepIs } from "./families/defense-conditions.ts";

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

export function holds(state: ScenarioState, condition: Condition, scope: Scope, ctx: ReduceContext): boolean {
  switch (condition.kind) {
    case "hideFailed":
      return state.hideFailures.some(
        (failure) =>
          failure.seat === scope.actor &&
          failure.round === state.round &&
          (condition.scope === "round" || failure.phase === state.phase),
      );
    case "hasEngaged": {
      const trait = condition.trait;
      return (state.seats[scope.actor]?.engaged ?? []).some((id) => trait == null || hasTrait(state, id, trait, ctx));
    }
    case "sourceIn":
      return sourceIn(state, scope.sourceId, condition.zone);
    case "inVictory":
      return state.victory.some((id) => state.cards[id]?.code === condition.code) === condition.is;
    case "otherLocationInPlay":
      return [...state.staging, state.activeLocation, state.secondActiveLocation].some(
        (id) => id != null && id !== scope.sourceId && printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "location",
      );
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
      return (scope.phase ?? state.phase) === condition.is;
    case "undefended":
      return state.pendingAttack != null && (state.pendingAttack.defenderId == null || state.pendingAttack.undefended === true);
    case "searchable":
      return searchable(state, condition, ctx).length > 0;
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
          return card.code === condition.code && card.zone === "attached" && host != null && printedOf(ctx.cards, host.code).type === "hero";
        }) === condition.is
      );
    case "hostActive": {
      const host = scope.sourceId ? state.cards[scope.sourceId]?.host : null;
      return host != null && (host === state.activeLocation || host === state.secondActiveLocation);
    }
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
  return zone === "play" ? inPlay(source.zone) : source.zone === zone;
}

export function hasTrait(state: ScenarioState, id: string, trait: string, ctx: ReduceContext): boolean {
  const instance = state.cards[id];
  return instance != null && (printedOf(ctx.cards, instance.code).traits.includes(trait) || grantedTraits(state, id, ctx).includes(trait));
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
