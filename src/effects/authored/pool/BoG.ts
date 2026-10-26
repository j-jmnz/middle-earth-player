import type { Effect } from "../../../catalog/boundary.ts";

// Records for the BoG player cards whose lines no template reads (data/cards/BoG.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 06107 Caldara: she is discarded as the cost, so the count reads the other heroes with a printed Spirit icon.
  {"id":"06107:action:1","cardCode":"06107","lines":["06107:A:1"],"timing":"action","limit":"oncePerGame","cost":{"kind":"discardSelf"},"instructions":[{"verb":"Repeat","times":{"count":{"type":"hero","control":"you","printedIcon":"spirit","other":true}},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"discard","cardType":"ally","sphere":"spirit","intoPlay":true}},{"verb":"MovePicked","to":"play"}]}]},
  // 06108 Squire of the Citadel
  {"id":"06108:response:1","cardCode":"06108","lines":["06108:A:1"],"timing":"response","trigger":"leftPlay","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any","trait":"Gondor"}},{"verb":"AddResources","amount":1,"to":"picked"}]},
  // 06109 Tome of Atanatar (line 3, playing an event from the discard pile, is open)
  {"id":"06109:constant:2","cardCode":"06109","lines":["06109:A:2"],"timing":"constant","instructions":[{"verb":"ReduceCost","amount":{"count":{"type":"hero","control":"you","printedIcon":"leadership"}}}]},
  // 06110 Guthlaf
  {"id":"06110:constant:1","cardCode":"06110","lines":["06110:A:1"],"timing":"constant","instructions":[{"verb":"ReduceCost","amount":1,"when":{"kind":"count","pick":{"type":"hero","control":"any","trait":"Rohan"},"min":1}}]},
  {"id":"06110:constant:2","cardCode":"06110","lines":["06110:A:2"],"timing":"constant","condition":{"kind":"count","pick":{"type":"hero","control":"any","trait":"Gondor"},"min":1},"instructions":[{"verb":"ModifyStat","stat":"sentinel","amount":1,"until":"whileSourceInPlay"}]},
  // 06111 The Hammer-stroke: each enemy in play, in the staging area or engaged with any player.
  {"id":"06111:action:1","cardCode":"06111","lines":["06111:A:1"],"timing":"action","condition":{"kind":"phase","is":"Encounter"},"instructions":[{"verb":"Each","pick":{"type":"enemy","control":"any","staging":true},"instructions":[{"verb":"Engage","target":"picked"}]}]},
  // 06113 Children of the Sea
  {"id":"06113:action:1","cardCode":"06113","lines":["06113:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you","traits":["Silvan","Noldor"]}},{"verb":"ModifyStat","stat":"willpower","amount":2,"until":"endOfPhase","target":"picked"},{"verb":"Delay","until":"endOfPhase","subject":"picked","instructions":[{"verb":"PutOnDeck","position":"shuffle","target":"picked","when":{"kind":"matches","card":"picked","inPlay":true}}]}]},
  // 06114 Anborn
  {"id":"06114:action:1","cardCode":"06114","lines":["06114:A:1"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"discard","trait":"Trap"}},{"verb":"MovePicked","to":"hand"}]},
];

export const REPLACES: readonly string[] = [];
