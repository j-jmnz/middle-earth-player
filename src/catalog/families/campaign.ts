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
  z.strictObject({ verb: z.literal("SetAsideEachPlayer"), code, ...when }),
  // The last picked hero gets a set-aside copy of the card attached to it ("each player attaches 1 set-aside copy of Valor to a hero they
  // control, if able", 01130:A:3). With no set-aside copy left, or no hero picked, nothing happens. The `attached` event is announced.
  z.strictObject({ verb: z.literal("AttachSetAside"), code, ...when }),
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
  // Resolution: the resource tokens on the campaign card with this code join the Campaign Log's counters under its code ("Record the number of tokens
  // here", 41050:B:1); the `tokens` condition reads them in the same Resolution. Written to the log's `counters` fact (campaign/log.ts).
  z.strictObject({ verb: z.literal("RecordTokens"), code, ...when }),
] as const;

export const TRIGGERS = [] as const;
export const FLAGS = [] as const;
