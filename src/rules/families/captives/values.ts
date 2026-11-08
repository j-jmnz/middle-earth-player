// What the Captives of The Uruk-hai are, read from the state alone (families/captives/index.ts runs the verbs; the pick filter `captive` in interpret/pick.ts reads these).
import { printedOf, type PrintedCard } from "../../core/printed.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";

/** Every Captive in play, in card order. */
export function captivesOf(state: ScenarioState): CardInstance[] {
  return Object.values(state.cards).filter((card) => card.captive === true && card.zone === "captive");
}

/** The Captive the card holds (lies under or is attached to), or null. */
export function captiveHeldBy(state: ScenarioState, hostId: string | null): CardInstance | null {
  return hostId == null ? null : (captivesOf(state).find((card) => card.host === hostId) ?? null);
}

/** The pick filter `captive`: `only` and `include` name every Captive, `free` those lying under a card that is not an enemy (none held by Grishnákh). */
export function captiveIds(state: ScenarioState, mode: "only" | "free" | "include", cards: ReadonlyMap<string, PrintedCard>): string[] {
  return captivesOf(state)
    .filter((card) => mode !== "free" || printedOf(cards, state.cards[card.host ?? ""]?.code ?? "").type !== "enemy")
    .map((card) => card.id);
}
