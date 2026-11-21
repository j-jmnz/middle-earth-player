import type { Effect } from "../../../catalog/boundary.ts";

// Records for the BtS player cards whose lines no template reads (data/cards/BtS.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 17056 Haradrim Spear: the scan prints "Attach to a Harad character"; RingsDB and Hall of Beorn print "Haradrim", a trait no card has.
  {"id":"17056:constant:1","cardCode":"17056","lines":["17056:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"character","trait":"Harad"}}]},
  // 17057 Hunting Party: a unique Warrior and another unique Scout. Two different characters fill the two roles exactly when
  // each role has a candidate and the candidates together are at least two cards. Line 2 (after the players commit
  // characters) has no trigger yet.
  {"id":"17057:constant:1","cardCode":"17057","lines":["17057:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"all","conditions":[{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Warrior"},"min":1},{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Scout"},"min":1},{"kind":"count","pick":{"type":"character","control":"you","unique":true,"traits":["Warrior","Scout"]},"min":2}]}}]},
  // 17058 The Red Arrow (17058:constant:1 is the generated +1 Willpower on line 2).
  {"id":"17058:constant:2","cardCode":"17058","lines":["17058:A:1"],"timing":"constant","instructions":[{"verb":"DeckLimit","copies":1},{"verb":"AttachesTo","host":{"kind":"hero","trait":"Gondor"}}]},
  // 17061 Fireside Song: it counts itself, a Song attached to the hero.
  {"id":"17061:constant:1","cardCode":"17061","lines":["17061:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero","trait":"Hobbit"},"limitPerHost":true},{"verb":"ModifyStat","stat":"willpower","amount":{"count":{"type":"attachment","control":"any","attachedTo":"host","trait":"Song"}},"until":"whileSourceInPlay","target":"host"}]},
  // 17062 Dúnedain Lookout
  {"id":"17062:response:1","cardCode":"17062","lines":["17062:A:1"],"timing":"response","trigger":"whenRevealedPending","subject":{"type":"enemy","control":"any"},"cost":{"kind":"discardSelf"},"instructions":[{"verb":"CancelEffect"}]},
  // 17063 Doughty Ranger
  {"id":"17063:constant:1","cardCode":"17063","lines":["17063:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"},"limitPerHost":true},{"verb":"GrantTrait","trait":"Ranger"}]},
  {"id":"17063:response:1","cardCode":"17063","lines":["17063:A:2"],"timing":"response","trigger":"played","subject":"self","eventSeat":"you","instructions":[{"verb":"Draw","amount":1}]},
];

export const REPLACES: readonly string[] = [
  // Haradrim Spear: the generated host record reads the sources' "Haradrim" trait, not the printed "Harad".
  "17056:constant:1",
];
