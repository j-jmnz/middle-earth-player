import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TLR player cards whose lines no template reads (data/cards/TLR.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 09001 Aragorn: "an enemy not engaged with you" is one in the staging area or one engaged with another player.
  {"id":"09001:constant:1","cardCode":"09001","lines":["09001:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"defense","amount":-1,"until":"whileSourceInPlay","holders":{"type":"enemy","control":"any","engaged":"you"}}]},
  {"id":"09001:response:1","cardCode":"09001","lines":["09001:A:2"],"timing":"response","trigger":"attackDestroyed","subject":"self","condition":{"kind":"any","conditions":[{"kind":"canPick","pick":{"type":"enemy","control":"any","stagingOnly":true}},{"kind":"canPick","pick":{"type":"enemy","control":"any","engaged":"other"}}]},"instructions":[{"verb":"Choose","who":"actor","options":[{"id":"staging","requires":{"kind":"canPick","pick":{"type":"enemy","control":"any","stagingOnly":true}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","stagingOnly":true}},{"verb":"Engage","target":"picked"}]},{"id":"otherPlayer","requires":{"kind":"canPick","pick":{"type":"enemy","control":"any","engaged":"other"}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","engaged":"other"}},{"verb":"Engage","target":"picked"}]}]}]},
  // 09002 Halbarad
  {"id":"09002:constant:1","cardCode":"09002","lines":["09002:A:1"],"timing":"constant","condition":{"kind":"hasEngaged"},"instructions":[{"verb":"ModifyStat","stat":"noExhaustQuest","amount":1,"until":"whileSourceInPlay"}]},
  // 09003 Weather Hills Watchman
  {"id":"09003:response:1","cardCode":"09003","lines":["09003:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":5,"trait":"Signal"}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]},
  // 09005 Sarn Ford Sentry
  {"id":"09005:response:1","cardCode":"09005","lines":["09005:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","condition":{"kind":"hasEngaged"},"instructions":[{"verb":"Draw","amount":{"count":{"type":"enemy","control":"any","engaged":"you"}}}]},
  // 09006 Warden of Annúminas
  {"id":"09006:constant:1","cardCode":"09006","lines":["09006:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":{"count":{"type":"enemy","control":"any","engaged":"you"}},"until":"whileSourceInPlay"}]},
  // 09007 Ranger Summons
  {"id":"09007:constant:1","cardCode":"09007","lines":["09007:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"count","pick":{"type":"hero","control":"you","trait":"Dúnedain"},"min":1}}]},
  // 09008 Tireless Hunters: the enemy is in the staging area or engaged with another player.
  {"id":"09008:action:1","cardCode":"09008","lines":["09008:A:2"],"timing":"action","condition":{"kind":"phase","is":"Combat"},"instructions":[{"verb":"Choose","who":"actor","options":[{"id":"staging","requires":{"kind":"canPick","pick":{"type":"enemy","control":"any","stagingOnly":true}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","stagingOnly":true}},{"verb":"Engage","target":"picked"},{"verb":"DiscardShadow"}]},{"id":"otherPlayer","requires":{"kind":"canPick","pick":{"type":"enemy","control":"any","engaged":"other"}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","engaged":"other"}},{"verb":"Engage","target":"picked"},{"verb":"DiscardShadow"}]}]}]},
  // 09009 Expert Trackers: exhausting the Scout or Ranger character is the cost; X is the engaged enemy's printed Threat.
  {"id":"09009:response:1","cardCode":"09009","lines":["09009:A:1"],"timing":"response","trigger":"engaged","eventSeat":"you","cost":{"kind":"playEvent"},"condition":{"kind":"all","conditions":[{"kind":"canPick","pick":{"type":"character","control":"you","traits":["Scout","Ranger"],"state":"ready"}},{"kind":"canPick","pick":{"type":"location","control":"any"}}]},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"you","traits":["Scout","Ranger"],"state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"Pick","pick":{"type":"location","control":"any"}},{"verb":"PlaceProgressOn","amount":{"stat":"threat","of":"subject","printed":true},"target":"picked"}]},
  // 09010 Heir of Valandil
  {"id":"09010:constant:1","cardCode":"09010","lines":["09010:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","trait":"Dúnedain"}]}]},
  // 09011 Athelas
  {"id":"09011:constant:1","cardCode":"09011","lines":["09011:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"character","control":"any","traits":["Dúnedain","Healer"]}]}]},
  // 09012 Secret Vigil
  {"id":"09012:constant:1","cardCode":"09012","lines":["09012:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"enemy","control":"any","staging":true}],"limitPerHost":true}]},
  {"id":"09012:constant:2","cardCode":"09012","lines":["09012:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"threat","amount":-1,"until":"whileSourceInPlay","target":"host"}]},
  // 09013 Star Brooch
  {"id":"09013:constant:1","cardCode":"09013","lines":["09013:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","traits":["Dúnedain","Noldor"]}],"limitPerHost":true}]},
  // 09014 Gather Information
  {"id":"09014:constant:1","cardCode":"09014","lines":["09014:A:1"],"timing":"constant","instructions":[{"verb":"DeckLimit","copies":1}]},
];

export const REPLACES: readonly string[] = [];
