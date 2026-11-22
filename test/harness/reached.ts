// Test helper. The records of a scenario's own cards that no golden resolves: the golden suite installs a recorder (`recordReached`, src/rules/core/cause.ts) while it plays the goldens, which notes each effect record whose instructions run, and writes what it
// found to `.agent/unreached/<scenario-id>.json` (not committed). `pnpm test scenario <scenario-id>` reads the file and lists the records with the tests that name them (scripts/tools/unreached.ts). The step logs name no records, and adding ids to steps
// would change every golden.json, so nothing here touches a golden.
import { mkdirSync, writeFileSync } from "node:fs";

import type { Effect } from "../../src/catalog/boundary.ts";
import { recordReached } from "../../src/rules/core/cause.ts";
import type { AnyScenarioData } from "../../src/catalog/scenario-data.ts";

/** One record no golden resolved. */
export type Unreached = { id: string; timing: Effect["timing"]; lines: readonly string[] };

// A constant is read where it applies and has no moment it resolves; a Resolution is written by the campaign layer when the golden's win is applied (the suite's won test), not while the game is played.
const NO_MOMENT: ReadonlySet<Effect["timing"]> = new Set(["constant", "resolution"]);

/** The codes of the cards a scenario owns: its campaign card, quest stages, the cards its campaign card places and every card it deals. */
export function ownCodes(scenario: AnyScenarioData): Set<string> {
  return new Set([...(scenario.campaignCard === undefined ? [] : [scenario.campaignCard]), ...scenario.stages, ...scenario.campaignPlaced, ...scenario.cards.map((card) => card.code)]);
}

/** Runs `play`, noting into the returned set each effect record whose instructions ran. */
export function whileRecording<T>(play: () => T): { value: T; reached: Set<string> } {
  const reached = new Set<string>();
  recordReached(reached);
  try {
    return { value: play(), reached };
  } finally {
    recordReached(null);
  }
}

/** The records of the scenario's own cards (one entry for each id) that were not reached, in record order. */
export function unreachedRecords(effects: readonly Effect[], own: ReadonlySet<string>, reached: ReadonlySet<string>): Unreached[] {
  const seen = new Set<string>();
  const found: Unreached[] = [];
  for (const effect of effects) {
    if (!own.has(effect.cardCode) || NO_MOMENT.has(effect.timing) || reached.has(effect.id) || seen.has(effect.id)) continue;
    seen.add(effect.id);
    found.push({ id: effect.id, timing: effect.timing, lines: effect.lines });
  }
  return found;
}

/** Where the list of a scenario is written. */
export const unreachedFile = (scenarioId: string): string => new URL(`../../.agent/unreached/${scenarioId}.json`, import.meta.url).pathname;

export function writeUnreached(scenarioId: string, list: readonly Unreached[]): void {
  const file = unreachedFile(scenarioId);
  mkdirSync(new URL("../../.agent/unreached/", import.meta.url).pathname, { recursive: true });
  writeFileSync(file, `${JSON.stringify({ scenario: scenarioId, unreached: list })}\n`);
}
