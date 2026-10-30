import type { Effect, PickSpec } from "../../../catalog/boundary.ts";

// Flight to the Ford Nightmare (deck 9063, data/printed/nightmare.json). The Ring-bearer's life and the burden deck are the burden family's
// (src/catalog/families/burden.ts). Nightmare Ford of Bruinen (906303) takes the standard one's set-aside slot: Race to Rivendell's "Add Ford
// of Bruinen" reads it (twinCode, src/rules/families/nightmare.ts). Race to Rivendell (141029) is the last stage: defeating it wins
// (rr.winning-the-game), so "cannot win" holds the stage back while Ford of Bruinen is in play.
const RING = "141085";
const LAST_STAGE = "141029";
const FORD = "906303";
const NAZGUL: PickSpec = { type: "enemy", control: "any", trait: "Nazgûl" };
const TWILIGHT_ON_A_HERO: PickSpec = { type: "card", control: "any", names: ["The Twilight World"], on: { type: "hero", control: "any" } };
const NEXT_PLAYER_ATTACKS = [{"verb":"EngageNextPlayer","when":{"kind":"otherPlayer"}},{"verb":"ImmediateAttack","when":{"kind":"otherPlayer"}}] as const;

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 906301 Flight to the Ford Nightmare (setup card, side A)
  {"id":"906301:constant:1","cardCode":"906301","lines":["906301:A:2"],"timing":"constant","condition":{"kind":"all","conditions":[{"kind":"inPlay","code":FORD,"is":true},{"kind":"inPlay","code":LAST_STAGE,"is":true}]},"instructions":[{"verb":"Restrict","what":"advance"}]},
  // 906302 Fell Rider (line 1 is the generated 906302:constant:1, line 3 the generated shadow): when it attacks, the end of that attack reads the
  // characters it destroyed.
  {"id":"906302:forced:1","cardCode":"906302","lines":["906302:A:2"],"timing":"forced","trigger":"attacks","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ReduceLife","amount":1,"when":{"kind":"x","min":1}}]}]},
  // 906303 Ford of Bruinen (line 1 is immune)
  {"id":"906303:travel:1","cardCode":"906303","lines":["906303:A:2"],"timing":"travel","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"SearchMove","trait":"Nazgûl","type":"enemy","to":"engaged"}]},{"verb":"ShuffleEncounterDeck"}]},
  // 906304 Trollshaw Forest
  {"id":"906304:forced:1","cardCode":"906304","lines":["906304:A:1"],"timing":"forced","trigger":"whenRevealedCanceled","condition":{"kind":"sourceIn","zone":"staging"},"instructions":[{"verb":"ReduceLife","amount":1}]},
  {"id":"906304:travel:1","cardCode":"906304","lines":["906304:A:2"],"timing":"travel","instructions":[{"verb":"ReduceLife","amount":1}]},
  // 906305 Great East Road: its Threat is X.
  {"id":"906305:constant:1","cardCode":"906305","lines":["906305:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"threat","amount":{"count":NAZGUL,"plus":1},"until":"whileSourceInPlay","target":"self"}]},
  {"id":"906305:constant:2","cardCode":"906305","lines":["906305:A:2"],"timing":"constant","condition":{"kind":"sourceIn","zone":"staging"},"instructions":[{"verb":"ModifyStat","stat":"engagementCost","amount":-5,"until":"whileSourceInPlay","target":"enemies","trait":"Nazgûl"}]},
  {"id":"906305:shadow:1","cardCode":"906305","lines":["906305:A:3"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[...NEXT_PLAYER_ATTACKS]}]},
  // 906306 Pathless Wilderness. "Enters play with" is not a Forced effect: it resolves as the card enters play (triggered).
  {"id":"906306:triggered:1","cardCode":"906306","lines":["906306:A:1"],"timing":"triggered","trigger":"encounterEnteredPlay","subject":"self","instructions":[{"verb":"PlaceToken","amount":3}]},
  {"id":"906306:forced:1","cardCode":"906306","lines":["906306:A:2"],"timing":"forced","trigger":"endOfRound","instructions":[{"verb":"DiscardResources","amount":1,"target":"self"},{"verb":"ReduceLife","amount":3,"when":{"kind":"not","condition":{"kind":"matches","card":"self","pick":{"type":"location","control":"any","hasResources":true}}}}]},
  // 906307 Ettendales: a location leaves play with a leftPlay event when it is explored.
  {"id":"906307:forced:1","cardCode":"906307","lines":["906307:A:1"],"timing":"forced","trigger":"leftPlay","subject":"self","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"MoveBurden","to":"encounterShuffle"}]},
  {"id":"906307:shadow:1","cardCode":"906307","lines":["906307:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack","target":"attacker"},{"verb":"AfterAttack","instructions":[{"verb":"ReduceLife","amount":1,"when":{"kind":"x","min":1}}]}]},
  // 906308 Come Back! (line 1 is Peril and Doomed 1). The defending player chooses.
  {"id":"906308:whenRevealed:1","cardCode":"906308","lines":["906308:A:2"],"timing":"whenRevealed","instructions":[{"verb":"ReduceLife","amount":1},{"verb":"RemoveAllQuestProgress"}]},
  {"id":"906308:shadow:1","cardCode":"906308","lines":["906308:A:3"],"timing":"shadow","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"life","instructions":[{"verb":"ReduceLife","amount":1}]},{"id":"undefended","instructions":[{"verb":"ConsiderUndefended"}]}]}]},
  // 906309 The Twilight World (line 1 is Doomed 2). Limit 1 per hero: a copy already on the Ring-bearer keeps another off.
  {"id":"906309:whenRevealed:1","cardCode":"906309","lines":["906309:A:2"],"timing":"whenRevealed","instructions":[{"verb":"AttachSelfToRingBearer","when":{"kind":"count","pick":TWILIGHT_ON_A_HERO,"max":0}}]},
  {"id":"906309:forced:1","cardCode":"906309","lines":["906309:A:2"],"timing":"forced","trigger":"beginningOfPhase","condition":{"kind":"phase","is":"Planning"},"instructions":[{"verb":"Choose","who":"firstPlayer","options":[{"id":"exhaust","requires":{"kind":"exhausted","code":RING,"is":false},"instructions":[{"verb":"Exhaust","target":{"kind":"byCode","code":RING}}]},{"id":"life","instructions":[{"verb":"ReduceLife","amount":1}]}]}]},
  {"id":"906309:constant:1","cardCode":"906309","lines":["906309:A:2"],"timing":"constant","instructions":[{"verb":"CountsAs","cardType":"attachment","trait":"Condition"}]},
];

export const AUTHORED_REPLACES: readonly string[] = [];
