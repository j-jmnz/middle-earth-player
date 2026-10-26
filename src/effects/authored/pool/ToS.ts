import type { Effect } from "../../../catalog/boundary.ts";

// Records for the ToS player cards whose lines no template reads (data/cards/ToS.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 143001 Aragorn (A:1, the first player gaining control, is open)
  {"id":"143001:action:1","cardCode":"143001","lines":["143001:A:2"],"timing":"action","cost":{"kind":"resources","amount":2,"from":"self"},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any"}},{"verb":"Ready","target":"picked"}]},
  // 143003 Treebeard
  {"id":"143003:constant:1","cardCode":"143003","lines":["143003:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"143003:action:1","cardCode":"143003","lines":["143003:A:2"],"timing":"action","limit":"fivePerPhase","cost":{"kind":"damageSelf","amount":1},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfPhase"}]},
  // 143005 Legolas
  {"id":"143005:response:1","cardCode":"143005","lines":["143005:A:2"],"timing":"response","trigger":"attackDestroyed","subject":"self","instructions":[{"verb":"Draw","amount":1}]},
  // 143006 Quickbeam
  {"id":"143006:constant:1","cardCode":"143006","lines":["143006:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"},{"verb":"EntersPlayExhausted"}]},
  {"id":"143006:response:1","cardCode":"143006","lines":["143006:A:2"],"timing":"response","trigger":"enteredPlay","subject":"self","cost":{"kind":"damageSelf","amount":1},"instructions":[{"verb":"Ready"}]},
  // 143007 Háma
  {"id":"143007:action:1","cardCode":"143007","lines":["143007:A:1"],"timing":"action","limit":"oncePerRound","condition":{"kind":"phase","is":"Combat"},"instructions":[
    {"verb":"Ready"},
    {"verb":"ModifyStat","stat":"defense","amount":3,"until":"endOfPhase"},
    {"verb":"Delay","until":"endOfPhase","instructions":[{"verb":"Discard","target":{"kind":"self"},"when":{"kind":"matches","card":"self","inPlay":true}}]}]},
  // 143008 Arod
  {"id":"143008:constant:1","cardCode":"143008","lines":["143008:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any"},{"type":"character","control":"any","names":["Legolas"]}]}]},
  {"id":"143008:response:1","cardCode":"143008","lines":["143008:A:2"],"timing":"response","trigger":"attackDestroyed","subject":"host","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Pick","pick":{"type":"location","control":"any"}},{"verb":"PlaceProgressOn","amount":1,"target":"picked"}]},
  // 143009 Ent Draught: A:2 is the generated 143009:constant:1, so A:1 and A:3 take the next numbers.
  {"id":"143009:constant:2","cardCode":"143009","lines":["143009:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"count","pick":{"type":"character","control":"you","trait":"Ent"},"min":1}}]},
  {"id":"143009:constant:3","cardCode":"143009","lines":["143009:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"hitPoints","amount":2,"until":"whileSourceInPlay","target":"host"}]},
  // 143010 Herugrim (A:2, a cost reduction that depends on the host, is open)
  {"id":"143010:response:1","cardCode":"143010","lines":["143010:A:3"],"timing":"response","trigger":"declaredAttacker","subject":"host","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"stat":"willpower","of":"host"},"until":"endOfAttack","target":"host"}]},
  // 143011 Entmoot: "any number" is a take-or-leave choice for each Ent card among the top 5.
  {"id":"143011:constant:1","cardCode":"143011","lines":["143011:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"count","pick":{"type":"character","control":"you","trait":"Ent"},"min":1}}]},
  {"id":"143011:action:1","cardCode":"143011","lines":["143011:A:2"],"timing":"action","instructions":[
    {"verb":"Each","pick":{"type":"card","control":"you","from":"deck","top":5,"trait":"Ent"},"instructions":[
      {"verb":"Choose","who":"actor","options":[{"id":"take","instructions":[{"verb":"MovePicked","to":"hand"}]},{"id":"leave","instructions":[]}]}]},
    {"verb":"ShuffleDeck"}]},
  // 143012 Helm! Helm! (A:1, the play timing after the enemy attacks step, is open)
  {"id":"143012:action:1","cardCode":"143012","lines":["143012:A:2"],"timing":"action","condition":{"kind":"phase","is":"Combat"},"instructions":[
    {"verb":"Pick","pick":{"type":"ally","control":"you","trait":"Rohan","state":"ready"}},
    {"verb":"Exhaust","target":{"kind":"picked"}},
    {"verb":"Discard","target":{"kind":"picked"}},
    {"verb":"Pick","pick":{"type":"enemy","control":"any","engaged":"you","nonUnique":true}},
    {"verb":"Discard","target":{"kind":"picked"}}]},
  // 143013 The Three Hunters
  {"id":"143013:constant:1","cardCode":"143013","lines":["143013:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"count","pick":{"type":"hero","control":"you","names":["Aragorn"],"spheres":["fellowship"]},"min":1}}]},
  {"id":"143013:action:1","cardCode":"143013","lines":["143013:A:2"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Quest"},{"kind":"count","pick":{"type":"hero","control":"any","committed":true},"min":3}]},"instructions":[
    {"verb":"Repeat","times":3,"instructions":[
      {"verb":"Pick","pick":{"type":"hero","control":"any","committed":true,"different":true}},
      {"verb":"Ready","target":"picked"},
      {"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfRound","target":"picked"},
      {"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfRound","target":"picked"},
      {"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfRound","target":"picked"}]}]},
  // 143014 Shadowfax ("Gandalf" is the hero it is attached to, 143014:A:1)
  {"id":"143014:constant:2","cardCode":"143014","lines":["143014:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"ranged","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"sentinel","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"143014:action:1","cardCode":"143014","lines":["143014:A:3"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Ready","target":"host"}]},
];

export const REPLACES: readonly string[] = [];
