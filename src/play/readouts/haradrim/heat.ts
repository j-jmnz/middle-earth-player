// Rules: hrd.heat-tracker (data/rules/entries.json); ledger lines 16068:A:1, 16068:B:3, 16069:B:2, 16070:B:3 (docs/scenarios/haradrim/desert-crossing.md, Table).
// Desert Crossing's temperature as a top-bar dial against its limit of 60 (it warms as the pursuit dial does). The engine decided the number (the `temperature` table modifier); nothing here changes it. Empty in any other scenario. Pure, so a test reads it.
// The "Blank" pill and the no-ready line of its Craft Remedy and Find Water are shared card marks (src/play/cards/card-effects.ts).
import type { ScenarioState } from "../../../rules/core/state.ts";
import { temperatureOf } from "../../../rules/families/haradrim/heat.ts";

import { HEAT_LABEL, HEAT_LIMIT, HEAT_NAME, heatLimitWords, heatNearWords, heatPanel, heatWords } from "../../words/scenarios/haradrim/heat-table.ts";
import type { TableDial } from "../dials.ts";


/** The temperature dial: the value against the limit the stage's loss record reads, warm near the limit; none while no tracker is set (before Setup, or in any other scenario). */
export function heatDials(game: ScenarioState): readonly TableDial[] {
  const value = temperatureOf(game);
  if (value == null) return [];
  const level = value >= (HEAT_LIMIT * 9) / 10 ? ("critical" as const) : ("near" as const);
  const near = value >= (HEAT_LIMIT * 4) / 5 ? { warn: { level, words: heatNearWords(value) } } : {};
  return [{ id: "heat", testID: "desert-heat", label: HEAT_LABEL, name: HEAT_NAME, value, limit: HEAT_LIMIT, warms: true, ...near, limitWords: heatLimitWords, note: heatWords(value), lists: [{ heading: HEAT_NAME, lines: heatPanel(value) }], said: heatPanel(value).join(" ") }];
}
