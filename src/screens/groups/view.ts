// Which of its views the Cards tab shows: Player (the pool), Scenario (encounter sets) and Campaign (campaign cards, boons, burdens, treasures). Kept in user.db `settings.sections` like the
// folds, as booleans (a fold's map holds nothing else): the Scenario entry is true while Scenario is picked, the Campaign entry while Campaign is. Pure.
import { withFolded, type Sections } from "../kit/fold-state";

export type CardsView = "Player" | "Scenario" | "Campaign";

/** The views the switch offers, in order. */
export const CARDS_VIEWS: readonly CardsView[] = ["Player", "Scenario", "Campaign"];

const KEYS = { Scenario: "cards-view-scenario", Campaign: "cards-view-campaign" } as const;

/** The view the sections hold (`on` reads an entry, as `useFolds().folded` does), Player when none. */
export function viewOf(on: (id: string) => boolean): CardsView {
  return on(KEYS.Campaign) ? "Campaign" : on(KEYS.Scenario) ? "Scenario" : "Player";
}

/** The ids and values to write for a view: both entries, the picked one true (an entry set back to false is dropped, as a fold set back to its default is). */
export function viewWrites(view: CardsView): { id: string; value: boolean }[] {
  return [
    { id: KEYS.Scenario, value: view === "Scenario" },
    { id: KEYS.Campaign, value: view === "Campaign" },
  ];
}

/** The sections with the view set (what the store holds after viewWrites). */
export function withView(sections: Sections, view: CardsView): Sections {
  return viewWrites(view).reduce((map, { id, value }) => withFolded(map, id, value, false), sections);
}
