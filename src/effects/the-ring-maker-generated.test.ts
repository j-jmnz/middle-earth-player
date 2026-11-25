import { describe, expect, it } from "vitest";

import { EFFECTS } from "./index.ts";

// The templates write records for a few Ring-maker lines at build time (src/effects/generated/the-ring-maker.ts); the rest are the scenario authors' (src/effects/open-lines.ts). Each generated
// record belongs to the printed line it names.
describe("The Ring-maker's generated records", () => {
  it.each([
    ["07024:constant:1", "07024:A:1"],
    ["07036:shadow:1", "07036:A:2"],
    ["07038:shadow:1", "07038:A:2"],
    ["07039:shadow:1", "07039:A:2"],
    ["07046:shadow:1", "07046:A:3"],
    ["07048:shadow:1", "07048:A:2"],
    ["08040:constant:1", "08040:A:1"],
    ["08041:constant:1", "08041:A:1"],
    ["08042:constant:1", "08042:A:1"],
    ["08050:constant:1", "08050:A:1"],
    ["08068:triggered:1", "08068:A:3"],
    ["08077:travel:1", "08077:A:1"],
    ["08102:triggered:1", "08102:A:3"],
    ["08103:constant:1", "08103:A:1"],
    ["08104:constant:1", "08104:A:1"],
    ["08110:shadow:1", "08110:A:3"],
    ["08127:constant:1", "08127:A:2"],
    ["08150:triggered:1", "08150:A:3"],
  ])("%s implements the printed line %s", (id, line) => {
    expect(EFFECTS.find((effect) => effect.id === id)?.lines).toContain(line);
  });
});
