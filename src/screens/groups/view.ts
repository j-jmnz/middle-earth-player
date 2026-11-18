// Which of its views the Cards tab shows: Player cards (the pool) or Encounter cards (encounter sets and the campaigns' cards). Kept in user.db
// `settings.sections` like the folds, as a boolean (a fold's map holds nothing else): the entry is true while Encounter cards is picked. The
// entries the tab's earlier Scenario and Campaign views wrote read as Encounter cards, and a pick clears them. Pure.
import { withFolded, type Sections } from "../kit/fold-state";

export type CardsView = "Player cards" | "Encounter cards";

/** The views the switch offers, in order. */
export const CARDS_VIEWS: readonly CardsView[] = ["Player cards", "Encounter cards"];

const ENCOUNTER = "cards-view-encounter";
const EARLIER = ["cards-view-scenario", "cards-view-campaign"] as const;

/** The view the sections hold (`on` reads an entry, as `useFolds().folded` does), Player cards when none. */
export function viewOf(on: (id: string) => boolean): CardsView {
  return on(ENCOUNTER) || EARLIER.some((id) => on(id)) ? "Encounter cards" : "Player cards";
}

/** The ids and values to write for a view (an entry set back to false is dropped, as a fold set back to its default is). */
export function viewWrites(view: CardsView): { id: string; value: boolean }[] {
  return [{ id: ENCOUNTER, value: view === "Encounter cards" }, ...EARLIER.map((id) => ({ id, value: false }))];
}

/** The sections with the view set (what the store holds after viewWrites). */
export function withView(sections: Sections, view: CardsView): Sections {
  return viewWrites(view).reduce((map, { id, value }) => withFolded(map, id, value, false), sections);
}
