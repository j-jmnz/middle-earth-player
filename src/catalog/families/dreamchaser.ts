// The vocabulary the Dream-chaser campaign cards add to effect records (phase 38): the XP a Resolution awards (dcce.gaining-xp). Simple
// verbs; effect-schema-verbs.ts composes them. src/rules/setup/resolution.ts runs them (src/rules/families/dreamchaser/index.ts counts what a line is for).
import { z } from "zod";

import { when } from "../effect-schema-conditions.ts";

const code = z.string().min(1);

// What a "for each" line counts: the surviving players, the cards with these codes in the victory display, or the resource tokens on
// the card with this code ("1 XP for each resource on this card (to a maximum of 3 XP)"). A line with none counts once.
export const xpCountSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("survivingPlayer") }),
  z.strictObject({ kind: z.literal("inVictory"), codes: z.array(code).min(1) }),
  z.strictObject({ kind: z.literal("tokens"), code }),
  // The locations of the Island Map with this code that have been flipped over, showing the location they are ("1 XP for each faceup Temple Halls", 11197:B:5).
  z.strictObject({ kind: z.literal("islandFaceup"), code }),
]);
export type XpCount = z.infer<typeof xpCountSchema>;

export const VERBS = [
  // Resolution: one line of the campaign card's "Gain the following" list ("1 XP for each surviving player", "2 XP if Thunderstruck is in the
  // victory display", "-1 XP if Ominous Fate is in the victory display") or the Hard/Expert Mode card's "Gain 1 XP". `amount` XP once, or for each
  // of `each`, at most `max` XP from the line; the condition is the record's `when`. The scenario's lines add up in the Resolution's log (`xp`), and
  // the Campaign Log keeps the total for the scenario, never below 0. Nothing is spent here: the players choose where the XP goes.
  z.strictObject({ verb: z.literal("GainXp"), amount: z.number().int().refine((value) => value !== 0, { message: "amount is 0" }), each: xpCountSchema.optional(), max: z.number().int().positive().optional(), ...when }),
] as const;

export const TRIGGERS = [
  // About a seat: it drew cards (the event's amount, the effect's X, is how many) by the resource phase or a card effect, once the draw is done: "After a
  // player draws any number of cards, that player raises their threat by that number" (11217:A:2). Announced only in a game that has the Hard/Expert
  // Mode card (dcce.hard-expert), so no other game's events change.
  "cardsDrawn",
] as const;
export const FLAGS = [
  // On a seat: its threat is lowered by effects by at most this much each round ("cannot be reduced by more than 1 each round", 11217:A:1;
  // dcce.hard-expert). The reductions made this round are kept in the state (`threatLoweredBy`) until the round ends.
  "threatReductionCap",
  // On a seat: its threat cannot be reduced by any effect ("Each player's threat cannot be reduced", 11217:B:1; dcce.hard-expert).
  "threatReductionBarred",
] as const;
