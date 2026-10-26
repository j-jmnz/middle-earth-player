import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TGH player cards whose lines no template reads (data/cards/TGH.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 11001 Círdan the Shipwright
  {"id":"11001:constant:1","cardCode":"11001","lines":["11001:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"extraDraw","amount":1,"until":"whileSourceInPlay","target":"actorSeat"}]},
  // 11002 Galdor of the Havens
  {"id":"11002:action:1","cardCode":"11002","lines":["11002:A:2"],"timing":"action","limit":"oncePerGame","condition":{"kind":"not","condition":{"kind":"handHasCard"}},"instructions":[{"verb":"Draw","amount":6}]},
  // 11004 Skyward Volley. Line 1's additional cost is a play restriction (the card cannot be played without a ready ranged
  // character to exhaust) and the first instructions of the Action, which an action record cannot name (line 1 has no label).
  {"id":"11004:constant:1","cardCode":"11004","lines":["11004:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"canPick","pick":{"type":"character","control":"you","keyword":"ranged","state":"ready"}}}]},
  {"id":"11004:action:1","cardCode":"11004","lines":["11004:A:2"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Combat"},{"kind":"canPick","pick":{"type":"character","control":"you","keyword":"ranged","state":"ready"}}]},"instructions":[
    {"verb":"Pick","pick":{"type":"character","control":"you","keyword":"ranged","state":"ready"}},
    {"verb":"Exhaust","target":{"kind":"picked"}},
    {"verb":"Pick","pick":{"type":"enemy","control":"any"}},
    {"verb":"DamageCard","amount":2},
    {"verb":"Repeat","times":{"count":{"type":"card","control":"you","from":"discard","names":["Skyward Volley"]}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any"}},{"verb":"DamageCard","amount":2}]}]},
  // 11008 Mariner's Compass
  {"id":"11008:constant:1","cardCode":"11008","lines":["11008:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"character","control":"any","spheres":["leadership"]},{"type":"character","control":"any","trait":"Scout"}]}]},
  // 11010 The Evening Star
  {"id":"11010:action:1","cardCode":"11010","lines":["11010:A:1"],"timing":"action","instructions":[
    {"verb":"Pick","pick":{"type":"location","control":"any"}},
    {"verb":"PlaceProgressOn","amount":2,"target":"picked"},
    {"verb":"Repeat","times":{"count":{"type":"card","control":"you","from":"discard","names":["The Evening Star"]}},"instructions":[{"verb":"Pick","pick":{"type":"location","control":"any"}},{"verb":"PlaceProgressOn","amount":2,"target":"picked"}]}]},
  // 11011 Explorer's Almanac
  {"id":"11011:constant:1","cardCode":"11011","lines":["11011:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"location","control":"any","stagingOnly":true}]}]},
  // 11013 Elwing's Flight
  {"id":"11013:action:1","cardCode":"11013","lines":["11013:A:1"],"timing":"action","condition":{"kind":"phase","is":"Quest"},"instructions":[
    {"verb":"Pick","pick":{"type":"character","control":"any","committed":true}},
    {"verb":"Ready","target":"picked"},
    {"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","target":"picked"},
    {"verb":"Repeat","times":{"count":{"type":"card","control":"you","from":"discard","names":["Elwing's Flight"]}},"instructions":[
      {"verb":"Pick","pick":{"type":"character","control":"any","committed":true}},
      {"verb":"Ready","target":"picked"},
      {"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","target":"picked"}]}]},
  // 11015 Narya. "Up to 2": the second ally is optional; a player who wants none does not use the Action.
  {"id":"11015:constant:1","cardCode":"11015","lines":["11015:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"character","control":"any","names":["Círdan the Shipwright","Gandalf"]}]}]},
  {"id":"11015:constant:2","cardCode":"11015","lines":["11015:A:2"],"timing":"constant","instructions":[{"verb":"GrantIcon","sphere":"leadership"}]},
  {"id":"11015:action:1","cardCode":"11015","lines":["11015:A:3"],"timing":"action","cost":[{"kind":"exhaustSelf"},{"kind":"exhaustHost"}],"instructions":[
    {"verb":"Pick","pick":{"type":"ally","control":"any"}},
    {"verb":"Ready","target":"picked"},
    {"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfPhase","target":"picked"},
    {"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfPhase","target":"picked"},
    {"verb":"Choose","who":"actor","options":[
      {"id":"second","requires":{"kind":"count","pick":{"type":"ally","control":"any"},"min":2},"instructions":[
        {"verb":"Pick","pick":{"type":"ally","control":"any","different":true}},
        {"verb":"Ready","target":"picked"},
        {"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfPhase","target":"picked"},
        {"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfPhase","target":"picked"}]},
      {"id":"done","instructions":[]}]}]},
];

export const REPLACES: readonly string[] = [];
