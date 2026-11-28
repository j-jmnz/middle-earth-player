import type { Effect } from "../../../catalog/boundary.ts";

// Records for the UtAM player cards whose lines no template reads (data/cards/UtAM.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 22081 Gildor Inglorion
  {"id":"22081:action:1","cardCode":"22081","lines":["22081:A:1"],"timing":"action","limit":"oncePerRound","cost":{"kind":"resources","amount":1,"from":"self"},"instructions":[{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"Draw","amount":1,"who":"picked"}]},
  // 22082 Wandering Exile. Discarding the card is the cost; readying it changes the game only while it is exhausted.
  {"id":"22082:response:1","cardCode":"22082","lines":["22082:A:1"],"timing":"response","trigger":"committed","subject":"self","condition":{"kind":"all","conditions":[{"kind":"handHasCard"},{"kind":"matches","card":"self","pick":{"type":"ally","control":"any","state":"exhausted"}}]},"instructions":[{"verb":"DiscardFromHand","amount":1},{"verb":"Ready"}]},
  // 22083 Valiant Sword (line 1 is Restricted)
  {"id":"22083:constant:2","cardCode":"22083","lines":["22083:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host","when":{"kind":"threat","max":39,"valour":true}},{"verb":"ModifyStat","stat":"attack","amount":2,"until":"whileSourceInPlay","target":"host","when":{"kind":"threat","min":40,"valour":true}}]},
  // 22084 Stone of Elostirion
  {"id":"22084:constant:1","cardCode":"22084","lines":["22084:A:2","22084:A:3"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"}},{"verb":"ModifyStat","stat":"willpower","amount":2,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"extraDraw","amount":1,"until":"whileSourceInPlay","target":"actorSeat"}]},
  // 22085 Well Preserved. The One Ring is the copy the player controls: the player card (21001) or the saga's objective, whichever box printed it. Healing changes the game
  // only while the hero is damaged.
  {"id":"22085:response:1","cardCode":"22085","lines":["22085:A:3"],"timing":"response","trigger":"beginningOfPhase","cost":[{"kind":"exhaustNamed","name":"The One Ring"},{"kind":"raiseThreat","amount":1}],"condition":{"kind":"all","conditions":[{"kind":"phase","is":"Beginning of round"},{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","damaged":true}}]},"instructions":[{"verb":"Heal","all":true,"target":"host"}]},
  // 22086 Northern Bowmaster (line 1 is Ranged)
  {"id":"22086:constant:1","cardCode":"22086","lines":["22086:A:2"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"hasEngaged"}}]},
  // 22087 Reckless Attack (line 1 is Doomed 2). Each player in turn, the first player first; an enemy must be engaged with a
  // player for the effect to change the game (rr.triggered-ability).
  {"id":"22087:action:1","cardCode":"22087","lines":["22087:A:2"],"timing":"action","condition":{"kind":"count","pick":{"type":"enemy","control":"any"},"min":1},"instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","engaged":"you"}},{"verb":"DamageCard","amount":2,"target":"picked"}]}]},
  // 22088 Odo Proudfoot
  {"id":"22088:response:1","cardCode":"22088","lines":["22088:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":5,"cardType":"ally","trait":"Hobbit"}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]},
  // 22089 Defiant Challenge (line 1 is Doomed 2). "May": each player chooses to ready one of their characters or not.
  {"id":"22089:action:1","cardCode":"22089","lines":["22089:A:2"],"timing":"action","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"ready","requires":{"kind":"canPick","pick":{"type":"character","control":"you","state":"exhausted"}},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"you","state":"exhausted"}},{"verb":"Ready","target":"picked"}]},{"id":"skip","instructions":[]}]}]}]},
  // 22090 Helm of Secrecy
  {"id":"22090:constant:1","cardCode":"22090","lines":["22090:A:1"],"timing":"constant","instructions":[{"verb":"DeckLimit","copies":1}]},
];

export const REPLACES: readonly string[] = [];
