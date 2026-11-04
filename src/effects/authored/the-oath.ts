import type { Effect } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as ANDUIN } from "./journey-along-the-anduin.ts";
import { AUTHORED_EFFECTS as PASSAGE } from "./passage-through-mirkwood.ts";
import { reprint } from "./reprint.ts";

// Records for The Oath (Mirkwood Paths part 4 and The Dark of Mirkwood part 1, campaign card 41050): the encounter cards no template reads,
// the three quest cards and the campaign card. The boons and burdens it deals or earns (the Adaptations 41044 to 41047, Stalking Goblin 41041,
// Guilty Conscience 41043) are in pool/TDoM.ts. Every line is read from the scan ledger (data/printed/mirkwood-paths.json).
// Rules: rr.step-3-3, rr.search, rr.travel, rr.engaged, rr.cancel, rr.first-player, rr.campaign-cards, rr.limits (data/rules/entries.json).
const READY_CHARACTER = {"type":"character","control":"you","state":"ready"} as const;
const EXHAUSTED_CHARACTER = {"type":"character","control":"you","state":"exhausted"} as const;
const QUESTING_CHARACTER = {"type":"character","control":"you","committed":true} as const;
const STAGING_LOCATIONS = {"type":"location","control":"any","stagingOnly":true} as const;
const GOBLIN_ENEMY = {"type":"enemy","control":"any","trait":"Goblin"} as const;

// The records of the Passage and Anduin cards this scenario prints again (the ledger lines are identical, reprint.test.ts).
const TWINS: readonly Effect[] = [...PASSAGE, ...ANDUIN];

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 41001 After the Raid: the piles place The Eaves of Mirkwood in the staging area and set Goblin Troop aside; this record describes them (as 01119:setup:1).
  {"id":"41001:setup:1","cardCode":"41001","lines":["41001:A:1"],"timing":"setup","instructions":[{"verb":"AddToStaging","code":"41010"},{"verb":"SetAside","code":"41019"},{"verb":"ShuffleEncounterDeck"}]},
  // 41002 Mirkwood Forest: each player finds a Forest location; the stage cannot be defeated until a Goblin Trail is in the victory display.
  {"id":"41002:whenRevealed:1","cardCode":"41002","lines":["41002:B:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"SearchMove","trait":"Forest","type":"location","to":"staging"}]},{"verb":"ShuffleEncounterDeck"}]},
  {"id":"41002:constant:1","cardCode":"41002","lines":["41002:B:2"],"timing":"constant","condition":{"kind":"inVictory","code":"41014","is":false},"instructions":[{"verb":"Restrict","what":"advance"}]},
  // 41003 The Rearguard: the first player adds the set-aside Goblin Troop, each other player finds a Goblin enemy; the stage cannot be defeated while Goblin
  // Troop is in play, and defeating the last stage wins the game.
  {"id":"41003:whenRevealed:1","cardCode":"41003","lines":["41003:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AddSetAsideToStaging","code":"41019"},{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"SearchMove","trait":"Goblin","type":"enemy","to":"staging","when":{"kind":"not","condition":{"kind":"firstPlayer"}}}]}]},
  {"id":"41003:constant:1","cardCode":"41003","lines":["41003:B:1"],"timing":"constant","condition":{"kind":"inPlay","code":"41019","is":true},"instructions":[{"verb":"Restrict","what":"advance"}]},
  // 41008 Spiders of Mirkwood: +1 Attack for each exhausted character of the player it is engaged with; the Shadow exhausts a character (and deals it 2 damage when undefended).
  {"id":"41008:constant:1","cardCode":"41008","lines":["41008:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"engaged"},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"count":EXHAUSTED_CHARACTER},"until":"whileSourceInPlay","target":"self"}]},
  {"id":"41008:shadow:1","cardCode":"41008","lines":["41008:A:2"],"timing":"shadow","instructions":[{"verb":"Pick","pick":READY_CHARACTER},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"DamageCard","amount":2,"target":"picked","when":{"kind":"undefended"}}]},
  // 41009 Great Spider: the player it engages exhausts a character; the Shadow deals 1 damage to an exhausted character.
  {"id":"41009:forced:1","cardCode":"41009","lines":["41009:A:1"],"timing":"forced","trigger":"engaged","subject":"self","instructions":[{"verb":"Pick","pick":READY_CHARACTER},{"verb":"Exhaust","target":{"kind":"picked"}}]},
  {"id":"41009:shadow:1","cardCode":"41009","lines":["41009:A:2"],"timing":"shadow","instructions":[{"verb":"Pick","pick":EXHAUSTED_CHARACTER},{"verb":"DamageCard","amount":1,"target":"picked"}]},
  // 41010 The Eaves of Mirkwood: while it is the active location the table holds encounterUncancelable (families/encounter/cancel.ts).
  {"id":"41010:constant:1","cardCode":"41010","lines":["41010:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"activeLocation"},"instructions":[{"verb":"ModifyStat","stat":"encounterUncancelable","amount":1,"until":"whileSourceInPlay","target":"table"}]},
  // 41011 Tangled Grove: its Threat is the number of locations in the staging area; each player discards a card at random to travel here.
  {"id":"41011:constant:1","cardCode":"41011","lines":["41011:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"threat","amount":{"count":STAGING_LOCATIONS},"until":"whileSourceInPlay"}]},
  {"id":"41011:travel:1","cardCode":"41011","lines":["41011:A:2"],"timing":"travel","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"DiscardRandomFromHand","amount":1}]}]},
  // 41012 Forest Gate: the first player may draw 2 cards after the players travel here (as 01100:response:1).
  ...reprint(TWINS, "01100", "41012"),
  // 41013 Spider Den: any player may use this Quest Action to bring a Spider from the deck or discard pile into play engaged with him and discard Spider Den.
  {"id":"41013:action:1","cardCode":"41013","lines":["41013:A:1"],"timing":"action","anyPlayer":true,"condition":{"kind":"all","conditions":[{"kind":"phase","is":"Quest"},{"kind":"searchable","trait":"Spider"}]},"instructions":[{"verb":"SearchMove","trait":"Spider","type":"enemy","to":"engaged"},{"verb":"Discard","target":{"kind":"self"}}]},
  // 41014 Goblin Trail: a card is revealed to travel here (as 01078:travel:1); explored, it puts 6 progress on the current quest.
  {"id":"41014:response:1","cardCode":"41014","lines":["41014:A:2"],"timing":"response","trigger":"leftPlay","subject":"self","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"ProgressQuest","amount":6}]},
  // 41015 Abandoned Camp: the first player discards the top card of his deck after the players travel here, an ally goes into play; the Travel cost
  // discards the top card of the encounter deck, an enemy goes to the staging area.
  {"id":"41015:response:1","cardCode":"41015","lines":["41015:A:1"],"timing":"response","trigger":"traveled","instructions":[{"verb":"DiscardFromDeck","amount":1},{"verb":"Pick","pick":{"type":"card","control":"you","from":"discard","looked":true,"cardType":"ally"}},{"verb":"PutIntoPlay","card":"picked","who":"actor"}]},
  {"id":"41015:travel:1","cardCode":"41015","lines":["41015:A:2"],"timing":"travel","instructions":[{"verb":"MoveEncounterCard","card":"deckTop","to":"discard"},{"verb":"MoveEncounterCard","card":"picked","to":"staging","when":{"kind":"matches","card":"picked","pick":{"type":"enemy","control":"any"}}}]},
  // 41016 Driven by Shadow: every enemy and location in the staging area gets +1 Threat; surge when there is no card there (as 01092).
  ...reprint(TWINS, "01092", "41016"),
  // 41017 Surprising Speed: each player returns an engaged enemy to the staging area; with none returned it gains surge and doomed 1. The Shadow
  // adds Attack and returns the attacker to the staging area after the attack.
  {"id":"41017:whenRevealed:1","cardCode":"41017","lines":["41017:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"ReturnToStaging","target":{"kind":"engagedEnemies","who":"actor","pick":"choose"}}]},{"verb":"GainSurge","when":{"kind":"noneReturned"}},{"verb":"Doomed","amount":1,"when":{"kind":"noneReturned"}}]},
  // 41018 Caught in a Web: as 01080 (the highest threat player attaches it; its hero does not ready unless the pool pays 2).
  ...reprint(TWINS, "01080", "41018"),
  // 41019 Goblin Troop: no attachments; while engaged it gives each other Goblin enemy engaged with the same player +1 Attack and +1 Defense; the Shadow adds 2 Attack.
  {"id":"41019:constant:1","cardCode":"41019","lines":["41019:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay","target":"self"}]},
  {"id":"41019:constant:2","cardCode":"41019","lines":["41019:A:2"],"timing":"constant","condition":{"kind":"sourceIn","zone":"engaged"},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","holders":{"type":"enemy","control":"any","engaged":"you","trait":"Goblin","other":true}},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","holders":{"type":"enemy","control":"any","engaged":"you","trait":"Goblin","other":true}}]},
  // 41020 Goblin Sniper: as 01083 (cannot be optionally engaged while another enemy is in the staging area; damages a character of each player if it is still there after combat).
  ...reprint(TWINS, "01083", "41020"),
  // 41021 Goblin Runners (Surge): the Shadow makes the attacker attack again once this attack is over, with a new shadow card (as 141073:shadow:1).
  {"id":"41021:shadow:1","cardCode":"41021","lines":["41021:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ImmediateAttack"}]}]},
  // 41022 Goblintown Scavengers: each player's top card is discarded and its printed cost adds to this enemy's Threat until the end of the phase.
  {"id":"41022:whenRevealed:1","cardCode":"41022","lines":["41022:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"SetX","value":0},{"verb":"DiscardTopOfDeck"},{"verb":"ModifyStat","stat":"threat","amount":{"x":true},"until":"endOfPhase","target":"self"}]}]},
  // 41023 Wild Wargs: after it engages a player, the top card of the encounter deck is discarded; a Goblin enemy goes into play engaged with him.
  {"id":"41023:forced:1","cardCode":"41023","lines":["41023:A:1"],"timing":"forced","trigger":"engaged","subject":"self","instructions":[{"verb":"MoveEncounterCard","card":"deckTop","to":"discard"},{"verb":"MoveEncounterCard","card":"picked","to":"engaged","when":{"kind":"matches","card":"picked","pick":GOBLIN_ENEMY}}]},
  // 41024 Goblins are Upon You!: each player finds a Goblin enemy and it engages him (this effect cannot be canceled: the card waits in the staging area
  // while it resolves); the Shadow adds Attack for each Goblin enemy engaged with the defending player.
  {"id":"41024:whenRevealed:1","cardCode":"41024","lines":["41024:A:1"],"timing":"whenRevealed","uncancelable":{"kind":"sourceIn","zone":"staging"},"instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"SearchMove","trait":"Goblin","type":"enemy","to":"engaged"}]},{"verb":"ShuffleEncounterDeck"}]},
  {"id":"41024:shadow:1","cardCode":"41024","lines":["41024:A:2"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"count":{"type":"enemy","control":"any","engaged":"you","trait":"Goblin"}},"until":"endOfAttack","target":"attacker"}]},
  // 41025 Eyes in the Dark (Doomed 1): each player raises his threat by 1 for each questing character or discards a questing character; the Shadow discards an ally when undefended.
  {"id":"41025:whenRevealed:1","cardCode":"41025","lines":["41025:A:2"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"threat","instructions":[{"verb":"RaiseThreat","amount":{"count":QUESTING_CHARACTER},"who":"actor"}]},{"id":"discard","requires":{"kind":"canPick","pick":QUESTING_CHARACTER},"instructions":[{"verb":"Pick","pick":QUESTING_CHARACTER},{"verb":"Discard","target":{"kind":"picked"}}]}]}]}]},
  {"id":"41025:shadow:1","cardCode":"41025","lines":["41025:A:3"],"timing":"shadow","instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you"},"when":{"kind":"undefended"}},{"verb":"DiscardPicked","when":{"kind":"undefended"}}]},
  // 41026 Obsidian Arrows: 2 damage to a character of the revealing player; the Shadow deals the defending player 1 damage on a character.
  {"id":"41026:whenRevealed:1","cardCode":"41026","lines":["41026:A:1"],"timing":"whenRevealed","instructions":[{"verb":"Pick","pick":{"type":"character","control":"you"}},{"verb":"DamageCard","amount":2,"target":"picked"}]},
  {"id":"41026:shadow:1","cardCode":"41026","lines":["41026:A:2"],"timing":"shadow","instructions":[{"verb":"Pick","pick":{"type":"character","control":"you"}},{"verb":"DamageCard","amount":1,"target":"picked"}]},
  // 41050 The Oath (campaign card). Setup: each player chooses an Adaptation and attaches it to a hero of his (they join the Campaign Pool), Stalking Goblin
  // is shuffled into the encounter deck and added to the pool. Response: a resource token is placed on the card at the end of each round (a Response is
  // optional). Resolution: the tokens are recorded, and 6 or more earn Guilty Conscience.
  {"id":"41050:campaignSetup:1","cardCode":"41050","lines":["41050:A:2"],"timing":"campaignSetup","instructions":[{"verb":"ChooseCards","codes":["41044","41045","41046","41047"],"who":"eachSeat","to":"hero"},{"verb":"ShuffleIntoEncounterDeck","code":"41041"},{"verb":"AddToPool","code":"41041"}]},
  {"id":"41050:response:1","cardCode":"41050","lines":["41050:A:3"],"timing":"response","trigger":"endOfRound","instructions":[{"verb":"PlaceToken","amount":1}]},
  {"id":"41050:resolution:1","cardCode":"41050","lines":["41050:B:1"],"timing":"resolution","instructions":[{"verb":"Earn","codes":["41043"],"when":{"kind":"tokens","code":"41050","min":6}}]},
];

// The played goldens store this shape of "Cannot have attachments." (the card as target); the generated twin writes it without a target.
export const AUTHORED_REPLACES: readonly string[] = ["41019:constant:1"];
