// The rows that open a campaign's scenarios as card groups (scenario-group.ts): the campaign setup's Later scenarios list and the path's Cards
// screen (docs/design-system.md, Campaign setup). Each says the scenario's place in the book and what its encounter deck holds in Normal. Pure.
import { printedScenarioName } from "../../campaign/printed-name";
import { scenarioOf } from "../data/campaign-data";
import { cardsWord } from "./card-group";

export type ScenarioRow = { id: string; number: number; name: string; detail: string };

/** "3 sets · 36 cards": the booklet's sets and their Normal counts, as the briefing counts them. */
export function encounterWords(sets: readonly { count: number }[]): string {
  const cards = sets.reduce((sum, set) => sum + set.count, 0);
  return `${sets.length} ${sets.length === 1 ? "set" : "sets"} · ${cardsWord(cards)}`;
}

/** "Stages 1 to 3", "Stage 1". */
export function stagesWords(count: number): string {
  return count === 1 ? "Stage 1" : `Stages 1 to ${count}`;
}

/** The campaign's scenarios from the one after `after` (0 for all), in book order; a scenario with no file is left out. */
export function scenarioRows(scenarios: readonly string[], after = 0): ScenarioRow[] {
  return scenarios.slice(after).flatMap((id, at): ScenarioRow[] => {
    const scenario = scenarioOf(id);
    if (!scenario) return [];
    const number = after + at + 1;
    return [{ id, number, name: printedScenarioName(scenario.name), detail: `Scenario ${number} · ${encounterWords(scenario.encounterSets)}` }];
  });
}
