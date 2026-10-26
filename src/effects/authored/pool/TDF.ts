import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TDF player cards whose lines no template reads (data/cards/TDF.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 06033 Forlong: a neutral card belongs to no sphere (rr.neutral-cards) and an ally has one of the four spheres of influence
  // (rr.spheres-of-influence), so 4 different spheres is one Outlands ally of each. Each phase is one of the seven phases of
  // the round, not the engine's beginning and end of round.
  {"id":"06033:triggered:1","cardCode":"06033","lines":["06033:A:1"],"timing":"triggered","trigger":"beginningOfPhase","condition":{"kind":"all","conditions":[{"kind":"count","pick":{"type":"ally","control":"you","trait":"Outlands","spheres":["leadership"]},"min":1},{"kind":"count","pick":{"type":"ally","control":"you","trait":"Outlands","spheres":["tactics"]},"min":1},{"kind":"count","pick":{"type":"ally","control":"you","trait":"Outlands","spheres":["spirit"]},"min":1},{"kind":"count","pick":{"type":"ally","control":"you","trait":"Outlands","spheres":["lore"]},"min":1}]},"instructions":[{"verb":"Ready","when":{"kind":"any","conditions":[{"kind":"phase","is":"Resource"},{"kind":"phase","is":"Planning"},{"kind":"phase","is":"Quest"},{"kind":"phase","is":"Travel"},{"kind":"phase","is":"Encounter"},{"kind":"phase","is":"Combat"},{"kind":"phase","is":"Refresh"}]}}]},
  // 06034 Strength of Arms
  {"id":"06034:constant:1","cardCode":"06034","lines":["06034:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"allMatch","of":{"type":"hero","control":"you"},"match":{"type":"hero","control":"you","printedIcon":"leadership"}}}]},
  {"id":"06034:action:1","cardCode":"06034","lines":["06034:A:2"],"timing":"action","instructions":[{"verb":"Each","pick":{"type":"ally","control":"any"},"instructions":[{"verb":"Ready","target":"picked"}]}]},
  // 06035 Mighty Prowess ("a Tactics hero hero" is printed so). Line 2 needs "shares a Trait with": open.
  {"id":"06035:constant:1","cardCode":"06035","lines":["06035:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero","sphere":"tactics"},"limitPerHost":true}]},
  // 06036 Trained for War (line 2, Battle and Siege on the quest, is no longer open).
  {"id":"06036:constant:1","cardCode":"06036","lines":["06036:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"allMatch","of":{"type":"hero","control":"you"},"match":{"type":"hero","control":"you","printedIcon":"tactics"}}}]},
  // 06037 Silvan Refugee: another character (its own leaving play leaves nothing to discard).
  {"id":"06037:forced:1","cardCode":"06037","lines":["06037:A:1"],"timing":"forced","trigger":"leftPlay","subject":{"type":"character","control":"any","other":true},"instructions":[{"verb":"Discard","target":{"kind":"self"}}]},
  // 06038 Against the Shadow (line 2, Willpower used instead of Defense, is no longer open).
  {"id":"06038:constant:1","cardCode":"06038","lines":["06038:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"allMatch","of":{"type":"hero","control":"you"},"match":{"type":"hero","control":"you","printedIcon":"spirit"}}}]},
  // 06039 Harbor Master
  {"id":"06039:response:1","cardCode":"06039","lines":["06039:A:1"],"timing":"response","trigger":"resourcesAdded","subject":{"type":"hero","control":"you"},"instructions":[{"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfRound"}]},
  // 06040 Advance Warning: the enemies in play when it resolves (rr.event-cards).
  {"id":"06040:constant:1","cardCode":"06040","lines":["06040:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"allMatch","of":{"type":"hero","control":"you"},"match":{"type":"hero","control":"you","printedIcon":"lore"}}}]},
  {"id":"06040:action:1","cardCode":"06040","lines":["06040:A:2"],"timing":"action","instructions":[{"verb":"ModifyStat","stat":"noEngagementChecks","amount":1,"until":"endOfPhase","holders":{"type":"enemy","control":"any","staging":true}}]},
];

export const REPLACES: readonly string[] = [];
