// The vocabulary player side quests, contracts, encounter-keyword player cards and the victory display adds to effect records: simple verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them.
import { z } from "zod";

import { when } from "../effect-schema-conditions.ts";

export const VERBS = [
  // Constant on a card that goes to the victory display ("Limit 3 copies of ~ in the victory display"): the display holds at
  // most `copies` of its title. A copy that would be added beyond that goes to its owner's discard pile instead
  // (families/sidequests-victory.ts).
  z.strictObject({ verb: z.literal("VictoryLimit"), copies: z.number().int().positive(), ...when }),
  // Constant on a side quest ("Battle.", "Siege."): the characters committed to it quest with this stat instead of their
  // Willpower (families/sidequests-quest.ts).
  z.strictObject({ verb: z.literal("QuestsWith"), stat: z.enum(["attack", "defense"]), ...when }),
  // The actor is eliminated from the game by a card effect ("At the end of the round, you are eliminated from the game",
  // rr.player-elimination).
  z.strictObject({ verb: z.literal("EliminatePlayer"), ...when }),
  // Constant on a card in hand ("Limit 2 copies of ~ in play"): it cannot be played while this many copies of its title are in
  // play (families/sidequests-play.ts).
  z.strictObject({ verb: z.literal("InPlayLimit"), copies: z.number().int().positive(), ...when }),
  // The source card is removed from the campaign pool ("add ~ to the victory display and remove it from the campaign pool"): the
  // campaign log drops it when the scenario is won.
  z.strictObject({ verb: z.literal("RemoveFromCampaignPool"), ...when }),
] as const;

export const TRIGGERS = [
  // About a side quest: its progress reached its quest points and it was defeated. A player side quest in the victory display or
  // its owner's discard pile hears it ("Response: When this stage is defeated, ...").
  "questDefeated",
] as const;

export const FLAGS = [] as const;

