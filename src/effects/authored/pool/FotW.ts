import type { Effect } from "../../../catalog/boundary.ts";

// Records for the FotW player cards whose lines no template reads (data/cards/FotW.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 145001 Aragorn
  {"id":"145001:constant:1","cardCode":"145001","lines":["145001:A:2"],"timing":"constant","condition":{"kind":"matches","card":"self","pick":{"type":"hero","control":"any","hasAttachment":{"trait":"Artifact"}}},"instructions":[{"verb":"ModifyStat","stat":"sentinel","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"noExhaustQuest","amount":1,"until":"whileSourceInPlay"}]},
  // 145002 Éowyn
  {"id":"145002:action:1","cardCode":"145002","lines":["145002:A:2"],"timing":"action","limit":"oncePerGameGroup","cost":{"kind":"raiseThreat","amount":3},"instructions":[{"verb":"Ready"},{"verb":"ModifyStat","stat":"attack","amount":9,"until":"endOfPhase"}]},
  // 145004 Grimbold
  {"id":"145004:action:1","cardCode":"145004","lines":["145004:A:1"],"timing":"action","cost":{"kind":"discardSelf"},"condition":{"kind":"all","conditions":[{"kind":"phase","is":"Combat"},{"kind":"canPick","pick":{"type":"enemy","control":"any"}}]},"instructions":[{"verb":"BarAttack","scope":"any","until":"endOfPhase"}]},
  // 145006 Halbarad
  {"id":"145006:constant:1","cardCode":"145006","lines":["145006:A:1"],"timing":"constant","instructions":[{"verb":"ReduceCost","amount":{"count":{"type":"enemy","control":"any","engaged":"you"}}}]},
  {"id":"145006:constant:2","cardCode":"145006","lines":["145006:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"engagementCost","amount":10,"until":"whileSourceInPlay","holders":{"type":"enemy","control":"any","engaged":"you"}}]},
  // 145010 Golden Shield: the hero's willpower is read when the effect resolves.
  {"id":"145010:response:1","cardCode":"145010","lines":["145010:A:2"],"timing":"response","trigger":"declaredDefender","subject":"host","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"ModifyStat","stat":"defense","amount":{"stat":"willpower","of":"host"},"until":"endOfAttack","target":"host"}]},
  // 145012 Roheryn
  {"id":"145012:constant:1","cardCode":"145012","lines":["145012:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","trait":"Dúnedain"}]}]},
  {"id":"145012:constant:2","cardCode":"145012","lines":["145012:A:2"],"timing":"constant","instructions":[{"verb":"GrantIcon","sphere":"tactics","when":{"kind":"hostNamed","name":"Aragorn"}}]},
];

export const REPLACES: readonly string[] = [];
