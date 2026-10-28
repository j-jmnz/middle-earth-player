import type { Effect } from "../../catalog/boundary.ts";

// Records for Passage Through Mirkwood (Mirkwood Paths part 1, campaign card 01129): the encounter cards, the four quest cards and the
// campaign card. The boons and burdens it earns are in pool/RevCore.ts. Every line is read from the scan ledger (data/printed/mirkwood-paths.json).
// Rules: rr.step-3-3, rr.travel, rr.search, rr.first-player, rr.quest-advancement, rr.campaign-cards (data/rules/entries.json).
const READY_CHARACTER = {"type":"character","control":"you","state":"ready"} as const;
const NOT_UNDEFENDED = {"kind":"not","condition":{"kind":"undefended"}} as const;
// The treachery being revealed waits in the staging area while it resolves (rules/frames.ts): "the staging area" here is the other cards.
const STAGING = {"type":"card","control":"any","stagingOnly":true,"other":true} as const;

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 01074 King Spider: every player exhausts a character; as a Shadow card the defending player exhausts one (two when undefended).
  {"id":"01074:whenRevealed:1","cardCode":"01074","lines":["01074:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Pick","pick":READY_CHARACTER},{"verb":"Exhaust","target":{"kind":"picked"}}]}]},
  {"id":"01074:shadow:1","cardCode":"01074","lines":["01074:A:2"],"timing":"shadow","instructions":[{"verb":"Pick","pick":READY_CHARACTER},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"Pick","pick":READY_CHARACTER,"when":{"kind":"undefended"}},{"verb":"Exhaust","target":{"kind":"picked"},"when":{"kind":"undefended"}}]},
  // 01075 Hummerhorns: 5 damage on one of the engaged player's heroes; as a Shadow card 1 damage on each character (2 when undefended).
  {"id":"01075:forced:1","cardCode":"01075","lines":["01075:A:1"],"timing":"forced","trigger":"engaged","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you"}},{"verb":"DamageCard","amount":5,"target":"picked"}]},
  {"id":"01075:shadow:1","cardCode":"01075","lines":["01075:A:2"],"timing":"shadow","instructions":[{"verb":"DamageEach","amount":1,"pick":{"type":"character","control":"you"},"when":NOT_UNDEFENDED},{"verb":"DamageEach","amount":2,"pick":{"type":"character","control":"you"},"when":{"kind":"undefended"}}]},
  // 01076 Ungoliant's Spawn: -1 Willpower on the committed characters until the end of the phase; the Shadow raises the defender's threat.
  {"id":"01076:whenRevealed:1","cardCode":"01076","lines":["01076:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":-1,"until":"endOfPhase","holders":{"type":"character","control":"any","committed":true}}]},
  {"id":"01076:shadow:1","cardCode":"01076","lines":["01076:A:2"],"timing":"shadow","instructions":[{"verb":"RaiseThreat","amount":4,"who":"actor","when":NOT_UNDEFENDED},{"verb":"RaiseThreat","amount":8,"who":"actor","when":{"kind":"undefended"}}]},
  // 01077 Great Forest Web: each player exhausts a hero to travel here (the travel is barred when some player has none to exhaust).
  {"id":"01077:travel:1","cardCode":"01077","lines":["01077:A:1"],"timing":"travel","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}}]}]},
  // 01078 Mountains of Mirkwood: the Travel cost reveals a card; explored, each player may search the top 5 cards of his deck.
  {"id":"01078:travel:1","cardCode":"01078","lines":["01078:A:1"],"timing":"travel","instructions":[{"verb":"RevealEncounter"}]},
  {"id":"01078:response:1","cardCode":"01078","lines":["01078:A:2"],"timing":"response","trigger":"leftPlay","subject":"self","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"search","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":5}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]},{"id":"skip","instructions":[]}]}]}]},
  // 01079 Eyes of the Forest
  {"id":"01079:whenRevealed:1","cardCode":"01079","lines":["01079:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"DiscardEach","pick":{"type":"card","control":"you","from":"hand","cardType":"event"}}]}]},
  // 01080 Caught in a Web: the highest threat player attaches it to a hero of his; that hero does not ready in the refresh phase unless its
  // pool pays 2 (the controller is asked before the phase readies cards, rules/families/attachments-ready.ts).
  {"id":"01080:whenRevealed:1","cardCode":"01080","lines":["01080:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AttachSelf","to":{"kind":"hero","control":"highestThreat"}}]},
  {"id":"01080:constant:1","cardCode":"01080","lines":["01080:A:1"],"timing":"constant","instructions":[{"verb":"CountsAs","cardType":"attachment","trait":"Condition"},{"verb":"ModifyStat","stat":"doesNotReady","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"readyPayment","amount":2,"until":"whileSourceInPlay","target":"host"}]},
  // 01089 Dol Guldur Orcs: 2 damage on a committed character of the first player's choice; the Shadow adds Attack (+3 when undefended).
  {"id":"01089:whenRevealed:1","cardCode":"01089","lines":["01089:A:1"],"timing":"whenRevealed","instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","committed":true,"who":"firstPlayer"}},{"verb":"DamageCard","amount":2,"target":"picked"}]},
  {"id":"01089:shadow:1","cardCode":"01089","lines":["01089:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker","when":NOT_UNDEFENDED},{"verb":"ModifyStat","stat":"attack","amount":3,"until":"endOfAttack","target":"attacker","when":{"kind":"undefended"}}]},
  // 01090 Chieftan Ufthak (printed "Chieftain" in the lines): +2 Attack for each resource token on him, and one more after each of his attacks.
  {"id":"01090:constant:1","cardCode":"01090","lines":["01090:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"stat":"resources","of":"self","times":2},"until":"whileSourceInPlay","target":"self"}]},
  {"id":"01090:forced:1","cardCode":"01090","lines":["01090:A:2"],"timing":"forced","trigger":"attackResolved","subject":"self","instructions":[{"verb":"AddResources","amount":1,"to":"self"}]},
  // 01091 Dol Guldur Beastmaster
  {"id":"01091:forced:1","cardCode":"01091","lines":["01091:A:1"],"timing":"forced","trigger":"attacks","instructions":[{"verb":"DealShadow","additional":true}]},
  // 01092 Driven by Shadow: every enemy and location in the staging area gets +1 Threat; surge when there is none.
  {"id":"01092:whenRevealed:1","cardCode":"01092","lines":["01092:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ModifyStat","stat":"threat","amount":1,"until":"endOfPhase","holders":STAGING},{"verb":"GainSurge","when":{"kind":"count","pick":STAGING,"max":0}}]},
  {"id":"01092:shadow:1","cardCode":"01092","lines":["01092:A:2"],"timing":"shadow","instructions":[{"verb":"Pick","pick":{"type":"attachment","control":"any","attachedTo":"defender"},"when":NOT_UNDEFENDED},{"verb":"DiscardPicked","when":NOT_UNDEFENDED},{"verb":"Each","pick":{"type":"attachment","control":"you"},"instructions":[{"verb":"DiscardPicked"}],"when":{"kind":"undefended"}}]},
  // 01093 The Necromancer's Reach
  {"id":"01093:whenRevealed:1","cardCode":"01093","lines":["01093:A:1"],"timing":"whenRevealed","instructions":[{"verb":"DamageEach","amount":1,"pick":{"type":"character","control":"any","state":"exhausted"}}]},
  // 01094 Necromancer's Pass: the first player discards 2 cards at random to travel here (barred with fewer in hand).
  {"id":"01094:travel:1","cardCode":"01094","lines":["01094:A:1"],"timing":"travel","instructions":[{"verb":"DiscardRandomFromHand","amount":2,"who":"firstPlayer"}]},
  // 01095 Enchanted Stream
  {"id":"01095:constant:1","cardCode":"01095","lines":["01095:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"activeLocation"},"instructions":[{"verb":"ModifyStat","stat":"cannotDraw","amount":1,"until":"whileSourceInPlay","target":"table"}]},
  // 01096 Forest Spider
  {"id":"01096:forced:1","cardCode":"01096","lines":["01096:A:1"],"timing":"forced","trigger":"engaged","subject":"self","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfRound","target":"self"}]},
  {"id":"01096:shadow:1","cardCode":"01096","lines":["01096:A:2"],"timing":"shadow","instructions":[{"verb":"Pick","pick":{"type":"attachment","control":"you"}},{"verb":"DiscardPicked"}]},
  // 01097 East Bight Patrol
  {"id":"01097:shadow:1","cardCode":"01097","lines":["01097:A:1"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker"},{"verb":"RaiseThreat","amount":3,"who":"actor","when":{"kind":"undefended"}}]},
  // 01098 Black Forest Bats: each player removes a committed character from the quest (it stays exhausted).
  {"id":"01098:whenRevealed:1","cardCode":"01098","lines":["01098:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Pick","pick":{"type":"character","control":"you","committed":true}},{"verb":"RemoveFromQuest"}]}]},
  // 01099 Old Forest Road, 01100 Forest Gate: the Responses to traveling there (the first player's).
  {"id":"01099:response:1","cardCode":"01099","lines":["01099:A:1"],"timing":"response","trigger":"traveled","condition":{"kind":"canPick","pick":{"type":"character","control":"you","state":"exhausted","who":"firstPlayer"}},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"you","state":"exhausted","who":"firstPlayer"}},{"verb":"Ready","target":"picked"}]},
  {"id":"01100:response:1","cardCode":"01100","lines":["01100:A:1"],"timing":"response","trigger":"traveled","instructions":[{"verb":"Draw","amount":2,"who":"firstPlayer"}]},
  // 01119 Flies and Spiders. The Setup record describes what the scenario's piles already place (a Forest Spider and an Old Forest Road
  // in the staging area) and the shuffle buildStart appends; the definition runs those, not this record, so nothing is placed twice.
  {"id":"01119:setup:1","cardCode":"01119","lines":["01119:A:1"],"timing":"setup","instructions":[{"verb":"AddToStaging","code":"01096"},{"verb":"AddToStaging","code":"01099"},{"verb":"ShuffleEncounterDeck"}]},
  // 01120 A Fork in the Road: defeating it proceeds to 01121 or 01122 at random (BranchStage, rules/families/quest-branch.ts).
  {"id":"01120:forced:1","cardCode":"01120","lines":["01120:B:1"],"timing":"forced","trigger":"questCardDefeated","subject":"self","instructions":[{"verb":"BranchStage","codes":["01121","01122"]}]},
  // 01121 A Chosen Path, "Don't Leave the Path!": each player finds a Spider; it prints 0 quest points and cannot be advanced, the players win
  // when Ungoliant's Spawn is defeated. 01122, "Beorn's Path": it cannot be defeated while Ungoliant's Spawn is in play.
  {"id":"01121:whenRevealed:1","cardCode":"01121","lines":["01121:B:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"SearchMove","trait":"Spider","to":"staging"}]}]},
  {"id":"01121:constant:1","cardCode":"01121","lines":["01121:B:2"],"timing":"constant","instructions":[{"verb":"Restrict","what":"advance"}]},
  {"id":"01121:triggered:1","cardCode":"01121","lines":["01121:B:2"],"timing":"triggered","trigger":"enemyDestroyed","subject":{"type":"enemy","control":"any","names":["Ungoliant's Spawn"]},"instructions":[{"verb":"WinGame"}]},
  {"id":"01122:constant:1","cardCode":"01122","lines":["01122:B:1"],"timing":"constant","condition":{"kind":"inPlay","code":"01076","is":true},"instructions":[{"verb":"Restrict","what":"advance"}]},
  // 01129 Passage Through Mirkwood (campaign card). Setup: Mendor enters play. He leaving play loses the game. Resolution: one Mendor's
  // Support for each player, and the burden of the stage 3B the players reached.
  {"id":"01129:campaignSetup:1","cardCode":"01129","lines":["01129:A:2"],"timing":"campaignSetup","instructions":[{"verb":"PutObjectiveAllyIntoPlay","code":"01135"}]},
  {"id":"01129:triggered:1","cardCode":"01129","lines":["01129:A:3"],"timing":"triggered","trigger":"leftPlay","subject":{"type":"card","control":"any","names":["Mendor"]},"instructions":[{"verb":"LoseGame"}]},
  {"id":"01129:resolution:1","cardCode":"01129","lines":["01129:B:1"],"timing":"resolution","instructions":[{"verb":"Earn","codes":["01132"],"eachPlayer":true},{"verb":"Earn","codes":["01136"],"when":{"kind":"stageReached","code":"01122","is":true}},{"verb":"Earn","codes":["01137"],"when":{"kind":"stageReached","code":"01121","is":true}}]},
];

export const AUTHORED_REPLACES: readonly string[] = [];
