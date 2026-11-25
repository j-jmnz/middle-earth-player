import type { Effect, PickSpec } from "../../catalog/boundary.ts";

// Records for The Caves of Nibin-Dûm (Mirkwood Paths part 5 and The Dark of Mirkwood part 2, campaign card 41051): the four quest cards, the
// encounter cards no template or earlier record reads, and the campaign card. The Goblins cards 41019 to 41026 are The Oath's (the-oath.ts). The
// boons and burdens it deals ("No Time to Waste!" 41048, Shiny Distraction 41042) and earns (Ranger Sense 41049) are in pool/TDoM.ts. Every line
// is read from the scan ledger (data/printed/mirkwood-paths.json).
// Rules: rr.step-3-3, rr.search, rr.travel, rr.engaged, rr.cancel, rr.first-player, rr.campaign-cards, rr.active-location, rr.removed-from-game
// (data/rules/entries.json).
const CLAIM_GOBLIN = "41027";
const TORCH = "41029";
const DARK_LOCATION = {"type":"location","control":"any","trait":"Dark"} as const;
const PILLAR_IN_STAGING: PickSpec = {"type":"location","control":"any","names":["Cracked Pillar"],"stagingOnly":true};
const IN_STAGING = {"kind":"sourceIn","zone":"staging"} as const;
const GOBLIN_ENEMY = {"type":"enemy","control":"any","trait":"Goblin"} as const;

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 41004 The Dark of Nibin-Dûm. Setup: Goblin Chieftain and Cracked Pillar are set aside by the piles (the scenario data); the Cave Torch is dealt
  // here: out of the encounter deck, then attached to a hero of the first player's choice (rules/families/quest/setup.ts runs this record).
  {"id":"41004:setup:1","cardCode":"41004","lines":["41004:A:1"],"timing":"setup","instructions":[{"verb":"SetAside","code":TORCH},{"verb":"Pick","pick":{"type":"hero","control":"you","attachable":TORCH}},{"verb":"AttachSetAside","code":TORCH},{"verb":"ShuffleEncounterDeck"}]},
  {"id":"41004:whenRevealed:1","cardCode":"41004","lines":["41004:B:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"SearchMove","type":"location","to":"staging","different":true,"deckOnly":true}]},{"verb":"ShuffleEncounterDeck"}]},
  // 41005 Surprise Attack: Goblin Chieftain comes from the set-aside cards, each player finds an enemy in the deck or the discard pile; every enemy costs 0 to
  // engage in the encounter phase; this stage's quest points are 4 for each enemy in play.
  {"id":"41005:whenRevealed:1","cardCode":"41005","lines":["41005:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AddSetAsideToStaging","code":CLAIM_GOBLIN},{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"SearchMove","type":"enemy","to":"staging","different":true}]},{"verb":"ShuffleEncounterDeck"}]},
  {"id":"41005:constant:1","cardCode":"41005","lines":["41005:B:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"engagementCostZero","amount":1,"until":"whileSourceInPlay","target":"table"}]},
  {"id":"41005:constant:2","cardCode":"41005","lines":["41005:B:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"questPoints","amount":{"count":{"type":"enemy","control":"any","staging":true},"times":4},"until":"whileSourceInPlay"}]},
  // 41006 The Chasm: Goblin Chieftain is set aside, Cracked Pillar joins the staging area. One more card is revealed each quest phase; no progress can go on the
  // Pillar while it is in the staging area; the stage prints no quest points, so the players advance when the Pillar leaves play explored.
  {"id":"41006:whenRevealed:1","cardCode":"41006","lines":["41006:A:1"],"timing":"whenRevealed","instructions":[{"verb":"SetAsideInPlay","code":CLAIM_GOBLIN},{"verb":"AddSetAsideToStaging","code":"41028"}]},
  {"id":"41006:forced:1","cardCode":"41006","lines":["41006:B:1"],"timing":"forced","trigger":"beginningOfPhase","condition":{"kind":"phase","is":"Quest"},"instructions":[{"verb":"RevealMore","amount":1}]},
  {"id":"41006:constant:1","cardCode":"41006","lines":["41006:B:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"noProgressPlaced","amount":1,"until":"whileSourceInPlay","holders":PILLAR_IN_STAGING}]},
  {"id":"41006:triggered:1","cardCode":"41006","lines":["41006:B:3"],"timing":"triggered","trigger":"leftPlay","subject":{"type":"location","control":"any","names":["Cracked Pillar"]},"condition":{"kind":"subjectExplored"},"instructions":[{"verb":"AdvanceStage"}]},
  // 41007 Oathkeepers: Goblin Chieftain returns (the generated When Revealed record, a template). With 8 progress on the stage it can take damage; the stage cannot be defeated while it is in play, and
  // defeating this last stage wins the game (rr.winning-the-game).
  {"id":"41007:constant:1","cardCode":"41007","lines":["41007:B:1"],"timing":"constant","condition":{"kind":"stageProgress","min":8},"instructions":[{"verb":"ModifyStat","stat":"losesNoDamage","amount":1,"until":"whileSourceInPlay","holders":{"type":"enemy","control":"any","staging":true,"names":["Goblin Chieftain"]}}]},
  {"id":"41007:constant:2","cardCode":"41007","lines":["41007:B:2"],"timing":"constant","condition":{"kind":"inPlay","code":CLAIM_GOBLIN,"is":true},"instructions":[{"verb":"Restrict","what":"advance"}]},
  // 41027 Goblin Chieftain: its Threat, Attack and Defense are the stage number; no damage, no attachments; after it attacks the first player either takes X
  // progress off the quest (offered only when the stage holds progress: an effect with no potential to change the game state cannot be selected, rr.effects)
  // or returns it to the staging area.
  {"id":"41027:constant:1","cardCode":"41027","lines":["41027:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"threat","amount":{"stage":true},"until":"whileSourceInPlay","target":"self"},{"verb":"ModifyStat","stat":"attack","amount":{"stage":true},"until":"whileSourceInPlay","target":"self"},{"verb":"ModifyStat","stat":"defense","amount":{"stage":true},"until":"whileSourceInPlay","target":"self"}]},
  {"id":"41027:constant:2","cardCode":"41027","lines":["41027:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotTakeDamage","amount":1,"until":"whileSourceInPlay","target":"self"},{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay","target":"self"}]},
  {"id":"41027:forced:1","cardCode":"41027","lines":["41027:A:3"],"timing":"forced","trigger":"attackResolved","subject":"self","instructions":[{"verb":"Choose","who":"firstPlayer","options":[{"id":"progress","requires":{"kind":"stageProgress","min":1},"instructions":[{"verb":"RemoveProgressFromQuest","amount":{"stage":true}}]},{"id":"staging","instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"}}]}]}]},
  // 41028 Cracked Pillar: in the staging area it can be attacked by the first player in the combat phase, its Threat as its Defense (it has no hit points, so
  // the damage stays on it); 4 damage come off it to travel here.
  {"id":"41028:constant:1","cardCode":"41028","lines":["41028:A:1"],"timing":"constant","condition":IN_STAGING,"instructions":[{"verb":"ModifyStat","stat":"attackableAsEngaged","amount":1,"until":"whileSourceInPlay","target":"self"},{"verb":"ModifyStat","stat":"defense","amount":{"stat":"threat","of":"self"},"until":"whileSourceInPlay","target":"self"}]},
  {"id":"41028:travel:1","cardCode":"41028","lines":["41028:A:2"],"timing":"travel","instructions":[{"verb":"Heal","amount":4,"target":"self"}]},
  // 41029 Cave Torch (the Setup attaches it): exhausting it places up to 3 progress on a Dark location (at least 1: placing none is no use; the exhaust is the first
  // instruction, not a paid cost, so the Forced effect hears it: rules/player/usage.ts does not announce an exhausted cost); after it exhausts,
  // the top encounter card is discarded and an enemy goes to the staging area (as 41015:travel:1).
  {"id":"41029:action:1","cardCode":TORCH,"lines":["41029:A:2"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"exhausted","code":TORCH,"is":false},{"kind":"canPick","pick":DARK_LOCATION}]},"instructions":[{"verb":"Exhaust"},{"verb":"ChooseX","max":[3]},{"verb":"Pick","pick":DARK_LOCATION},{"verb":"PlaceProgressOn","amount":{"x":true},"target":"picked"}]},
  {"id":"41029:forced:1","cardCode":TORCH,"lines":["41029:A:3"],"timing":"forced","trigger":"exhausted","subject":"self","instructions":[{"verb":"MoveEncounterCard","card":"deckTop","to":"discard"},{"verb":"MoveEncounterCard","card":"picked","to":"staging","when":{"kind":"matches","card":"picked","pick":{"type":"enemy","control":"any"}}}]},
  // 41030 Great Cave-troll: no attachments; the excess of its combat damage takes progress off the current quest.
  {"id":"41030:constant:1","cardCode":"41030","lines":["41030:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay","target":"self"}]},
  {"id":"41030:constant:2","cardCode":"41030","lines":["41030:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"excessToQuestProgress","amount":1,"until":"whileSourceInPlay","target":"self"}]},
  // 41031 Cavern Warg: the player it attacks may exhaust the Cave Torch to cancel the attack and send it back to the staging area; as a Shadow card it goes back to
  // the staging area after an attack that destroyed a character.
  {"id":"41031:response:1","cardCode":"41031","lines":["41031:A:1"],"timing":"response","trigger":"enemyAttacks","subject":"self","condition":{"kind":"all","conditions":[{"kind":"controls","code":TORCH},{"kind":"exhausted","code":TORCH,"is":false}]},"instructions":[{"verb":"Exhaust","target":{"kind":"byCode","code":TORCH}},{"verb":"CancelAttack"},{"verb":"ReturnToStaging","target":{"kind":"self"}}]},
  {"id":"41031:shadow:1","cardCode":"41031","lines":["41031:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"},"when":{"kind":"x","min":1}}]}]},
  // 41032 Goblin Tunnels: while in the staging area a Goblin revealed from the encounter deck takes a progress token off the quest; the Shadow adds 1 Attack, 3 to a Goblin.
  {"id":"41032:forced:1","cardCode":"41032","lines":["41032:A:1"],"timing":"forced","trigger":"revealed","byEncounterDeck":true,"subject":GOBLIN_ENEMY,"condition":IN_STAGING,"instructions":[{"verb":"RemoveProgressFromQuest","amount":1}]},
  // 41033 Lightless Passage: the Cave Torch must be exhausted to travel here (rules/interpret/restrictions.ts reads the cost); the Shadow cancels the combat damage dealt to the attacker.
  {"id":"41033:shadow:1","cardCode":"41033","lines":["41033:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"combatDamageCanceled","amount":1,"until":"endOfAttack","target":"attacker"}]},
  // 41034 Branching Paths: in the staging area every Dark location gets +1 Threat; explored, the players look at the top 3 encounter cards, choose 1 to reveal and
  // the other 2 go to the bottom of the deck.
  {"id":"41034:constant:1","cardCode":"41034","lines":["41034:A:1"],"timing":"constant","condition":IN_STAGING,"instructions":[{"verb":"ModifyStat","stat":"threat","amount":1,"until":"whileSourceInPlay","holders":DARK_LOCATION}]},
  {"id":"41034:forced:1","cardCode":"41034","lines":["41034:A:2"],"timing":"forced","trigger":"leftPlay","subject":"self","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"LookAtTop","count":3},{"verb":"PickEncounter","from":"looked"},{"verb":"BottomOtherLooked"},{"verb":"RevealEncounter"}]},
  // 41035 Collapsed Mine: in the staging area no more than 4 progress go on the quest each round; the Shadow raises the defending player's threat by the damage the attack dealt.
  {"id":"41035:constant:1","cardCode":"41035","lines":["41035:A:1"],"timing":"constant","condition":IN_STAGING,"instructions":[{"verb":"ModifyStat","stat":"questProgressCap","amount":4,"until":"whileSourceInPlay","target":"table"}]},
  {"id":"41035:shadow:1","cardCode":"41035","lines":["41035:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"RaiseThreat","amount":{"dealt":true},"who":"actor"}]}]},
  // 41036 Goblin Dungeon: a card is revealed to travel here; explored, the first player may find an ally among the top 5 cards of his deck and put it into play.
  {"id":"41036:response:1","cardCode":"41036","lines":["41036:A:2"],"timing":"response","trigger":"leftPlay","subject":"self","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":5,"cardType":"ally"}},{"verb":"PutIntoPlay","card":"picked","who":"actor"},{"verb":"ShuffleDeck"}]},
  // 41037 Crumbling Stairs: no progress on it in the staging area; explored, the top encounter card is discarded and a location goes into play as the active location.
  {"id":"41037:constant:1","cardCode":"41037","lines":["41037:A:1"],"timing":"constant","condition":IN_STAGING,"instructions":[{"verb":"ModifyStat","stat":"noProgressPlaced","amount":1,"until":"whileSourceInPlay","target":"self"}]},
  {"id":"41037:forced:1","cardCode":"41037","lines":["41037:A:2"],"timing":"forced","trigger":"leftPlay","subject":"self","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"MoveEncounterCard","card":"deckTop","to":"discard"},{"verb":"MoveEncounterCard","card":"picked","to":"activeLocation","when":{"kind":"matches","card":"picked","pick":{"type":"location","control":"any"}}}]},
  // 41038 Crumbling Ruin: each player exhausts a ready character and discards the top card of his deck; a card whose printed cost is the character's remaining hit points
  // or more discards the character.
  {"id":"41038:whenRevealed:1","cardCode":"41038","lines":["41038:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Pick","pick":{"type":"character","control":"you","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"SetX","value":0},{"verb":"DiscardTopOfDeck"},{"verb":"Discard","target":{"kind":"picked"},"when":{"kind":"xReachesRemaining"}}]}]},
  // 41039 Lost in the Dark: the player who controls the Cave Torch exhausts it or stops progress on the quest this phase (the active location still takes it); the Shadow deals 1 damage to the defender.
  {"id":"41039:whenRevealed:1","cardCode":"41039","lines":["41039:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"exhaust","requires":{"kind":"all","conditions":[{"kind":"controls","code":TORCH},{"kind":"exhausted","code":TORCH,"is":false}]},"instructions":[{"verb":"Exhaust","target":{"kind":"byCode","code":TORCH}}]},{"id":"noProgress","requires":{"kind":"controls","code":TORCH},"instructions":[{"verb":"ModifyStat","stat":"noQuestProgress","amount":1,"until":"endOfPhase","target":"table"}]}]}]}]},
  {"id":"41039:shadow:1","cardCode":"41039","lines":["41039:A:2"],"timing":"shadow","instructions":[{"verb":"DamageCard","amount":1,"target":"defender"}]},
  // 41040 Watchful Eyes: attached to a hero of the first player's, it counts as a Condition attachment; at the end of the combat phase an exhausted host has an encounter card revealed.
  {"id":"41040:whenRevealed:1","cardCode":"41040","lines":["41040:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AttachSelf","to":{"kind":"hero","control":"firstPlayer"}}]},
  {"id":"41040:constant:1","cardCode":"41040","lines":["41040:A:1"],"timing":"constant","instructions":[{"verb":"CountsAs","cardType":"attachment","trait":"Condition"}]},
  {"id":"41040:forced:1","cardCode":"41040","lines":["41040:A:1"],"timing":"forced","trigger":"endOfPhase","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Combat"},{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","state":"exhausted"}}]},"instructions":[{"verb":"RevealEncounter"}]},
  // 41051 The Caves of Nibin-Dûm (campaign card). Setup: each player adds "No Time to Waste!" to his hand after his starting hand and mulligan (the campaign checklist deals it),
  // each copy joins the Campaign Pool, Shiny Distraction is shuffled into the encounter deck and joins the pool. Resolution: with the highest final threat under 40 each player earns
  // a Ranger Sense now and carries one over to his next campaign.
  {"id":"41051:campaignSetup:1","cardCode":"41051","lines":["41051:A:2"],"timing":"campaignSetup","instructions":[{"verb":"AddToHandAfterMulligan","code":"41048"},{"verb":"AddToPool","code":"41048","eachPlayer":true},{"verb":"ShuffleIntoEncounterDeck","code":"41042"},{"verb":"AddToPool","code":"41042"}]},
  {"id":"41051:resolution:1","cardCode":"41051","lines":["41051:B:1"],"timing":"resolution","instructions":[{"verb":"Earn","codes":["41049"],"eachPlayer":true,"when":{"kind":"highestThreat","max":39}},{"verb":"CarryOver","codes":["41049"],"eachPlayer":true,"when":{"kind":"highestThreat","max":39}}]},
];

// The played goldens store this shape of "Cannot have attachments." (the card as target); the generated twin writes it without a target.
export const AUTHORED_REPLACES: readonly string[] = ["41030:constant:1"];
