// The sea family (phase 39): the vocabulary of the ships, the Heading card, the Sailing test and the Corsair deck that the Dream-chaser scenarios
// share. Simple verbs; effect-schema-verbs.ts composes them and src/rules/families/sea/index.ts runs them (the helpers are beside it in src/rules/families/sea/). The rules are
// the Dream-chaser Campaign Expansion rulebook (dcce.*, data/rules/entries.json).
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";
import { verbFlags } from "../verb-flags.ts";

const VERBS = [
  // Setup: "Prepare the Corsair deck" (dcce.corsair-deck). Every non-ship enemy still in the encounter deck goes to the Corsair deck, which is
  // then shuffled; from now on a non-ship enemy that would be discarded goes to the Corsair discard pile, and the Corsair deck refills from it.
  // `trait` (The Hunt for the Dreadnaught, reading 6): only the non-ship enemies with this trait join the Corsair deck, and only they are discarded to the Corsair discard pile (the Sea Monster stays an encounter enemy).
  z.strictObject({ verb: z.literal("PrepareCorsairDeck"), trait: z.string().min(1).optional(), ...when }),
  // "Shuffle the Corsair deck and Corsair discard pile into the encounter deck" (dcce.from-sea-to-land, The City of Corsairs stage 2B): the Corsair
  // deck is gone from then on, so a non-ship enemy is discarded to the encounter discard pile as in any other game.
  z.strictObject({ verb: z.literal("EndCorsairDeck"), ...when }),
  // Setup: "Players prepare their fleet" (dcce.prepare-your-fleet). Each player in turn takes one of the six ship-objectives set aside (the
  // Dream-chaser is forced on the last player who has not got it; a lone player takes the Dream-chaser and one other), the unused ships leave the
  // game, and the Heading card is attached to the Dream-chaser, set to on-course. A seat with a choice asks it as a choice of cards.
  // `own` (The Hunt for the Dreadnaught, docs/brief.md, The Hunt for the Dreadnaught, reading 4): the ships are the box's own unique ship-objectives set aside; each seat takes one, in player order (a lone player one), there is no
  // Dream-chaser and no Heading card, and the unused ships stay set aside.
  verbFlags(z.strictObject({ verb: z.literal("PrepareFleet"), own: z.literal(true).optional(), ...when }), { setupRuns: "top" }),
  // "Shift your heading off-course" / "on-course" (dcce.heading): one step toward Storm / toward Sun, never past either end. Nothing happens in a
  // game with no Heading card.
  z.strictObject({ verb: z.literal("ShiftHeading"), direction: z.enum(["onCourse", "offCourse"]), ...when }),
  // "Reveal the top card of the Corsair deck and put it into play, engaged with you" (dcce.boarding, dcce.corsair-deck): `count` cards (1 by
  // default) for the actor, or for each player (`eachSeat`), or for one player the first player names (`anyPlayer`: "One player must reveal the top card of the Corsair deck and engage it", 12154:A:1; the only
  // player takes it without being asked). The deck refills from its discard pile when it runs out.
  // `shadow` (Descendant of Castamir, Ramming Ship: "deal each of them 1 shadow card"): each card put into play is dealt this many shadow cards at once (docs/brief.md, The Hunt for the Dreadnaught, reading 22).
  z.strictObject({ verb: z.literal("RevealCorsair"), count: positiveAmountSchema.optional(), who: z.enum(["actor", "eachSeat", "anyPlayer"]).optional(), shadow: z.number().int().positive().optional(), ...when }),
  // "Engages the last player" (dcce.last-player): the source enemy, in the staging area, engages the player to the right of the first player.
  z.strictObject({ verb: z.literal("EngageLastPlayer"), ...when }),
  // Engine use: "Boarding X" resolves for the ship-enemy that engaged the actor from the staging area (dcce.boarding), in a frame under the Responses to the engagement.
  z.strictObject({ verb: z.literal("Board"), ...when }),
  // "Search the encounter deck and discard pile for the Ship enemy with the highest Threat and add it to the staging area" (11021:A:1): the `count`
  // Ship enemies with the highest Threat found there are added to the staging area, without being revealed. Of cards tied on Threat that are not
  // copies of one card the first player chooses. The encounter deck is not shuffled by this verb.
  z.strictObject({ verb: z.literal("SearchShips"), count: positiveAmountSchema, ...when }),
  // Campaign Setup: "Each player chooses a Modification boon for each of their ship-objectives and attaches it to that ship-objective" (11171:A:2).
  // Of the cards with these codes set aside, each player in player order takes one for each ship-objective they control, in the order the ships
  // were taken, and attaches it to that ship (a card dealt on its Upgraded side if the log says it is upgraded). Resolved after the quest card's
  // Setup has prepared the fleet (ScenarioDefinition.afterSetup).
  verbFlags(z.strictObject({ verb: z.literal("FitShips"), codes: z.array(z.string().min(1)).min(1), ...when }), { setupRole: "afterSetup" }),
  // Campaign Setup: "For each ship-objective, its controller may deal 2 damage to it to add 1 resource to a hero's resource pool" (11171:A:2). In
  // player order, the controller of each ship chooses to trade or keep; a trade deals `damage` to the ship and adds `resources` to the pool of a hero
  // they choose (`ship` and `hero` are engine use: the ship being traded for and the hero chosen so far).
  verbFlags(z.strictObject({ verb: z.literal("TradeShipDamage"), damage: z.number().int().positive(), resources: z.number().int().positive(), ship: z.string().optional(), hero: z.string().optional(), ...when }), { setupRole: "afterSetup" }),
  // Deals `amount` damage to the last picked card, a Ship objective, as the encounter or campaign card whose effect it is: a ship is immune to player card
  // effects, not to this ("Excess damage from this attack is dealt to a Ship objective you control", 11055:A:2).
  z.strictObject({ verb: z.literal("DamageShip"), amount: positiveAmountSchema, ...when }),
  // "Discard a random card from your hand and place resources on ~ equal to that card's printed cost" (11062:A:1): the actor's hand, a card chosen by the
  // seed, discarded as any random discard is; the source enemy gets that many resources (a card printing no cost, or X, none).
  z.strictObject({ verb: z.literal("PlunderHand"), ...when }),
  // "Name a card" (110139:B:5): the actor chooses the title of any card of the game, wherever it is (every card the game holds is offered, so the choices say
  // nothing about what the decks hold), written into the effect as its named card for DiscardFromAnyDeck to read.
  z.strictObject({ verb: z.literal("NameCard"), ...when }),
  // "Discard the top N cards of any deck" (110139:A:4, B:5): the actor chooses a deck (each player's deck that holds a card, the encounter deck, the Corsair deck)
  // and its top `count` cards are discarded to its discard pile. When a card was named, the effect's X is 1 if one of the cards discarded bears that title, else 0.
  z.strictObject({ verb: z.literal("DiscardFromAnyDeck"), count: z.number().int().positive(), ...when }),
  // Setup: "Shuffle Crowley into the Corsair deck" (11171:A:2): the card joins the Corsair deck the scenario deals, which the quest card's Setup
  // then shuffles (dcce.corsair-deck). Dealt when the game starts (src/campaign/start.ts).
  z.strictObject({ verb: z.literal("ShuffleIntoCorsairDeck"), code: z.string().min(1), ...when }),
  // "Take control of 1 set aside copy of Dol Amroth Warship" (12136:A:3): of the ship-objectives set aside with this title (whichever printing the game deals) the first one goes into play
  // under the actor, faceup, as a ship a player prepared in the fleet does (dcce.ships). Nothing happens with none set aside.
  // "Shuffle ... 1 random set-aside Send for Help into the encounter deck" (11210:A:4): of the cards set aside with this title one, chosen with the game's seed, goes into the encounter deck facedown. The deck is
  // not shuffled here: the instruction after it does that (ShuffleSelfIntoEncounterDeck, ShuffleEncounterDeck). Nothing happens with none set aside.
  z.strictObject({ verb: z.literal("ShuffleRandomSetAside"), name: z.string().min(1), ...when }),
  // "The players make engagement checks against each enemy in the staging area" (12122:A:1), outside the encounter phase: the engagement checks of rr.engagement-check, pass after pass, until a pass engages
  // no enemy (the tie for the highest engagement cost is the first player's choice). `lower`: "Raider Flagship gets -50 engagement cost during these engagement checks": the enemy with this title checks
  // with `amount` less. `ordinal` and `engaged` are engine use: the seat the checks are at and whether this pass has engaged an enemy, kept while the first player chooses among tied enemies.
  z.strictObject({ verb: z.literal("MakeEngagementChecks"), lower: z.strictObject({ name: z.string().min(1), amount: z.number().int().positive() }).optional(), ordinal: z.number().int().min(0).optional(), engaged: z.boolean().optional(), ...when }),
  // "Set it aside, out of play" (12123:A:3, 110102:A:3): the source card, wherever it is, goes to the set-aside zone with no damage on it and no controller, so that a set aside copy can be taken again (PutSetAsideInPlay to the actor).
  z.strictObject({ verb: z.literal("SetAsideSelf"), ...when }),
  // "While Belfalas Islet is the active location, the chosen enemy is considered to be out of play" (12129:A:2): the last picked enemy goes facedown under the source location, out of play as any card under a location is
  // (rr.in-play-and-out-of-play), and returns to the staging area, or to the player it was engaged with, once the source is no longer the active location (a settle sweep keeps this).
  z.strictObject({ verb: z.literal("ConsiderOutOfPlay"), ...when }),
  // "Discard allies he controls with a total of at least 3 Willpower" (12125:A:3): the actor chooses allies they control one at a time, as many as it takes, and each is discarded as it is chosen
  // once their Willpower adds up to `willpower`. `taken` is engine use: the allies chosen so far. The Response that uses it names the condition alliesWillpower, so the choice can always be completed.
  z.strictObject({ verb: z.literal("DiscardAlliesForWillpower"), willpower: z.number().int().positive(), taken: z.array(z.string()).optional(), ...when }),
  // "Take control of Corsair Skirmisher as a Ship-Objective with Willpower equal to its Threat" (12125:A:3): the source Ship enemy, from the discard pile it was destroyed to, goes into play under the actor
  // as a Ship-objective (rules/core/printed.ts, the code `<code>~ship`): it loses the Ship-enemy card type and gains the Ship-objective card type, with its Attack, Defense and hit points and no damage.
  z.strictObject({ verb: z.literal("TakeControlAsShip"), ...when }),
  // "Attach to a Ship objective" (12132:A:1) and "If defending character is a Ship, attach ~ to it" (12132:A:2): the source treachery attaches to a Ship objective. `choose`: the first player chooses among the Ship
  // objectives the players control (a lone one is taken); `defender`: the Ship objective defending the attack in progress, and nothing happens if the defender is not a Ship.
  // "The engaged Ship enemy with the highest Attack makes an immediate attack. Until the end of the phase, add 1 to the total Threat in the staging area for each damage dealt by this attack" (12131:A:1): the last picked
  // enemy makes an immediate attack (counted for noneReturned like any attack made by an effect); with `raiseStagingThreat`, when the attack ends the total Threat in the staging area is raised, until the phase or the
  // round ends, by the damage the attack dealt.
  z.strictObject({ verb: z.literal("AttackWithPicked"), raiseStagingThreat: z.enum(["endOfPhase", "endOfRound"]).optional(), ...when }),
  // "Set the current encounter deck and discard pile aside, inactive" (12148:B:1, dcce.from-sea-to-land): every card of the encounter deck and its discard pile goes to the set-aside zone, and the Corsair
  // piles are left alone. `carry`: the cards with these codes are the ones the stage's search "shuffles into the second encounter deck" ("each copy of Battle-hardened and each copy of Watch Tower"): they
  // stay in the encounter deck, those in the discard pile moving to it, and are not set aside. Copies in play stay in play. The second deck is the encounter set the stage's Setup set aside: ShuffleSetAsideSet
  // and EndCorsairDeck after this verb make it the active encounter deck, the Corsair deck and its discard pile shuffled into it.
  z.strictObject({ verb: z.literal("SetAsideEncounterDeck"), carry: z.array(z.string().min(1)).optional(), ...when }),
  // "Captain Sahír makes an attack against each other player (in turn order)" (11216:A:4): the source enemy attacks, one after the other from the first player on, each player it is not engaged with, as an attack
  // outside the combat phase dealt a shadow card of its own. `target`: the enemy that attacks (the source by default; "subject" for a card that hears the enemy's attack end). `seat` is engine use: the player whose
  // attack is next.
  z.strictObject({ verb: z.literal("AttackOtherPlayers"), target: cardRefSchema.optional(), seat: z.number().int().min(0).optional(), ...when }),
  // "Search the encounter deck and discard pile for each boon and non-Ship burden and shuffle them into the second encounter deck" (11215:B:1, dcce.from-sea-to-land): every boon, and every burden without the
  // trait `exceptBurdenTrait`, found in the encounter deck or its discard pile is marked as carried across: a discard-pile card moves to the deck, and the stage's SetAsideEncounterDeck keeps the marked cards in it
  // while it sets the rest aside. Run while the first deck is still the encounter deck (the Forced effect resolves above the stage's When Revealed, rr.forced).
  z.strictObject({ verb: z.literal("CarryToSecondDeck"), exceptBurdenTrait: z.string().min(1), ...when }),
  // "Discard all Ship enemies, Ship objectives, and Ocean locations in play" (12148:A:1): every card in play that matches `pick` is discarded (not destroyed, so a Victory enemy does not go to the victory
  // display, rr.victory): an encounter card to the encounter discard pile, a player's card to its owner's discard pile, its attachments with it and its tokens gone. A non-ship enemy goes to the Corsair discard pile
  // while a Corsair deck exists (dcce.corsair-deck).
  z.strictObject({ verb: z.literal("DiscardAllInPlay"), pick: pickSchema, ...when }),
  // Constant on a location in the staging area: "When faced with the option to travel, if Streets of Umbar is in the staging area, the players must either travel to a location named Streets of Umbar or add 2
  // resources to a Raider enemy in play" (12160:A:1). Declining to travel, or traveling to a location with another title, costs the first player's choice of a card that matches `pick` getting `amount` resources
  // (families/sea/streets.ts); with no such card the players can only travel to a location with the source's title.
  z.strictObject({ verb: z.literal("TravelOrAddResources"), amount: z.number().int().positive(), pick: pickSchema, ...when }),
  // Constant on a location in the staging area: "If the players have crossed the Anduin, Pelennor Fields gains: 'When faced with the option to travel, the players must either travel to Pelennor Fields or raise each player's threat
  // by 3.'" (00010:A:1). Declining to travel, or traveling to a location with another title, raises each player's threat by `amount` (families/sea/streets.ts); raising it satisfies the "must", as the resources do for Streets of Umbar.
  // Raising threat is always possible, so the players are never forced to travel. With two copies, traveling to either satisfies both and the threat is raised once.
  z.strictObject({ verb: z.literal("TravelOrRaiseThreat"), amount: z.number().int().positive(), ...when }),
  // Constant on a card in play: no more than `max` cards of this type can enter play each round, played or put into play ("While Corsair Waters is the active location, no more than 1 ally can enter play each
  // round", 12155:A:1). An ally that entered play and left again counts (families/sea/entries.ts).
  // `perPlayer`: each player's own count, by the seat that controls the ally as it enters ("Each player cannot play, or put into play, more than 1 ally each round", 144071:B:2; rr.play-and-put-into-play).
  z.strictObject({ verb: z.literal("LimitEntries"), cardType: z.literal("ally"), max: z.number().int().min(0), perPlayer: z.literal(true).optional(), ...when }),
  // Pillage X (docs/brief.md, The Hunt for the Dreadnaught, reading 21): the actor discards the top `amount` cards of their deck, one at a time, each event card among them announced as `pillaged` (the source enemy, subject the card). The attack's
  // end runs it for an enemy with the Pillage keyword (printed or gained, the flag `pillage`), in the frame of its other effects (families/sea/pillage.ts).
  z.strictObject({ verb: z.literal("Pillage"), amount: positiveAmountSchema, ...when }),
  // "Deal 4 damage to the Ship enemy or Ship objective with the fewest remaining hit points" (40033:A:2): the Ship enemies and the Ship objectives in play (any player's) with the fewest hit points left are the candidates; the first player chooses among tied ones, and the one found is picked.
  z.strictObject({ verb: z.literal("PickFewestHitPoints"), ...when }),
  // "Each player puts 1 set-aside unique Corsair enemy into play at random engaged with them" (40013:B:3): of the unique `trait` enemies set aside, one chosen with the game's seed is put into play engaged with the actor, not revealed and dealt no shadow card.
  z.strictObject({ verb: z.literal("EngageRandomSetAside"), trait: z.string().min(1), ...when }),
  // Constant on a mode card: "If a player controls no ship-objective, that player is eliminated from the game" (40001:B:3, 40002:B:2), once the box's fleet is prepared; a settle sweep checks it (families/sea/fleet.ts).
  z.strictObject({ verb: z.literal("EliminateWithoutShip"), ...when }),
  // "Until the end of the game, that hero gains the printed Traits of another hero you control" (40006:A:3): the second-last picked hero (the first pick) gains the printed Traits of the last picked one.
  z.strictObject({ verb: z.literal("GainHeroTraits"), ...when }),
  // "Flip it to its Upgraded side" (40034:A:1): the last picked Ship objective, if it shows its Basic side and has an Upgraded side, flips to it, keeping its damage and tokens, and hears `flipped`.
  z.strictObject({ verb: z.literal("FlipShip"), ...when }),
] as const;

// About a Ship objective: it became exhausted by any means, defending, attacking, questing, Sailing or an effect ("When attached objective exhausts", 12132:A:1). Announced by a settle sweep (families/sea/water.ts) only in a game
// whose cards hear it.
const TRIGGERS = [
  "shipExhausted",
  // About the enemy whose Pillage discarded a card: an event card discarded from the deck of the player the enemy attacked ("After an event card is discarded from your deck by Corsair Plunderer's Pillage keyword", 40021:A:2). The card is the event's subject.
  "pillaged",
] as const;

const FLAGS = [
  // The holder can be committed to any Sailing test, whoever controls it, not only the first player's ("The Dream-chaser can be committed to
  // Sailing tests (even if you are not the first player)", dcce.sailing-tests). A number: more than 0 holds.
  "sailsAnyTest",
  // The holder counts as this many characters more than one when committed to a Sailing test ("counts as 2 characters": 1; "3 characters": 2).
  "sailingExtra",
  // Boarding X gained or lost: added to the printed Boarding value, never below 0 ("gains Boarding 1", "reduce Boarding by 1", dcce.boarding).
  "boarding",
  // Archery X gained: added to the printed Archery value of the holder ("gains archery 4", dcce.archery).
  "archery",
  // The holder cannot be attacked by player characters ("Ship enemies ... cannot be attacked", 11024:A:1).
  "cannotBeAttacked",
  // On a character: it cannot attack a Ship enemy ("characters you control cannot attack Ship enemies", 11063:A:1).
  "cannotAttackShips",
  // On the table: the Sailing test looks at this many more cards ("look at 2 additional cards", 11050:A:1), and cancels this many Sailing success symbols
  // of the cards looked at ("cancel the first Sailing success symbol", 11053:A:1).
  "sailingLook",
  "sailingCancel",
  // On an enemy: the damage of its attack beyond the remaining hit points of the character it damages is the X of the effect the attack leaves for its
  // end (11055:A:2, "Excess damage from this attack is dealt to a Ship objective you control").
  "excessToShip",
  // On a Ship enemy: each Raider enemy its Boarding reveals enters play with this many resources ("enters play with 1 resource", 11057:A:3).
  "boardingResource",
  // On an enemy engaged with a player: it contributes its Threat to the total Threat in the staging area ("each Ship enemy engaged with you contributes
  // its Threat", 11060:A:1).
  "engagedThreat",
  // On a card: it takes no more than this much damage each round ("cannot take more than 4 damage each round", 11177:A:4).
  "damageCap",
  // On the table: no more than this much damage can be healed from each character each round, by every effect together ("no more than 1 damage can be healed from each character each round", 145033:A:1; families/dreamchaser/heal-cap.ts).
  "healCap",
  // On an enemy: it has this Victory value while the flag holds ("he gains victory 3", 11178:A:1), for where it goes when it is destroyed and for the score.
  "gainsVictory",
  // On an enemy: only a Ship objective can be declared as an attacker against it ("Only Ship objectives can be declared as attackers against Raider Flagship", 12124:A:3; families/sea/ships.ts).
  "shipAttackersOnly",
  // On an enemy: it is immune to player events, not to the other player cards ("Each Raider enemy with at least 1 resource on it is immune to player events", 12159:A:1; families/sea/immune.ts).
  "immuneToPlayerEvents",
  // On an enemy: the Pillage it gains ("gains Pillage 3", 40034:A:2), added to its printed Pillage X (families/sea/pillage.ts).
  "pillage",
  // On a character: it cannot be declared as an attacker against the Dreadnaught ("Engaged player cannot attack the Dreadnaught", 40014:A:2).
  "cannotAttackDreadnaught",
  // On an enemy that is no ship: Ship objectives may attack and defend against it ("Ship objectives may attack and defend against Sea Monster", 40033:A:1; families/sea/ships.ts).
  "shipFightable",
  // On an enemy: for each point of excess combat damage it deals, the defending player deals 1 damage to a Ship objective they control (40019:A:3; families/defense/excess.ts).
  "excessDamagesShip",
] as const;

export const manifest = { name: "sea", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
