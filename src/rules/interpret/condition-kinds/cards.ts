// Conditions about which cards are where: the source's zone, copies in play, counts and pick filters, exhaustion, attachments and the victory display.
import { outOfPlayCopies, searchable } from "../search.ts";
import { countMatching, matchesPick, pickCandidates } from "../pick.ts";
import { engagedAs } from "../../core/engaged.ts";
import { victoryPointsOf } from "../../core/printed-stat.ts";
import { cardTypeOf, printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay } from "../../core/state.ts";
import { areaOf } from "../../families/stormcaller/zone.ts";
import { hostOf } from "../amounts.ts";
import { conditionCard, type ConditionHandlers } from "../condition-scope.ts";

function sourceIn(state: ScenarioState, sourceId: string | null, zone: "activeLocation" | "staging" | "engaged" | "questStage" | "play" | "victory" | "hand" | "stormcallerArea" | "encounterDeck" | "attached" | "encounterDiscard"): boolean {
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (!source) return false;
  // The second active location slot is an active location too (mec109.stage-4).
  if (zone === "activeLocation") return source.zone === "activeLocation" || source.zone === "secondActiveLocation";
  // A card of the Stormcaller's area stays one while it stands in the staging area at the Stormcaller's stage (dcce.stormcallers-area-stages: "considered to be in the staging area").
  if (zone === "stormcallerArea") return areaOf(state)?.members.includes(source.id) ?? false;
  return zone === "play" ? inPlay(source.zone) : source.zone === zone;
}

export const cardHandlers = {
  sourceIn: (state, condition, scope) => sourceIn(state, scope.sourceId, condition.zone),
  otherLocationInPlay: (state, _condition, scope, ctx) =>
    [...state.staging, state.activeLocation, state.secondActiveLocation].some(
      (id) => id != null && id !== scope.sourceId && printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "location",
    ),
  damageHere: (state, condition, scope) => (scope.sourceId ? (state.cards[scope.sourceId]?.damage ?? 0) : 0) <= condition.max,
  exhausted: (state, condition) => {
    const found = Object.values(state.cards).find((card) => card.code === condition.code && inPlay(card.zone));
    return found != null && found.exhausted === condition.is;
  },
  exhaustedNamed: (state, condition, _scope, ctx) =>
    Object.values(state.cards).some((card) => printedOf(ctx.cards, card.code).name === condition.name && inPlay(card.zone) && card.controller != null && card.exhausted === condition.is),
  searchable: (state, condition, _scope, ctx) => searchable(state, condition, ctx).length > 0,
  inPlay: (state, condition) => Object.values(state.cards).some((card) => card.code === condition.code && inPlay(card.zone)) === condition.is,
  outOfPlay: (state, condition) => outOfPlayCopies(state, condition.code).length > 0,
  inVictory: (state, condition) => state.victory.some((id) => state.cards[id]?.code === condition.code) === condition.is,
  victoryPoints: (state, condition, _scope, ctx) => state.victory.reduce((sum, id) => sum + victoryPointsOf(state, id, ctx.cards), 0) >= condition.min,
  controls: (state, condition, scope) =>
    Object.values(state.cards).some(
      (card) => card.code === condition.code && (condition.who === "anyPlayer" ? card.controller != null : card.controller === scope.actor) && (card.zone === "heroes" || card.zone === "play"),
    ),
  canPick: (state, condition, scope, ctx) =>
    // A pick for the copy of the last picked card (`sameTitleAs: picked`) reads what the effect picked; every other filter asks as if nothing were picked (its `different` has nothing to leave out).
    pickCandidates(state, condition.pick, scope.actor, condition.pick.sameTitleAs === "picked" ? (scope.picked ?? []) : [], scope.sourceId, ctx, undefined, undefined, false, { subject: scope.subject, other: scope.other }).length > 0,
  count: (state, condition, scope, ctx) => {
    const found = countMatching(state, condition.pick, scope.actor, scope.sourceId, ctx, undefined, condition.pick.sameTitleAs === "picked" ? scope.picked : undefined, scope.subject != null ? { subject: scope.subject } : undefined);
    return (condition.min == null || found >= condition.min) && (condition.max == null || found <= condition.max);
  },
  allMatch: (state, condition, scope, ctx) => {
    const of = pickCandidates(state, condition.of, scope.actor, [], scope.sourceId, ctx, undefined, undefined, true);
    const at = { seat: scope.actor, sourceId: scope.sourceId, counting: true };
    return of.length > 0 && of.every((id) => matchesPick(state, id, condition.match, at, ctx));
  },
  matches: (state, condition, scope, ctx) => {
    const id = conditionCard(state, condition.card, scope);
    const card = id ? state.cards[id] : undefined;
    if (!id || !card) return false;
    if (condition.inPlay != null && inPlay(card.zone) !== condition.inPlay) return false;
    if (condition.inStaging != null && (card.zone === "staging") !== condition.inStaging) return false;
    // "While attached enemy is engaged with you": an enemy filter's `engaged` is read against the actor here too.
    if (condition.pick?.type === "enemy" && condition.pick.engaged && !engagedAs(state, id, condition.pick.engaged, scope.actor)) return false;
    // `isSource` (the fortress family's pick hook, 143036:A:2) reads the scope's source; every other filter reads none.
    const sourceId = condition.pick?.isSource ? scope.sourceId : null;
    return condition.pick == null || matchesPick(state, id, condition.pick, { seat: scope.actor, sourceId, counting: true }, ctx);
  },
  attachedToHero: (state, condition, _scope, ctx) =>
    Object.values(state.cards).some((card) => {
      const host = card.host ? state.cards[card.host] : undefined;
      return card.code === condition.code && card.zone === "attached" && host != null && cardTypeOf(host, printedOf(ctx.cards, host.code)) === "hero";
    }) === condition.is,
  hostActive: (state, _condition, scope) => {
    const host = hostOf(state, scope.sourceId);
    return host != null && (host === state.activeLocation || host === state.secondActiveLocation);
  },
  hostNamed: (state, condition, scope, ctx) => {
    const hostId = hostOf(state, scope.sourceId);
    const host = hostId ? state.cards[hostId] : undefined;
    return host != null && printedOf(ctx.cards, host.code).name === condition.name;
  },
} satisfies Partial<ConditionHandlers>;
