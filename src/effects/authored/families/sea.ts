import type { Effect } from "../../../catalog/boundary.ts";

// Authored records for the sea family (docs/plans/effect-authoring.md): the lines the Sailing test itself reads (dcce.sailing-tests). The rest of the
// six ships' lines, and the Upgraded sides, are written with the first scenario that plays them. A card's other lines may have records elsewhere.
const dreamChaser = (code: string, line: string): Effect => ({
  id: `${code}:constant:1`,
  cardCode: code,
  lines: [line],
  timing: "constant",
  // "The Dream-chaser can be committed to Sailing tests (even if you are not the first player) and counts as 2 characters when committed."
  instructions: [
    { verb: "ModifyStat", stat: "sailsAnyTest", amount: 1, until: "whileSourceInPlay" },
    { verb: "ModifyStat", stat: "sailingExtra", amount: 1, until: "whileSourceInPlay" },
  ],
});

export const RECORDS: readonly Effect[] = [dreamChaser("11080", "11080:A:3"), dreamChaser("110136", "110136:A:3")];

export const REPLACES: readonly string[] = [];
