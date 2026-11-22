// The sea family's pieces (src/catalog/families/sea.ts, the Dream-chaser box and The Hunt for the Dreadnaught): the fleet and Corsair deck Setup, the heading, the Corsair reveals and the ship effects: templates and samples.
import { amt, pck, type Samples, type Templates } from "../family-kit.ts";
import { joinAnd, str } from "../kit.ts";

const codes = (value: unknown): string => joinAnd((Array.isArray(value) ? value : []).map(str));

export const SEA_TEMPLATES: Templates = {
  PrepareCorsairDeck: (i) => ({ text: `Setup: every non-ship enemy${typeof i.trait === "string" ? ` with the trait ${i.trait}` : ""} still in the encounter deck goes to the Corsair deck, which is shuffled; from then on ${typeof i.trait === "string" ? `such an enemy` : "a non-ship enemy"} that would be discarded goes to the Corsair discard pile, and the Corsair deck refills from it`, read: ["trait"] }),
  PrepareFleet: (i) => ({
    text: i.own === true
      ? "Setup: each player in turn takes one of the box's own unique ship-objectives set aside (a lone player takes one), the unused ships stay set aside; there is no Dream-chaser and no Heading card"
      : "Setup: each player in turn takes one of the six ship-objectives set aside (the Dream-chaser is forced on the last player who has not got it; a lone player takes the Dream-chaser and one other), the unused ships leave the game, and the Heading card is attached to the Dream-chaser, set to on-course",
    read: ["own"],
  }),
  ShiftHeading: (i) => ({ text: `the Heading card shifts one step ${i.direction === "onCourse" ? "toward Sun (on-course)" : "toward Storm (off-course)"}, never past either end (nothing in a game with no Heading card)`, read: ["direction"] }),
  ShuffleIntoCorsairDeck: (i) => ({ text: `Setup: the card with code ${str(i.code)} joins the Corsair deck the scenario deals, which the quest card's Setup then shuffles`, read: ["code"] }),
  FitShips: (i) => ({ text: `Campaign Setup, after the quest card's Setup has prepared the fleet: each player in player order takes one of the set-aside cards with codes ${codes(i.codes)} for each ship-objective they control, in the order the ships were taken, and attaches it to that ship (a card dealt on its Upgraded side if the log says it is upgraded)`, read: ["codes"] }),
  RevealCorsair: (i, ctx) => ({
    text: `${i.who === "eachSeat" ? "each player" : i.who === "anyPlayer" ? "one player, named by the first player (the only player takes it without being asked)," : "the acting player"} reveals the top ${i.count === undefined ? "card" : `${amt(i.count, ctx)} cards`} of the Corsair deck and puts ${i.count === undefined ? "it" : "each"} into play engaged with them (the deck refills from its discard pile when it runs out)${typeof i.shadow === "number" ? `; each card put into play is dealt ${i.shadow} shadow card(s) at once` : ""}`,
    read: ["count", "who", "shadow"],
  }),
  SetAsideSelf: () => ({ text: "this card, wherever it is, goes to the set-aside zone with no damage and no controller, so a set-aside copy can be taken again", read: [] }),
  AttackWithPicked: (i) => ({ text: `the last picked enemy makes an immediate attack against ${i.who === "firstPlayer" ? "the first player" : "the acting player"} (when it is in the staging area; counted as an attack made, like any attack an effect makes${i.counted === true ? "; an enemy that stays in the staging area counts for noneReturned too" : ""})${i.raiseStagingThreat !== undefined ? `; when the attack ends the total Threat in the staging area is raised, until ${i.raiseStagingThreat === "endOfPhase" ? "the end of the phase" : "the end of the round"}, by the damage the attack dealt` : ""}`, read: ["raiseStagingThreat", "who", "counted"] }),
  LimitEntries: (i) => ({ text: `no more than ${str(i.max)} ${str(i.cardType)} cards can enter play each round, played or put into play${i.perPlayer === true ? ", counted for each player on their own (by the seat that controls the ally as it enters)" : ""} (an ${str(i.cardType)} that entered play and left again counts)`, read: ["cardType", "max", "perPlayer"] }),
  DamageShip: (i, ctx) => ({ text: `deal ${amt(i.amount, ctx)} damage to the last picked card, a Ship objective, as the encounter or campaign card whose effect it is (a ship is immune to player card effects, not to this)`, read: ["amount"] }),
  DiscardAlliesForWillpower: (i) => ({ text: `the acting player chooses allies they control one at a time and each is discarded as it is chosen, until the Willpower of the allies discarded adds up to at least ${str(i.willpower)}`, read: ["willpower", "taken"] }),
  TakeControlAsShip: () => ({ text: "this Ship enemy, from the discard pile it was destroyed to, goes into play under the acting player as a Ship-objective with Willpower equal to its Threat: it loses the Ship-enemy card type and gains the Ship-objective type, keeps its Attack, Defense and hit points and has no damage", read: [] }),
  DiscardFromAnyDeck: (i) => ({ text: `the acting player chooses a deck (each player's deck that holds a card, the encounter deck, the Corsair deck) and its top ${str(i.count)} cards are discarded to its discard pile (when a card was named, X is 1 if one of the cards discarded bears that title, else 0)`, read: ["count"] }),
  SearchShips: (i, ctx) => ({ text: `the ${amt(i.count, ctx)} Ship enemies with the highest Threat in the encounter deck and its discard pile are added to the staging area, not revealed (of cards tied on Threat that are not copies of one card the first player chooses; the deck is not shuffled)`, read: ["count"] }),
  ConsiderOutOfPlay: () => ({ text: "the last picked enemy goes facedown under this location, out of play, and returns to the staging area, or to the player it was engaged with, once this card is no longer the active location", read: [] }),
  CarryToSecondDeck: (i) => ({ text: `every boon, and every burden without the trait ${str(i.exceptBurdenTrait)}, in the encounter deck or its discard pile is marked as carried across to the second encounter deck (a discard-pile card moves to the deck, and the stage's set-aside step keeps the marked cards in it)`, read: ["exceptBurdenTrait"] }),
  SetAsideEncounterDeck: (i) => ({ text: `every card of the encounter deck and its discard pile goes to the set-aside zone (the Corsair piles are left alone; copies in play stay in play)${Array.isArray(i.carry) ? `, except the cards with codes ${codes(i.carry)}, which stay in the encounter deck (those in the discard pile move to it)` : ""}`, read: ["carry"] }),
  EndCorsairDeck: () => ({ text: "the Corsair deck and Corsair discard pile are shuffled into the encounter deck and the Corsair deck is gone: a non-ship enemy is discarded to the encounter discard pile as in any other game", read: [] }),
  TravelOrAddResources: (i, ctx) => ({ text: `while this location is in the staging area, the players cannot decline to travel, and cannot travel to a location with another title, unless the first player chooses a ${pck(i.pick, ctx)} that gets ${str(i.amount)} resources instead (with no such card they can only travel to a location with this card's title)`, read: ["pick", "amount"] }),
  ShuffleRandomSetAside: (i) => ({ text: `of the set-aside cards titled "${str(i.name)}" one, chosen with the game's seed, is used: a ship-objective goes into play under the acting player, faceup; any other goes into the encounter deck facedown (the deck is not shuffled here; nothing when none is set aside)`, read: ["name"] }),
  NameCard: () => ({ text: "the acting player chooses the title of any card of the game, wherever it is (every card the game holds is offered); it is the effect's named card for the step after", read: [] }),
  PlunderHand: () => ({ text: "a card of the acting player's hand, chosen by the game's seed, is discarded; this enemy gets as many resources as its printed cost (none for a card with no cost or an X cost)", read: [] }),
  TradeShipDamage: (i) => ({ text: `Campaign Setup: in player order, the controller of each ship chooses to trade or keep: a trade deals ${str(i.damage)} damage to the ship and adds ${str(i.resources)} resource(s) to a hero's pool of their choice`, read: ["damage", "resources", "ship", "hero"] }),
};

export const SEA_SAMPLES: Samples = {
  PrepareCorsairDeck: [{ verb: "PrepareCorsairDeck" }, { verb: "PrepareCorsairDeck", trait: "Corsair" }],
  PrepareFleet: [{ verb: "PrepareFleet" }, { verb: "PrepareFleet", own: true }],
  ShiftHeading: [{ verb: "ShiftHeading", direction: "onCourse" }],
  ShuffleIntoCorsairDeck: [{ verb: "ShuffleIntoCorsairDeck", code: "11178" }],
  FitShips: [{ verb: "FitShips", codes: ["11172", "11173"] }],
  RevealCorsair: [{ verb: "RevealCorsair" }, { verb: "RevealCorsair", count: 2, who: "eachSeat", shadow: 1 }, { verb: "RevealCorsair", who: "anyPlayer" }],
  SetAsideSelf: [{ verb: "SetAsideSelf" }],
  AttackWithPicked: [{ verb: "AttackWithPicked", raiseStagingThreat: "endOfPhase", who: "firstPlayer", counted: true }, { verb: "AttackWithPicked", raiseStagingThreat: "endOfRound" }],
  LimitEntries: [{ verb: "LimitEntries", cardType: "ally", max: 1, perPlayer: true }],
  DamageShip: [{ verb: "DamageShip", amount: 2 }],
  DiscardAlliesForWillpower: [{ verb: "DiscardAlliesForWillpower", willpower: 3 }],
  TakeControlAsShip: [{ verb: "TakeControlAsShip" }],
  DiscardFromAnyDeck: [{ verb: "DiscardFromAnyDeck", count: 2 }],
  SearchShips: [{ verb: "SearchShips", count: 2 }],
  ConsiderOutOfPlay: [{ verb: "ConsiderOutOfPlay" }],
  CarryToSecondDeck: [{ verb: "CarryToSecondDeck", exceptBurdenTrait: "Ship" }],
  SetAsideEncounterDeck: [{ verb: "SetAsideEncounterDeck", carry: ["12156", "11067"] }],
  EndCorsairDeck: [{ verb: "EndCorsairDeck" }],
  TravelOrAddResources: [{ verb: "TravelOrAddResources", amount: 2, pick: { type: "enemy", control: "any", trait: "Raider" } }],
  ShuffleRandomSetAside: [{ verb: "ShuffleRandomSetAside", name: "Gondorian Warship" }],
  NameCard: [{ verb: "NameCard" }],
  PlunderHand: [{ verb: "PlunderHand" }],
  TradeShipDamage: [{ verb: "TradeShipDamage", damage: 2, resources: 1 }],
};
