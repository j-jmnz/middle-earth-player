// What a Pick offers in an effect record, and who makes a choice. The same filter counts cards (an amount, a condition),
// names the holders of a constant modifier, and says which cards a trigger hears about.
import { z } from "zod";

// "guardian": the player guarding Gollum (Return to Mirkwood, sotm.guarding-gollum; src/rules/families/guardian/). Resolved by `seatFor` (src/rules/interpret/verbs.ts) and by a Choose (src/rules/windows/choices.ts).
export const whoSchema = z.enum(["actor", "firstPlayer", "guardian"]);

export const sphereSchema = z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]);

// The cards or players a Pick offers. `control` is whose cards: yours, or any player's (`other`: another player's). `from` is
// the zone group: in play (the default), the hand, the discard pile, the deck or the victory display. `state` keeps only ready
// or only exhausted cards. `different` leaves out cards this effect has already picked. `attackableByPicked` keeps the enemies
// the last picked character could attack. `type: player` picks a seat that is still in the game.
export const pickSchema = z.strictObject({
  // `attachment`: a card of the attachment type in play that the chooser controls (141071:A:2). `treachery` and `objective`
  // match an encounter card's printed type ("a treachery card just revealed").
  type: z.enum(["hero", "ally", "character", "enemy", "location", "player", "card", "attachment", "treachery", "objective"]),
  control: z.enum(["you", "any", "other"]),
  // An enemy in the staging area counts too (an enemy "in play"), not only one engaged with a player. With `engaged`, the
  // enemies in the staging area and those engaged as `engaged` says ("in the staging area or engaged with another player").
  staging: z.boolean().optional(),
  // Only an enemy in the staging area ("an enemy in the staging area"), or only one engaged with a player. With `type: card`:
  // any card in the staging area ("choose a card in the staging area").
  stagingOnly: z.boolean().optional(),
  // An enemy in the Stormcaller's area counts too: it is in play, though not in the staging area while the players are at another stage ("if Captain Sahír is in play", 11192:A:3; dcce.stormcallers-area). Read by src/rules/interpret/pick.ts.
  inStormcallerArea: z.literal(true).optional(),
  // Which staging area the staging cards of the filter are in once stages are separate (Breaking of the Fellowship, mec109.multiple-staging-areas):
  // the chooser's own (`own`, the default: "the staging area", "this stage"), the shared area stage 2B deals out (`shared`), or any seat's (`any`:
  // "in any staging area"). Read by src/rules/interpret/pick.ts; a game with one staging area ignores it.
  stagingArea: z.enum(["own", "shared", "any"]).optional(),
  // The cards "at this stage" (Breaking of the Fellowship, mec109.multiple-staging-areas): once stages are separate the chooser's own staging area, the enemies
  // engaged with the chooser and the characters the chooser controls; with one staging area every card in play of the type. Read by src/rules/interpret/pick.ts.
  atStage: z.literal(true).optional(),
  // A character whose printed hit points are fewer than those of the enemy making the attack in progress ("if the defending character has fewer printed hit
  // points than the attacking enemy", 142079:A:2). Read by src/rules/families/breaking/attack.ts.
  fewerHitPointsThan: z.literal("attackingEnemy").optional(),
  // A burden card (Campaign Mode) in play, in the encounter deck or in the encounter discard pile ("choose a burden card in play, in the encounter deck, or
  // in the discard pile", 142074:A:2). Read by src/rules/interpret/pick.ts.
  burden: z.literal(true).optional(),
  // An enemy engaged with the chooser (`you`) or with another player (`other`). `control` is ignored for enemies.
  engaged: z.enum(["you", "other"]).optional(),
  // With `type: card`, the enemies engaged with a player count too ("each Raider card in play", 12046:A:1): the cards in play of every kind, an enemy in an engagement area included.
  engagedEnemies: z.literal(true).optional(),
  // A card of this sphere of influence, for a card picked from the hand or a discard pile.
  sphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral"]).optional(),
  // A card whose printed sphere is the printed sphere of a hero the chooser controls ("an ally that matches the sphere of a hero he controls", 143072:B:1). A neutral card or a Fellowship hero matches
  // no sphere (rr.neutral-cards). Read by the play family.
  heroSphere: z.literal(true).optional(),
  // A card of any of these spheres ("a Leadership or Lore character"), its printed sphere.
  spheres: z.array(sphereSchema).min(1).optional(),
  // A hero with this printed resource icon ("each hero you control with a printed Spirit resource icon").
  printedIcon: sphereSchema.optional(),
  // `loot`: the loot cards of the chooser's that guard a location, under it (The Burglar's Turn, 22024).
  // `encounterDeck`: with `looked`, the cards of the encounter deck the running effect looked at ("Look at the top 10 cards of the encounter deck, discard any number of them", 11202:A:5).
  from: z.enum(["play", "hand", "discard", "deck", "victory", "loot", "encounterDeck"]).optional(),
  // From the deck: only its top cards are looked at. The cards still in the deck are the ones ArrangeTop puts back in order.
  // From the discard pile: only its top cards, the last put there ("While the top card of your discard pile is an event").
  top: z.number().int().positive().optional(),
  // Only the cards the running effect looked at (LookAtTop) or discarded (DiscardFromDeck), still in a deck or a discard pile
  // ("add 1 of those cards to its owner's hand", "Put up to 2 allies discarded by this effect into play"; src/rules/families/deck/each.ts).
  looked: z.boolean().optional(),
  // A card that shares at least one Trait with the source card (`self`: "an ally who shares at least 1 Trait with him"), the
  // source's host (`host`: "if that character shares at least one trait with the attached hero"), or the answered event's
  // other card (`other`: "another enemy that shares a Trait with the enemy just destroyed"), the active location
  // (`activeLocation`: "a location in the victory display that shares a Trait with the active location") or the enemy of the
  // attack in progress (`attackingEnemy`); never that card itself. A Trait gained from an attachment counts
  // (src/rules/families/play/pick.ts, src/rules/families/attack/pick.ts, src/rules/families/sidequests/pick.ts).
  sharesTrait: z.enum(["self", "host", "other", "activeLocation", "attackingEnemy"]).optional(),
  // The printed card type, and a printed cost at most this, for a card picked from a hand, a discard pile or a deck.
  cardType: z.enum(["ally", "attachment", "event", "hero", "player-side-quest", "encounter-side-quest", "treasure", "quest"]).optional(),
  // A side quest of either kind, a player side quest or an encounter side quest ("for each side quest in the victory display", 17117:A:2): the rules call both side quests (mec108.side-quests).
  sideQuest: z.literal(true).optional(),
  // A quest card of any kind, in any zone: a quest stage, an encounter side quest or a player side quest ("quest cards in the victory display", 19125:A:1; mec108.side-quests).
  questCardType: z.literal(true).optional(),
  // A number, or the X of a scalable card: its level in the Campaign Log (`halved`: half of it rounded up) plus 1 for each copy the campaign card's Setup let the players choose
  // ("Put an ally with cost X or less in your discard pile into play", 11201:A:5; dcce.scalable-upgradable). Read by src/rules/interpret/pick.ts.
  maxCost: z.union([z.number().int().min(0), z.strictObject({ level: z.literal(true), halved: z.literal(true).optional(), plusChosen: z.literal(true).optional() })]).optional(),
  minCost: z.number().int().min(0).optional(),
  // A card whose printed cost is odd ("a card with an odd printed cost", 110138:A:3): a card with no printed cost, or with X, is not.
  oddCost: z.literal(true).optional(),
  // The candidates are the cards the last picked attachment may be attached to.
  hostForPicked: z.boolean().optional(),
  // The card is going to be put into play: a unique card already in play cannot be chosen.
  intoPlay: z.boolean().optional(),
  // The printed cost must be the X the event was played for (Stand and Fight).
  costIsX: z.boolean().optional(),
  // Only the topmost card of each discard pile that matches (Erebor Hammersmith).
  topmost: z.boolean().optional(),
  // Who chooses. The actor, unless the card says the first player does.
  who: z.enum(["actor", "firstPlayer"]).optional(),
  // Not the source card itself: "another character". The source is never offered from a hand, a discard pile or a deck.
  other: z.boolean().optional(),
  // The Uruk-hai's Captives (families/captives): `only` picks among them, `free` among those lying under To Isengard! (none held by an enemy), `include` adds them to the heroes or characters the filter picks among ("a hero" may be a Captive, 143016:A:3).
  captive: z.enum(["only", "free", "include"]).optional(),
  // A character committed to the quest (`false`: one that is not).
  committed: z.boolean().optional(),
  // A character that took part in the attack the Response answers (not the card itself).
  participating: z.boolean().optional(),
  // A card that belongs to a sphere of influence: "any sphere" does not include a neutral card (faq.stand-and-fight).
  nonNeutral: z.boolean().optional(),
  // A non-unique card; an enemy with a shadow card dealt to it.
  nonUnique: z.boolean().optional(),
  // A unique card.
  unique: z.boolean().optional(),
  hasShadow: z.boolean().optional(),
  trait: z.string().min(1).optional(),
  // Any of these traits ("a Noldor or Silvan character").
  traits: z.array(z.string().min(1)).min(1).optional(),
  // None of these traits ("a non-Nazgûl enemy").
  notTraits: z.array(z.string().min(1)).min(1).optional(),
  // A card with one of these titles ("a hero or Gandalf" is two picks; "Elladan or Elrohir" is one with two names).
  names: z.array(z.string().min(1)).min(1).optional(),
  // A card that has this keyword, printed or gained (sentinel, ranged).
  keyword: z.enum(["sentinel", "ranged", "restricted", "doomed", "surge"]).optional(),
  state: z.enum(["ready", "exhausted"]).optional(),
  // A card with damage on it (`false`: one with none).
  damaged: z.boolean().optional(),
  // The character attacking or defending in the attack in progress.
  attacking: z.boolean().optional(),
  defending: z.boolean().optional(),
  // A card with an attachment on it; with `trait`, an attachment with that trait. `none`: a card with no such attachment ("Limit 1 per hero": 18048:A:1).
  // `names`: an attachment with one of these titles ("a character with Círdan's Blessing on it", 11201:A:4).
  hasAttachment: z.strictObject({ trait: z.string().min(1).optional(), playerCard: z.boolean().optional(), treasure: z.literal(true).optional(), names: z.array(z.string().min(1)).min(1).optional(), none: z.literal(true).optional() }).optional(),
  // A card attached to the source (`source`), to the source's host (`host`), to the active location (`activeLocation`), or to
  // the defending character (`defender`).
  attachedTo: z.enum(["source", "host", "activeLocation", "defender"]).optional(),
  // An attachment on a card of this type controlled by the chooser (`you`), by another player (`other`) or by anyone ("a Weapon
  // card attached to a hero you control", "an attachment on a hero you control").
  on: z.strictObject({
    type: z.enum(["hero", "character"]),
    control: z.enum(["you", "other", "any"]),
    // The host's current Willpower is at least this ("each character you control with 3 or more Willpower", 900807:A:2).
    minWillpower: z.number().int().min(0).optional(),
  }).optional(),
  // Not the card the source is attached to ("each other questing character" on an attachment).
  notHost: z.boolean().optional(),
  // An enemy that engaged a player this round (a Shadow card: "if it was engaged this round", 142026:A:3).
  engagedThisRound: z.boolean().optional(),
  // Only the card the source is attached to ("attached hero" for a Condition that sets its stat).
  isHost: z.boolean().optional(),
  // Only the source card itself, among the cards that match: "After Soldier of Isengard attacks and destroys a character" is heard by the one copy that attacked (143036:A:2). Read by the fortress family.
  isSource: z.literal(true).optional(),
  // A location that is an active location now (either slot), not one in the staging area (142021:B:2, 142027:A:1).
  active: z.boolean().optional(),
  // A hero with at least one resource in its pool; with at least this many (`minResources`).
  hasResources: z.boolean().optional(),
  minResources: z.number().int().positive().optional(),
  // A card with a Valour ability: one of its records asks for a threat of 40 or more ("an event that has a Valour trigger").
  valour: z.boolean().optional(),
  // A hero whose threat cost is lower than that of the first card the effect picked ("each hero with lower threat cost than the
  // chosen hero").
  lowerThreatCost: z.boolean().optional(),
  // A card whose pool paid resources for the card the answered event is about, when it was played this round ("if you paid
  // all of its cost from a single hero's resource pool, that hero ...").
  paidFor: z.literal("subject").optional(),
  // An enemy whose engagement cost is higher than the chooser's threat.
  aboveThreat: z.boolean().optional(),
  different: z.boolean().optional(),
  attackableByPicked: z.boolean().optional(),
  // A card of any sphere but this one ("non-Fellowship hero", 141051:A:2).
  exceptSphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]).optional(),
  // A character that could attack some enemy engaged with a player, whether or not it is exhausted yet.
  canAttack: z.boolean().optional(),
  // An ally in a discard pile or the hand whose printed cost is X (Stand and Fight): the amount the effect names.
  cost: z.number().int().min(0).optional(),
  // A card that prints no victory points ("a location worth no victory points"); `false`: a card that prints some ("3 locations with victory points", 18078:B:2).
  noVictory: z.boolean().optional(),
  // A character that could be declared as a defender of the attack in progress and is not defending it yet (rr.step-6-4-1).
  canDefend: z.boolean().optional(),
  // An enemy with a facedown shadow card dealt to it.
  facedownShadow: z.boolean().optional(),
  // The enemy making the attack in progress (`false`: any other enemy, "another enemy engaged with you").
  attackingEnemy: z.boolean().optional(),
  // The attachments family's filters (src/rules/families/attachments/pick.ts): a card attached to another card (`false`: one attached
  // to nothing, "If unattached"), a card with the Guarded keyword (a Guarded record), a card with progress tokens on it
  // (`false`: with none, "a location with no progress tokens on it").
  attached: z.boolean().optional(),
  // A card the attachment with this code may be attached to now (its "Attach to" record and Limit per hero: a hero that holds a copy of a
  // "Limit 1 per hero" attachment is not offered), for the campaign cards that attach set-aside copies (01130:A:3, 01130:A:4).
  attachable: z.string().min(1).optional(),
  guarded: z.boolean().optional(),
  progress: z.boolean().optional(),
  // The uncharted family's filters (src/rules/families/uncharted/pick.ts). `uncharted`: a double-sided location lying on its Lost Island side, the keyword Uncharted (dcce.uncharted),
  // `false`: any other card. `minProgress`: a card with at least this many progress tokens ("Remove 4 progress from Lost Island"). `bottom`: from the deck, only its bottom cards
  // ("the bottom 5 cards of your deck").
  uncharted: z.boolean().optional(),
  minProgress: z.number().int().positive().optional(),
  // `doubleSided`: a double-sided location, whichever side it shows: a Lost Island, or a card with a second side in the Grotto or Underwater pairing (dcce.grotto-deck, "After a double-sided location is explored", 12092:B:2).
  doubleSided: z.boolean().optional(),
  // A card whose printed type is not this one ("discards each card in his hand that is not of the chosen type", 12106:A:1). Read by src/rules/families/uncharted/pick.ts.
  notCardType: z.enum(["ally", "attachment", "event", "hero", "player-side-quest", "treasure"]).optional(),
  bottom: z.number().int().positive().optional(),
  // The island family's filter (src/rules/families/island/pick.ts, dcce.island-map): `start`, the faceup left corners of the Island Map at Setup, before one is the active location; `temple`, the Temple column's
  // locations that lie facedown, wherever they are on the map; `secret`, the cards facedown under those locations; `here`, the secret under the active location; `adjacent`, the copies of Lost Island (not Temple of the Deceived) next to the active location.
  island: z.enum(["start", "temple", "secret", "here", "adjacent"]).optional(),
  // The attack family's filters (src/rules/families/attack/pick.ts). A card that prints this keyword, not one it gained ("a hero with the
  // printed Ranged keyword").
  printedKeyword: z.enum(["ranged", "sentinel"]).optional(),
  // An enemy engaged with the player the effect last picked (`picked`: "each enemy engaged with that player"), or one not engaged
  // with the chooser (`notYou`: in the staging area, with `staging`, or engaged with another player).
  engagedWith: z.enum(["picked", "notYou"]).optional(),
  // An attachment on the card the answered event is about ("a Weapon attached to that character").
  onSubject: z.boolean().optional(),
  // A card with at least this many printed hit points ("an enemy with 5 or more printed hit points").
  minHitPoints: z.number().int().positive().optional(),
  // The top card of its discard pile ("While the top card of your discard pile is an ally").
  topOfDiscard: z.boolean().optional(),
  // The misc family's filters (src/rules/families/misc/pick.ts). A card controlled by the player the effect last picked ("each hero
  // controlled by that player"); an attachment attached to the last picked card; a player card (not an encounter card); a
  // character whose current Defense is at most this ("an enemy with 0 Defense"); a card in the hand that was drawn by the
  // resource phase's draw step this round ("choose and discard 1 of those cards"). `controlledBy: host`: a card controlled by the player who
  // controls the source's host ("a character you control", on a Condition attached to a hero by an encounter card that no player controls,
  // 142087:A:2). `nonObjective`: not a card whose printed type is objective ("a non-objective attachment", 142052:A:2: the burden objectives that
  // count as attachments are left out).
  controlledBy: z.enum(["picked", "host"]).optional(),
  nonObjective: z.literal(true).optional(),
  // A card whose printed type is objective ("each hero and objective ally", 12081:A:2: Captain Sahír and Na'asiyah on their objective ally sides).
  objective: z.literal(true).optional(),
  // With `type: objective`: only an objective a player controls (claimed and attached to a hero), not one in the staging area or guarded ("if the players control the Gate Key", 12077:A:2); with `control: "any"` a tower freed of encounters counts too ("the players control 4 Dol Amroth objectives", 11209:B:7).
  controlled: z.literal(true).optional(),
  // The objectives family's filters (src/rules/families/objectives/pick.ts). `hasGuard`: an objective with an encounter card attached to it (guarded by an encounter; `false`: an unguarded objective,
  // "each unguarded objective in the staging area", 12121:A:1). `isGuard`: an enemy attached to an objective as its guard (`false`: "an enemy that is not currently guarding an objective", 12133:A:1).
  hasGuard: z.boolean().optional(),
  isGuard: z.boolean().optional(),
  // An objective guarded by an enemy attached to it with this trait (`guardedByTrait`), or by none (`notGuardedByTrait`): "a Clue card not attached to a Mordor enemy" (900401:A:2), "Clue cards attached to Mordor enemies" (900401:A:3).
  guardedByTrait: z.string().min(1).optional(),
  notGuardedByTrait: z.string().min(1).optional(),
  // An enemy attached as the guard of an objective with this trait: a Mordor enemy "with at least 1 Clue card attached" (900405:A:1; the Clue is the guarded objective, the enemy its guard).
  guardsTrait: z.string().min(1).optional(),
  // A character committed to this round's quest, though the quest's resolution already cleared its commitment: "any hero committed to the quest" in the Response to the players questing successfully (02014:A:2). Read in a game whose
  // records read `questSucceeded` (families/costs/pay.ts noteEvent keeps who committed).
  questedThisRound: z.literal(true).optional(),
  // A character whose code the Campaign Log marks "determined" (`campaignFacts.angmar.determined`, Angmar Awakened): "each character who is 'determined' in the Campaign Log" (10172:A:1). Read by the angmar family.
  determined: z.literal(true).optional(),
  // A Reanimated Dead (The Dread Realm, mec108.reanimated-dead): a player card facedown as an Undead enemy ("each Reanimated Dead", 101160:A:1). Read by the angmar family.
  reanimated: z.literal(true).optional(),
  // With `type: card`: every card in play of any kind, the attachments on quest cards, enemies and characters included, and the cards of the staging area, the active location and the quest card ("Sorcery cards in play", 10153:A:2). Read by the angmar family.
  allInPlay: z.literal(true).optional(),
  // A card with the printed title of the defending character in the attack in progress ("a copy of the defending character in your discard pile", 101160:A:2). Read by the angmar family.
  copyOfDefender: z.literal(true).optional(),
  // A card that has the Safe keyword (Across the Ettenmoors, mec108.safe; its record has the constant verb Safe): "a location with the safe keyword" (10075:A:2), for an objective-location (`type: objective`). Read by the angmar family.
  safe: z.literal(true).optional(),
  // A card with at least this many damage tokens on it ("while it has 3 or more damage on it", 10075:A:1). Read by the angmar family.
  minDamage: z.number().int().positive().optional(),
  // A card with at most this many hit points remaining: its hit points as modified now less the damage on it ("an Undead enemy with 2 or less remaining hit points", 10187:A:3). Read by the angmar family.
  maxHitPointsLeft: z.number().int().min(0).optional(),
  onPicked: z.boolean().optional(),
  // A player card (`false`: an encounter card, "all encounter cards are immune", 12172:A:2).
  playerCard: z.boolean().optional(),
  maxDefense: z.number().int().min(0).optional(),
  // A character whose current Attack is at least this ("a character with at least 2 Attack", 12074:A:2).
  minAttack: z.number().int().min(0).optional(),
  drawn: z.boolean().optional(),
  // Of the cards that match every other filter, only those with the most damage on them (all of them when tied): "the hero you control
  // with the most damage on it" (01137:A:2). Read by pickCandidates (src/rules/interpret/pick.ts).
  mostDamaged: z.literal(true).optional(),
  // A card with at most this many attachments on it ("a Dale character without an attachment" is read after the attachment arrived: 1).
  maxAttachments: z.number().int().min(0).optional(),
  // Not a card with one of these titles ("a character in play (other than Bilbo Baggins)").
  exceptNames: z.array(z.string().min(1)).min(1).optional(),
  // A card dealt into a named deck with a discard pile of its own ("an enemy from the Evil Creatures deck", 18066:B:3; emce.evil-creatures-deck): in play or not, whichever zone it lies in. Read by the wilderland family (src/rules/families/wilderland/pick.ts).
  fromDeck: z.literal("evilCreatures").optional(),
  // An Objective-Location (`objectiveLocation`, 18028:A:1; ledger line 18029:A:2): a card whose printed type line is Objective-Location, in the staging area or the active location. `guardsObjectiveLocation`: an encounter card attached to one as its guard ("each card guarding one").
  // Read by the wilderland family (src/rules/families/wilderland/pick.ts); use them with `type: card`.
  objectiveLocation: z.literal(true).optional(),
  guardsObjectiveLocation: z.literal(true).optional(),
  // Lost in Mirkwood's stages 3 and 4 (ledger lines 18074:B:1, 18075:B:1/B:2, 18076:B:1). `guardsHero`: an enemy that guards a hero (CarryAwayHero), in play or not. `hasFacedownUnder`: a card with a facedown player card under it (PlaceHandUnder), wherever the card is now.
  // `facedownUnder`, in an `eachAttached`: the cards counted are the facedown player cards under the holder, not its attachments. `nemesis`: the enemy 18076:A:1 named the nemesis, until it leaves play. Read by the wilderland family (src/rules/families/wilderland/pick.ts); use them with `type: card`.
  guardsHero: z.literal(true).optional(),
  hasFacedownUnder: z.literal(true).optional(),
  facedownUnder: z.literal(true).optional(),
  nemesis: z.literal(true).optional(),
  // The Ghost of Framsburg (ledger lines 19097:A:2, 19098:A:2, 19109:B:1, 12191:A:1; emce.loot). `lootKeyword`: an objective that prints the Loot keyword (its record has the constant verb Loot), "the Loot objectives the players control" with `controlled`.
  // `engagedWithUnique` (with `type: player`): a player who has a unique enemy engaged with them ("Choose a player that is engaged with a unique enemy", 12191:A:1). Read by the wilderland family (src/rules/families/wilderland/pick.ts).
  lootKeyword: z.literal(true).optional(),
  engagedWithUnique: z.literal(true).optional(),
  // Roam Across Rhovanion's guards (ledger lines 19049:B:1, 19049:B:3, 19050:B:1, 19048:B:3, 19050:B:3). `guardsCard`: an encounter card that guards a card, as the guard of an objective or as the keeper of a player card held under it (Hobgoblin). `guardsNamed`: an encounter card attached
  // to the objective with this title as its guard. Read by the wilderland family (src/rules/families/wilderland/pick.ts).
  guardsCard: z.literal(true).optional(),
  guardsNamed: z.string().min(1).optional(),
  // Only an enemy the chooser may engage: not one that cannot be engaged, nor one barred to this seat ("each player chooses an enemy in the staging area and engages it", 19046:A:1; a player with no such enemy has none to engage).
  engageable: z.literal(true).optional(),
  // The effect discards the card chosen, for a condition that asks before the discard (a canPick ahead of DiscardFromHand): a card that player card effects cannot discard (18026:A:1) is left out. A Pick followed by DiscardPicked is known without it (families/wilderland/pick.ts).
  discarded: z.literal(true).optional(),
  // Captured cards (Escape from Mount Gram, read by the captured family): the cards a pick starts from are `underSelf` the cards captured underneath the source (any owner's; one the owner cannot put into play is left out), `rescued` the cards the last rescue
  // put into hands that are still there (10044:A:2), `hosts` the encounter cards in play in the asking player's staging area (the staged cards, the active location and the enemies engaged with a player there; 10051:A:1).
  captured: z.enum(["underSelf", "rescued", "hosts"]).optional(),
  // With `type: card`: only the quest cards in play the asking player can name: their current quest stage, the encounter side quests in their staging area and the player side quests in the quest areas ("a quest card in play", 10176:A:1).
  questCard: z.literal(true).optional(),
  // The black-gate family's filters (src/rules/families/black-gate/pick.ts). `embassy`: a card of the Embassy from the Dark Tower's faceup row that is not paired yet, the player cards placed in front of the players (`player`) or the encounter cards placed faceup (`encounter`, 146072:B:1).
  // `highestThreat`: of the cards that matched, those with the highest current Threat, a card with none counting 0 ("the highest threat encounter card remaining"); every one when tied, and the chooser decides.
  embassy: z.enum(["player", "encounter"]).optional(),
  highestThreat: z.literal(true).optional(),
  // The mount-doom family's filter (src/rules/families/mount-doom/pick.ts): a card discarded for the Fortitude test in progress that still lies in the encounter discard pile ("choose an encounter card discarded for this test", 146049:A:3).
  fortitudeDiscarded: z.literal(true).optional(),
  // The sidequests family's filters (src/rules/families/sidequests/pick.ts).
  // A card with the same title as the active location ("each location in the staging area with the same title as the active location").
  // `picked`: a card with the same title as the last card the running effect picked, never that card itself ("if there is a copy of that enemy in the staging area", 146019:A:1; Pick, canPick and matches read it).
  sameTitleAs: z.enum(["activeLocation", "picked"]).optional(),
  // A character committed to a side quest (`sideQuest`), or to the current quest (`mainQuest`).
  committedTo: z.enum(["sideQuest", "mainQuest"]).optional(),
  // With `from: loot`, only the loot guarding the card the answered event is about.
  guardsSubject: z.boolean().optional(),
  // A card with at least this many Restricted attachments on it ("each of your heroes has at least 2 restricted attachments").
  restrictedAttachments: z.number().int().positive().optional(),
  // The play family's filter (src/rules/families/play/pick.ts): the character with more damage on it than each other character in play, a tie for the most matching none ("If a character (including Wilyador) has more damage than each other character", 02068:A:2).
  soleMostDamaged: z.literal(true).optional(),
  // The nightmare family's filters (read in src/rules/interpret/pick.ts): a character whose current Willpower is at most this, a value below 0
  // counting as 0 ("is discarded if its Willpower is 0", 900102:A:1).
  maxWillpower: z.number().int().min(0).optional(),
  // A card a player controls with a copy (a card of the same title) in that player's discard pile ("Discard each card you control that has at
  // least 1 copy of itself in your discard pile", 900309:A:2). `"owner"`: a card with its title in its OWNER's discard pile, itself counting when it lies there ("if there is a card that has the same title in its owner's discard pile", 09066:A:2; "in its owner's
  // discard pile", 09061:A:2, 09065:A:3).
  copyInDiscard: z.union([z.literal(true), z.literal("owner")]).optional(),
  // The grapple family's filter (src/rules/families/grapple/values.ts): a card that shows this side ("if Sea Serpent (Enraged side) is in play", side B, 11194:B:6).
  side: z.enum(["A", "B"]).optional(),
  // The aflame family's filters (src/rules/families/aflame/pick.ts). `aflame`: a location that prints the Aflame keyword (`false`: any other card). `lowestAflame`: of the cards that match, only
  // those whose Aflame value is the lowest ("the Aflame location in play with the lowest Aflame value", 11036:B:1); every one of them when tied, and then the chooser decides.
  aflame: z.boolean().optional(),
  lowestAflame: z.literal(true).optional(),
  // Of the cards that match, only those with the highest Attack, as the table shows it ("the engaged Ship enemy with the highest Attack", 12131:A:1); every one of them when tied, and then the chooser decides.
  // Read by the sea family (src/rules/families/sea/ramming.ts).
  highestAttack: z.literal(true).optional(),
  // Of the cards that match, only those with the lowest Attack or the lowest Threat, as the table shows it ("the lowest Attack Harad enemy engaged with you", 144036:A:2; "the lowest Threat Harad enemy in the staging area", 144038:A:2); every one of them
  // when tied, and then the chooser (the player who reveals) decides. Read by the harad family (src/rules/families/harad/pick.ts).
  lowestAttack: z.literal(true).optional(),
  lowestThreat: z.literal(true).optional(),
  // Of the cards that match, only those with the highest printed cost, a card with no printed cost counting as 0 ("discard the highest cost attachment you control", 145041:A:1); every one of them when tied, and then the
  // chooser decides. Read by the costs family (src/rules/families/costs/pick.ts).
  highestCost: z.literal(true).optional(),
});

export type PickSpec = z.infer<typeof pickSchema>;
