import type { Effect } from "../../catalog/boundary.ts";

// Written by pnpm data build from data/cards and data/scenarios (standalone-scenarios). Do not edit.
// scripts/data/effects/templates.ts holds the sentence patterns; src/effects/authored/ holds the rest.
export const GENERATED_EFFECTS: readonly Effect[] = [
  {"id":"147021:shadow:1","cardCode":"147021","lines":["147021:A:3"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"}}]}]},
  {"id":"50304:triggered:1","cardCode":"50304","lines":["50304:A:4"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  {"id":"50305:constant:1","cardCode":"50305","lines":["50305:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"}]},
];
