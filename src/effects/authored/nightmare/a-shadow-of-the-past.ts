import type { Effect } from "../../../catalog/boundary.ts";

// A Shadow of the Past Nightmare (deck 9061, data/printed/nightmare.json). The setup card (906101) sits in zone `nightmare` all game, so
// its Forced effect hears the stage reveal like any card in play. The One Ring is 141085.
const RING = "141085";
const KHAMUL = "906102";

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 906101 A Shadow of the Past Nightmare (setup card, side A). Stage 3A is Escape to Buckland (141024).
  {"id":"906101:forced:1","cardCode":"906101","lines":["906101:A:2"],"timing":"forced","trigger":"stageRevealed","condition":{"kind":"all","conditions":[{"kind":"matches","card":"subject","pick":{"type":"card","control":"any","names":["Escape to Buckland"]}},{"kind":"inPlay","code":KHAMUL,"is":false}]},"instructions":[{"verb":"SearchToStaging","code":KHAMUL},{"verb":"ShuffleEncounterDeck"}]},
  // 906102 Khamûl the Easterling
  {"id":"906102:constant:2","cardCode":"906102","lines":["906102:A:2"],"timing":"constant","condition":{"kind":"exhausted","code":RING,"is":true},"instructions":[{"verb":"ModifyStat","stat":"engagementCost","amount":-30,"until":"whileSourceInPlay","target":"self"}]},
  {"id":"906102:forced:1","cardCode":"906102","lines":["906102:A:3"],"timing":"forced","trigger":"beginningOfPhase","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Refresh"},{"kind":"sourceIn","zone":"engaged"}]},"instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"HideTest","x":2,"when":{"kind":"engagedWithActor"}},{"verb":"ImmediateAttack","when":{"kind":"all","conditions":[{"kind":"engagedWithActor"},{"kind":"lastHideFailed"}]}}]}]},
  // 906103 Dark Horseman: each committed character counts 1 less Willpower in the engaged player's Hide tests.
  {"id":"906103:constant:2","cardCode":"906103","lines":["906103:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"hideWillpower","amount":-1,"until":"whileSourceInPlay","target":"engagedSeat","per":"committed"}]},
  // 906104 Eastfarthing
  {"id":"906104:constant:1","cardCode":"906104","lines":["906104:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"threat","amount":{"stat":"resources","of":"self","times":2},"until":"whileSourceInPlay","target":"self"}]},
  {"id":"906104:forced:1","cardCode":"906104","lines":["906104:A:2"],"timing":"forced","trigger":"hideFailed","instructions":[{"verb":"PlaceToken","amount":1}]},
  // 906105 Green-Hill Country. The shadow is Pathless Country's (141072:shadow:1): with one player there is no next player to engage.
  {"id":"906105:constant:1","cardCode":"906105","lines":["906105:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"staging"},"instructions":[{"verb":"ModifyStat","stat":"hideValue","amount":1,"until":"whileSourceInPlay","target":"table"}]},
  {"id":"906105:travel:1","cardCode":"906105","lines":["906105:A:2"],"timing":"travel","instructions":[{"verb":"HideTest","x":1}]},
  {"id":"906105:shadow:1","cardCode":"906105","lines":["906105:A:3"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"EngageNextPlayer","when":{"kind":"otherPlayer"}},{"verb":"ImmediateAttack","when":{"kind":"otherPlayer"}}]}]},
  // 906106 Stock Woods
  {"id":"906106:constant:1","cardCode":"906106","lines":["906106:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"staging"},"instructions":[{"verb":"ModifyStat","stat":"hideCommitLimit","amount":2,"until":"whileSourceInPlay","target":"table"}]},
  {"id":"906106:travel:1","cardCode":"906106","lines":["906106:A:2"],"timing":"travel","instructions":[{"verb":"HideTest","x":1}]},
  // 906107 In the Name of Mordor!
  {"id":"906107:whenRevealed:1","cardCode":"906107","lines":["906107:A:2"],"timing":"whenRevealed","instructions":[{"verb":"AttachToQuest"}]},
  {"id":"906107:forced:1","cardCode":"906107","lines":["906107:A:2"],"timing":"forced","trigger":"hideFailed","instructions":[{"verb":"DiscardRandomFromHand"}]},
  {"id":"906107:constant:1","cardCode":"906107","lines":["906107:A:2"],"timing":"constant","instructions":[{"verb":"CountsAs","cardType":"attachment","trait":"Condition"}]},
  // 906108 Followed by Shadows
  {"id":"906108:whenRevealed:1","cardCode":"906108","lines":["906108:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"HideTest","x":2},{"verb":"RaiseThreat","amount":5,"when":{"kind":"lastHideFailed"}}]}]},
  {"id":"906108:shadow:1","cardCode":"906108","lines":["906108:A:2"],"timing":"shadow","instructions":[{"verb":"ConsiderUndefended","when":{"kind":"hideFailed","scope":"round"}}]},
  // 906109 Sniffing and Hissing. The first player chooses; with The One Ring already exhausted only the Hide test is left.
  {"id":"906109:whenRevealed:1","cardCode":"906109","lines":["906109:A:2"],"timing":"whenRevealed","instructions":[{"verb":"Choose","who":"firstPlayer","options":[{"id":"ring","requires":{"kind":"exhausted","code":RING,"is":false},"instructions":[{"verb":"Exhaust","target":{"kind":"byCode","code":RING}},{"verb":"RevealEncounter"}]},{"id":"hide","instructions":[{"verb":"HideTest","x":3}]}]}]},
  {"id":"906109:shadow:1","cardCode":"906109","lines":["906109:A:3"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack","target":"attacker"},{"verb":"AfterAttack","instructions":[{"verb":"RaiseThreat","amount":3,"when":{"kind":"x","min":1}}]}]},
];

export const AUTHORED_REPLACES: readonly string[] = [];
