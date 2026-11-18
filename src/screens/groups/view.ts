// Which of its views the Cards tab shows: Player (the pool), Scenario (encounter sets), and later Campaign. Kept in user.db `settings.sections` like the
// folds, as booleans (a fold's map holds nothing else): the Scenario entry is true while Scenario is picked, the Campaign entry while Campaign is. Pure.
import { withFolded, type Sections } from "../kit/fold-state";

export type CardsView = "Player" | "Scenario" | "Campaign";

/** The views the switch offers, in order. */
export const CARDS_VIEWS: readonly CardsView[] = ["Player", "Scenario"];

const KEYS = { Scenario: "cards-view-scenario", Campaign: "cards-view-campaign" } as const;

/** The view the sections hold (`on` reads an entry, as `useFolds().folded` does), Player when none or when the stored one is not offered. */
export function viewOf(on: (id: string) => boolean, offered: readonly CardsView[] = CARDS_VIEWS): CardsView {
  const stored: CardsView = on(KEYS.Campaign) ? "Campaign" : on(KEYS.Scenario) ? "Scenario" : "Player";
  return offered.includes(stored) ? stored : "Player";
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
