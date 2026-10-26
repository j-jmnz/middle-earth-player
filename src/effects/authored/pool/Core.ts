import type { Effect } from "../../../catalog/boundary.ts";

// Records for the Core player cards whose lines no template reads (data/cards/Core.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 01001 Aragorn (line 1 is the Sentinel keyword)
  {"id":"01001:response:1","cardCode":"01001","lines":["01001:A:2"],"timing":"response","trigger":"committed","cost":{"kind":"resources","amount":1,"from":"self"},"instructions":[{"verb":"Ready"}]},
  // 01004 Gimli
  {"id":"01004:constant:1","cardCode":"01004","lines":["01004:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"stat":"damage","of":"self"},"until":"whileSourceInPlay"}]},
  // 01006 Thalin: a mandatory effect, not printed as Forced, on each enemy the encounter deck reveals while he is committed;
  // not on one a player searched for and revealed (brief, Effects).
  {"id":"01006:triggered:1","cardCode":"01006","lines":["01006:A:1"],"timing":"triggered","trigger":"revealed","byEncounterDeck":true,"subject":{"type":"enemy","control":"any"},"condition":{"kind":"matches","card":"self","pick":{"type":"character","control":"any","committed":true}},"instructions":[{"verb":"DamageCard","amount":1,"target":"subject"}]},
  // 01011 Glorfindel
  {"id":"01011:action:1","cardCode":"01011","lines":["01011:A:1"],"timing":"action","limit":"oncePerRound","cost":{"kind":"resources","amount":1,"from":"self"},"condition":{"kind":"canPick","pick":{"type":"character","control":"any","damaged":true}},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","damaged":true}},{"verb":"Heal","amount":1,"target":"picked"}]},
  // 01018 Longbeard Orc Slayer: "in play" is engaged or in the staging area.
  {"id":"01018:response:1","cardCode":"01018","lines":["01018:A:1"],"timing":"response","trigger":"enteredPlay","condition":{"kind":"canPick","pick":{"type":"enemy","control":"any","staging":true,"trait":"Orc"}},"instructions":[{"verb":"Each","pick":{"type":"enemy","control":"any","staging":true,"trait":"Orc"},"instructions":[{"verb":"DamageCard","amount":1,"target":"picked"}]}]},
  // 01022 For Gondor!
  {"id":"01022:action:1","cardCode":"01022","lines":["01022:A:1"],"timing":"action","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfPhase","holders":{"type":"character","control":"any"}},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfPhase","holders":{"type":"character","control":"any","trait":"Gondor"}}]},
  // 01029 Gondorian Spearman (line 1 is the Sentinel keyword)
  {"id":"01029:response:1","cardCode":"01029","lines":["01029:A:2"],"timing":"response","trigger":"declaredDefender","instructions":[{"verb":"DamageCard","amount":1,"target":"other"}]},
  // 01032 Blade Mastery
  {"id":"01032:action:1","cardCode":"01032","lines":["01032:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"character","control":"any"}},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfPhase","target":"picked"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfPhase","target":"picked"}]},
  // 01037 Swift Strike
  {"id":"01037:response:1","cardCode":"01037","lines":["01037:A:1"],"timing":"response","trigger":"declaredDefender","subject":{"type":"character","control":"any"},"cost":{"kind":"playEvent"},"instructions":[{"verb":"DamageCard","amount":2,"target":"other"}]},
  // 01040 Citadel Plate (line 1 is the generated 01040:constant:1)
  {"id":"01040:constant:2","cardCode":"01040","lines":["01040:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"hitPoints","amount":4,"until":"whileSourceInPlay","target":"host"}]},
  // 01041 Dwarven Axe (line 1 is the generated 01041:constant:1)
  {"id":"01041:constant:2","cardCode":"01041","lines":["01041:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host","when":{"kind":"not","condition":{"kind":"matches","card":"host","pick":{"type":"character","control":"any","trait":"Dwarf"}}}},{"verb":"ModifyStat","stat":"attack","amount":2,"until":"whileSourceInPlay","target":"host","when":{"kind":"matches","card":"host","pick":{"type":"character","control":"any","trait":"Dwarf"}}}]},
  // 01044 Lórien Guide: only while there is an active location.
  {"id":"01044:response:1","cardCode":"01044","lines":["01044:A:1"],"timing":"response","trigger":"committed","condition":{"kind":"matches","card":"activeLocation"},"instructions":[{"verb":"PlaceProgressOn","amount":1,"target":"activeLocation"}]},
  // 01047 Strength of Will: exhausting a Spirit character is the cost, chosen as the first instructions.
  {"id":"01047:response:1","cardCode":"01047","lines":["01047:A:1"],"timing":"response","trigger":"traveled","subject":{"type":"location","control":"any"},"cost":{"kind":"playEvent"},"condition":{"kind":"canPick","pick":{"type":"character","control":"you","spheres":["spirit"],"state":"ready"}},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"you","spheres":["spirit"],"state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"PlaceProgressOn","amount":2,"target":"subject"}]},
  // 01052 A Light in the Dark
  {"id":"01052:action:1","cardCode":"01052","lines":["01052:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any"}},{"verb":"ReturnToStaging","target":{"kind":"picked"}}]},
  // 01056 Power in the Earth
  {"id":"01056:constant:1","cardCode":"01056","lines":["01056:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"location","control":"any"}]}]},
  {"id":"01056:constant:2","cardCode":"01056","lines":["01056:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"threat","amount":-1,"until":"whileSourceInPlay","target":"host"}]},
  // 01058 Daughter of the Nimrodel
  {"id":"01058:action:1","cardCode":"01058","lines":["01058:A:1"],"timing":"action","cost":{"kind":"exhaustSelf"},"condition":{"kind":"canPick","pick":{"type":"hero","control":"any","damaged":true}},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any","damaged":true}},{"verb":"Heal","amount":2,"target":"picked"}]},
  // 01063 Lore of Imladris
  {"id":"01063:action:1","cardCode":"01063","lines":["01063:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","damaged":true}},{"verb":"Heal","all":true,"target":"picked"}]},
  // 01064 Lórien's Wealth
  {"id":"01064:action:1","cardCode":"01064","lines":["01064:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"Draw","amount":3,"who":"picked"}]},
  // 01065 Radagast's Cunning
  {"id":"01065:action:1","cardCode":"01065","lines":["01065:A:1"],"timing":"action","condition":{"kind":"phase","is":"Quest"},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","stagingOnly":true}},{"verb":"ModifyStat","stat":"noThreatContribution","amount":1,"until":"endOfPhase","target":"picked"}]},
  // 01066 Secret Paths
  {"id":"01066:action:1","cardCode":"01066","lines":["01066:A:1"],"timing":"action","condition":{"kind":"phase","is":"Quest"},"instructions":[{"verb":"Pick","pick":{"type":"location","control":"any","stagingOnly":true}},{"verb":"ModifyStat","stat":"noThreatContribution","amount":1,"until":"endOfPhase","target":"picked"}]},
  // 01069 Forest Snare
  {"id":"01069:constant:1","cardCode":"01069","lines":["01069:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"enemy","control":"any"}]}]},
  {"id":"01069:constant:2","cardCode":"01069","lines":["01069:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotAttack","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 01070 Protector of Lórien (line 1 is the generated 01070:constant:1)
  {"id":"01070:action:1","cardCode":"01070","lines":["01070:A:2"],"timing":"action","limit":"thricePerPhase","condition":{"kind":"handHasCard"},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"hand"}},{"verb":"DiscardPicked"},{"verb":"Choose","who":"actor","options":[{"id":"defense","instructions":[{"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfPhase","target":"host"}]},{"id":"willpower","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","target":"host"}]}]}]},
  // 01071 Dark Knowledge
  {"id":"01071:constant:1","cardCode":"01071","lines":["01071:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"}},{"verb":"ModifyStat","stat":"willpower","amount":-1,"until":"whileSourceInPlay","target":"host"}]},
  // 01072 Self Preservation (line 1 is the generated 01072:constant:1)
  {"id":"01072:action:1","cardCode":"01072","lines":["01072:A:2"],"timing":"action","cost":{"kind":"exhaustSelf"},"condition":{"kind":"matches","card":"host","pick":{"type":"character","control":"any","damaged":true}},"instructions":[{"verb":"Heal","amount":2,"target":"host"}]},
];

export const REPLACES: readonly string[] = [];
