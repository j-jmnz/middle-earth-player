import { describe, expect, it } from "vitest";

import { EFFECTS } from "./index.ts";

// The templates write records for a few Against the Shadow lines at build time (src/effects/generated/against-the-shadow.ts); the rest are the scenario authors' (src/effects/open-lines.ts). Each generated
// record belongs to the printed line it names.
describe("Against the Shadow's generated records", () => {
  it.each([
    ["06044:whenRevealed:1", "06044:A:1"],
    ["06048:shadow:1", "06048:A:3"],
    ["06050:travel:1", "06050:A:2"],
    ["06067:whenRevealed:1", "06067:A:1"],
    ["06077:travel:1", "06077:A:2"],
    ["06097:travel:1", "06097:A:1"],
    ["06153:constant:1", "06153:A:1"],
    ["06154:shadow:1", "06154:A:2"],
    ["06158:shadow:1", "06158:A:3"],
  ])("%s implements the printed line %s", (id, line) => {
    expect(EFFECTS.find((effect) => effect.id === id)?.lines).toContain(line);
  });
});
