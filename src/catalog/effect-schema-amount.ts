// Amounts in effect records: a printed number, or a number the engine reads when the instruction runs ("X is the number of
// enemies engaged with you", "for each Hobbit hero you control", "equal to that enemy's Threat"). A player never supplies one.
import { z } from "zod";

import { RECORDED_COUNTS } from "./campaign-record.ts";
import { pickSchema } from "./effect-schema-pick.ts";

// The card a stat is read from: the source, its host, the last picked card, the card the event was about (`subject`), or
// the enemy and the defender of the attack in progress.
// `other` is the second card the answered event names: the enemy a character defends against or attacks, the enemy an
// attack destroyed, the defender of an attack that resolved.
// `previous` is the card picked before the last, `discardTop` the top card of the encounter discard pile (the last card put there), `questStage` the main quest card now (Hrogar's Hill, 19083:B:1).
export const cardRefSchema = z.enum(["self", "host", "picked", "subject", "other", "attacker", "defender", "activeLocation", "previous", "discardTop", "questStage", "smaug", "lakeTown"]);

// The decks beside the encounter deck a record names (emce.caves-deck, emce.evil-creatures-deck, mec112.setup-journey-to-the-cross-roads; src/rules/core/piles.ts NAMED_PILES): the one list `pile` of a wilderland verb, the amount `pile` and the condition `pileHas` share.
export const pileNameSchema = z.enum(["caves", "evilCreatures", "spiders", "orcs", "sideQuests", "harad", "greatSpider", "angmarOrcs", "smaug", "investigation"]);

export const amountExprSchema = z.strictObject({
  // How many cards match, from the actor's side ("each enemy engaged with you", "each side quest in the victory display").
  count: pickSchema.optional(),
  // With `count`: cards with the same title count once ("for each different player attachment on attached hero").
  distinct: z.literal(true).optional(),
  // A stat of a card. `printed` reads the printed value, else the current one. `damage`, `resources` and `progress` are
  // tokens on the card; `cost` is its printed cost; `threatCost` a hero's printed threat; `attachments` the cards attached to it; `shadowCards` the shadow cards dealt to an enemy (11188:A:4).
  stat: z.enum(["willpower", "attack", "defense", "threat", "hitPoints", "engagementCost", "questPoints", "damage", "resources", "progress", "cost", "threatCost", "attachments", "shadowCards"]).optional(),
  of: cardRefSchema.optional(),
  // With `stat`: read it from the card in play with this title instead of `of` ("Add Bilbo Baggins' total Willpower").
  ofNamed: z.string().min(1).optional(),
  printed: z.boolean().optional(),
  // With `stat: hitPoints`: the hit points the card has left, its hit points less its damage and at least 0 (damage can pass the hit points of an indestructible enemy, FAQ 3.057: "the remaining hit points of Durin's Bane", 04141:A:1). Read by the flame family.
  remaining: z.literal(true).optional(),
  // The X the event was played for, or the X an earlier instruction fixed (the discarded card's cost).
  x: z.literal(true).optional(),
  // The stage number of the current quest card: its place in the quest deck, counting from 1 ("X is the stage number of the quest", 41027:A:1).
  stage: z.literal(true).optional(),
  // The number of players in the game.
  players: z.literal(true).optional(),
  // The number of players who started the game, an eliminated one included ("per player" on a global value counts "the players who started that scenario", 40004:B:1, 40013:A:2).
  startedPlayers: z.literal(true).optional(),
  // The stage number of the Stormcaller's current quest stage (2 to 4, dcce.stormcallers-area): "X is the Stormcaller's current quest stage" (12028:A:2). 0 with no Stormcaller's area.
  stormcallerStage: z.literal(true).optional(),
  // The part number of the campaign card of the scenario being played: its place in its campaign, counting from 1 ("X is the campaign card's part
  // number", 11176:A:3).
  part: z.literal(true).optional(),
  // The actor's threat, and its tens digit (17084:A:1).
  threat: z.enum(["actor", "tens"]).optional(),
  // Cards in the actor's hand.
  hand: z.literal(true).optional(),
  // The damage the answered event dealt ("cancel that damage", "place that damage on ~ instead").
  dealt: z.literal(true).optional(),
  // The total Threat of all cards in the staging area now, modifiers and the active location's effects read as they are (the staging step's total, rr.staging-area; "raises his threat by the total Threat of all cards in the staging area", 02047:A:1).
  stagingThreat: z.literal(true).optional(),
  // The damage the player attack the effect answers (`enemyAttacked`) would deal its enemy: the attackers' total Attack less the enemy's Defense, 0 at the least ("deal the damage from the attack to 1 character", 04074:A:1). Read by the encounter family.
  attackDamage: z.literal(true).optional(),
  // The damage an attack sent on past its defender (excessToShip), read by the effect the attack leaves for its end ("deal that much damage", 11055:A:2).
  excess: z.literal(true).optional(),
  // The cards attached facedown to the source (Eagles of the Misty Mountains), and the resource tokens other copies of the
  // source card hold above the number on this one (Keeping Count; the most any copy holds), read by src/rules/families/misc/amounts.ts.
  facedown: z.literal(true).optional(),
  resourcesAboveCopies: z.literal(true).optional(),
  // The Victory points of the cards in the victory display added up, read live ("X is the number of victory points in the victory display", 03025:A:3; dwd.the-nameless-fear). Read by src/rules/families/misc/amounts.ts.
  victoryPoints: z.literal(true).optional(),
  // The quest points the active location still needs: its quest points less its progress, 0 with no active location or when it is full ("where X is the active location's remaining quest points", 901302:A:2). Read by src/rules/families/misc/amounts.ts.
  remainingQuestPoints: z.literal("activeLocation").optional(),
  // The amount comes out negative ("gets -1 Willpower for each damaged hero you control"): the value read, below 0.
  negative: z.literal(true).optional(),
  // A scalable card's level, read from the Campaign Log (dcce.scalable-upgradable): the level of the source card. `halved`: half of the value read, rounded up ("half the level of Galdor's
  // Counsel, rounded up", 11184:A:1). Read by the aflame family (src/rules/families/aflame/values.ts).
  level: z.literal(true).optional(),
  halved: z.literal(true).optional(),
  // The value read is divided by this and rounded down before `times` and `plus` apply ("For every 5 resources on Captain Sahír, he makes an additional attack", 12158:A:3).
  every: z.number().int().positive().optional(),
  // amount = value × times + plus, at most `limit`, at least 0.
  times: z.number().int().optional(),
  plus: z.number().int().optional(),
  // Plus the number of cards the campaign card's Setup let the players choose ("X is plus 1 for each of those copies", 11182:A:2): 0 in a game whose Setup chose none.
  plusChosen: z.literal(true).optional(),
  limit: z.number().int().min(0).optional(),
  // The number of enemies grappled with locations in the staging area ("equal to the number of enemies grappled with locations in the staging area", 12055:A:2; src/rules/families/grapple/values.ts).
  grappled: z.literal(true).optional(),
  // The total Threat of the locations to the left of the active location, in its row on the Island Map ("X is the total Threat of all locations to the left of the active location", 12078:A:1; src/rules/families/island/pick.ts).
  islandLeft: z.literal(true).optional(),
  // The most cards that match the pick any one player controls, each player counted from their own side ("X is the number of characters controlled by the player with the most characters", 18023:A:1). Read by the wilderland family.
  mostPerPlayer: pickSchema.optional(),
  // The tens digit of the first player's threat, whoever the actor is ("X is the tens digit of the first player's threat", 19099:A:1, 19103:A:2). Read by the wilderland family.
  firstPlayerTens: z.literal(true).optional(),
  // The Discover value of the active location: its Discover X (a number, or the amount its record reads) with the adjustment a Response made, 0 when it has none ("the Discover value of the active location", 19095:A:3; emce.discover). Read by the wilderland family.
  discoverValue: z.literal(true).optional(),
  // The Investigate value of the active location: its Investigate X (a number, or the amount its record reads) with the cards its flag adds not counted, 0 when it has none or no location is active ("1 more than the Investigate value of the active location", 50727:A:1; the keyword being ignored does not change it). Read by the investigation family.
  investigateValue: z.literal(true).optional(),
  // How many of the cards the running effect discarded from the top of the encounter deck (DiscardEncounterTop) match the pick, still in the discard pile ("for each enemy discarded this way", 12185:A:2). Read by the wilderland family.
  discardedMatching: pickSchema.optional(),
  // The printed cost of the card the source guards: the player cards under it, and the card it is attached to as a guard ("X is that card's cost", 18050:A:1). Read by the wilderland family.
  guardedCost: z.literal(true).optional(),
  // The Siege values added up for this round (docs/brief.md, Attack on Dol Guldur, reading 4): each destroyed enemy and each explored location adds its printed Siege value (TallySiege), "X is the total siege value of each location explored and each enemy destroyed this round" (50907:A:1). 0 once the round is over. Read by the wilderland family.
  siegeTally: z.literal(true).optional(),
  // The damage on the card the answered event is about beyond its printed hit points: "for each excess point of damage dealt" (18049:A:2). Read by the wilderland family.
  excessOf: z.literal("subject").optional(),
  // The resource tokens on the cards that match, added up ("+1 quest point for each resource token on a Raider enemy in play", 12042:A:2).
  resourcesOn: pickSchema.optional(),
  // With `resourcesOn`: the most resource tokens on any one of those cards, not the sum ("X is the highest number of resources on a Raider enemy in play", 12161:A:1). 0 when none matches.
  max: z.literal(true).optional(),
  // The number of cards left in this deck beside the encounter deck ("gets -1 Threat for each facedown card under it", 144030:A:2: the Harad deck lies under The Cross-roads). 0 in a game that did not deal it. Read by the wilderland family.
  pile: pileNameSchema.optional(),
  // What the running effect discarded from the top of decks so far, over every player it acted for: `cost` the combined printed cost of the cards (a card with no printed cost counts 0: "X is the combined printed cost of the discarded cards", 09034:A:1), `types`
  // the number of different card types among them ("for each different card type discarded this way", 09064:A:1). Read by the deck family.
  discarded: z.enum(["cost", "types"]).optional(),
  // The total printed Threat of the cards the running effect discarded from the top of the encounter deck (DiscardEncounterTop), looked at by it: an enemy's or a location's Threat, 0 for any other card ("X is the total Threat of the discarded cards", 10107:A:1). Read by the angmar family.
  discardedThreat: z.literal(true).optional(),
  // The Willpower the character the attack destroyed had in play, kept when the attack damaged it ("raise your threat by the destroyed character's Willpower", 10107:A:2); 0 when none was kept. Read by the angmar family.
  destroyedWillpower: z.literal(true).optional(),
  // The number of quest cards in play: the main quest card, the side quests in the staging area, encounter and player, at least 1 ("X is the number of quest cards in play", 09016:A:1; mec108.side-quests-in-play). Read by the angmar family.
  questCards: z.literal(true).optional(),
  // Every shadow card dealt to an enemy in play, the staging area's and the engaged ones, added up ("where X is the number of shadow cards in play", 10126:A:1). Read by the angmar family.
  shadowCardsInPlay: z.literal(true).optional(),
  // The highest printed cost among the cards in the actor's discard pile, 0 for an empty pile, a card with a printed X cost or no cost (a hero) counting 0 ("the printed cost of the highest cost card in that player's discard pile", 10137:A:1). Read by the angmar family.
  discardPileMaxCost: z.literal(true).optional(),
  // Captured cards (Escape from Mount Gram, read by the captured family): `under` the cards captured underneath the source ("X is the number of captured cards underneath Tunnels of Mount Gram", 10048:A:2), `cardsWith` the cards in play with 1 or more captured cards underneath
  // them ("X is the number of cards in play with 1 or more captured cards underneath them", 10045:A:2), `questsAndSides` the quest cards the players have completed plus the side quests in the victory display ("the number of completed quest cards plus the number of side
  // quests in the victory display", 10174:B:1), `players` the players in the game (Loot the Dungeons, "for each player in the game at every staging area", 10175:A:1).
  captured: z.enum(["under", "cardsWith", "questsAndSides", "players"]).optional(),
  // The pursuit value (mec112.pursuit; `pursuit`), 0 while no tracker is set: "X is the pursuit value" (143069:B:1). Read by the pursuit family.
  pursuit: z.literal(true).optional(),
  // The highest threat among the living players ("X is the threat of the player with the highest threat", 145064:B:1), and the number of living players whose threat is at least this ("+1 Threat for each player with a threat of 35 or higher",
  // 145021:A:1). Read by the grey-company family (src/rules/families/grey-company/amounts.ts).
  highestThreat: z.literal(true).optional(),
  playersAtThreat: z.number().int().positive().optional(),
  // With `stat`: the stat of every card that matches the pick, added up, read live ("X is the total Threat of each engaged enemy", 146026:A:1); with `cost` the printed costs (a card with none counts 0), as the words of 901701:A:2 say them. Read by the black-gate family.
  totalOf: pickSchema.optional(),
  // The damage tokens on the cards that match, added up ("equal to the total damage on each Ship objective he controls", 12148:A:1; read by the sea family, src/rules/families/sea/swap.ts).
  damageOn: pickSchema.optional(),
  // The total printed cost of the allies in the staging area ("X is the total cost of all allies in the staging area", 145074:B:1; a card with no printed cost counts 0). Read by the pelennor family.
  stagedAlliesCost: z.literal(true).optional(),
  // The total printed cost of all the cards attached to the source, those from the top of a deck and any a player attached (a card with no printed cost, a hero or an X cost, counts 0), or this number when nothing is attached ("X is the printed cost of all attached cards on this card. If there are no cards attached, X is 3", 04125:A:2; rr.attachment-cards). Read by the nameless family.
  // The players who share the acting player's staging area: every living player before stages are separate, those at his own area after ("if there is more than one player at this staging area", 901707:A:2; mec109.multiple-staging-areas). Read by the breaking family.
  playersAtStage: z.literal(true).optional(),
  namelessCost: z.number().int().min(0).optional(),
  // The damage that destroys Minas Tirith: its hit points less its damage, plus what the active City Wall can still take first (mec113.minas-tirith, 145046:A:1); a number no damage reaches while Minas Tirith is not in play. Read by the pelennor family.
  minasTirithLeft: z.literal(true).optional(),
  // A count the earlier Resolution recorded in the Campaign Log's notes ("X is the number recorded in the campaign log", 145078:A:1), 0 when none is recorded or the game has no log. Read by the campaign family.
  recorded: z.enum(RECORDED_COUNTS).optional(),
  // The Battle of Lake-town (docs/brief.md, The Battle of Lake-town), read by the smaug family: the damage on Lake-town ("X is the amount of damage on Lake-town", 50222:A:2), and the Victory points in the victory display (50203:B:3).
  lakeTownDamage: z.literal(true).optional(),
  victoryDisplay: z.literal(true).optional(),
});

export const amountSchema = z.union([z.number().int(), amountExprSchema]);

// An amount a verb moves or deals: a printed number is at least 1 (a read one may come to 0, and then nothing happens).
export const positiveAmountSchema = z.union([z.number().int().positive(), amountExprSchema]);

export type AmountExpr = z.infer<typeof amountExprSchema>;
export type Amount = z.infer<typeof amountSchema>;
export type CardRef = z.infer<typeof cardRefSchema>;
