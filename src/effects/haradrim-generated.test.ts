import { describe, expect, it } from "vitest";

import { EFFECTS } from "./index.ts";

// The templates write records for a few Haradrim lines at build time (src/effects/generated/haradrim.ts); the rest are the scenario authors' (src/effects/open-lines.ts). Each generated
// record belongs to the printed line it names.
describe("Haradrim's generated records", () => {
  it.each([
    ["16018:travel:1", "16018:A:2"],
    ["16056:travel:1", "16056:A:2"],
    ["16063:shadow:1", "16063:A:2"],
    ["17069:travel:1", "17069:A:3"],
    ["17120:triggered:1", "17120:A:3"],
    ["17123:shadow:1", "17123:A:3"],
    ["17145:triggered:1", "17145:A:4"],
    ["17151:shadow:1", "17151:A:2"],
    ["17155:shadow:1", "17155:A:2"],
  ])("%s implements the printed line %s", (id, line) => {
    expect(EFFECTS.find((effect) => effect.id === id)?.lines).toContain(line);
  });
});
