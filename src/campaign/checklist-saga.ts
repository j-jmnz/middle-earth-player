// Rules: mec112.setting-up-the-game, mec112.aragorn, mec112.campaign-mode-aragorn (data/rules/entries.json). What the Campaign Setup Checklist needs to know about the
// saga hero of a scenario that has a `sagaStart` (The Two Towers): which hero the scenario grants, which logged heroes belong to the saga and are not a player's choice
// of hero, and which are an earlier version of the granted Aragorn. A scenario with no `sagaStart` (every other campaign, and the Fellowship's six) is `active: false`: the
// checklist reads it exactly as before. Pure.
import type { ScenarioData } from "../catalog/scenario-data.ts";
import type { PrintedCard } from "../rules/core/printed.ts";

export type ChecklistSaga = {
  active: boolean;
  // The ☺ hero the scenario grants the first player (☺ Aragorn in scenarios 7 to 9), or null (a Ring-bearer scenario).
  granted: string | null;
  // A Fellowship-sphere hero: the saga's, so changing or leaving one out is no hero change (the Ring-bearer Frodo, ☺ Aragorn).
  ofSaga: (code: string) => boolean;
  // A hero titled Aragorn other than the granted one: the version a player recorded in the log, who is lost when the scenario grants ☺ Aragorn.
  isAragorn: (code: string) => boolean;
};

const INACTIVE: ChecklistSaga = { active: false, granted: null, ofSaga: () => false, isAragorn: () => false };

export function sagaOf(scenario: Pick<ScenarioData, "sagaStart">, cards: ReadonlyMap<string, PrintedCard>): ChecklistSaga {
  const start = scenario.sagaStart;
  if (!start) return INACTIVE;
  const granted = "hero" in start ? start.hero : null;
  const grantedName = granted != null ? cards.get(granted)?.name : undefined;
  return {
    active: true,
    granted,
    ofSaga: (code) => {
      const card = cards.get(code);
      return card != null && card.type === "hero" && card.sphere === "fellowship";
    },
    isAragorn: (code) => grantedName != null && code !== granted && cards.get(code)?.type === "hero" && cards.get(code)?.name === grantedName,
  };
}
