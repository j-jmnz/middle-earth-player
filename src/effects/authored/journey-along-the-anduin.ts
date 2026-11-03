import type { Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

// Records for Journey Along the Anduin (Mirkwood Paths part 2, campaign card 01130): the encounter cards no template reads, the three
// quest cards and the campaign card. Valor and Scarred, which the campaign card sets aside, are in pool/RevCore.ts. Every line is read from
// the scan ledger (data/printed/mirkwood-paths.json). The Setup that reveals cards and the stage's When Revealed at the start of the game
// are run by rules/families/quest/setup.ts.
// Rules: rr.step-3-3, rr.travel, rr.search, rr.engagement-check, rr.optional-engagement, rr.winning-the-game, rr.campaign-cards (data/rules/entries.json).
const NOT_UNDEFENDED = {"kind":"not","condition":{"kind":"undefended"}} as const;
const THREAT_35 = {"kind":"threat","min":35} as const;
const STAGING_LOCATIONS = {"type":"location","control":"any","stagingOnly":true} as const;
const EXHAUSTED_ALLY = {"type":"ally","control":"you","state":"exhausted"} as const;
const NO_EXHAUSTED_ALLY = {"kind":"not","condition":{"kind":"canPick","pick":EXHAUSTED_ALLY}} as const;
const HILL_TROLL: PickSpec = {"type":"enemy","control":"any","names":["Hill Troll"]};
// Each player picks a hero that may carry a set-aside copy of the card and attaches it (Limit 1 per hero: a hero with a copy is not offered).
const attachCopy = (code: string): Instruction => ({"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you","attachable":code}},{"verb":"AttachSetAside","code":code}]});

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 01081 Wolf Rider (Surge): as a shadow card it attacks the defending player once the attack it was dealt to has ended (rules/families/defense/shadow-attack.ts).
  {"id":"01081:shadow:1","cardCode":"01081","lines":["01081:A:2"],"timing":"shadow","instructions":[{"verb":"ShadowAttacks"}]},
  // 01082 Hill Troll: the excess of its combat damage raises its controller's threat (rules/families/defense/excess.ts).
  {"id":"01082:constant:1","cardCode":"01082","lines":["01082:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"excessToThreat","amount":1,"until":"whileSourceInPlay","target":"self"}]},
  // 01083 Goblin Sniper: it cannot be optionally engaged while another enemy is in the staging area; if it is there at the end of the
  // combat phase each player deals 1 damage to 1 of his characters.
  {"id":"01083:constant:1","cardCode":"01083","lines":["01083:A:1"],"timing":"constant","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Encounter"},{"kind":"sourceIn","zone":"staging"},{"kind":"count","pick":{"type":"enemy","control":"any","stagingOnly":true,"other":true},"min":1}]},"instructions":[{"verb":"ModifyStat","stat":"cannotBeOptionallyEngaged","amount":1,"until":"whileSourceInPlay","target":"self"}]},
  {"id":"01083:forced:1","cardCode":"01083","lines":["01083:A:2"],"timing":"forced","trigger":"endOfPhase","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Combat"},{"kind":"sourceIn","zone":"staging"}]},"instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Pick","pick":{"type":"character","control":"you"}},{"verb":"DamageCard","amount":1,"target":"picked"}]}]},
  // 01084 Marsh Adder: each time it attacks, the attacked player raises threat by 1.
  {"id":"01084:forced:1","cardCode":"01084","lines":["01084:A:1"],"timing":"forced","trigger":"attacks","instructions":[{"verb":"RaiseThreat","amount":1,"who":"actor"}]},
  // 01085 Wargs: dealt a shadow card with no effect, it returns to the staging area after it attacks; the Shadow adds Attack (+2 when undefended).
  {"id":"01085:forced:1","cardCode":"01085","lines":["01085:A:1"],"timing":"forced","trigger":"attackResolved","subject":"self","condition":{"kind":"shadowBlank"},"instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"}}]},
  {"id":"01085:shadow:1","cardCode":"01085","lines":["01085:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker","when":NOT_UNDEFENDED},{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack","target":"attacker","when":{"kind":"undefended"}}]},
  // 01086 Despair: 4 progress come off the quest; the Shadow sets the defender's Defense to 0 for this attack (its current Defense taken off).
  {"id":"01086:whenRevealed:1","cardCode":"01086","lines":["01086:A:1"],"timing":"whenRevealed","instructions":[{"verb":"RemoveProgressFromQuest","amount":4}]},
  {"id":"01086:shadow:1","cardCode":"01086","lines":["01086:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"defense","amount":{"stat":"defense","of":"defender","negative":true},"until":"endOfAttack","target":"defender"}]},
  // 01087 The Brown Lands: 1 progress token on it once the players have traveled there (it becomes the active location, rules/travel.ts).
  {"id":"01087:forced:1","cardCode":"01087","lines":["01087:A:1"],"timing":"forced","trigger":"becameActive","subject":"self","instructions":[{"verb":"PlaceProgressOn","amount":1,"target":"self"}]},
  // 01088 The East Bight: with no active location the players must travel here (rules/restrictions.ts forcedTravel).
  {"id":"01088:constant:1","cardCode":"01088","lines":["01088:A:1"],"timing":"constant","instructions":[{"verb":"Restrict","what":"travelOnly"}]},
  // 01111 Misty Mountain Goblins: progress comes off the quest after it attacks; the Shadow takes 1 (3 when undefended).
  {"id":"01111:forced:1","cardCode":"01111","lines":["01111:A:1"],"timing":"forced","trigger":"attackResolved","subject":"self","instructions":[{"verb":"RemoveProgressFromQuest","amount":1}]},
  {"id":"01111:shadow:1","cardCode":"01111","lines":["01111:A:2"],"timing":"shadow","instructions":[{"verb":"RemoveProgressFromQuest","amount":1,"when":NOT_UNDEFENDED},{"verb":"RemoveProgressFromQuest","amount":3,"when":{"kind":"undefended"}}]},
  // 01112 Massing at Night: X more cards are revealed, X the number of players (each player reveals one); the Shadow deals X shadow cards to the attacker.
  {"id":"01112:whenRevealed:1","cardCode":"01112","lines":["01112:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"RevealEncounter"}]}]},
  {"id":"01112:shadow:1","cardCode":"01112","lines":["01112:A:2"],"timing":"shadow","instructions":[{"verb":"Repeat","times":{"players":true},"instructions":[{"verb":"DealShadowTo","target":"attacker"}]}]},
  // 01113 Banks of the Anduin: when it leaves play it goes to the top of the encounter deck, not the discard pile.
  {"id":"01113:forced:1","cardCode":"01113","lines":["01113:A:1"],"timing":"forced","trigger":"leftPlay","subject":"self","instructions":[{"verb":"MoveEncounterCard","card":"self","to":"deckTop"}]},
  // 01114 Gladden Fields: while it is the active location each player raises threat by 1 more in the refresh phase.
  {"id":"01114:forced:1","cardCode":"01114","lines":["01114:A:1"],"timing":"forced","trigger":"endOfPhase","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Refresh"},{"kind":"sourceIn","zone":"activeLocation"}]},"instructions":[{"verb":"RaiseThreat","amount":1,"who":"eachSeat"}]},
  // 01115 Eastern Crows: when defeated it is shuffled back into the encounter deck; the Shadow adds Attack (+2 when the defending player's threat is 35 or higher).
  {"id":"01115:forced:1","cardCode":"01115","lines":["01115:A:2"],"timing":"forced","trigger":"enemyDestroyed","subject":"self","instructions":[{"verb":"MoveEncounterCard","card":"self","to":"shuffle"}]},
  {"id":"01115:shadow:1","cardCode":"01115","lines":["01115:A:3"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker","when":{"kind":"threat","max":34}},{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack","target":"attacker","when":THREAT_35}]},
  // 01116 Evil Storm: 1 damage on each character of each player whose threat is 35 or higher.
  {"id":"01116:whenRevealed:1","cardCode":"01116","lines":["01116:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"DamageEach","amount":1,"pick":{"type":"character","control":"you"},"when":THREAT_35}]}]},
  // 01117 Pursued by Shadow: each player raises threat by 1 for each character he controls that is not committed to a quest; the Shadow returns
  // an exhausted ally to its owner's hand, or raises the defender's threat by 3 when he controls none.
  {"id":"01117:whenRevealed:1","cardCode":"01117","lines":["01117:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"RaiseThreat","amount":{"count":{"type":"character","control":"you","committed":false}},"who":"actor"}]}]},
  {"id":"01117:shadow:1","cardCode":"01117","lines":["01117:A:2"],"timing":"shadow","instructions":[{"verb":"RaiseThreat","amount":3,"who":"actor","when":NO_EXHAUSTED_ALLY},{"verb":"Pick","pick":EXHAUSTED_ALLY,"when":{"kind":"canPick","pick":EXHAUSTED_ALLY}},{"verb":"ReturnToHand","target":"picked","when":{"kind":"canPick","pick":EXHAUSTED_ALLY}}]},
  // 01118 Treacherous Fog: each location in the staging area gets +1 Threat this phase; each player with threat 35 or higher discards a card from hand.
  {"id":"01118:whenRevealed:1","cardCode":"01118","lines":["01118:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ModifyStat","stat":"threat","amount":1,"until":"endOfPhase","holders":STAGING_LOCATIONS},{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"DiscardFromHand","amount":1,"when":THREAT_35}]}]},
  // 01126 To the River...: Setup reveals a card for each player (run by quest/setup.ts); side B searches for a Hill Troll when none is in play and
  // shuffles; the stage cannot be defeated while a Hill Troll is in play.
  {"id":"01126:setup:1","cardCode":"01126","lines":["01126:A:1"],"timing":"setup","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"RevealEncounter"}]}]},
  {"id":"01126:whenRevealed:1","cardCode":"01126","lines":["01126:B:1"],"timing":"whenRevealed","instructions":[{"verb":"SearchMove","code":"01082","to":"staging","when":{"kind":"inPlay","code":"01082","is":false}},{"verb":"ShuffleEncounterDeck"}]},
  {"id":"01126:constant:1","cardCode":"01126","lines":["01126:B:2"],"timing":"constant","condition":{"kind":"inPlay","code":"01082","is":true},"instructions":[{"verb":"Restrict","what":"advance"}]},
  // 01127 Anduin Passage: one more card is revealed each quest phase, and no engagement checks are made (optional engagement still is).
  {"id":"01127:constant:1","cardCode":"01127","lines":["01127:B:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"revealMore","amount":1,"until":"whileSourceInPlay","target":"table"},{"verb":"ModifyStat","stat":"noEngagementChecks","amount":1,"until":"whileSourceInPlay","target":"table"}]},
  // 01128 Ambush on the Shore: 2 cards for each player are revealed; the staging step is skipped; the players win once no enemy is in play.
  {"id":"01128:whenRevealed:1","cardCode":"01128","lines":["01128:B:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"RevealEncounter"},{"verb":"RevealEncounter"}]}]},
  {"id":"01128:constant:1","cardCode":"01128","lines":["01128:B:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"skipStaging","amount":1,"until":"whileSourceInPlay","target":"table"}]},
  // Stage 3B prints 0 quest points and the players win some other way, so progress cannot advance it (as 01121:B:2 in Passage Through Mirkwood).
  {"id":"01128:constant:2","cardCode":"01128","lines":["01128:B:3"],"timing":"constant","condition":{"kind":"enemyInPlay","is":false},"instructions":[{"verb":"WinGame"}]},
  {"id":"01128:constant:3","cardCode":"01128","lines":["01128:B:3"],"timing":"constant","instructions":[{"verb":"Restrict","what":"advance"}]},
  // 01130 Journey Along the Anduin (campaign card). Setup: Mendor enters play and a copy of Valor and of Scarred for each player is set aside.
  // A defeated Hill Troll gives each player a Valor (Response); a character a Hill Troll destroys gives each player a Scarred, once per game
  // (Forced). Mendor leaving play loses the game. Resolution: every Valor and Scarred in play joins the pool on its hero, and the hero with
  // the most damage (a tie at random) is the prisoner.
  {"id":"01130:campaignSetup:1","cardCode":"01130","lines":["01130:A:2"],"timing":"campaignSetup","instructions":[{"verb":"PutObjectiveAllyIntoPlay","code":"01135"},{"verb":"SetAsideEachPlayer","code":"01133"},{"verb":"SetAsideEachPlayer","code":"01138"}]},
  {"id":"01130:response:1","cardCode":"01130","lines":["01130:A:3"],"timing":"response","trigger":"enemyDestroyed","subject":HILL_TROLL,"instructions":[attachCopy("01133")]},
  {"id":"01130:forced:1","cardCode":"01130","lines":["01130:A:4"],"timing":"forced","trigger":"characterDestroyedByAttack","subject":{"type":"character","control":"any"},"condition":{"kind":"matches","card":"other","pick":HILL_TROLL},"limit":"oncePerGame","instructions":[attachCopy("01138")]},
  {"id":"01130:triggered:1","cardCode":"01130","lines":["01130:A:5"],"timing":"triggered","trigger":"leftPlay","subject":{"type":"card","control":"any","names":["Mendor"]},"instructions":[{"verb":"LoseGame"}]},
  {"id":"01130:resolution:1","cardCode":"01130","lines":["01130:B:1"],"timing":"resolution","instructions":[{"verb":"EarnAttached","codes":["01133","01138"]},{"verb":"NamePrisoner"}]},
];

export const AUTHORED_REPLACES: readonly string[] = [];
