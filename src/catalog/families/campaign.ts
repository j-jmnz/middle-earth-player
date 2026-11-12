// The vocabulary the Mirkwood campaign cards add to effect records (phase 28): the Setup instructions the campaign checklist deals
// beside the Fellowship's, and the Resolution that hands cards to the next campaign. Simple verbs; effect-schema-verbs.ts composes
// them. src/campaign/start.ts and checklist.ts deal the Setup ones; src/rules/families/campaign/index.ts and resolution.ts run the rest.
import { z } from "zod";

import { CAMPAIGN_ENDS, RECORDED_COUNTS } from "../campaign-record.ts";
import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const code = z.string().min(1);

const VERBS = [
  // Campaign Setup: the objective ally enters play under the first player ("Put Mendor into play", 01129:A:2). It is put there, not
  // played: nothing is revealed and no cost is paid. A pool card with this record for itself is put into play at the start of each
  // scenario instead of being shuffled into the encounter deck (Campaign Setup Checklist step 8).
  verbFlags(z.strictObject({ verb: z.literal("PutObjectiveAllyIntoPlay"), code, ...when }), { setupRole: "dealt" }),
  // Campaign Setup: the first player chooses a hero and the card is attached to it ("Attach Appointed by Fate to a hero of the first
  // player's choice", 01131:A:2). The checklist asks for the choice as `<code>><hero>`, like a ChooseCards to a hero, but the
  // card is not added to the Campaign Pool.
  z.strictObject({ verb: z.literal("AttachChosen"), code }),
  // Campaign Setup: each player adds a copy of the card to their hand after drawing their starting hand, including a mulligan
  // ("adds a copy of X to their hand after drawing their starting hand", 41051:A:2). It joins the hand once every player has chosen.
  z.strictObject({ verb: z.literal("AddToHandAfterMulligan"), code }),
  // Campaign Setup: the card joins the Campaign Pool (a copy for each player when `eachPlayer`). The log keeps it when the scenario
  // is won; a lost scenario writes nothing.
  z.strictObject({ verb: z.literal("AddToPool"), code, eachPlayer: z.boolean().optional() }),
  // Resolution: these cards go to the NEXT campaign, not this one ("add Mendor to the Campaign Pool ... during your next campaign",
  // 01131:B:2). `eachPlayer`: one copy for each player ("Each player may include 1 copy of Mendor's Support", Ranger Sense). A new
  // save takes them in from a finished one (campaign/carry-over.ts).
  z.strictObject({ verb: z.literal("CarryOver"), codes: z.array(code).min(1), eachPlayer: z.boolean().optional(), ...when }),
  // Campaign Setup: a copy of the card for each player is set aside, out of play ("Set each copy of Valor and Scarred aside, out of play",
  // 01130:A:2). The players meet them later: AttachSetAside takes one copy from the set-aside cards each time.
  verbFlags(z.strictObject({ verb: z.literal("SetAsideEachPlayer"), code, ...when }), { setupRole: "dealt" }),
  // The last picked hero gets a set-aside copy of the card attached to it ("each player attaches 1 set-aside copy of Valor to a hero they
  // control, if able", 01130:A:3). With no set-aside copy left, or no hero picked, nothing happens. The `attached` event is announced.
  verbFlags(z.strictObject({ verb: z.literal("AttachSetAside"), code, ...when }), { setupRuns: "top" }),
  // Resolution: each copy of these cards attached to a hero in play joins the Campaign Pool attached to that hero ("Add each copy of
  // Valor and Scarred in play to the Campaign Pool. Record the names of heroes with Valor and/or Scarred attached ... and attach them
  // to those heroes when setting up each subsequent scenario", 01130:B:1). A hero that fell takes its copies out of the pool (campaign/log.ts).
  z.strictObject({ verb: z.literal("EarnAttached"), codes: z.array(code).min(1), ...when }),
  // Resolution: the hero in play with the most damage is the prisoner, chosen at random among those tied ("The hero with the most
  // damage will be taken prisoner ... in case of a tie, randomly select among the heroes with the most damage. Record the name of the
  // \"prisoner\" in the notes section of the Campaign Log", 01130:B:1). Written to the log's `prisoner` fact; the seed makes the pick.
  z.strictObject({ verb: z.literal("NamePrisoner"), ...when }),
  // Places `amount` resource tokens (1 by default) on the source card: the campaign card counts them ("Response: At the end of each round, place 1
  // resource token here", 41050:A:3). It is no hero's resource pool, so nothing collects it and no `resourcesAdded` is announced.
  z.strictObject({ verb: z.literal("PlaceToken"), amount: z.number().int().positive().optional(), ...when }),
  // The Two Towers' campaign cards (docs/brief.md, The Two Towers; src/campaign/checklist-two-towers.ts deals the Setup ones, src/rules/families/campaign/resolution.ts runs the Resolution ones).
  // Campaign Setup: these cards leave the Campaign Pool ("Remove Gildor Inglorion and Mr. Underhill from the Campaign Pool", 143071:A:2). The log loses them; a card on a hero goes with it.
  z.strictObject({ verb: z.literal("RemovePoolCards"), codes: z.array(code).min(1) }),
  // Campaign Setup: the pool's burdens of these burden sets are not dealt this scenario ("Remove each burden with the following burden set icons from the encounter deck", 143071:A:2, 143077:A:2, 143081:A:2;
  // "... from the encounter deck and each player's deck", 144067:A:2 to 144073:A:2, `playerDecks`). The cards stay in the pool: the setup only leaves them out of the decks it builds, so
  // an encounter-backed burden misses the encounter deck and, with `playerDecks`, one a player shuffles into their deck (a burden that functions like a player card) misses that deck too.
  z.strictObject({ verb: z.literal("RemoveBurdenSets"), sets: z.array(z.string().min(1)).min(1), playerDecks: z.literal(true).optional() }),
  // Campaign Setup: each player shuffles one copy of the card into their own deck ("Each player shuffles 1 copy of The Searching Eye into his deck", 144067:A:2). The copy is dealt for this
  // game only: nothing joins the pool until a Resolution earns one. Only in a Campaign Setup record; a scenario's Setup that shuffles a copy in uses `ShuffleCopyIntoEachDeck` (burden family).
  z.strictObject({ verb: z.literal("ShuffleIntoEachDeck"), code }),
  // Campaign Setup: each player in turn chooses either to shuffle one copy of the card into their deck or to add `resources` resources to each of their heroes' pools ("either add 1 resource to
  // each of his heroes' pools, or shuffle 1 copy of Brace of Coneys into his deck", 144069:A:2). A copy is recorded as chosen at Setup (ScenarioState.chosenAtSetup), so the Resolution's EarnDealt earns it.
  z.strictObject({ verb: z.literal("ChooseCopyOrResources"), code, resources: z.number().int().positive() }),
  // Resolution: the players answer a choice between named options, the first player for the group or each player in turn ("the players must choose: either ... or ...", 143071:B:1; "Each player must choose:
  // either ... or ...", 144067:B:1). The answer is recorded under `name` (the `picked` condition and the verbs below read it). An option with `needsFallen` is offered only while the list of fallen heroes holds one.
  z.strictObject({
    verb: z.literal("ChooseOption"),
    name: z.string().min(1),
    options: z.array(z.strictObject({ id: z.string().min(1), needsFallen: z.literal(true).optional() })).min(2),
    who: z.enum(["firstPlayer", "eachSeat"]),
    ...when,
  }),
  // Resolution: each player who answered `name` with `option` takes a permanent starting threat penalty of `amount`, recorded in the log for that seat ("take a permanent +2 starting threat penalty", 144067:B:1).
  z.strictObject({ verb: z.literal("ThreatPenaltyForPick"), name: z.string().min(1), option: z.string().min(1), amount: z.number().int().positive() }),
  // Resolution: each player who answered `name` with `option` earns one copy of each of these cards, shuffled into their deck after the starting hand in the scenarios that follow ("or earn 1 copy of
  // The Searching Eye", 144067:B:1).
  z.strictObject({ verb: z.literal("EarnForPick"), name: z.string().min(1), option: z.string().min(1), codes: z.array(code).min(1) }),
  // Resolution: each player with a copy of one of these cards in their hand, deck or discard pile earns that burden, shuffled into their deck after the starting hand later ("Each player with a copy of Poisoned
  // Counsels in his hand, deck or discard pile has earned that burden", 143077:B:1).
  z.strictObject({ verb: z.literal("EarnHeldCopies"), codes: z.array(code).min(1), ...when }),
  // Resolution: one player earns the boon and takes control of a hero from the list of fallen heroes, removing it from the list, and attaches the boon to that hero ("one player earns the boon Beyond All Hope and
  // chooses a hero from the list of fallen heroes. That player takes control of the chosen hero (removing it from the list of fallen heroes) and attaches Beyond All Hope to it", 143071:B:1). The first player
  // answers for the group, choosing the hero and the player; changing heroes this way costs no +1 threat penalty. Nothing is asked when the list is empty.
  z.strictObject({ verb: z.literal("ReviveFallenHero"), code, ...when }),
  // Resolution: a player who controls more than `limit` non-Fellowship heroes removes heroes from the Campaign Log until they control only `limit` ("must remove heroes from the Campaign Log until he controls
  // only 3 heroes", 143071:B:1). Fellowship heroes are not counted and are never removed. Each such player is asked in turn, the first player first.
  z.strictObject({ verb: z.literal("TrimHeroes"), limit: z.number().int().positive(), ...when }),
  // Resolution: the enemies facedown underneath the card with this code are recorded in the Campaign Log by card code and quantity ("Record the name and quantity of each enemy underneath The Black Gate in the notes
  // section of the campaign log", 144069:B:1).
  z.strictObject({ verb: z.literal("RecordUnderneath"), code, ...when }),
  // The Return of the King's campaign cards (docs/brief.md, The Return of the King; src/campaign/checklist.ts deals the Setup one, src/rules/families/campaign/saga-end.ts runs the Resolution ones).
  // Campaign Setup: the first player may raise each player's threat by `raiseThreat` for this game to search his deck for the card and add it to his hand ("The first player may raise each player's threat by 1 to search his deck
  // for Andúril and add it to his hand", 145066:A:1). The card is taken from the deck, or from the pool where step 7 would shuffle it in, and joins the hand after the mulligan; with no copy to find nothing is asked.
  z.strictObject({ verb: z.literal("SearchDeckForCard"), code, raiseThreat: z.number().int().positive() }),
  // Resolution: each copy of these cards attached to a player's threat dial joins the Campaign Pool, recorded for that player ("Add each copy of Overcome by Fear attached to a player's threat dial to the campaign pool and record
  // the name of each player it was attached to", 145066:B:1). One entry for each player holding a copy.
  z.strictObject({ verb: z.literal("EarnOnThreatDial"), codes: z.array(code).min(1), ...when }),
  // Resolution: the resources on the cards in play with these codes are counted and recorded in the notes section of the Campaign Log under `as` ("Count the number of resources on The Corsair Fleet and record that number in
  // the notes section", 145070:B:1; "Record the number of resource tokens on The Black Gate", 146074:B:1). A card of two sides is two codes; the count is their sum.
  z.strictObject({ verb: z.literal("RecordTokens"), codes: z.array(code).min(1), as: z.enum(RECORDED_COUNTS), ...when }),
  // Resolution: each card with one of these codes leaves the Campaign Pool, once ("Remove Army of the Dead from the campaign pool", 145070:B:1). With `perCopyInVictory`, one entry leaves for each copy of the code in the
  // victory display and none when there is none ("If a Wraith on Wings is in the victory display, remove that copy from the campaign pool", 146074:B:1). Nothing happens for a code the pool does not hold. The Setup's
  // RemovePoolCards is the same removal before a game.
  z.strictObject({ verb: z.literal("RemoveFromPoolByCode"), codes: z.array(code).min(1), perCopyInVictory: z.literal(true).optional(), ...when }),
  // Resolution: each boon attached to the card with this code in play leaves the Campaign Pool ("If Shagrat is in play, remove each Item boon attached to it from the campaign pool", 146069:B:2): the players have lost it.
  z.strictObject({ verb: z.literal("LoseGuardedBoons"), host: code, ...when }),
  // Resolution: a hero in its controller's discard pile is not added to the list of fallen heroes ("If a hero is in its controller's discard pile, do not add that hero's name to the list of fallen heroes", 146074:B:1).
  z.strictObject({ verb: z.literal("IgnoreDiscardedHeroes"), ...when }),
  // Resolution: the saga ends, the players winning or losing the campaign ("Keep The One Ring ... the players lose the campaign", "Destroy The One Ring ... the players win the campaign", 146079:B:2, 146079:B:3). The Campaign Log records it.
  z.strictObject({ verb: z.literal("EndCampaign"), result: z.enum(CAMPAIGN_ENDS), ...when }),
  // The Battle of the Pelennor Fields' campaign card (docs/brief.md, The Return of the King). Campaign Setup: the first player attaches these cards to the hero with this code and sets him aside, out of play ("The first player attaches Andúril and Banner of Elendil
  // to Aragorn and sets him aside, out of play", 145078:A:1). The attachments come from the supply; the hero and they leave no `leftPlay` behind (nothing in play left it) and the hero is set aside with an empty resource pool (Setup runs before the first round) and returns with an empty one (docs/brief.md, The Return of the King, 145072:A:1).
  verbFlags(z.strictObject({ verb: z.literal("SetAsideHeroWithAttachments"), hero: code, attach: z.array(code).min(1) }), { setupRole: "dealt" }),
  // The first player takes control of the set aside hero with the code, with the cards attached to him ("the first player takes control of Aragorn", 145072:A:1). He enters play ready under the first player; with no such hero set aside nothing happens.
  z.strictObject({ verb: z.literal("ReturnSetAsideHero"), code, ...when }),
  // Campaign Setup: each enemy recorded in the Campaign Log under The Black Gate with this trait is set aside, out of play, one copy for each recorded ("Set each Harad enemy recorded in the campaign log aside, out of play", 145078:A:1). With no log, nothing is set aside.
  verbFlags(z.strictObject({ verb: z.literal("SetAsideLogged"), trait: z.string().min(1) }), { setupRole: "dealt" }),
] as const;

const TRIGGERS = [] as const;
const FLAGS = [] as const;

export const manifest = { name: "campaign", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
