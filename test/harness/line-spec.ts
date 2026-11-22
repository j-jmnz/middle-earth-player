import { chai, it } from "vitest";

import type { Effect } from "../../src/catalog/boundary.ts";
import { EFFECTS } from "../../src/effects/index.ts";

import { withoutLine } from "./card-spec.ts";
import { IntentRefused } from "./scene.ts";

// Test helper. A player card's printed line as a test that proves it tests the line: `check` builds its table on the records it is given, plays the moment and asserts what the printed line says. It runs
// once on every record and must pass, and once with the records of the line removed and must throw a failed expectation or an IntentRefused (an intent nobody offers any more: the kit's send throws it). Any other throw
// (a TypeError, a lookup error in the check's own helpers) fails the test, as it would not show that the line is tested. A check that passes both ways tests nothing,
// as a card-spec row that passes without its records does (test/harness/card-spec.ts). The title begins with the line id, so the line is found by a search for it.

/** Two tests for one printed line: `check` on every record, and `check` without the records that name the line, which must fail. A line no record names is an error. */
export function lineSpec(line: string, name: string, check: (effects: readonly Effect[]) => void | Promise<void>, effects: readonly Effect[] = EFFECTS): void {
  it(`${line} ${name}`, async () => {
    if (!effects.some((effect) => effect.lines.includes(line))) throw new Error(`no record names line ${line}`);
    await check(effects);
  });
  it(`${line} ${name}: fails without its records`, async () => {
    const thrown = await (async () => check(withoutLine(effects, line)))().then(
      () => null,
      (error: unknown) => ({ error }),
    );
    if (thrown == null) throw new Error(`${line}: the check passes without its records, so it tests nothing`);
    if (thrown.error instanceof chai.AssertionError || thrown.error instanceof IntentRefused) return;
    throw new Error(`${line}: the check threw something other than a failed expectation or a refused intent`, { cause: thrown.error });
  });
}
