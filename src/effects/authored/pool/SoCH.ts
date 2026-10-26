import type { Effect } from "../../../catalog/boundary.ts";

// Records for the SoCH player cards whose lines no template reads (data/cards/SoCH.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 12109 Na'asiyah
  {"id":"12109:action:1","cardCode":"12109","lines":["12109:A:2"],"timing":"action","cost":{"kind":"resources","amount":1,"from":"self"},"condition":{"kind":"any","conditions":[{"kind":"matches","card":"self","pick":{"type":"character","control":"any","attacking":true}},{"kind":"matches","card":"self","pick":{"type":"character","control":"any","defending":true}}]},"instructions":[
    {"verb":"Choose","who":"actor","options":[
      {"id":"attack","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack"}]},
      {"id":"defense","instructions":[{"verb":"ModifyStat","stat":"defense","amount":2,"until":"endOfAttack"}]}]}]},
  // 12110 Rune-master
  {"id":"12110:constant:1","cardCode":"12110","lines":["12110:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","trait":"Ranger"},{"type":"hero","control":"any","spheres":["leadership"]}]}]},
  // 12112 Veteran Sword-elf
  {"id":"12112:constant:1","cardCode":"12112","lines":["12112:A:1"],"timing":"constant","instructions":[
    {"verb":"ModifyStat","stat":"attack","amount":{"count":{"type":"card","control":"you","from":"discard","names":["Veteran Sword-elf"]}},"until":"whileSourceInPlay"},
    {"verb":"ModifyStat","stat":"defense","amount":{"count":{"type":"card","control":"you","from":"discard","names":["Veteran Sword-elf"]}},"until":"whileSourceInPlay"}]},
  // 12113 Vigilant Guard
  {"id":"12113:constant:2","cardCode":"12113","lines":["12113:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"hitPoints","amount":2,"until":"whileSourceInPlay","target":"host"}]},
  // 12116 Windfola: A:2 is the generated 12116:constant:1, so the attach line takes the next number.
  {"id":"12116:constant:2","cardCode":"12116","lines":["12116:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","spheres":["spirit"]},{"type":"character","control":"any","names":["Éowyn"]}]}]},
  // 12117 Ioreth
  {"id":"12117:constant:1","cardCode":"12117","lines":["12117:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotAttack","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"cannotDefend","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"12117:action:1","cardCode":"12117","lines":["12117:A:2"],"timing":"action","anyPlayer":true,"cost":[{"kind":"resources","amount":1,"sphere":"lore"},{"kind":"exhaustSelf"}],"instructions":[{"verb":"Pick","pick":{"type":"character","control":"any"}},{"verb":"Heal","amount":3}]},
  // 12119 Justice Shall Be Done
  {"id":"12119:constant:1","cardCode":"12119","lines":["12119:A:1"],"timing":"constant","instructions":[{"verb":"DeckLimit","copies":1}]},
];

export const REPLACES: readonly string[] = [];
