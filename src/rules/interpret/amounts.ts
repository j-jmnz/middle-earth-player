// The numbers an effect record asks the engine to read: "X is the number of enemies engaged with you", "for each Hobbit hero
// you control", "equal to that enemy's printed Threat". A player never supplies one (brief, Effects).
import type { Amount, CardRef, Condition, Instruction } from "../../catalog/boundary.ts";

import type { ReduceContext } from "./interpret.ts";
import { modifiedStat } from "../core/keywords.ts";
import { familyAmount } from "./family-hooks.ts";
import { threatCostOf } from "../families/costs/stats.ts";
import { miscAmount, namedInPlay } from "../families/misc/amounts.ts";
import { seatThreat } from "../families/play/hooks.ts";
import { countMatching, pickCandidates } from "./pick.ts";
import { printedOf } from "../core/printed.ts";
import type { ScenarioState } from "../core/state.ts";
import { livingSeats } from "../core/state.ts";
import { activeOf } from "../families/breaking/areas.ts";
import { stageNumber } from "../families/caves/progress.ts";
import { topFrame } from "../windows/windows.ts";
import { shadowCards } from "../core/zones.ts";
import { chosenCopies, levelAmount } from "../families/aflame/values.ts";
import { grappledCount, resourcesOnMatching } from "../families/grapple/values.ts";
import { leftThreat } from "../families/island/pick.ts";
import { stormcallerStageNumber } from "../families/stormcaller/values.ts";

// Who an amount is read for: the actor (the "you" of the card), the source, and what the running effect knows.
export type AmountScope = {
  actor: number;
  sourceId: string | null;
  picked?: readonly string[];
  subject?: string | null;
  other?: string | null;
  x?: number;
  dealt?: number;
  excess?: number;
};

// The running effect frame's picks, subject and X, for an amount or a card reference read inside it.
export function frameScope(state: ScenarioState, actor: number, sourceId: string | null): AmountScope {
  const data = topFrame(state)?.data;
  if (data?.kind !== "effect") return { actor, sourceId };
  return {
    actor,
    sourceId,
    ...(data.picked ? { picked: data.picked } : {}),
    ...(data.subject ? { subject: data.subject } : {}),
    ...(data.other ? { other: data.other } : {}),
    ...(data.x != null ? { x: data.x } : {}),
    ...(data.dealt != null ? { dealt: data.dealt } : {}),
    ...(data.excess != null ? { excess: data.excess } : {}),
  };
}

// The card a reference names now, or null.
export function refCard(state: ScenarioState, ref: CardRef, scope: AmountScope): string | null {
  const source = scope.sourceId ? state.cards[scope.sourceId] : undefined;
  switch (ref) {
    case "self":
      return scope.sourceId;
    case "host":
      return source?.host ?? null;
    case "picked":
      return scope.picked?.at(-1) || null;
    case "subject":
      return scope.subject ?? null;
    case "other":
      return scope.other ?? null;
    case "attacker":
      return state.pendingAttack?.enemyId ?? state.pendingStrike?.enemyId ?? null;
    case "defender":
      return state.pendingAttack?.defenderId && !state.pendingAttack.undefended ? state.pendingAttack.defenderId : null;
    // With two active locations (The Ring Goes South stage 4) "the active location" is the one that is not Doors of Durin, which
    // is immune to player card effects and always the first (mec109.stage-4).
    case "activeLocation":
      return state.separate ? activeOf(state, scope.actor) : (state.secondActiveLocation ?? state.activeLocation);
    case "previous":
      return scope.picked?.at(-2) || null;
    case "discardTop":
      return state.encounterDiscard.at(-1) ?? null;
  }
}

function statOf(state: ScenarioState, id: string | null, stat: NonNullable<Exclude<Amount, number>["stat"]>, printed: boolean, ctx: ReduceContext): number {
  const instance = id ? state.cards[id] : undefined;
  if (!instance) return 0;
  const card = printedOf(ctx.cards, instance.code);
  switch (stat) {
    case "damage":
      return instance.damage;
    case "resources":
      return instance.resources;
    case "progress":
      return instance.progress;
    case "cost":
      return card.cost ?? 0;
    case "threatCost":
      // With the ThreatCost constants that lower it, unless the printed value is asked for (families/costs/stats.ts).
      return card.type !== "hero" ? 0 : printed ? (card.threat ?? 0) : threatCostOf(state, instance.id, ctx);
    case "attachments":
      return instance.attachments.length;
    case "shadowCards":
      return shadowCards(instance).length;
    default:
      if (printed) return (stat === "hitPoints" ? card.health : card[stat]) ?? 0;
      return modifiedStat(state, instance, stat, ctx.cards);
  }
}

// Whether any instruction, at any depth, holds an amount that reads `key` ("the damage dealt by this attack" is `{"dealt": true}`): a record's amounts are
// plain data, so the walk looks at the keys of every object under the instructions, never at text.
export function readsAmount(instructions: readonly Instruction[], key: keyof Exclude<Amount, number>): boolean {
  const walk = (node: unknown): boolean => {
    if (Array.isArray(node)) return node.some(walk);
    if (node === null || typeof node !== "object") return false;
    const record = node as Record<string, unknown>;
    return record[key] === true || Object.values(record).some(walk);
  };
  return walk(instructions);
}

// Whether any instruction, at any depth, holds a condition of this kind (`{"kind": "dealt"}`), found the same way as `readsAmount`.
export function readsCondition(instructions: readonly Instruction[], kind: Condition["kind"]): boolean {
  const walk = (node: unknown): boolean => {
    if (Array.isArray(node)) return node.some(walk);
    if (node === null || typeof node !== "object") return false;
    const record = node as Record<string, unknown>;
    return record.kind === kind || Object.values(record).some(walk);
  };
  return walk(instructions);
}

export function resolveAmount(state: ScenarioState, amount: Amount, scope: AmountScope, ctx: ReduceContext): number {
  if (typeof amount === "number") return amount;
  let value = 0;
  // A family's own amount (interpret/family-hooks.ts): null when it is not the family's, so the reads below stand.
  const familial = familyAmount(state, amount, scope, ctx);
  if (familial !== null) value = familial;
  else if (amount.count && amount.distinct) value = new Set(pickCandidates(state, amount.count, scope.actor, [], scope.sourceId, ctx, undefined, undefined, true).map((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").name)).size;
  else if (amount.count) value = countMatching(state, amount.count, scope.actor, scope.sourceId, ctx);
  else if (amount.stat) value = statOf(state, amount.ofNamed ? namedInPlay(state, amount.ofNamed, ctx) : refCard(state, amount.of ?? "self", scope), amount.stat, amount.printed === true, ctx);
  else if (amount.x) value = scope.x ?? 0;
  else if (amount.stage) value = stageNumber(state);
  else if (amount.players) value = livingSeats(state).length;
  else if (amount.stormcallerStage) value = stormcallerStageNumber(state);
  else if (amount.part) value = state.part ?? 0;
  else if (amount.level) value = levelAmount(state, scope.sourceId, amount.halved === true);
  else if (amount.threat) {
    const threat = seatThreat(state, scope.actor);
    value = amount.threat === "tens" ? Math.floor(threat / 10) : threat;
  } else if (amount.hand) value = (state.seats[scope.actor]?.hand ?? []).length;
  else if (amount.dealt) value = scope.dealt ?? 0;
  else if (amount.excess) value = scope.excess ?? 0;
  else if (amount.facedown || amount.resourcesAboveCopies) value = miscAmount(state, amount, scope.sourceId);
  else if (amount.grappled) value = grappledCount(state);
  else if (amount.islandLeft) value = leftThreat(state, ctx);
  else if (amount.resourcesOn) value = resourcesOnMatching(state, amount.resourcesOn, scope, ctx, amount.max === true);
  if (amount.every != null) value = Math.floor(value / amount.every);
  value = value * (amount.times ?? 1) + (amount.plus ?? 0) + (amount.plusChosen ? chosenCopies(state, scope.sourceId, ctx) : 0);
  if (amount.limit != null) value = Math.min(value, amount.limit);
  return amount.negative ? -Math.max(0, value) : Math.max(0, value);
}
