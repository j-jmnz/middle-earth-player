import type { Effect } from "../../../catalog/boundary.ts";

// Records for the WitW player cards whose lines no template reads (data/cards/WitW.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 04054 Grave Cairn. The character that left play is out of play, so any character chosen is another one.
  {"id":"04054:response:1","cardCode":"04054","lines":["04054:A:1"],"timing":"response","trigger":"leftPlay","subject":{"type":"character","control":"any"},"cost":{"kind":"playEvent"},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"any"}},{"verb":"ModifyStat","stat":"attack","amount":{"stat":"attack","of":"subject"},"until":"endOfRound","target":"picked"}]},
  // 04055 Sword that was Broken (line 1 is the generated 04055:constant:1)
  {"id":"04055:constant:2","cardCode":"04055","lines":["04055:A:2"],"timing":"constant","instructions":[{"verb":"GrantIcon","sphere":"leadership"}]},
  {"id":"04055:constant:3","cardCode":"04055","lines":["04055:A:3"],"timing":"constant","condition":{"kind":"hostNamed","name":"Aragorn"},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","holders":{"type":"character","control":"you"}}]},
  // 04056 Watcher of the Bruinen (line 1 is the sentinel keyword)
  {"id":"04056:constant:1","cardCode":"04056","lines":["04056:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"noExhaustDefend","amount":1,"until":"whileSourceInPlay"}]},
  // 04057 Rivendell Bow
  {"id":"04057:constant:1","cardCode":"04057","lines":["04057:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"character","control":"any","traits":["Noldor","Silvan"]},{"type":"character","control":"any","names":["Aragorn"]}],"limitPerHost":true}]},
  {"id":"04057:constant:2","cardCode":"04057","lines":["04057:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"ranged","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 04058 Arwen Undómiel
  {"id":"04058:response:1","cardCode":"04058","lines":["04058:A:1"],"timing":"response","trigger":"exhausted","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"character","control":"any"}},{"verb":"ModifyStat","stat":"sentinel","amount":1,"until":"endOfRound","target":"picked"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfRound","target":"picked"}]},
  // 04059 Elrond's Counsel. "Another character" is one other than the unique Noldor character you control: with two or more
  // of them any character will do; with one, any character but that one (a non-Noldor or a non-unique Noldor character).
  {"id":"04059:action:1","cardCode":"04059","lines":["04059:A:1"],"timing":"action","condition":{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Noldor"},"min":1},"instructions":[
    {"verb":"Choose","who":"actor","options":[
      {"id":"anyCharacter","requires":{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Noldor"},"min":2},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"any"}},{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","target":"picked"}]},
      {"id":"nonNoldor","requires":{"kind":"all","conditions":[{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Noldor"},"max":1},{"kind":"canPick","pick":{"type":"character","control":"any","notTraits":["Noldor"]}}]},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","notTraits":["Noldor"]}},{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","target":"picked"}]},
      {"id":"nonUniqueNoldor","requires":{"kind":"all","conditions":[{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Noldor"},"max":1},{"kind":"canPick","pick":{"type":"character","control":"any","trait":"Noldor","nonUnique":true}}]},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","trait":"Noldor","nonUnique":true}},{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","target":"picked"}]},
      {"id":"otherPlayersNoldor","requires":{"kind":"all","conditions":[{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Noldor"},"max":1},{"kind":"canPick","pick":{"type":"character","control":"other","trait":"Noldor","unique":true}}]},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"other","trait":"Noldor","unique":true}},{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","target":"picked"}]}]},
    {"verb":"LowerThreat","amount":3,"who":"actor"}]},
  // 04061 Legacy of Durin (line 1 is the generated 04061:constant:1)
  {"id":"04061:response:1","cardCode":"04061","lines":["04061:A:2"],"timing":"response","trigger":"played","eventSeat":"you","subject":{"type":"character","control":"you","trait":"Dwarf"},"cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Draw","amount":1}]},
  // 04062 Resourceful (line 1 is Secrecy)
  {"id":"04062:constant:1","cardCode":"04062","lines":["04062:A:2"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"you"}]}]},
  {"id":"04062:constant:2","cardCode":"04062","lines":["04062:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"extraResource","amount":1,"until":"whileSourceInPlay","target":"host"}]},
];

export const REPLACES: readonly string[] = [];
