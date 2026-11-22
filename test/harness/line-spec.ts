import { expect, it } from "vitest";

import type { Effect } from "../../src/catalog/boundary.ts";
import { EFFECTS } from "../../src/effects/index.ts";

import { withoutLine } from "./card-spec.ts";

// Test helper. A player card's printed line as a test that proves it tests the line: `check` builds its table on the records it is given, plays the moment and asserts what the printed line says. It runs
// once on every record and must pass, and once with the records of the line removed and must throw (a failed expectation, or an intent nobody offers any more). A check that passes both ways tests nothing,
// as a card-spec row that passes without its records does (test/harness/card-spec.ts). The title begins with the line id, so the line is found by a search for it.

/** Two tests for one printed line: `check` on every record, and `check` without the records that name the line, which must fail. A line no record names is an error. */
export function lineSpec(line: string, name: string, check: (effects: readonly Effect[]) => void | Promise<void>, effects: readonly Effect[] = EFFECTS): void {
  it(`${line} ${name}`, async () => {
    if (!effects.some((effect) => effect.lines.includes(line))) throw new Error(`no record names line ${line}`);
    await check(effects);
  });
  it(`${line} ${name}: fails without its records`, async () => {
    await expect((async () => check(withoutLine(effects, line)))()).rejects.toThrow();
  });
}
