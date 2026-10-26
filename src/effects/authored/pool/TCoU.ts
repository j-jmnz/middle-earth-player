import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TCoU player cards whose lines no template reads (data/cards/TCoU.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 22028 Angbor the Fearless
  {"id":"22028:constant:1","cardCode":"22028","lines":["22028:A:1"],"timing":"constant","condition":{"kind":"threat","min":40},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"noExhaustQuest","amount":1,"until":"whileSourceInPlay"}]},
  // 22031 Keen Longbow (line 1 is the generated 22031:constant:1; Restricted is a keyword the engine reads)
  {"id":"22031:constant:2","cardCode":"22031","lines":["22031:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"ranged","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"22031:response:1","cardCode":"22031","lines":["22031:A:3"],"timing":"response","trigger":"declaredAttacker","subject":"host","condition":{"kind":"handHasCard"},"instructions":[{"verb":"Choose","who":"actor","options":[
    {"id":"discard1","requires":{"kind":"count","pick":{"type":"card","control":"you","from":"hand"},"min":1},"instructions":[{"verb":"DiscardFromHand","amount":1},{"verb":"DamageCard","amount":1,"target":"other"}]},
    {"id":"discard2","requires":{"kind":"count","pick":{"type":"card","control":"you","from":"hand"},"min":2},"instructions":[{"verb":"DiscardFromHand","amount":2},{"verb":"DamageCard","amount":2,"target":"other"}]},
    {"id":"discard3","requires":{"kind":"count","pick":{"type":"card","control":"you","from":"hand"},"min":3},"instructions":[{"verb":"DiscardFromHand","amount":3},{"verb":"DamageCard","amount":3,"target":"other"}]}]}]},
  // 22032 War Axe (line 1 is the generated 22032:constant:1, line 2 Restricted). It is restricted, so it counts itself.
  {"id":"22032:constant:2","cardCode":"22032","lines":["22032:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"count":{"type":"attachment","control":"any","attachedTo":"host","keyword":"restricted"}},"until":"whileSourceInPlay","target":"host"}]},
  // 22034 Knight of Belfalas
  {"id":"22034:response:1","cardCode":"22034","lines":["22034:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","condition":{"kind":"canPick","pick":{"type":"ally","control":"you","from":"discard","trait":"Gondor"}},"instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you","from":"discard","trait":"Gondor"}},{"verb":"MovePicked","to":"hand"}]},
  // 22035 Horn of the Mark (line 2 is open). Merry is a hero or an ally.
  {"id":"22035:constant:1","cardCode":"22035","lines":["22035:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","trait":"Rohan"},{"type":"character","control":"any","names":["Merry"]}]}]},
];

export const REPLACES: readonly string[] = [];
