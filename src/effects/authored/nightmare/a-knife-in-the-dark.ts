import type { Effect, PickSpec } from "../../../catalog/boundary.ts";

// A Knife in the Dark Nightmare (deck 9062, data/printed/nightmare.json). The One Ring is 141085, Ringwraith 141069, Trouble in Bree (stage 1)
// 141025. Nightmare Weathertop (906204) takes the set-aside slot of the standard one: the quest's records that name Weathertop by code read it
// (twinCode, src/rules/families/nightmare/guards.ts).
const RING = "141085";
const RINGWRAITH = "141069";
const STAGE_ONE = "141025";
const THE_RING: PickSpec = { type: "card", control: "any", names: ["The One Ring"] };
const RING_EXHAUSTED = { kind: "exhausted", code: RING, is: true } as const;

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 906201 A Knife in the Dark Nightmare (setup card, side A)
  {"id":"906201:constant:1","cardCode":"906201","lines":["906201:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"immuneToPlayerCards","amount":1,"until":"whileSourceInPlay","holders":{"type":"enemy","control":"any","stagingOnly":true,"names":["Bill Ferny"]}}]},
  // 906202 Menacing Wraith (line 1 is the generated 906202:constant:1). It engages the first player, wherever it is.
  {"id":"906202:forced:1","cardCode":"906202","lines":["906202:A:2"],"timing":"forced","trigger":"exhausted","subject":THE_RING,"instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Engage","target":"self","when":{"kind":"firstPlayer"}},{"verb":"ImmediateAttack","when":{"kind":"firstPlayer"}}]}]},
  // 906203 Southern Spy
  {"id":"906203:whenRevealed:1","cardCode":"906203","lines":["906203:A:1"],"timing":"whenRevealed","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"ringwraith","requires":{"kind":"outOfPlay","code":RINGWRAITH},"instructions":[{"verb":"ShuffleOutOfPlayIntoEncounterDeck","code":RINGWRAITH}]},{"id":"attack","instructions":[{"verb":"AttackActor"}]}]}]},
  {"id":"906203:shadow:1","cardCode":"906203","lines":["906203:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"defense","amount":-1,"until":"endOfAttack","target":"defender"},{"verb":"ModifyStat","stat":"defense","amount":-2,"until":"endOfAttack","target":"defender","when":RING_EXHAUSTED}]},
  // 906204 Weathertop (line 1 is the immune keyword)
  {"id":"906204:constant:1","cardCode":"906204","lines":["906204:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotTakeDamage","amount":1,"until":"whileSourceInPlay","holders":{"type":"enemy","control":"any","names":["The Witch-king"]}}]},
  // The Ring's "cannot ready" holds while Weathertop is in play from here on: it is the active location until it is explored and leaves play.
  {"id":"906204:forced:1","cardCode":"906204","lines":["906204:A:3"],"timing":"forced","trigger":"becameActive","instructions":[{"verb":"Exhaust","target":{"kind":"byCode","code":RING}},{"verb":"Pick","pick":THE_RING},{"verb":"ModifyStat","stat":"cannotReady","amount":1,"until":"whileSourceInPlay","target":"picked"}]},
  // 906205 Weather Hills. Stage 1 is Trouble in Bree, in play while the players are at it.
  {"id":"906205:constant:1","cardCode":"906205","lines":["906205:A:1"],"timing":"constant","condition":{"kind":"inPlay","code":STAGE_ONE,"is":true},"instructions":[{"verb":"ModifyStat","stat":"noProgressPlaced","amount":1,"until":"whileSourceInPlay","target":"self"}]},
  {"id":"906205:constant:2","cardCode":"906205","lines":["906205:A:2"],"timing":"constant","condition":RING_EXHAUSTED,"instructions":[{"verb":"ModifyStat","stat":"threat","amount":2,"until":"whileSourceInPlay","target":"self"}]},
  {"id":"906205:shadow:1","cardCode":"906205","lines":["906205:A:3"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack","target":"attacker"}]},
  // 906206 The Old Road. "Enters play with" is not a Forced effect: it resolves as the card enters play (triggered).
  {"id":"906206:triggered:1","cardCode":"906206","lines":["906206:A:1"],"timing":"triggered","trigger":"encounterEnteredPlay","subject":"self","instructions":[{"verb":"PlaceToken","amount":3}]},
  {"id":"906206:forced:1","cardCode":"906206","lines":["906206:A:2"],"timing":"forced","trigger":"endOfRound","instructions":[{"verb":"DiscardResources","amount":1,"target":"self"},{"verb":"ShuffleOutOfPlayIntoEncounterDeck","code":RINGWRAITH,"when":{"kind":"not","condition":{"kind":"matches","card":"self","pick":{"type":"location","control":"any","hasResources":true}}}}]},
  // 906207 Forsaken Inn: its Threat is X.
  {"id":"906207:constant:1","cardCode":"906207","lines":["906207:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"threat","amount":{"count":{"type":"character","control":"you","who":"firstPlayer"}},"until":"whileSourceInPlay","target":"self"}]},
  {"id":"906207:travel:1","cardCode":"906207","lines":["906207:A:2"],"timing":"travel","instructions":[{"verb":"SearchReveal","trait":"Spy","type":"enemy","who":"firstPlayer"},{"verb":"ShuffleEncounterDeck"}]},
  // 906208 The Ring's Will. Frodo Baggins (the Ring-bearer) cannot cancel it; nothing can while The One Ring is exhausted.
  {"id":"906208:whenRevealed:1","cardCode":"906208","lines":["906208:A:1"],"timing":"whenRevealed","uncancelable":RING_EXHAUSTED,"instructions":[{"verb":"NotCanceledBy","trait":"Ring-bearer"},{"verb":"RaiseThreat","amount":5,"who":"eachSeat"}]},
  {"id":"906208:shadow:1","cardCode":"906208","lines":["906208:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"EngageNextPlayer","when":{"kind":"otherPlayer"}},{"verb":"ImmediateAttack","when":{"kind":"otherPlayer"}}]}]},
  // 906209 Blade Tip (line 1 is Surge and Doomed 1)
  {"id":"906209:shadow:1","cardCode":"906209","lines":["906209:A:2"],"timing":"shadow","instructions":[{"verb":"AttachToDamagedDefender"}]},
  {"id":"906209:forced:1","cardCode":"906209","lines":["906209:A:2"],"timing":"forced","trigger":"endOfPhase","condition":{"kind":"phase","is":"Refresh"},"instructions":[{"verb":"RaiseThreat","amount":2,"who":"hostController"}]},
  {"id":"906209:constant:1","cardCode":"906209","lines":["906209:A:2"],"timing":"constant","instructions":[{"verb":"CountsAs","cardType":"attachment","trait":"Condition"}]},
];

export const AUTHORED_REPLACES: readonly string[] = [];
