// The aflame family (phase 42, Raid on the Grey Havens): Aflame X and The Havens Burn (dcce.aflame), the Stormcaller Elite's cards (dcce.stormcaller-elite), and the Campaign Setup and
// Resolution of the campaign card 11182. Simple verbs; effect-schema-verbs.ts composes them and src/rules/families/aflame/index.ts runs them (the helpers are beside it in src/rules/families/aflame/). The rules are the
// Dream-chaser Campaign Expansion rulebook (dcce.*, data/rules/entries.json).
import { z } from "zod";

import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

export const VERBS = [
  // Setup: "Shuffle the encounter deck and discard cards from the top of the encounter deck until X locations with the Aflame keyword are discarded, where X is the number of players in
  // the game. Add each discarded Aflame location to the staging area." (11036:A:1). `perPlayer` Aflame locations for each player: the cards above them go to the encounter discard pile,
  // each Aflame location found goes to the staging area, and the deck stops when it is empty. The line's "shuffle the encounter discard pile back" is a ShuffleEncounterDiscard after it.
  z.strictObject({ verb: z.literal("DiscardUntilAflame"), perPlayer: z.number().int().positive(), ...when }),
  // "Search the encounter deck and discard pile for the Aflame location with the highest Aflame value, and add it to the staging area" (11040:A:1). Of locations tied on the value
  // that are not copies of one card the first player chooses. The encounter deck is not shuffled by this verb.
  z.strictObject({ verb: z.literal("SearchAflame"), ...when }),
  // "Captain Sahír engages the first player" (11076:A:1): the source enemy, in the staging area, engages the first player. (EngageLastPlayer is the sea family's: dcce.last-player.)
  z.strictObject({ verb: z.literal("EngageFirstPlayer"), ...when }),
  // Resolution: "Add the copies of Galdor's Counsel chosen during setup to the Campaign Pool" (11182:B:2). One entry for each copy with one of these codes that a seat chose at the Setup
  // (ScenarioState.chosenAtSetup), earned for that seat wherever the copy is now (in a hand, in the victory display, in a discard pile).
  z.strictObject({ verb: z.literal("EarnDealt"), codes: z.array(z.string().min(1)).min(1), ...when }),
  // "Add Na'asiyah and Captain Sahír to the staging area, enemy side faceup" (11037:A:1): the set-aside card with this code joins the staging area, announced as added to it (its Forced effects hear that,
  // "Captain Sahír engages the first player"), and enters play. It is not revealed (rr.staging).
  // `name` in place of `code`: the set-aside card with this title, for a card a campaign game deals as its reprint (The Thing in the Depths 12049, 110063; 12040:B:1).
  z.strictObject({ verb: z.literal("StageSetAside"), code: z.string().min(1).optional(), name: z.string().min(1).optional(), ...when }),
  // "Remove Calphon and each attachment on him from the game, ignoring his 'leaves play' ability" (11182:A:3): the card in play with this title and the cards attached to it leave the game, and none of them
  // is announced as leaving play, so no "If ~ leaves play" ability triggers. The campaign pool is left alone.
  z.strictObject({ verb: z.literal("RemoveNamedFromGame"), name: z.string().min(1), ...when }),
  // The players remove this much damage from the locations in play, one damage at a time from the location the first player chooses, when a stage turns the progress players
  // would place on it into healing (11037:B:1); `amount` is the progress replaced (the running effect's X is the event's amount).
  z.strictObject({ verb: z.literal("HealLocations"), amount: positiveAmountSchema, healed: z.number().int().min(0).optional(), ...when }),
] as const;

export const TRIGGERS = [
  // About a card: it was placed facedown underneath The Havens Burn, an Aflame location whose damage reached its Aflame value (dcce.aflame). The card hears it from where it went ("When
  // Burning Piers is placed underneath The Havens Burn"), and so does The Havens Burn ("When a card is placed underneath The Havens Burn").
  "placedUnder",
  // About the current stage: progress the players would place on it was turned into something else (a flag progressHeals); the event's amount is the progress (11037:B:1).
  "progressReplaced",
  // About the current stage: it was revealed and its When Revealed effects have resolved ("Forced: After stage 2B is revealed", 11182:A:3). The event names the stage as its subject, as `stageRevealed` does,
  // and is heard by any card in play, the campaign card included; it resolves below the stage's own When Revealed frames.
  "afterStageRevealed",
  // About a seat: it collected its resources in the resource phase (rr.step-1-2) ("After the engaged player collects resources at the beginning of the resource phase", 11065:A:2). The event is queued
  // once every seat has collected, and the queue drains in settle after the grant has also drawn the cards (machine.ts grant), so the effect resolves once the draws are done.
  "resourcesCollected",
  // About an enemy: a player attack was declared against it, once for the whole attack however many characters attack (the event's seat is the attacking player); the effect resolves before the attack's strength is read.
  "enemyAttacked",
] as const;

export const FLAGS = [
  // On a quest stage: the progress the players would place on it (after the active location) is replaced by removing that much damage from locations in play ("Any time players would
  // place progress on this quest, remove an equal amount of damage from locations in play instead", 11037:B:1).
  "progressHeals",
  // On a card: "For each point of damage ~ would take, discard 1 resource from him and cancel that damage" (11076:A:2). The damage placed on it is what its resources cannot pay.
  "resourceShield",
  // On an enemy: no more than this many characters can attack it each round ("No more than 1 character can attack Graxar each round", 11188:A:2). `attackersThisRound` is engine use: the characters
  // declared against it so far this round.
  "attackerLimit",
  "attackersThisRound",
] as const;
