import type { Effect } from "../../../catalog/boundary.ts";

// Records for the MoF player cards whose lines no template reads (data/cards/MoF.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 146001 Frodo Baggins. The One Ring in play is the Fellowship box's (141085), the only one the playable scenarios deal.
  {"id":"146001:action:1","cardCode":"146001","lines":["146001:A:1"],"timing":"action","condition":{"kind":"phase","is":"Planning"},"cost":{"kind":"exhaustCode","code":"141085"},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any"}},{"verb":"AddResources","amount":1,"to":"picked"}]},
  // 146002 Aragorn
  {"id":"146002:action:1","cardCode":"146002","lines":["146002:A:2"],"timing":"action","limit":"oncePerPhase","cost":{"kind":"resources","amount":1,"from":"self"},"instructions":[{"verb":"Ready"}]},
  // 146004 Tom Cotton
  {"id":"146004:response:1","cardCode":"146004","lines":["146004:A:2"],"timing":"response","trigger":"enteredPlay","subject":{"type":"ally","control":"any","trait":"Hobbit"},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfRound","target":"subject"}]},
  // 146005 Rosie Cotton
  {"id":"146005:action:1","cardCode":"146005","lines":["146005:A:1"],"timing":"action","limit":"oncePerPhase","cost":{"kind":"exhaustSelf"},"instructions":[
    {"verb":"Pick","pick":{"type":"hero","control":"any","trait":"Hobbit"}},
    {"verb":"Choose","who":"actor","options":[
      {"id":"willpower","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":{"stat":"willpower","of":"self"},"until":"endOfPhase","target":"picked"}]},
      {"id":"attack","instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"stat":"willpower","of":"self"},"until":"endOfPhase","target":"picked"}]},
      {"id":"defense","instructions":[{"verb":"ModifyStat","stat":"defense","amount":{"stat":"willpower","of":"self"},"until":"endOfPhase","target":"picked"}]}]}]},
  // 146007 Elladan
  {"id":"146007:constant:1","cardCode":"146007","lines":["146007:A:1"],"timing":"constant","condition":{"kind":"count","pick":{"type":"character","control":"any","names":["Elrohir"]},"min":1},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"whileSourceInPlay"}]},
  // 146008 Elrohir
  {"id":"146008:constant:1","cardCode":"146008","lines":["146008:A:1"],"timing":"constant","condition":{"kind":"count","pick":{"type":"character","control":"any","names":["Elladan"]},"min":1},"instructions":[{"verb":"ModifyStat","stat":"defense","amount":2,"until":"whileSourceInPlay"}]},
  // 146009 Orc Disguise
  {"id":"146009:constant:1","cardCode":"146009","lines":["146009:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"ringBearer"},"limitPerHost":true}]},
  // 146010 Captains of the West
  {"id":"146010:action:1","cardCode":"146010","lines":["146010:A:1"],"timing":"action","condition":{"kind":"phase","is":"Quest"},"instructions":[
    {"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","holders":{"type":"hero","control":"any","trait":"Noble"}},
    {"verb":"ModifyStat","stat":"noExhaustQuest","amount":1,"until":"endOfPhase","holders":{"type":"hero","control":"any","trait":"Noble"}}]},
  // 146013 Raise the Shire: the top 5, or the whole deck when that enemy's engagement cost is higher than your threat.
  {"id":"146013:response:1","cardCode":"146013","lines":["146013:A:1"],"timing":"response","trigger":"engaged","eventSeat":"you","cost":{"kind":"playEvent"},"instructions":[
    {"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":5,"cardType":"ally","trait":"Hobbit","intoPlay":true},"when":{"kind":"not","condition":{"kind":"matches","card":"subject","pick":{"type":"enemy","control":"any","aboveThreat":true}}}},
    {"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","cardType":"ally","trait":"Hobbit","intoPlay":true},"when":{"kind":"matches","card":"subject","pick":{"type":"enemy","control":"any","aboveThreat":true}}},
    {"verb":"MovePicked","to":"play"},
    {"verb":"ShuffleDeck"},
    {"verb":"Delay","until":"endOfRound","subject":"picked","instructions":[{"verb":"ReturnToHand","when":{"kind":"matches","card":"picked","inPlay":true}}]}]},
];

export const REPLACES: readonly string[] = [];
