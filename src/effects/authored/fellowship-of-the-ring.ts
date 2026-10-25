import type { Effect } from "../../catalog/boundary.ts";

// Records for the sentences no template in scripts/data/effects/templates.ts reads in full.
// An id here that a template also produces replaces the generated record; list it in AUTHORED_REPLACES.
export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 141023 A Shortcut to Mushrooms
  {"id":"141023:constant:1","cardCode":"141023","lines":["141023:B:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"hideThreat","amount":1,"until":"whileSourceInPlay","target":"eachSeat","per":"ally"}]},
  // 141034 Bamfurlong
  {"id":"141034:response:1","cardCode":"141034","lines":["141034:A:1"],"timing":"response","trigger":"traveled","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"ready","requires":{"kind":"hasEngaged","trait":"Nazgûl"},"instructions":[{"verb":"ReadyHero"}]},{"id":"skip","instructions":[]}]}]}]},
  // 141041 Crawling Towards Him
  {"id":"141041:whenRevealed:1","cardCode":"141041","lines":["141041:A:2"],"timing":"whenRevealed","instructions":[{"verb":"UncommitAll","who":"actor","when":{"kind":"hideFailed","scope":"phase"}}]},
  // 141042 Hunting For The Ring
  {"id":"141042:whenRevealed:1","cardCode":"141042","lines":["141042:A:2"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"lastFirst","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"return","requires":{"kind":"hasEngaged","trait":"Nazgûl"},"instructions":[{"verb":"ReturnToStaging","target":{"kind":"engagedEnemies","trait":"Nazgûl","who":"actor","pick":"choose"}}]},{"id":"hide","instructions":[{"verb":"HideTest","x":2}]}]}]}]},
  // 141043 Have You Seen Baggins?
  {"id":"141043:whenRevealed:1","cardCode":"141043","lines":["141043:A:2"],"timing":"whenRevealed","instructions":[{"verb":"AttachSelf","to":{"kind":"hero","control":"any"}}]},
  {"id":"141043:forced:1","cardCode":"141043","lines":["141043:A:2"],"timing":"forced","trigger":"hideFailed","instructions":[{"verb":"Discard","target":{"kind":"host"}}]},
  // 141072 Pathless Country
  {"id":"141072:shadow:1","cardCode":"141072","lines":["141072:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"EngageNextPlayer","when":{"kind":"otherPlayer"}},{"verb":"ImmediateAttack","when":{"kind":"otherPlayer"}}]}]},
  // 141073 Piercing Cry
  {"id":"141073:whenRevealed:1","cardCode":"141073","lines":["141073:A:2"],"timing":"whenRevealed","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"staging","requires":{"kind":"searchable","trait":"Nazgûl"},"instructions":[{"verb":"SearchMove","trait":"Nazgûl","to":"staging"}]},{"id":"engage","requires":{"kind":"searchable","trait":"Nazgûl"},"instructions":[{"verb":"SearchMove","trait":"Nazgûl","to":"engagedFirstPlayer"}]}]},{"verb":"ShuffleEncounterDeck"}]},
  // 141076 Lure of the Ring
  {"id":"141076:whenRevealed:1","cardCode":"141076","lines":["141076:A:2"],"timing":"whenRevealed","instructions":[{"verb":"Choose","who":"firstPlayer","options":[{"id":"exhaust","requires":{"kind":"exhausted","code":"141085","is":false},"instructions":[{"verb":"Exhaust","target":{"kind":"byCode","code":"141085"}}]},{"id":"threat","instructions":[{"verb":"RaiseThreat","amount":3,"who":"firstPlayer"}]}]}]},
  // 141074 Black Steed
  {"id":"141074:constant:1","cardCode":"141074","lines":["141074:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"engagementCost","amount":-10,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"141074:whenRevealed:1","cardCode":"141074","lines":["141074:A:2"],"timing":"whenRevealed","instructions":[{"verb":"AttachSelf","to":{"kind":"enemy","trait":"Nazgûl"}}]},
  {"id":"141074:forced:1","cardCode":"141074","lines":["141074:A:2"],"timing":"forced","trigger":"endOfPhase","condition":{"kind":"phase","is":"Refresh"},"instructions":[{"verb":"ReturnToStaging","target":{"kind":"host"}}]},
  // 141075 Rode Like a Gale
  {"id":"141075:whenRevealed:1","cardCode":"141075","lines":["141075:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ReturnToStaging","target":{"kind":"engagedEnemies","trait":"Nazgûl","who":"each","pick":"all"}},{"verb":"GainSurge","when":{"kind":"noneReturned"}}]},
  // 141001 Frodo Baggins: the cost is 1 Fellowship resource and exhausting The One Ring, so the Ring must be ready.
  {"id":"141001:response:1","cardCode":"141001","lines":["141001:A:1"],"timing":"response","trigger":"encounterRevealed","cost":{"kind":"resources","amount":1,"sphere":"fellowship"},"condition":{"kind":"exhausted","code":"141085","is":false},"instructions":[{"verb":"Exhaust","target":{"kind":"byCode","code":"141085"}},{"verb":"CancelEffect"}]},
  // 141017 Mr. Underhill
  {"id":"141017:action:1","cardCode":"141017","lines":["141017:A:3"],"timing":"action","cost":{"kind":"addSelfToVictory"},"condition":{"kind":"hasEngaged"},"instructions":[{"verb":"BarAttack"}]},
  // 141077 Gildor Inglorion
  {"id":"141077:whenRevealed:1","cardCode":"141077","lines":["141077:A:1"],"timing":"whenRevealed","instructions":[{"verb":"TakeControl","who":"firstPlayer"}]},
  {"id":"141077:forced:1","cardCode":"141077","lines":["141077:A:2"],"timing":"forced","trigger":"endOfRound","cancel":{"cost":1,"sphere":"fellowship"},"instructions":[{"verb":"Discard","target":{"kind":"self"}}]},
  // 141079 The Ring Draws Them
  {"id":"141079:whenRevealed:1","cardCode":"141079","lines":["141079:A:2"],"timing":"whenRevealed","uncancelable":{"kind":"exhausted","code":"141085","is":true},"instructions":[{"verb":"Delay","until":"endOfPhase","uncancelable":{"kind":"exhausted","code":"141085","is":true},"instructions":[{"verb":"EngageAll","who":"firstPlayer"}]}]},

  // Campaign cards: the Setup on the front and the Resolution on the back (Learn to Play p29, Rules Reference Appendix III).
  // 141030 A Shadow of the Past
  {"id":"141030:campaignSetup:1","cardCode":"141030","lines":["141030:A:2"],"timing":"campaignSetup","instructions":[{"verb":"AttachToRingBearer","code":"141017"},{"verb":"AddToStaging","code":"141078"},{"verb":"ShuffleIntoEncounterDeck","code":"141077"},{"verb":"ShuffleIntoEncounterDeck","code":"141079"}]},
  {"id":"141030:resolution:1","cardCode":"141030","lines":["141030:B:1"],"timing":"resolution","instructions":[{"verb":"ChooseCards","codes":["141078","141079"],"who":"firstPlayer","to":"pool"},{"verb":"ChooseCards","codes":["141077","141017"],"who":"firstPlayer","to":"pool"}]},
  // 141044 A Knife in the Dark
  {"id":"141044:resolution:1","cardCode":"141044","lines":["141044:B:1"],"timing":"resolution","instructions":[{"verb":"ChooseCards","codes":["141018","141019","141020","141021"],"who":"eachSeat","to":"hero","optional":true}]},
  // 141056 Flight to the Ford (its front Response line is the scenario 3 engine half, phase 13)
  {"id":"141056:resolution:1","cardCode":"141056","lines":["141056:B:1"],"timing":"resolution","instructions":[{"verb":"EarnAllBurdens"}]},
  // 142019 The Ring Goes South
  {"id":"142019:campaignSetup:1","cardCode":"142019","lines":["142019:A:2"],"timing":"campaignSetup","instructions":[{"verb":"WaiveThreatPenalty"},{"verb":"ChooseCards","codes":["142011","142012","142013","142014"],"who":"eachSeat","to":"hand","leftover":"firstPlayerDeck"}]},
  {"id":"142019:resolution:1","cardCode":"142019","lines":["142019:B:1"],"timing":"resolution","instructions":[{"verb":"Earn","codes":["142084"],"when":{"kind":"attachedToHero","code":"142084","is":true}}]},
  // 142039 Journey in the Dark
  {"id":"142039:campaignSetup:1","cardCode":"142039","lines":["142039:A:2"],"timing":"campaignSetup","instructions":[{"verb":"ShuffleIntoEncounterDeck","code":"142086"},{"verb":"ShuffleIntoEncounterDeck","code":"142085"},{"verb":"AddToStaging","code":"142088"},{"verb":"AddToStaging","code":"142087"}]},
  {"id":"142039:resolution:1","cardCode":"142039","lines":["142039:B:1"],"timing":"resolution","instructions":[{"verb":"Earn","codes":["142086","142085","142088","142087"],"when":{"kind":"inPlay","code":"142044","is":true}},{"verb":"ChooseCards","codes":["142086","142085"],"who":"firstPlayer","to":"pool","when":{"kind":"inPlay","code":"142044","is":false}},{"verb":"ChooseCards","codes":["142088","142087"],"who":"firstPlayer","to":"pool","when":{"kind":"inPlay","code":"142044","is":false}}]},
  // 142060 Breaking of the Fellowship
  {"id":"142060:campaignSetup:1","cardCode":"142060","lines":["142060:A:2"],"timing":"campaignSetup","instructions":[{"verb":"ChooseCards","codes":["142015","142016","142017","142018"],"who":"eachSeat","to":"hero"},{"verb":"ShuffleIntoEncounterDeck","code":"142089"},{"verb":"ShuffleIntoEncounterDeck","code":"142090"}]},
  {"id":"142060:resolution:1","cardCode":"142060","lines":["142060:B:1"],"timing":"resolution","instructions":[{"verb":"MarkFallen","attached":"142083"}]},
  {"id":"142060:resolution:2","cardCode":"142060","lines":["142060:B:2"],"timing":"resolution","instructions":[{"verb":"ChooseCards","codes":["142089","142090"],"who":"firstPlayer","to":"pool"}]},
  {"id":"142060:resolution:3","cardCode":"142060","lines":["142060:B:3"],"timing":"resolution","instructions":[{"verb":"NameCaptives","except":["Ring-bearer","Aragorn"]}]},
];

export const AUTHORED_REPLACES: readonly string[] = [];
