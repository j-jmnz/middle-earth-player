// Rules: dcce.sailing-tests, dcce.heading (data/rules/entries.json). The dock's numbers for a Sailing test: how many cards the characters picked would look at (the engine's
// own count: a character that counts as more than one, from the card or from what another card gives it), and, once the cards are looked at, the heading change the symbols found would make.
import { shiftHeading } from "../rules/families/sea-heading.ts";
import { committedWeight } from "../rules/families/sea-sailing.ts";
import { askingToCommit } from "../rules/families/sea-sailing-legal.ts";
import type { ReduceContext, ScenarioState } from "../rules/reduce.ts";
import { modifierActive } from "../rules/state.ts";

import type { Readout } from "./readout.ts";
import { headingChangeWords, sailingLookWords } from "./sea-words.ts";
import { lookRows, successesOf } from "./sea-sheets.ts";
import type { SheetNames } from "./sheet-types.ts";

// The cards other than the character itself that give it "counts as 2" (Enlarged Quarters, 11174:B; Sea-ward Tower, 12134): named in the readout.
function givers(game: ScenarioState, id: string, cardName: (cardId: string) => string): string[] {
  const names = game.modifiers.filter((modifier) => modifier.stat === "sailingExtra" && modifier.instanceId === id && modifier.sourceId !== id && modifierActive(game, modifier)).map((modifier) => cardName(modifier.sourceId));
  return [...new Set(names)];
}

/** The readout of a Sailing test being asked, or null when none is. `picked` are the characters the first player has picked to commit. */
export function sailingReadout(game: ScenarioState, ctx: ReduceContext, picked: readonly string[], names: SheetNames): Readout | null {
  if (askingToCommit(game)) {
    const rows = picked.map((id) => ({ id, weight: committedWeight(game, id) }));
    const total = rows.reduce((sum, row) => sum + row.weight, 0);
    const counts = rows.filter((row) => row.weight > 1).map((row) => ({ name: names.card(row.id), weight: row.weight, sources: givers(game, row.id, names.card) }));
    return { kind: "sailing", stats: [], result: sailingLookWords(total, counts) };
  }
  const test = game.sea?.sailing;
  if (test?.step !== "shift") return null;
  const heading = game.sea?.heading ?? null;
  if (heading == null) return null;
  // The shift the engine makes for each symbol still to answer, one step on-course at a time, never past Sun.
  let after = game;
  for (let left = 0; left < test.left; left += 1) after = shiftHeading(after, "onCourse");
  const found = successesOf(lookRows(game, ctx, names));
  return { kind: "sailing", stats: found > 0 ? [{ icon: "sailingSuccess", value: test.left, word: "Success" }] : [], result: headingChangeWords(heading, after.sea?.heading ?? heading) };
}

