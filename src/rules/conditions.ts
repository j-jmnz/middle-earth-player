import type { Condition } from "../catalog/boundary.ts";

import type { ReduceContext } from "./interpret.ts";
import { printedOf } from "./printed.ts";
import type { ScenarioState } from "./state.ts";
import { inPlay } from "./state.ts";

// Who the condition is asked about. `returned` is the count the running effect has returned to staging.
// `phase` overrides the current phase for an end-of-phase event, which fires after the phase has moved on.
export type Scope = { actor: number; sourceId: string | null; returned: number; phase?: string };

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
    case "attachedToHero":
      return (
        Object.values(state.cards).some((card) => {
          const host = card.host ? state.cards[card.host] : undefined;
          return card.code === condition.code && card.zone === "attached" && host != null && printedOf(ctx.cards, host.code).type === "hero";
        }) === condition.is
      );
  }
}

function sourceIn(state: ScenarioState, sourceId: string | null, zone: "activeLocation" | "staging" | "engaged" | "questStage" | "play"): boolean {
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (!source) return false;
  return zone === "play" ? inPlay(source.zone) : source.zone === zone;
}

export function hasTrait(state: ScenarioState, id: string, trait: string, ctx: ReduceContext): boolean {
  const instance = state.cards[id];
  return instance != null && printedOf(ctx.cards, instance.code).traits.includes(trait);
}

// Cards in the encounter deck, then the discard pile, that match a code or trait.
export function searchable(
  state: ScenarioState,
  selector: { code?: string; trait?: string },
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
      found.push(id);
    }
  }
  return found;
}
