import type { Effect } from "../../catalog/boundary.ts";

// Written by pnpm data:build from data/cards and data/scenarios (the-dark-of-mirkwood). Do not edit.
// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.
export const GENERATED_EFFECTS: readonly Effect[] = [
  {"id":"41007:whenRevealed:1","cardCode":"41007","lines":["41007:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AddSetAsideToStaging","code":"41027"}]},
  {"id":"41029:constant:1","cardCode":"41029","lines":["41029:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"}}]},
  {"id":"41044:setup:1","cardCode":"41044","lines":["41044:A:1"],"timing":"setup","instructions":[{"verb":"AttachSelf","to":{"kind":"hero"}}]},
  {"id":"41045:setup:1","cardCode":"41045","lines":["41045:A:1"],"timing":"setup","instructions":[{"verb":"AttachSelf","to":{"kind":"hero"}}]},
  {"id":"41046:setup:1","cardCode":"41046","lines":["41046:A:1"],"timing":"setup","instructions":[{"verb":"AttachSelf","to":{"kind":"hero"}}]},
  {"id":"41047:setup:1","cardCode":"41047","lines":["41047:A:1"],"timing":"setup","instructions":[{"verb":"AttachSelf","to":{"kind":"hero"}}]},
];
