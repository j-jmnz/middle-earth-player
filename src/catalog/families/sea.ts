// The sea family (phase 39): the vocabulary of the ships, the Heading card, the Sailing test and the Corsair deck that the Dream-chaser scenarios
// share. Simple verbs; effect-schema-verbs.ts composes them and src/rules/families/sea/index.ts runs them (the helpers are beside it in src/rules/families/sea/). The rules are
// the Dream-chaser Campaign Expansion rulebook (dcce.*, data/rules/entries.json).
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { setupRole } from "../setup-role.ts";

const VERBS = [
  // Setup: "Prepare the Corsair deck" (dcce.corsair-deck). Every non-ship enemy still in the encounter deck goes to the Corsair deck, which is
  // then shuffled; from now on a non-ship enemy that would be discarded goes to the Corsair discard pile, and the Corsair deck refills from it.
  z.strictObject({ verb: z.literal("PrepareCorsairDeck"), ...when }),
  // "Shuffle the Corsair deck and Corsair discard pile into the encounter deck" (dcce.from-sea-to-land, The City of Corsairs stage 2B): the Corsair
  // deck is gone from then on, so a non-ship enemy is discarded to the encounter discard pile as in any other game.
  z.strictObject({ verb: z.literal("EndCorsairDeck"), ...when }),
  // Setup: "Players prepare their fleet" (dcce.prepare-your-fleet). Each player in turn takes one of the six ship-objectives set aside (the
  // Dream-chaser is forced on the last player who has not got it; a lone player takes the Dream-chaser and one other), the unused ships leave the
  // game, and the Heading card is attached to the Dream-chaser, set to on-course. A seat with a choice asks it as a choice of cards.
  z.strictObject({ verb: z.literal("PrepareFleet"), ...when }),
  // "Shift your heading off-course" / "on-course" (dcce.heading): one step toward Storm / toward Sun, never past either end. Nothing happens in a
  // game with no Heading card.
  z.strictObject({ verb: z.literal("ShiftHeading"), direction: z.enum(["onCourse", "offCourse"]), ...when }),
  // "Reveal the top card of the Corsair deck and put it into play, engaged with you" (dcce.boarding, dcce.corsair-deck): `count` cards (1 by
  // default) for the actor, or for each player (`eachSeat`). The deck refills from its discard pile when it runs out.
  z.strictObject({ verb: z.literal("RevealCorsair"), count: positiveAmountSchema.optional(), who: z.enum(["actor", "eachSeat"]).optional(), ...when }),
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
  setupRole(z.strictObject({ verb: z.literal("FitShips"), codes: z.array(z.string().min(1)).min(1), ...when }), "afterSetup"),
  // Campaign Setup: "For each ship-objective, its controller may deal 2 damage to it to add 1 resource to a hero's resource pool" (11171:A:2). In
  // player order, the controller of each ship chooses to trade or keep; a trade deals `damage` to the ship and adds `resources` to the pool of a hero
  // they choose (`ship` and `hero` are engine use: the ship being traded for and the hero chosen so far).
  setupRole(z.strictObject({ verb: z.literal("TradeShipDamage"), damage: z.number().int().positive(), resources: z.number().int().positive(), ship: z.string().optional(), hero: z.string().optional(), ...when }), "afterSetup"),
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
  z.strictObject({ verb: z.literal("TakeSetAsideShip"), name: z.string().min(1), ...when }),
  // "The players make engagement checks against each enemy in the staging area" (12122:A:1), outside the encounter phase: the engagement checks of rr.engagement-check, pass after pass, until a pass engages
  // no enemy (the tie for the highest engagement cost is the first player's choice). `lower`: "Raider Flagship gets -50 engagement cost during these engagement checks": the enemy with this title checks
  // with `amount` less. `ordinal` and `engaged` are engine use: the seat the checks are at and whether this pass has engaged an enemy, kept while the first player chooses among tied enemies.
  z.strictObject({ verb: z.literal("MakeEngagementChecks"), lower: z.strictObject({ name: z.string().min(1), amount: z.number().int().positive() }).optional(), ordinal: z.number().int().min(0).optional(), engaged: z.boolean().optional(), ...when }),
  // "Set it aside, out of play" (12123:A:3, 110102:A:3): the source card, wherever it is, goes to the set-aside zone with no damage on it and no controller, so that a set aside copy can be taken again (TakeSetAsideShip).
  z.strictObject({ verb: z.literal("SetAsideSelf"), ...when }),
  // "While Belfalas Islet is the active location, the chosen enemy is considered to be out of play" (12129:A:2): the last picked enemy goes facedown under the source location, out of play as any card under a location is
  // (rr.in-play-and-out-of-play), and returns to the staging area, or to the player it was engaged with, once the source is no longer the active location (a settle sweep keeps this).
  z.strictObject({ verb: z.literal("ConsiderOutOfPlay"), ...when }),
] as const;

const TRIGGERS = [] as const;

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
  // On an enemy: it has this Victory value while the flag holds ("he gains victory 3", 11178:A:1), for where it goes when it is destroyed and for the score.
  "gainsVictory",
  // On an enemy: only a Ship objective can be declared as an attacker against it ("Only Ship objectives can be declared as attackers against Raider Flagship", 12124:A:3; families/sea/ships.ts).
  "shipAttackersOnly",
] as const;

export const manifest = { name: "sea", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
