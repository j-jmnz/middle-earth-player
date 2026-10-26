import type { Effect } from "../../../catalog/boundary.ts";

// Records for the RAH player cards whose lines no template reads (data/cards/RAH.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 17028 Thurindir. The only side quests in data/cards are player side quests. Line 2 (a hero's Setup search) stays open.
  {"id":"17028:constant:1","cardCode":"17028","lines":["17028:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":{"count":{"type":"card","control":"any","from":"victory","cardType":"player-side-quest"}},"until":"whileSourceInPlay"}]},
  // 17029 Kahliel's Tribesman
  {"id":"17029:action:1","cardCode":"17029","lines":["17029:A:1"],"timing":"action","cost":{"kind":"exhaustSelf"},"condition":{"kind":"canPick","pick":{"type":"character","control":"any","trait":"Harad","other":true}},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","trait":"Harad","other":true}},{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","target":"picked"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfPhase","target":"picked"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfPhase","target":"picked"}]},
  // 17030 Steed of the North. data/cards spells the trait both "Dúnedain" and "Dunedain"; both are the one trait.
  {"id":"17030:constant:1","cardCode":"17030","lines":["17030:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","traits":["Dúnedain","Dunedain","Ranger"]}]}]},
  {"id":"17030:response:1","cardCode":"17030","lines":["17030:A:2"],"timing":"response","trigger":"engaged","eventSeat":"you","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Ready","target":"host"}]},
  // 17031 Mighty Warrior (lines 1 and 2 are the generated 17031:constant:1 and :2)
  {"id":"17031:response:1","cardCode":"17031","lines":["17031:A:3"],"timing":"response","trigger":"played","instructions":[{"verb":"Draw","amount":1}]},
  // 17032 Proud Hunters. Two different characters fill the two roles exactly when each role has a candidate and the two
  // roles together have at least two (Hall's condition for two slots).
  {"id":"17032:constant:1","cardCode":"17032","lines":["17032:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"all","conditions":[{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Noble"},"min":1},{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Ranger"},"min":1},{"kind":"count","pick":{"type":"character","control":"you","unique":true,"traits":["Noble","Ranger"]},"min":2}]}}]},
  {"id":"17032:response:1","cardCode":"17032","lines":["17032:A:2"],"timing":"response","trigger":"attackDestroyed","subject":{"type":"hero","control":"you"},"cost":{"kind":"playEvent"},"instructions":[{"verb":"AddResources","amount":{"stat":"threat","of":"other","printed":true},"to":"subject"}]},
];

export const REPLACES: readonly string[] = [];
