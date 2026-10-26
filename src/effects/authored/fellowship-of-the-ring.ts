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
  // "Counts as a Condition attachment": Miner of the Iron Hills can discard it (01061:A:1).
  {"id":"141043:constant:1","cardCode":"141043","lines":["141043:A:2"],"timing":"constant","instructions":[{"verb":"CountsAs","cardType":"attachment","trait":"Condition"}]},
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

  // A Knife in the Dark (scenario 2). An "out of play" Ringwraith is a copy set aside (stage 1's Setup), in the encounter discard
  // pile or victory display, or under Weather Hills (outOfPlay condition, rr.in-play-and-out-of-play).
  // 141025 Trouble in Bree. The Setup record describes what the scenario's piles already place (setAside, staging) and the
  // shuffle buildStart appends; the definition runs those, not this record, so nothing is placed twice. Its SetAside order is the
  // piles' order (Weathertop, Midgewater, The Witch-king, Ringwraith), so the record stays a subsequence of what runs.
  {"id":"141025:setup:1","cardCode":"141025","lines":["141025:A:1"],"timing":"setup","instructions":[{"verb":"SetAside","code":"141046"},{"verb":"SetAside","code":"141048"},{"verb":"SetAside","code":"141068"},{"verb":"SetAside","code":"141069"},{"verb":"AddToStaging","code":"141045"},{"verb":"AddToStaging","code":"141051"},{"verb":"ShuffleEncounterDeck"}]},
  // 141026 Into the Wild
  {"id":"141026:whenRevealed:1","cardCode":"141026","lines":["141026:B:1"],"timing":"whenRevealed","instructions":[{"verb":"AddSetAsideToStaging","code":"141048"},{"verb":"PlaceQuestProgress","perPlayer":1}]},
  {"id":"141026:forced:1","cardCode":"141026","lines":["141026:B:2"],"timing":"forced","trigger":"endOfRound","instructions":[{"verb":"Choose","who":"firstPlayer","options":[{"id":"progress","requires":{"kind":"questProgress"},"instructions":[{"verb":"RemoveQuestProgress","perPlayer":1}]},{"id":"ringwraith","requires":{"kind":"outOfPlay","code":"141069"},"instructions":[{"verb":"ShuffleOutOfPlayIntoEncounterDeck","code":"141069"}]}]}]},
  // 141027 The Ringwraiths Attack. Set-aside Ringwraiths stay set aside: the search reads the encounter deck and discard pile.
  {"id":"141027:whenRevealed:1","cardCode":"141027","lines":["141027:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AddSetAsideToStaging","code":"141046"},{"verb":"AddSetAsideToStaging","code":"141068"},{"verb":"SearchMove","trait":"Nazgûl","type":"enemy","to":"staging","each":true},{"verb":"ShuffleEncounterDeck"}]},
  {"id":"141027:constant:1","cardCode":"141027","lines":["141027:B:1"],"timing":"constant","condition":{"kind":"enemyInPlay","trait":"Nazgûl","is":false},"instructions":[{"verb":"WinGame"}]},
  // 141045 The Prancing Pony
  {"id":"141045:response:1","cardCode":"141045","lines":["141045:A:1"],"timing":"response","trigger":"traveled","instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you","from":"hand","intoPlay":true,"who":"firstPlayer"}},{"verb":"MovePicked","to":"play","who":"firstPlayer"}]},
  {"id":"141045:forced:1","cardCode":"141045","lines":["141045:A:2"],"timing":"forced","trigger":"leftPlay","instructions":[{"verb":"DiscardUntilEnemies","perPlayer":1}]},
  // 141046 Weathertop (line 1 is the immune keyword)
  {"id":"141046:constant:1","cardCode":"141046","lines":["141046:A:2"],"timing":"constant","condition":{"kind":"sourceIn","zone":"victory"},"instructions":[{"verb":"ModifyStat","stat":"threat","amount":-1,"until":"whileSourceInPlay","target":"enemies"}]},
  {"id":"141046:travel:1","cardCode":"141046","lines":["141046:A:3"],"timing":"travel","instructions":[{"verb":"Exhaust","target":{"kind":"byCode","code":"141085"},"who":"firstPlayer"}]},
  // 141047 Chetwood
  {"id":"141047:constant:1","cardCode":"141047","lines":["141047:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"staging"},"instructions":[{"verb":"ModifyStat","stat":"threat","amount":1,"until":"whileSourceInPlay","target":"enemies","trait":"Spy"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"enemies","trait":"Spy"}]},
  {"id":"141047:shadow:1","cardCode":"141047","lines":["141047:A:2"],"timing":"shadow","instructions":[{"verb":"DiscardRandomFromHand"}]},
  // 141048 Midgewater
  {"id":"141048:constant:1","cardCode":"141048","lines":["141048:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"activeLocation"},"instructions":[{"verb":"ModifyStat","stat":"cannotAttack","amount":1,"until":"whileSourceInPlay","target":"enemies"},{"verb":"ModifyStat","stat":"cannotTakeDamage","amount":1,"until":"whileSourceInPlay","target":"enemies"},{"verb":"ModifyStat","stat":"cannotBeEngaged","amount":1,"until":"whileSourceInPlay","target":"enemies"}]},
  {"id":"141048:forced:1","cardCode":"141048","lines":["141048:A:2"],"timing":"forced","trigger":"becameActive","instructions":[{"verb":"ReturnToStaging","target":{"kind":"engagedEnemies","who":"each","pick":"all"}}]},
  // 141049 Weather Hills
  {"id":"141049:response:1","cardCode":"141049","lines":["141049:A:1"],"timing":"response","trigger":"traveled","instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","staging":true,"nonUnique":true}},{"verb":"PlaceUnderSelf"}]},
  {"id":"141049:forced:1","cardCode":"141049","lines":["141049:A:2"],"timing":"forced","trigger":"leftPlay","instructions":[{"verb":"ReturnUnderToStaging"}]},
  // 141050 Rider of Mordor (line 1 is the generated 141050:constant:1)
  {"id":"141050:constant:2","cardCode":"141050","lines":["141050:A:2"],"timing":"constant","condition":{"kind":"sourceIn","zone":"engaged"},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":-1,"until":"whileSourceInPlay","target":"engagedSeatCharacters"}]},
  {"id":"141050:constant:3","cardCode":"141050","lines":["141050:A:3"],"timing":"constant","condition":{"kind":"exhausted","code":"141085","is":true},"instructions":[{"verb":"ModifyStat","stat":"engagementCost","amount":-10,"until":"whileSourceInPlay"}]},
  // 141051 Bill Ferny. The first player makes the players' choice on an encounter card.
  {"id":"141051:constant:1","cardCode":"141051","lines":["141051:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotBeOptionallyEngaged","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"141051:forced:1","cardCode":"141051","lines":["141051:A:2"],"timing":"forced","trigger":"stagingStepBegins","instructions":[{"verb":"Choose","who":"firstPlayer","options":[{"id":"ringwraith","requires":{"kind":"outOfPlay","code":"141069"},"instructions":[{"verb":"ShuffleOutOfPlayIntoEncounterDeck","code":"141069"}]},{"id":"threat","requires":{"kind":"canPick","pick":{"type":"hero","control":"any","committed":true,"exceptSphere":"fellowship"}},"instructions":[{"verb":"RaiseThreat","who":"eachSeat","perCommitted":{"type":"hero","exceptSphere":"fellowship"}}]}]}]},
  // 141052 Shady Bree-Lander
  {"id":"141052:constant:1","cardCode":"141052","lines":["141052:A:1"],"timing":"constant","condition":{"kind":"exhausted","code":"141085","is":true},"instructions":[{"verb":"ModifyStat","stat":"cannotBeOptionallyEngaged","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"141052:shadow:1","cardCode":"141052","lines":["141052:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"defense","amount":-1,"until":"endOfAttack","target":"defender"},{"verb":"ModifyStat","stat":"defense","amount":-1,"until":"endOfAttack","target":"defender","when":{"kind":"exhausted","code":"141085","is":true}}]},
  // 141053 Squint-Eyed Southerner. "Reveal an additional encounter card" is surge (rr.surge).
  {"id":"141053:whenRevealed:1","cardCode":"141053","lines":["141053:A:1"],"timing":"whenRevealed","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"ringwraith","requires":{"kind":"outOfPlay","code":"141069"},"instructions":[{"verb":"ShuffleOutOfPlayIntoEncounterDeck","code":"141069"}]},{"id":"reveal","instructions":[{"verb":"GainSurge"}]}]}]},
  // 141054 Unwanted Attention (line 1 is Peril, line 3 the generated shadow record)
  {"id":"141054:whenRevealed:1","cardCode":"141054","lines":["141054:A:2"],"timing":"whenRevealed","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"heroes","requires":{"kind":"canPick","pick":{"type":"hero","control":"you","committed":true}},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you","committed":true}},{"verb":"RemoveFromQuest"},{"verb":"Pick","pick":{"type":"hero","control":"you","committed":true}},{"verb":"RemoveFromQuest"}]},{"id":"ringwraith","requires":{"kind":"outOfPlay","code":"141069"},"instructions":[{"verb":"ShuffleOutOfPlayIntoEncounterDeck","code":"141069"}]}]}]},
  // 141055 Black Breath. AttachSelf offers only heroes without a copy attached (Limit 1 per hero). It counts as a Condition
  // attachment (01061:A:1).
  {"id":"141055:whenRevealed:1","cardCode":"141055","lines":["141055:A:2"],"timing":"whenRevealed","instructions":[{"verb":"AttachSelf","to":{"kind":"hero"}}]},
  {"id":"141055:constant:1","cardCode":"141055","lines":["141055:A:2"],"timing":"constant","instructions":[{"verb":"SetStat","stat":"willpower","value":0,"target":"host"},{"verb":"SetStat","stat":"attack","value":0,"target":"host"},{"verb":"SetStat","stat":"defense","value":0,"target":"host"},{"verb":"CountsAs","cardType":"attachment","trait":"Condition"}]},
  // 141068 The Witch-king (line 1 is the immune keyword)
  {"id":"141068:constant:1","cardCode":"141068","lines":["141068:A:2"],"timing":"constant","condition":{"kind":"exhausted","code":"141085","is":true},"instructions":[{"verb":"ModifyStat","stat":"engagementCost","amount":-30,"until":"whileSourceInPlay"}]},
  {"id":"141068:constant:2","cardCode":"141068","lines":["141068:A:3"],"timing":"constant","instructions":[{"verb":"Restrict","what":"defend","maxWillpower":1}]},
  // 141069 Ringwraith (line 1 is the generated 141069:constant:1)
  {"id":"141069:forced:1","cardCode":"141069","lines":["141069:A:2"],"timing":"forced","trigger":"attacks","condition":{"kind":"exhausted","code":"141085","is":true},"instructions":[{"verb":"DealShadow","additional":true}]},
  {"id":"141069:shadow:1","cardCode":"141069","lines":["141069:A:3"],"timing":"shadow","instructions":[{"verb":"ShuffleSelfIntoEncounterDeck"}]},
  // 141070 Pale Blade (line 1 is Surge). AttachSelf offers only enemies without a copy attached (Limit 1 per enemy).
  {"id":"141070:whenRevealed:1","cardCode":"141070","lines":["141070:A:2"],"timing":"whenRevealed","instructions":[{"verb":"AttachSelf","to":{"kind":"enemy","trait":"Nazgûl"}}]},
  {"id":"141070:constant:1","cardCode":"141070","lines":["141070:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"cannotTakeNonCombatDamage","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 141071 Power In Their Terror. An encounter card's lasting effect also holds for allies that enter play later (rr.lasting-effects).
  {"id":"141071:whenRevealed:1","cardCode":"141071","lines":["141071:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":-1,"until":"endOfRound","target":"allies"},{"verb":"DamageAll","amount":2,"type":"ally","maxWillpower":0}]},
  {"id":"141071:shadow:1","cardCode":"141071","lines":["141071:A:2"],"timing":"shadow","instructions":[{"verb":"Pick","pick":{"type":"attachment","control":"you"}},{"verb":"DiscardPicked"}]},

  // Player cards of the player's own decks that the box does not print (user request, 2026-10-25).
  // 19121 The Shirefolk: its play restriction (19121:A:1, inert in the ledger) is the condition of its one Action.
  {"id":"19121:action:1","cardCode":"19121","lines":["19121:A:2"],"timing":"action","condition":{"kind":"heroesAll","trait":"Hobbit"},"instructions":[{"verb":"LowerThreat","amount":4,"who":"actor"}]},

  // Campaign cards: the Setup on the front and the Resolution on the back (Learn to Play p29, Rules Reference Appendix III).
  // 141030 A Shadow of the Past
  {"id":"141030:campaignSetup:1","cardCode":"141030","lines":["141030:A:2"],"timing":"campaignSetup","instructions":[{"verb":"AttachToRingBearer","code":"141017"},{"verb":"AddToStaging","code":"141078"},{"verb":"ShuffleIntoEncounterDeck","code":"141077"},{"verb":"ShuffleIntoEncounterDeck","code":"141079"}]},
  {"id":"141030:resolution:1","cardCode":"141030","lines":["141030:B:1"],"timing":"resolution","instructions":[{"verb":"ChooseCards","codes":["141078","141079"],"who":"firstPlayer","to":"pool"},{"verb":"ChooseCards","codes":["141077","141017"],"who":"firstPlayer","to":"pool"}]},
  // 141044 A Knife in the Dark
  {"id":"141044:resolution:1","cardCode":"141044","lines":["141044:B:1"],"timing":"resolution","instructions":[{"verb":"ChooseCards","codes":["141018","141019","141020","141021"],"who":"eachSeat","to":"hero","optional":true}]},
  // 141056 Flight to the Ford (its front Response, 141056:A:2, is in flight-to-the-ford.ts)
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
