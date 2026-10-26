// Stat modifiers in effect records: what a modifier changes, how long it lasts, and the ModifyStat instruction.
import { z } from "zod";

import { amountSchema } from "./effect-schema-amount.ts";
import { when } from "./effect-schema-conditions.ts";
import { pickSchema } from "./effect-schema-pick.ts";
import { FAMILY_FLAGS } from "./families/index.ts";


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
  // Flags a player card gives or takes away. A keyword gained ("Attached hero gains sentinel"); a character that does not
  // exhaust to commit to the quest, to attack or to defend; one that cannot commit to the quest or defend (cannotAttack bars
  // its attacks too); one that cannot have attachments; one that does not ready in the refresh phase; a card in the staging
  // area that does not contribute its Threat; an enemy that does not make engagement checks.
  "sentinel",
  "ranged",
  "noExhaustQuest",
  "noExhaustAttack",
  "noExhaustDefend",
  "cannotQuest",
  "cannotDefend",
  "cannotHaveAttachments",
  "cannotHaveRestricted",
  "doesNotReady",
  "noThreatContribution",
  "noEngagementChecks",
  // Numbers a seat or a hero holds: cards drawn beyond the one in the resource phase (on "seat:N"), resources a hero
  // collects beyond the one, restricted attachments a character may have beyond two.
  "extraDraw",
  // A character that may take the damage of an undefended attack against its controller, as a hero would.
  "takesUndefendedDamage",
  "extraResource",
  "extraRestricted",
  // The flags each mechanic family adds (src/catalog/families).
  ...FAMILY_FLAGS,
]);

export const modifyStatSchema = z.strictObject({
  verb: z.literal("ModifyStat"),
  stat: modifierStatSchema,
  // A number, or one the engine reads ("+1 Attack for each enemy engaged with you"): when the effect resolves for a lasting
  // effect, each time the constant records are rebuilt for a constant.
  amount: amountSchema,
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
  // `engagedSeatCharacters` is every character of the player the source is engaged with (141050:A:2). `subject` is the card
  // the event a Response answers was about. `actorSeat` and `pickedSeat` hold a seat number (extraDraw). `other` is the second card
  // the answered event names (the enemy a character defends against or attacks), `pickedPlayerHeroes` every hero the picked
  // player controls, fixed when the effect resolves.
  target: z
    .enum(["self", "attacker", "host", "table", "engagedSeat", "eachSeat", "heroes", "hobbitCharacters", "enemies", "picked", "pickedPlayerCharacters", "ownHeroes", "defender", "allies", "engagedSeatCharacters", "subject", "actorSeat", "pickedSeat", "other", "pickedPlayerHeroes"])
    .optional(),
  // Only holders with this trait ("Spy enemies get +1 Threat", 141047:A:1).
  trait: z.string().min(1).optional(),
  // Every card that matches, from the source controller's side, instead of `target` ("Each Outlands character you control
  // gets +1 Attack", "Each enemy engaged with you gets -1 Defense"): read when the effect resolves, or for a constant each time
  // its records are rebuilt.
  holders: pickSchema.optional(),
  // Multiplies the amount by this count when the stat is read. `hobbitHero` is the Hobbit heroes the source's controller has.
  per: z.enum(["committed", "ally", "hobbitHero", "x"]).optional(),
  ...when,
});

