import type { Effect } from "../../../catalog/boundary.ts";

// Records for the KD player cards whose lines no template reads (data/cards/KD.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 03001 Dwalin: the Orc test is on the Response's `condition`, which reads the destroyed enemy (the event's other card).
  {"id":"03001:response:1","cardCode":"03001","lines":["03001:A:1"],"timing":"response","trigger":"attackDestroyed","subject":"self","condition":{"kind":"matches","card":"other","pick":{"type":"enemy","control":"any","trait":"Orc"}},"instructions":[{"verb":"LowerThreat","amount":2,"who":"actor"}]},
  // 03002 Bifur: any hero's resource pays.
  {"id":"03002:action:1","cardCode":"03002","lines":["03002:A:1"],"timing":"action","anyPlayer":true,"limit":"oncePerRound","cost":{"kind":"resources","amount":1,"sphere":"neutral"},"instructions":[{"verb":"AddResources","amount":1,"to":"self"}]},
  // 03004 Durin's Song
  {"id":"03004:action:1","cardCode":"03004","lines":["03004:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any","trait":"Dwarf"}},{"verb":"ModifyStat","stat":"willpower","amount":2,"until":"endOfRound","target":"picked"},{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfRound","target":"picked"},{"verb":"ModifyStat","stat":"defense","amount":2,"until":"endOfRound","target":"picked"}]},
  // 03007 Dwarrowdelf Axe
  {"id":"03007:constant:2","cardCode":"03007","lines":["03007:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 03008 Khazâd! Khazâd!
  {"id":"03008:action:1","cardCode":"03008","lines":["03008:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","trait":"Dwarf"}},{"verb":"ModifyStat","stat":"attack","amount":3,"until":"endOfPhase","target":"picked"}]},
  // 03010 Untroubled by Darkness
  {"id":"03010:action:1","cardCode":"03010","lines":["03010:A:1"],"timing":"action","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","holders":{"type":"character","control":"any","trait":"Dwarf"},"when":{"kind":"not","condition":{"kind":"matches","card":"activeLocation","pick":{"type":"location","control":"any","traits":["Underground","Dark"]}}}},{"verb":"ModifyStat","stat":"willpower","amount":2,"until":"endOfPhase","holders":{"type":"character","control":"any","trait":"Dwarf"},"when":{"kind":"matches","card":"activeLocation","pick":{"type":"location","control":"any","traits":["Underground","Dark"]}}}]},
  // 03011 Erebor Record Keeper
  {"id":"03011:constant:1","cardCode":"03011","lines":["03011:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotAttack","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"cannotDefend","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"03011:action:1","cardCode":"03011","lines":["03011:A:2"],"timing":"action","cost":[{"kind":"exhaustSelf"},{"kind":"resources","amount":1,"sphere":"lore"}],"condition":{"kind":"canPick","pick":{"type":"character","control":"any","trait":"Dwarf"}},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","trait":"Dwarf"}},{"verb":"Ready","target":"picked"}]},
  // 03012 Ancestral Knowledge: exhausting a Dwarf character you control is the cost.
  {"id":"03012:action:1","cardCode":"03012","lines":["03012:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"canPick","pick":{"type":"character","control":"you","trait":"Dwarf","state":"ready"}},{"kind":"matches","card":"activeLocation"}]},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"you","trait":"Dwarf","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"PlaceProgressOn","amount":2,"target":"activeLocation","when":{"kind":"not","condition":{"kind":"matches","card":"activeLocation","pick":{"type":"location","control":"any","traits":["Underground","Mountain"]}}}},{"verb":"PlaceProgressOn","amount":4,"target":"activeLocation","when":{"kind":"matches","card":"activeLocation","pick":{"type":"location","control":"any","traits":["Underground","Mountain"]}}}]},
  // 03013 Boots from Erebor: the host rule and its limit are one AttachesTo (the engine reads the first one).
  {"id":"03013:constant:1","cardCode":"03013","lines":["03013:A:1","03013:A:2"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"character","control":"any","traits":["Dwarf","Hobbit"]}],"limitPerHost":true}]},
  {"id":"03013:constant:2","cardCode":"03013","lines":["03013:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"hitPoints","amount":1,"until":"whileSourceInPlay","target":"host"}]},
];

export const REPLACES: readonly string[] = [];
