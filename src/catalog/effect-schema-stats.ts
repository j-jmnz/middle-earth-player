// Stat modifiers in effect records: what a modifier changes, how long it lasts, and the ModifyStat instruction.
import { z } from "zod";

import { when } from "./effect-schema-conditions.ts";


// `whileSourceInVictory`: a constant that works from the victory display ("While Weathertop is in the victory display",
// 141046:A:2). The engine writes it; a record names `whileSourceInPlay`.
export const modifierUntilSchema = z.enum(["endOfPhase", "endOfRound", "endOfAttack", "whileSourceInPlay", "whileSourceInVictory"]);

// Stats on a card, plus Hide numbers held by a seat or the table, and a flag that bars an enemy's attack.
export const modifierStatSchema = z.enum([
  "willpower",
  "attack",
  "defense",
  "threat",
  "questPoints",
  "engagementCost",
  "hideValue",
  "hideThreat",
  "hideWillpower",
  "cannotAttack",
  // Hit points: the printed health plus modifiers. A character with damage at or above it is destroyed.
  "hitPoints",
  // Flags, like cannotAttack: the holder takes no damage at all (141048:A:1), no damage but combat damage (141070:A:2),
  // cannot be engaged by any means (141048:A:1), or cannot be optionally engaged (141051:A:1, 141052:A:1).
  "cannotTakeDamage",
  "cannotTakeNonCombatDamage",
  "cannotBeEngaged",
  "cannotBeOptionallyEngaged",
]);

export const modifyStatSchema = z.strictObject({
  verb: z.literal("ModifyStat"),
  stat: modifierStatSchema,
  amount: z.number().int(),
  until: modifierUntilSchema,
  // Whose stat changes. The default is the source card. `attacker` is the enemy in the attack in progress.
  // `host` is the card the source is attached to. `table` is every seat. `engagedSeat` is the seat the
  // source is engaged with. `eachSeat` is one holder per living seat.
  // `heroes`, `hobbitCharacters` and `enemies` are every such card in play, for a constant effect. A Hide number
  // held by the table or a seat is read through `per`.
  // `picked` is the card the last Pick chose, `pickedPlayerCharacters` every character the picked player controls, `ownHeroes`
  // every hero the actor controls: all fixed when the effect resolves.
  // `defender` is the character defending the attack in progress (141052:A:2). `allies` is every ally in play: from an
  // encounter card's lasting effect it also holds for allies that enter play later (rr.lasting-effects, 141071:A:1).
  // `engagedSeatCharacters` is every character of the player the source is engaged with (141050:A:2).
  target: z
    .enum(["self", "attacker", "host", "table", "engagedSeat", "eachSeat", "heroes", "hobbitCharacters", "enemies", "picked", "pickedPlayerCharacters", "ownHeroes", "defender", "allies", "engagedSeatCharacters"])
    .optional(),
  // Only holders with this trait ("Spy enemies get +1 Threat", 141047:A:1).
  trait: z.string().min(1).optional(),
  // Multiplies the amount by this count when the stat is read. `hobbitHero` is the Hobbit heroes the source's controller has.
  per: z.enum(["committed", "ally", "hobbitHero", "x"]).optional(),
  ...when,
});

