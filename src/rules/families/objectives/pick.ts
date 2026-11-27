// Rules: rr.guarded, rr.attachment-cards, hrd.guarded-x (data/rules/entries.json); ledger lines 12121:A:1, 12133:A:1, 17091:A:2, 17092:A:2, 17101:A:2, 17106:B:2. The objectives family's filters: an objective with or without an encounter card attached to it, an enemy that is or
// is not attached to an objective as its guard, an objective attached to an encounter card (guarded by one or hanging on one), the encounter card attached to the source objective, a character holding an objective.
import type { PickSpec } from "../../../catalog/boundary.ts";

import { hasTrait } from "../../interpret/conditions.ts";
import { printedOf } from "../../core/printed.ts";
import { inPlay } from "../../core/state.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { PickContext } from "../../interpret/pick.ts";
import { freeOfEncounters } from "./free.ts";

// An encounter card attached to an objective in play as its guard (the guard marker is set as it attaches and cleared as it leaves).
export function isGuard(state: ScenarioState, id: string): boolean {
  const card = state.cards[id];
  const host = card?.host ? state.cards[card.host] : undefined;
  return card?.guard === true && host != null && inPlay(host.zone);
}

/** Whether the card is attached as the guard of the objective with this title ("the Grey Moorland guarding Tiny", 19048:B:3; Giant guarding Urdug's Horn, 19049:B:3). */
export function guardsTitled(state: ScenarioState, ctx: ReduceContext, id: string, title: string): boolean {
  const host = state.cards[id]?.host;
  return isGuard(state, id) && host != null && printedOf(ctx.cards, state.cards[host]?.code ?? "").name === title;
}

// Whether an enemy with this trait is attached to the objective as its guard (900401:A:2, A:3).
function guardedByTrait(state: ScenarioState, ctx: ReduceContext, id: string, trait: string): boolean {
  return (state.cards[id]?.attachments ?? []).some((attachmentId) => isGuard(state, attachmentId) && hasTrait(state, attachmentId, trait, ctx));
}

// Whether the card is an enemy attached as the guard of an objective with this trait.
function guardsTrait(state: ScenarioState, ctx: ReduceContext, id: string, trait: string): boolean {
  const host = state.cards[id]?.host;
  return isGuard(state, id) && host != null && hasTrait(state, host, trait, ctx);
}

// An objective hanging on an enemy or a location in play, unclaimed: The Black Serpent holds the random Harad objective stage 3A attaches to it (17108:A:1).
function hangsOnEncounter(state: ScenarioState, ctx: ReduceContext, id: string): boolean {
  const card = state.cards[id];
  const host = card?.host ? state.cards[card.host] : undefined;
  if (!card || card.zone !== "attached" || card.claimed === true || !host || !inPlay(host.zone)) return false;
  const type = printedOf(ctx.cards, host.code).type;
  return type === "enemy" || type === "location";
}

/** The objectives in play that hang on an encounter card: no player holds them and the staging area does not list them (`onEncounter`). */
export function hungOnEncounter(state: ScenarioState, ctx: ReduceContext): string[] {
  return Object.values(state.cards)
    .filter((card) => printedOf(ctx.cards, card.code).type === "objective" && hangsOnEncounter(state, ctx, card.id))
    .map((card) => card.id);
}

// The objective is attached to an encounter card: one guards it, or it hangs on one.
function onEncounterCard(state: ScenarioState, ctx: ReduceContext, id: string): boolean {
  return !freeOfEncounters(state, id) || hangsOnEncounter(state, ctx, id);
}

// An encounter card attached to the source objective as its guard, or the encounter card the source objective hangs on.
function linkedTo(state: ScenarioState, ctx: ReduceContext, id: string, sourceId: string | null): boolean {
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (!source || source.id === id) return false;
  return isGuard(state, id) ? state.cards[id]?.host === source.id : hangsOnEncounter(state, ctx, source.id) && source.host === id;
}

export function objectivesPickMatches(state: ScenarioState, id: string, spec: PickSpec, ctx: ReduceContext, at?: PickContext): boolean {
  if (spec.onEncounter != null && onEncounterCard(state, ctx, id) !== spec.onEncounter) return false;
  if (spec.linkedToSource && !linkedTo(state, ctx, id, at?.sourceId ?? null)) return false;
  if (spec.holdsObjective && !(state.cards[id]?.attachments ?? []).some((attachmentId) => state.cards[attachmentId]?.claimed === true && printedOf(ctx.cards, state.cards[attachmentId]?.code ?? "").type === "objective")) return false;
  if (spec.hasGuard != null && !freeOfEncounters(state, id) !== spec.hasGuard) return false;
  if (spec.isGuard != null && isGuard(state, id) !== spec.isGuard) return false;
  if (spec.guardedByTrait != null && !guardedByTrait(state, ctx, id, spec.guardedByTrait)) return false;
  if (spec.guardsTrait != null && !guardsTrait(state, ctx, id, spec.guardsTrait)) return false;
  if (spec.notGuardedByTrait != null && guardedByTrait(state, ctx, id, spec.notGuardedByTrait)) return false;
  // The character was committed to this round's quest (kept by families/costs/pay.ts noteEvent, which the quest's resolution clearing `committed` leaves).
  if (spec.questedThisRound && !(state.quested?.round === state.round && state.quested.committed.includes(id))) return false;
  return true;
}
