import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TFoN player cards whose lines no template reads (data/cards/TFoN.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 22138 Shining Shield
  {"id":"22138:constant:2","cardCode":"22138","lines":["22138:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host","when":{"kind":"threat","max":39}},{"verb":"ModifyStat","stat":"defense","amount":2,"until":"whileSourceInPlay","target":"host","when":{"kind":"threat","min":40}}]},
  // 22139 Knowledge of the Enemy: no other copy may have been played this round.
  {"id":"22139:action:1","cardCode":"22139","lines":["22139:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Planning"},{"kind":"copiesPlayedThisRound","max":0}]},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you"}},{"verb":"AddResources","amount":{"count":{"type":"enemy","control":"any","engaged":"you"}},"to":"picked"}]},
  // 22141 Woodman Lore: up to X, so each ready is a choice.
  {"id":"22141:action:1","cardCode":"22141","lines":["22141:A:1"],"timing":"action","instructions":[{"verb":"Repeat","times":{"count":{"type":"location","control":"any","hasAttachment":{"playerCard":true}}},"instructions":[{"verb":"Choose","who":"actor","options":[{"id":"ready","requires":{"kind":"canPick","pick":{"type":"character","control":"you","trait":"Woodman","state":"exhausted"}},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"you","trait":"Woodman","state":"exhausted"}},{"verb":"Ready","target":"picked"}]},{"id":"stop","instructions":[]}]}]}]},
  // 22143 Tireless Thoroughbred: Restricted is a keyword the engine reads.
  {"id":"22143:constant:1","cardCode":"22143","lines":["22143:A:2"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"character","control":"any","trait":"Warrior"}]},{"verb":"ModifyStat","stat":"ranged","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"sentinel","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 22144 Misty Mountain Journeyman
  {"id":"22144:constant:1","cardCode":"22144","lines":["22144:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"hasEngaged"}}]},
  // 22146 Thorongil: a hero of any sphere but Fellowship and Baggins.
  {"id":"22146:constant:1","cardCode":"22146","lines":["22146:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"you","spheres":["leadership","lore","spirit","tactics","neutral"]}]}]},
];

export const REPLACES: readonly string[] = [];
