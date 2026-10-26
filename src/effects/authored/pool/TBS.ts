import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TBS player cards whose lines no template reads (data/cards/TBS.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 17082 Song of Hope (line 1 is the generated 17082:constant:1)
  {"id":"17082:action:1","cardCode":"17082","lines":["17082:A:2"],"timing":"action","limit":"thricePerPhase","cost":{"kind":"resources","amount":1,"from":"host"},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","target":"host"}]},
  // 17083 Burst into Song
  {"id":"17083:action:1","cardCode":"17083","lines":["17083:A:1"],"timing":"action","instructions":[{"verb":"Each","pick":{"type":"hero","control":"any","hasAttachment":{"trait":"Song"}},"instructions":[{"verb":"Ready","target":"picked"}]}]},
  // 17084 Defender of Cair Andros. Valour: while your threat is 40 or higher. The attacking enemy is the event's other card.
  {"id":"17084:constant:1","cardCode":"17084","lines":["17084:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"defense","amount":{"threat":"tens","limit":4},"until":"whileSourceInPlay"}]},
  {"id":"17084:response:1","cardCode":"17084","lines":["17084:A:2"],"timing":"response","trigger":"declaredDefender","subject":"self","condition":{"kind":"threat","min":40},"instructions":[{"verb":"DamageCard","amount":1,"target":"other"}]},
  // 17085 Oath of Eorl (its Response, 17085:A:2, is no longer open). "A unique Rohan and another unique Gondor character": one of each,
  // and two different cards among them.
  {"id":"17085:constant:1","cardCode":"17085","lines":["17085:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"all","conditions":[{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Rohan"},"min":1},{"kind":"count","pick":{"type":"character","control":"you","unique":true,"trait":"Gondor"},"min":1},{"kind":"count","pick":{"type":"character","control":"you","unique":true,"traits":["Rohan","Gondor"]},"min":2}]}}]},
  // 17086 Fearless Scout
  {"id":"17086:constant:1","cardCode":"17086","lines":["17086:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"},"limitPerHost":true},{"verb":"GrantTrait","trait":"Scout"}]},
  {"id":"17086:response:1","cardCode":"17086","lines":["17086:A:2"],"timing":"response","trigger":"played","subject":"self","instructions":[{"verb":"Draw","amount":1}]},
  // 17088 Dúnedain Pipe. Placing the card from the hand is part of the cost, so the hand must hold one.
  {"id":"17088:constant:1","cardCode":"17088","lines":["17088:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"character","trait":"Dúnedain"},"limitPerHost":true}]},
  {"id":"17088:action:1","cardCode":"17088","lines":["17088:A:2"],"timing":"action","cost":{"kind":"exhaustSelf"},"condition":{"kind":"handHasCard"},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"hand"}},{"verb":"PutOnDeck","position":"bottom","target":"picked"},{"verb":"Draw","amount":1}]},
  // 17089 Old Toby
  {"id":"17089:action:1","cardCode":"17089","lines":["17089:A:1"],"timing":"action","instructions":[{"verb":"Draw","amount":{"count":{"type":"attachment","control":"you","trait":"Pipe"}}},{"verb":"Each","pick":{"type":"hero","control":"any","hasAttachment":{"trait":"Pipe"}},"instructions":[{"verb":"Heal","amount":1,"target":"picked"}]}]},
];

export const REPLACES: readonly string[] = [];
