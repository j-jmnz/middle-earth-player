// The vocabulary player attacks: attack modifiers and targets, immediate attacks, attacks into the staging area adds to effect records: simple verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them. src/rules/families/attack/index*.ts runs them.
import { z } from "zod";

import { cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";

export const VERBS = [
  // The `attacker` character (the card picked before the last by default) is declared as an attacker against the `enemy` (the
  // last picked card by default), engaged with a player or in the staging area, and the attack resolves now, outside the attack
  // step, with the steps and windows of a player attack (rr.attacks-outside-the-combat-phase, rr.step-6-8b to rr.step-6-8-4).
  // It is an extra attack (faq.limitations-on-attacks). The attacker must be ready and exhausts, unless it does not exhaust to
  // attack; `exhausted`: the effect's cost already exhausted it ("Exhaust a character ... to declare it as an attacker").
  // `ranged`: the card calls it a ranged attack (132014:A:2). The instructions after it run once the attack is over, with the
  // attacker as the last picked card ("Then, ... commit that hero to the quest").
  z.strictObject({
    verb: z.literal("DeclareAttack"),
    attacker: cardRefSchema.optional(),
    enemy: cardRefSchema.optional(),
    exhausted: z.boolean().optional(),
    ranged: z.boolean().optional(),
    ...when,
  }),
  // Opens a player attack window for the actor now: they may declare one attack against each enemy that matches `pick` (read
  // now, from the actor's side), as if it were engaged with them, until they decline or none is left. These attacks are extra
  // (faq.limitations-on-attacks): "You may declare and resolve an attack against each non-unique enemy in the staging area as if
  // it were engaged with you" (22007:A:2).
  z.strictObject({ verb: z.literal("OfferAttacks"), pick: pickSchema, ...when }),
  // Places `amount` progress tokens on the current quest; the active location takes them first (rr.active-location), and a full
  // quest card advances when it may ("place 2 progress tokens on the current quest", 01005:A:2).
  z.strictObject({ verb: z.literal("QuestProgress"), amount: positiveAmountSchema, ...when }),
  // The excess damage of the player attack in progress, dealt beyond the attacked enemy's remaining hit points, is dealt to the
  // last picked enemy as well ("Excess damage dealt by this attack is assigned to the chosen enemy", 08004:A:3).
  z.strictObject({ verb: z.literal("ExcessDamageTo"), ...when }),
] as const;

export const TRIGGERS = [
  // About each character that attacked, as the player attack it was declared in ends (rr.step-6-8-4; the other card is the
  // enemy): "After ~ attacks", "After an attack in which ~ attacked resolves".
  "attacked",
  // About each attacker: the attack dealt damage to the enemy (the other card): "After ~ attacks and damages an enemy".
  "attackDamaged",
  // About each attacker, like attackDestroyed, when the destroyed enemy (the other card) was engaged with a player: the event's
  // seat is that player ("an enemy engaged with another player", "reduce the engaged player's threat").
  "attackDestroyedEngaged",
] as const;

export const FLAGS = [
  // On a character: it can be declared as an attacker against enemies in the staging area (`attacksStaging`), or only when it
  // attacks alone (`attacksStagingAlone`, 01009:A:1).
  "attacksStaging",
  "attacksStagingAlone",
  // On an attacking character: the enemy it attacks does not count its Defense against this attack ("While ~ is attacking alone,
  // the defending enemy does not count its Defense").
  "ignoresDefense",
  // On a character: Attack it gets for its next attack this phase (19090:A:1). It becomes a for-this-attack modifier when the
  // character is declared as an attacker.
  "nextAttackBonus",
  // On a seat: that player draws this many cards each time an attack they declared destroys an enemy (12114:A:1).
  "drawOnAttackDestroy",
  // On a seat (engine use): the player engaged an enemy this round, for the `engagedThisRound` condition.
  "engagedThisRound",
] as const;
