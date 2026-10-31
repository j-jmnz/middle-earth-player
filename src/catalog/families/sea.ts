// The sea family (phase 39): the vocabulary of the ships, the Heading card, the Sailing test and the Corsair deck that the Dream-chaser scenarios
// share. Simple verbs; effect-schema-verbs.ts composes them and src/rules/families/sea.ts runs them (the helpers are in sea-*.ts). The rules are
// the Dream-chaser Campaign Expansion rulebook (dcce.*, data/rules/entries.json).
import { z } from "zod";

import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

export const VERBS = [
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
] as const;

export const TRIGGERS = [] as const;

export const FLAGS = [
  // The holder can be committed to any Sailing test, whoever controls it, not only the first player's ("The Dream-chaser can be committed to
  // Sailing tests (even if you are not the first player)", dcce.sailing-tests). A number: more than 0 holds.
  "sailsAnyTest",
  // The holder counts as this many characters more than one when committed to a Sailing test ("counts as 2 characters": 1; "3 characters": 2).
  "sailingExtra",
  // Boarding X gained or lost: added to the printed Boarding value, never below 0 ("gains Boarding 1", "reduce Boarding by 1", dcce.boarding).
  "boarding",
  // Archery X gained: added to the printed Archery value of the holder ("gains archery 4", dcce.archery).
  "archery",
] as const;
