// The vocabulary the Mirkwood campaign cards add to effect records (phase 28): the Setup instructions the campaign checklist deals
// beside the Fellowship's, and the Resolution that hands cards to the next campaign. Simple verbs; effect-schema-verbs.ts composes
// them. src/campaign/start.ts and checklist.ts deal the Setup ones; src/rules/families/campaign.ts and resolution.ts run the rest.
import { z } from "zod";

import { when } from "../effect-schema-conditions.ts";

const code = z.string().min(1);

export const VERBS = [
  // Campaign Setup: the objective ally enters play under the first player ("Put Mendor into play", 01129:A:2). It is put there, not
  // played: nothing is revealed and no cost is paid. A pool card with this record for itself is put into play at the start of each
  // scenario instead of being shuffled into the encounter deck (Campaign Setup Checklist step 8).
  z.strictObject({ verb: z.literal("PutObjectiveAllyIntoPlay"), code, ...when }),
  // Campaign Setup: the first player chooses a hero and the card is attached to it ("Attach Appointed by Fate to a hero of the first
  // player's choice", 01131:A:2). The checklist asks for the choice as `<code>><hero>`, like a ChooseCards to a hero, but the
  // card is not added to the Campaign Pool.
  z.strictObject({ verb: z.literal("AttachChosen"), code, ...when }),
  // Campaign Setup: each player adds a copy of the card to their hand after drawing their starting hand, including a mulligan
  // ("adds a copy of X to their hand after drawing their starting hand", 41051:A:2). It joins the hand once every player has chosen.
  z.strictObject({ verb: z.literal("AddToHandAfterMulligan"), code, ...when }),
  // Campaign Setup: the card joins the Campaign Pool (a copy for each player when `eachPlayer`). The log keeps it when the scenario
  // is won; a lost scenario writes nothing.
  z.strictObject({ verb: z.literal("AddToPool"), code, eachPlayer: z.boolean().optional(), ...when }),
  // Resolution: these cards go to the NEXT campaign, not this one ("add Mendor to the Campaign Pool ... during your next campaign",
  // 01131:B:2). `eachPlayer`: one copy for each player ("Each player may include 1 copy of Mendor's Support", Ranger Sense). A new
  // save takes them in from a finished one (campaign/carry-over.ts).
  z.strictObject({ verb: z.literal("CarryOver"), codes: z.array(code).min(1), eachPlayer: z.boolean().optional(), ...when }),
] as const;

export const TRIGGERS = [] as const;
export const FLAGS = [] as const;
