// The vocabulary player attacks: attack modifiers and targets, immediate attacks, attacks into the staging area adds to effect records: simple verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them. src/rules/families/attack/ runs them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";

const VERBS = [
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
  // `main`: the main quest card takes them whichever quest is current: a side quest that is the current quest does not, and the active location keeps none of them then ("add 10 progress to the main quest", 10139:A:3).
  z.strictObject({ verb: z.literal("QuestProgress"), amount: positiveAmountSchema, main: z.boolean().optional(), ...when }),
  // The excess damage of the player attack in progress, dealt beyond the attacked enemy's remaining hit points, is dealt to the
  // last picked enemy as well ("Excess damage dealt by this attack is assigned to the chosen enemy", 08004:A:3).
  z.strictObject({ verb: z.literal("ExcessDamageTo"), ...when }),
] as const;

const TRIGGERS = [
  // About each character that attacked, as the player attack it was declared in ends (rr.step-6-8-4; the other card is the
  // enemy): "After ~ attacks", "After an attack in which ~ attacked resolves".
  "attacked",
  // About each attacker: the attack dealt damage to the enemy (the other card): "After ~ attacks and damages an enemy".
  "attackDamaged",
  // About each attacker, like attackDestroyed, when the destroyed enemy (the other card) was engaged with a player: the event's
  // seat is that player ("an enemy engaged with another player", "reduce the engaged player's threat").
  "attackDestroyedEngaged",
] as const;

const FLAGS = [
  // On an enemy: it gains Toughness of this amount until the modifier ends, on top of any it prints ("Attacking enemy gets +2 Attack and gains Toughness 2 until the end of the round", 143043:A:2;
  // mec109.toughness): each instance of damage it is assigned is reduced by it.
  "toughness",
  // On a character: it can be declared as an attacker against enemies in the staging area (`attacksStaging`), or only when it
  // attacks alone (`attacksStagingAlone`, 01009:A:1).
  "attacksStaging",
  "attacksStagingAlone",
  // On an enemy in the staging area: characters with the ranged keyword, of any player, may be declared as attackers against it during the player attacks of the combat phase, together with
  // each other, one attack per seat (Goblin Archer, 03032:A:2; rr.ranged, agent recommendation in docs/scenarios/dwarrowdelf.md, The Seventh Level). Characters without ranged cannot (rules/combat/combat.ts canAttack).
  "attackableByRanged",
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
  // On an enemy: only characters with the Eagle trait or the Ranged keyword can attack or defend against it ("Only Eagle characters or characters with ranged can attack or defend against Mirkwood Flock", 02070:A:1).
  "eagleOrRangedOnly",
  // On an enemy, until the modifier ends: a character with the Ranged keyword cannot be declared as an attacker against it ("cannot be attacked by characters with the ranged keyword until the end of the phase", 900606:A:2).
  "cannotBeAttackedByRanged",
  // On an enemy: only characters with the Ranged keyword, printed or gained, can attack or defend against it ("Only characters with ranged can attack or defend against Moria Bats", 04127:A:1); with none able its attack is undefended.
  "onlyRangedCombat",
  // On an enemy, until the modifier ends: it loses the Spectral keyword ("that enemy loses the Spectral keyword until the end of the phase", 50311:A:1; docs/scenarios/standalone-scenarios.md, The Stone of Erech): characters attacking it use their Attack again.
  "losesSpectral",
] as const;

export const manifest = { name: "attack", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
