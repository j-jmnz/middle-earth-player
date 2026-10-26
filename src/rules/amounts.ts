// The numbers an effect record asks the engine to read: "X is the number of enemies engaged with you", "for each Hobbit hero
// you control", "equal to that enemy's printed Threat". A player never supplies one (brief, Effects).
import type { Amount, CardRef } from "../catalog/boundary.ts";

import type { ReduceContext } from "./interpret.ts";
import { modifiedStat } from "./keywords.ts";
import { countMatching } from "./pick.ts";
import { printedOf } from "./printed.ts";
import type { ScenarioState } from "./state.ts";
import { livingSeats } from "./state.ts";
import { topFrame } from "./windows.ts";

// Who an amount is read for: the actor (the "you" of the card), the source, and what the running effect knows.
export type AmountScope = {
  actor: number;
  sourceId: string | null;
  picked?: readonly string[];
  subject?: string | null;
  other?: string | null;
  x?: number;
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
    case "attacker":
      return state.pendingAttack?.enemyId ?? state.pendingStrike?.enemyId ?? null;
    case "defender":
      return state.pendingAttack?.defenderId && !state.pendingAttack.undefended ? state.pendingAttack.defenderId : null;
    case "activeLocation":
      return state.activeLocation;
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
      return card.type === "hero" ? (card.threat ?? 0) : 0;
    default:
      if (printed) return (stat === "hitPoints" ? card.health : card[stat]) ?? 0;
      return modifiedStat(state, instance, stat, ctx.cards);
  }
}

export function resolveAmount(state: ScenarioState, amount: Amount, scope: AmountScope, ctx: ReduceContext): number {
  if (typeof amount === "number") return amount;
  let value = 0;
  if (amount.count) value = countMatching(state, amount.count, scope.actor, scope.sourceId, ctx);
  else if (amount.stat) value = statOf(state, refCard(state, amount.of ?? "self", scope), amount.stat, amount.printed === true, ctx);
  else if (amount.x) value = scope.x ?? 0;
  else if (amount.players) value = livingSeats(state).length;
  else if (amount.threat) {
    const threat = state.seats[scope.actor]?.threat ?? 0;
    value = amount.threat === "tens" ? Math.floor(threat / 10) : threat;
  } else if (amount.hand) value = (state.seats[scope.actor]?.hand ?? []).length;
  value = value * (amount.times ?? 1) + (amount.plus ?? 0);
  if (amount.limit != null) value = Math.min(value, amount.limit);
  return Math.max(0, value);
}
