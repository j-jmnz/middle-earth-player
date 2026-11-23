import { describe, expect, it } from "vitest";

import { EFFECTS } from "./index.ts";

// The templates write records for a few Hobbit lines at build time (src/effects/generated/the-hobbit.ts); the rest are the scenario authors' (src/effects/open-lines.ts). Each generated record
// belongs to the printed line it names.
describe("The Hobbit's generated records", () => {
  it.each([
    ["131059:shadow:1", "131059:A:2"],
    ["132020:constant:1", "132020:A:1"],
    ["132022:constant:1", "132022:A:1"],
    ["132022:constant:2", "132022:A:2"],
    ["132023:constant:1", "132023:A:1"],
    ["132024:constant:1", "132024:A:1"],
    ["132025:travel:1", "132025:A:2"],
    ["132070:whenRevealed:1", "132070:A:1"],
  ])("%s implements the printed line %s", (id, line) => {
    expect(EFFECTS.find((effect) => effect.id === id)?.lines).toContain(line);
  });
});
