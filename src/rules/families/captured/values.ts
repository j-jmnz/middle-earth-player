// Rules: mec108.captured-cards, mec108.capture-x, mec108.side-quests-in-play (data/rules/entries.json); ledger lines 10039:B:2, 10044:A:2, 10045:A:2, 10046:A:2, 10048:A:2, 10051:A:1, 10052:A:1, 10174:B:1, 10175:A:1.
//
// What the captured family reads: the pool of a pick (the cards under the source, the cards the last rescue put into hands, the encounter cards in play in an area), the amount and the condition of the cards that name captured cards.
import type { Amount, Condition, PickSpec } from "../../../catalog/boundary.ts";

import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, livingSeats } from "../../core/state.ts";
import type { AmountScope } from "../../interpret/amounts.ts";
import type { Scope } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { activeFor, headOf, sharing } from "../breaking/areas.ts";
import { capturedUnder } from "./pile.ts";
import { playable } from "./play.ts";

// The cards a captured pick starts from (null for a pick that is not one).
export function capturedPool(state: ScenarioState, spec: PickSpec, asking: number, sourceId: string | null, ctx: ReduceContext): string[] | null {
  if (!spec.captured) return null;
  if (spec.captured === "underSelf") return sourceId ? capturedUnder(state, sourceId).filter((id) => playable(state, id, ctx)) : [];
  if (spec.captured === "rescued") return (state.rescued ?? []).filter((id) => state.cards[id]?.zone === "hand" && playable(state, id, ctx));
  // The encounter cards in play in the asking player's area: its staging cards, its active location and the enemies engaged with a player of the area.
  const head = headOf(state, asking);
  const engaged = sharing(state, head).flatMap((seat) => state.seats[seat]?.engaged ?? []);
  const staged = state.separate ? (state.viewSeat === head ? state.staging : [...(state.seats[head]?.staging ?? []), ...(state.capture?.here ?? []).filter((id) => state.cards[id]?.zone === "staging")]) : state.staging;
  return [...new Set([...staged, ...activeFor(state, asking), ...engaged])].filter((id) => inPlay(state.cards[id]?.zone ?? "removed"));
}

// Whether a card has captured cards underneath it.
function holdsCaptured(state: ScenarioState, id: string): boolean {
  return Object.values(state.cards).some((card) => card.zone === "captured" && card.host === id);
}

// The index of the quest stage a seat is at, 0 for the first: the quest cards the players have completed (the first is done at Setup).
function completedQuests(state: ScenarioState): number {
  const stage = state.questStage ?? livingSeats(state).map((seat) => state.seats[seat]?.stage).find((id) => id != null) ?? null;
  const code = stage ? state.cards[stage]?.code : undefined;
  return Math.max(0, state.stages.findIndex((entry) => entry.code === code));
}

export function capturedAmount(state: ScenarioState, found: Exclude<Amount, number>, scope: AmountScope, ctx: ReduceContext): number | null {
  if (!found.captured) return null;
  switch (found.captured) {
    case "under":
      return scope.sourceId ? capturedUnder(state, scope.sourceId).length : 0;
    case "cardsWith": {
      const hosts = new Set(Object.values(state.cards).filter((card) => card.zone === "captured" && card.host != null && inPlay(state.cards[card.host]?.zone ?? "removed")).map((card) => card.host));
      return hosts.size;
    }
    case "questsAndSides":
      return completedQuests(state) + state.victory.filter((id) => /side-quest/.test(printedOf(ctx.cards, state.cards[id]?.code ?? "").type)).length;
    case "players":
      return livingSeats(state).length;
  }
}

export function capturedHolds(state: ScenarioState, condition: Condition, scope: Scope): boolean | null {
  if (condition.kind !== "captured") return null;
  if (condition.is === "noneUnderSelf") return scope.sourceId != null && !holdsCaptured(state, scope.sourceId);
  return state.capture?.none === true;
}
