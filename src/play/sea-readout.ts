// Rules: dcce.sailing-tests, dcce.heading (data/rules/entries.json). The dock's numbers for a Sailing test: how many cards the characters picked would look at (the engine's
// own count: a character that counts as more than one, from the card or from what another card gives it), and, once the cards are looked at, the heading change the symbols found would make.
import { shiftHeading } from "../rules/families/sea/heading.ts";
import { committedWeight } from "../rules/families/sea/sailing.ts";
import { askingToCommit } from "../rules/families/sea/sailing-legal.ts";
import type { ReduceContext, ScenarioState } from "../rules/engine/reduce.ts";
import { modifierActive } from "../rules/core/state.ts";

import type { Readout } from "./readout.ts";
import { headingChangeWords, sailingLookWords, shiftReadoutWords } from "./sea-words.ts";
import { successesOf } from "./sea-sheets.ts";
import type { SheetNames } from "./sheet-types.ts";

// The cards other than the character itself that give it "counts as 2" (Enlarged Quarters, 11174:B; Sea-ward Tower, 12134): named in the readout.
function givers(game: ScenarioState, id: string, cardName: (cardId: string) => string): string[] {
  const names = game.modifiers.filter((modifier) => modifier.stat === "sailingExtra" && modifier.instanceId === id && modifier.sourceId !== id && modifierActive(game, modifier)).map((modifier) => cardName(modifier.sourceId));
  return [...new Set(names)];
}

// The additional cards a card in play says to look at ("look at 2 additional cards", 11050:A:1), with the cards that say so: the engine adds the flag `sailingLook` to the count.
function extraLooks(game: ScenarioState, cardName: (cardId: string) => string): { amount: number; sources: string[] } {
  const held = game.modifiers.filter((modifier) => modifier.stat === "sailingLook" && modifier.instanceId === "table" && modifierActive(game, modifier));
  return { amount: Math.max(0, held.reduce((sum, modifier) => sum + modifier.amount, 0)), sources: [...new Set(held.map((modifier) => cardName(modifier.sourceId)))] };
}

/** The readout of a Sailing test being asked, or null when none is. `picked` are the characters the first player has picked to commit. */
export function sailingReadout(game: ScenarioState, ctx: ReduceContext, picked: readonly string[], names: SheetNames): Readout | null {
  if (askingToCommit(game)) {
    const rows = picked.map((id) => ({ id, weight: committedWeight(game, id) }));
    const extra = extraLooks(game, names.card);
    const total = rows.reduce((sum, row) => sum + row.weight, 0) + extra.amount;
    const counts = rows.filter((row) => row.weight > 1).map((row) => ({ name: names.card(row.id), weight: row.weight, sources: givers(game, row.id, names.card) }));
    return { kind: "sailing", stats: [], result: sailingLookWords(total, counts, extra.amount > 0 ? extra : undefined) };
  }
  const test = game.sea?.sailing;
  const heading = game.sea?.heading ?? null;
  if (heading == null) return null;
  // Cards looked at with no shift left to make: the heading stays where it is.
  if (test?.step === "look") return { kind: "sailing", stats: [], result: headingChangeWords(heading, heading) };
  if (test?.step !== "shift") return null;
  // What one tap on "Shift on-course" does: one step, never past Sun, and the symbols that would still be asked after it (none once the heading is back on Sun).
  const after = shiftHeading(game, "onCourse").sea?.heading ?? heading;
  const more = after === "Sun" ? 0 : test.left - 1;
  return { kind: "sailing", stats: successesOf(game, ctx) > 0 ? [{ icon: "sailingSuccess", value: test.left, word: "Success" }] : [], result: shiftReadoutWords(heading, after, more) };
}

