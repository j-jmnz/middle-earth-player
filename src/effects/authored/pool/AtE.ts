import type { Effect } from "../../../catalog/boundary.ts";

// Records for the AtE player cards whose lines no template reads (data/cards/AtE.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 10054 Dori (line 1 is Sentinel). His Defense when the response resolves.
  {"id":"10054:response:1","cardCode":"10054","lines":["10054:A:2"],"timing":"response","trigger":"declaredDefender","subject":{"type":"hero","control":"any","other":true},"cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"ModifyStat","stat":"defense","amount":{"stat":"defense","of":"self"},"until":"endOfAttack","target":"subject"}]},
  // 10055 Ranger Provisions
  {"id":"10055:constant:1","cardCode":"10055","lines":["10055:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"location","control":"any"}],"limitPerHost":true}]},
  {"id":"10055:response:1","cardCode":"10055","lines":["10055:A:2"],"timing":"response","trigger":"hostLeftPlay","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"Each","pick":{"type":"hero","control":"you","who":"firstPlayer"},"instructions":[{"verb":"AddResources","amount":1,"to":"picked"}]}]},
  // 10056 Dúnedain Message
  {"id":"10056:action:1","cardCode":"10056","lines":["10056:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","cardType":"player-side-quest"}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]},
  // 10057 Longbeard Sentry
  {"id":"10057:action:1","cardCode":"10057","lines":["10057:A:1"],"timing":"action","limit":"oncePerPhase","cost":{"kind":"discardDeckTop","amount":2},"instructions":[{"verb":"ModifyStat","stat":"sentinel","amount":1,"until":"endOfPhase"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfPhase"}]},
  // 10058 Delay the Enemy (a player side quest: lines 1 and 3 are no longer open)
  {"id":"10058:constant:1","cardCode":"10058","lines":["10058:A:2"],"timing":"constant","instructions":[{"verb":"DeckLimit","copies":1}]},
  // 10059 Steed of Imladris. With no active location there is nothing to place progress on, so the cost cannot be paid (rr.cost).
  {"id":"10059:constant:1","cardCode":"10059","lines":["10059:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","spheres":["spirit"]},{"type":"hero","control":"any","trait":"Noldor"}]}]},
  {"id":"10059:response:1","cardCode":"10059","lines":["10059:A:2"],"timing":"response","trigger":"committed","subject":"host","condition":{"kind":"all","conditions":[{"kind":"handHasCard"},{"kind":"matches","card":"activeLocation"}]},"instructions":[{"verb":"DiscardFromHand","amount":1},{"verb":"PlaceProgressOn","amount":2,"target":"activeLocation"}]},
  // 10060 Fair and Perilous. The source text splits the one Action over two lines; line 2 (the effect) has no label, so an
  // Action record cannot name it. This record is the whole ability.
  {"id":"10060:action:1","cardCode":"10060","lines":["10060:A:1","10060:A:2"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","traits":["Noldor","Silvan"]}},{"verb":"ModifyStat","stat":"attack","amount":{"stat":"willpower","of":"picked"},"until":"endOfPhase","target":"picked"}]},
  // 10061 Wellinghall Preserver
  {"id":"10061:constant:1","cardCode":"10061","lines":["10061:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"10061:constant:2","cardCode":"10061","lines":["10061:A:2"],"timing":"constant","instructions":[{"verb":"EntersPlayExhausted"}]},
  {"id":"10061:response:1","cardCode":"10061","lines":["10061:A:3"],"timing":"response","trigger":"readied","subject":"self","condition":{"kind":"canPick","pick":{"type":"character","control":"any","trait":"Ent","damaged":true}},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","trait":"Ent","damaged":true}},{"verb":"Heal","amount":1}]},
  // 10062 None Return. The victory display limit is a play restriction (line 1); the engine reads PlayOnlyIf for cards played
  // from the hand in an action window, so the Response carries the same condition.
  {"id":"10062:constant:1","cardCode":"10062","lines":["10062:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"count","pick":{"type":"card","control":"any","from":"victory","names":["None Return"]},"max":2}}]},
  {"id":"10062:response:1","cardCode":"10062","lines":["10062:A:2"],"timing":"response","trigger":"enemyDestroyed","subject":{"type":"enemy","control":"any","nonUnique":true},"cost":{"kind":"playEvent"},"condition":{"kind":"count","pick":{"type":"card","control":"any","from":"victory","names":["None Return"]},"max":2},"instructions":[{"verb":"AddSourceToVictory"},{"verb":"AddToVictory","target":"subject"}]},
];

export const REPLACES: readonly string[] = [];
