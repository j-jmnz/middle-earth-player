// Rules: mec108.create-staging-area, mec109.multiple-staging-areas (data/rules/entries.json); ledger line 148003:B:3.
// The condition the breaking family adds (src/catalog/effect-schema-conditions.ts): every living player is at the source stage.
import type { Condition } from "../../../catalog/boundary.ts";

import type { ScenarioState } from "../../core/state.ts";
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import { flagged, livingSeats } from "../../core/state.ts";
import { sharing, stageSeat } from "./areas.ts";

// `allAtStage`: with one shared staging area every player is at the stage; once the areas are separate the living players that share the source stage's area are counted against all of them (a stage no player is at, parked, has none). Null for any other condition.
export function allAtStageHolds(state: ScenarioState, condition: Condition, sourceId: string | null): boolean | null {
  if (condition.kind !== "allAtStage") return null;
  if (!state.separate) return condition.is;
  const at = sourceId ? stageSeat(state, sourceId) : null;
  const all = at != null && sharing(state, at).length === livingSeats(state).length;
  return all === condition.is;
}

// Whether the seat that plays the card is held by "cannot trigger Action or Response effects" (148017:A:2): it plays no event, whose Action or Response is the play. Other cards are bound where their Actions and Responses are heard (player/actions.ts, windows/listen.ts).
export function eventFrozen(state: ScenarioState, cardId: string, seat: number | undefined, cards: ReadonlyMap<string, PrintedCard>): boolean {
  const card = state.cards[cardId];
  const by = seat ?? card?.controller ?? null;
  return card != null && by != null && state.modifiers.length > 0 && flagged(state, `seat:${by}`, "cannotTriggerEffects") && printedOf(cards, card.code).type === "event";
}
