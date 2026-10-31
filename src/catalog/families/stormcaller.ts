// The stormcaller family (phase 43, Flight of the Stormcaller): the Stormcaller's area, a second quest deck of stages 2C to 4C beside the Stormcaller (dcce.stormcallers-area,
// dcce.stormcallers-area-stages), the stage the players must catch up to, and the commitments the ships and Corsairs of the scenario hear (dcce.sailing-tests). Simple verbs;
// effect-schema-verbs.ts composes them and src/rules/families/stormcaller.ts runs them (the helpers are in stormcaller-*.ts). The rules are the Dream-chaser Campaign Expansion
// rulebook (dcce.*, data/rules/entries.json).
import { z } from "zod";

import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

export const VERBS = [
  // Setup: "Prepare the Stormcaller's area" (12012:A:1, dcce.stormcallers-area). The quest cards with these codes (set aside, stages 2C, 3C and 4C) become the Stormcaller's quest deck in this order,
  // the top one is the Stormcaller's current quest stage, side D up (the Setup of a stage does not reveal it), and the set-aside Stormcaller is placed beside it, in the area.
  // `number` is the stage number of the first of them (2).
  z.strictObject({ verb: z.literal("PrepareStormcallerArea"), stages: z.array(z.string().min(1)).min(1), number: z.number().int().positive(), ...when }),
  // Campaign Setup: "Flip the Stormcaller to its 'Campaign Mode only' side" (11191:A:2, dcce.campaign-mode): the Stormcaller shows its side B, with the stats and the text printed there.
  z.strictObject({ verb: z.literal("FlipStormcaller"), ...when }),
  // "Move 2 progress from Swift Departure to the Stormcaller's quest stage" / "from the main quest" (12012:B:2, 12026:A:1): up to `amount` progress comes off the current quest card and goes on the
  // Stormcaller's current quest stage, which advances when it is full. Nothing moves when the quest holds none.
  z.strictObject({ verb: z.literal("MoveProgressToStormcaller"), amount: positiveAmountSchema, ...when }),
  // "The Stormcaller places progress on this stage equal to its Threat plus the Threat of the discarded card" (12016:B:3, 12017:B:3, 12018:B:1): the top card of the encounter deck is discarded, and
  // the Stormcaller's current stage takes the Stormcaller's Threat, the printed Threat of that card and the Threat of each card in the area that says it contributes (flag stormcallerThreat). A full
  // stage advances.
  z.strictObject({ verb: z.literal("StormcallerProgress"), ...when }),
  // "Add ~ to the Stormcaller's area, instead of the players' staging area" (12020:A:4, 12027:A:1): the source card (or the last picked card) goes into the Stormcaller's area.
  z.strictObject({ verb: z.literal("MoveToStormcallerArea"), target: z.enum(["self", "picked"]).optional(), ...when }),
  // On a quest stage: defeating it when the Stormcaller is at this stage number means the players have caught up to the Stormcaller and win the game (12013:B:3, 12014:B:3, 12015:B:3). The
  // stage's definition carries the number (ScenarioDefinition.stages), as `look` does; nothing runs when the record is resolved.
  z.strictObject({ verb: z.literal("CatchUpWins"), stage: z.number().int().positive(), ...when }),
] as const;

export const TRIGGERS = [
  // About the Stormcaller's quest stage: it was full and the Stormcaller advanced to the next stage ("Forced: When the Stormcaller advances to the next quest stage", 12024:A:1). The event names the
  // Stormcaller as its subject; it is announced once the new stage's C side has been revealed.
  "stormcallerAdvanced",
  // About the Stormcaller's last quest stage: it was full ("If the Stormcaller defeats this stage", 12018:B:2).
  "stormcallerStageDefeated",
  // About a seat: it committed characters to the quest or to a Sailing test (the event's amount is how many characters; a ship that counts as more counts as that many), once for the
  // whole commitment ("After a player commits 4 or more characters to a Sailing test or to the quest", 12021:A:3). Announced only in a game with ships.
  "commitmentMade",
  // About a hero: the first player committed it to a Sailing test (dcce.sailing-tests), as `committed` says of the quest ("After the engaged player commits a hero to a Sailing test", 12023:A:2).
  "committedToSailing",
  // About a card: it went from the top of the encounter deck to the encounter discard pile ("After a card is discarded from the encounter deck", 11193:B:2). Announced only in a game with a Stormcaller's area.
  "discardedFromEncounterDeck",
] as const;

export const FLAGS = [
  // On a card in the Stormcaller's area: it contributes its Threat to the progress the Stormcaller places on its quest stage each round ("While Sahír's Escort is in the Stormcaller's area",
  // 12020:A:3). A number: more than 0 holds.
  "stormcallerThreat",
] as const;
