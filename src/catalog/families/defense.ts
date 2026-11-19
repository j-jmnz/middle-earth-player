// The vocabulary enemy attacks: defenders, the damage window (cancel, prevent, reduce, redirect), shadow cards adds to effect records: simple verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them. src/rules/families/defense/ runs them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { amountSchema, cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { sphereSchema } from "../effect-schema-pick.ts";

const VERBS = [
  // The actor chooses a number from 1 to the smallest of these amounts (read now): it becomes the effect's X ("Cancel X damage
  // just dealt", "Spend X resources ... to cancel X damage"). One possible number is taken without asking; none leaves X at 0.
  z.strictObject({ verb: z.literal("ChooseAmount"), upTo: z.array(amountSchema).min(1), ...when }),
  // Removes resources from a card's pool (the picked card by default): "Spend X resources from attached hero's pool", "pay 1
  // Tactics resource". Fewer go when the pool runs out.
  z.strictObject({ verb: z.literal("SpendFromPool"), amount: positiveAmountSchema, from: cardRefSchema.optional(), ...when }),
  // Moves damage the answered `damageDealt` event just dealt onto another card instead ("place that damage on Dori instead",
  // "place 1 of that damage on attached character instead"): that much is canceled on the damaged card and placed on `to`.
  // Nothing moves when `to` is the damaged card itself or is not in play.
  z.strictObject({ verb: z.literal("RedirectDamage"), to: cardRefSchema, amount: positiveAmountSchema.optional(), all: z.boolean().optional(), ...when }),
  // The enemy (`target`, the picked one by default) cannot attack the actor until the end of the phase or round; with `who:
  // "picked"`, every enemy engaged with the picked player cannot attack that player ("That player's engaged enemies cannot
  // attack that player this phase").
  z.strictObject({
    verb: z.literal("PreventAttacks"),
    target: cardRefSchema.optional(),
    who: z.literal("picked").optional(),
    until: z.enum(["endOfPhase", "endOfRound"]),
    ...when,
  }),
  // Discards a shadow card dealt to the enemy (`target`, the picked one by default): a facedown one if it has any. With `all`, each shadow card dealt to it ("discard each shadow card from that enemy", 10192:A:1).
  z.strictObject({ verb: z.literal("DiscardShadowOf"), target: cardRefSchema.optional(), all: z.literal(true).optional(), ...when }),
  // The damage this attack deals beyond the remaining hit points of the character it damages must be assigned to the card in play with this title, wherever it lies, instead of staying lost: "Excess damage dealt by this attack must be assigned to Arwen Undómiel" (901407:A:2; rr.damage). An undefended attack has
  // no excess. A Shadow effect: it is read as the damage is dealt, in families/defense/excess.ts.
  z.strictObject({ verb: z.literal("ExcessToCard"), name: z.string().min(1), ...when }),
  // Deals the enemy (`target`) one more shadow card from the encounter deck ("deal the attacking enemy another shadow card"):
  // during its attack it resolves after the ones it has. `from: encounter`: the card comes from the encounter deck even for an enemy that is dealt from another deck ("from the encounter deck (not the Balrog deck)", 901806:A:1).
  z.strictObject({ verb: z.literal("DealShadowTo"), target: cardRefSchema, from: z.literal("encounter").optional(), ...when }),
  // Shows the actor a facedown shadow card dealt to the enemy (`target`, the picked one by default). `markEffect`: the effect's X
  // becomes 1 when that card has a shadow effect, else 0 ("If that card has a shadow effect, ~ gets +2 Defense").
  z.strictObject({ verb: z.literal("LookAtShadow"), target: cardRefSchema.optional(), markEffect: z.boolean().optional(), ...when }),
  // The `attacker` character is declared as an attacker against the `enemy` and the attack resolves now, outside the attack
  // step ("declare him as an attacker against that enemy (and resolve his attack)"). `defense` changes the enemy's Defense for
  // this attack.
  z.strictObject({ verb: z.literal("StrikeBack"), attacker: cardRefSchema, enemy: cardRefSchema, defense: z.number().int().optional(), ...when }),
  // The last picked character is declared as a defender of the attack in progress, beside any already declared
  // (rr.multiple-defenders). It exhausts unless it is exhausted already ("declare an exhausted character") or does not exhaust
  // to defend, and "is declared as a defender" is announced.
  z.strictObject({ verb: z.literal("AddDefender"), ...when }),
  // The rest of the running effect is skipped: the player declares no more defenders.
  z.strictObject({ verb: z.literal("EndDeclaring"), ...when }),
  // The attack in progress is canceled: no shadow effect or damage resolves after this, and the enemy's attack is used up.
  z.strictObject({ verb: z.literal("CancelAttack"), ...when }),
  // Engine use: the last picked defender takes all the damage of the attack in progress (rr.multiple-defenders).
  z.strictObject({ verb: z.literal("AssignAttackDamage"), ...when }),
  // Engine use: each defender of the attack in progress that took no damage from it readies.
  z.strictObject({ verb: z.literal("ReadyUnharmed"), ...when }),
  // Readies characters once the attack in progress ends. `subject`: the card the answered event was about, `unharmedDefenders`:
  // each defender that took no damage from the attack. `ifNoDamage`: only when the attack dealt no damage. `pay`: the players
  // as a group may first spend that many resources of the sphere ("may spend 2 Tactics resources to ready ...").
  z.strictObject({
    verb: z.literal("ReadyAfterAttack"),
    who: z.enum(["subject", "unharmedDefenders"]),
    ifNoDamage: z.boolean().optional(),
    pay: z.strictObject({ amount: z.number().int().positive(), sphere: sphereSchema }).optional(),
    ...when,
  }),
  // Turns the attacking enemy's shadow card face up. If it has no shadow effect, the attack is resolved against the enemy
  // `target` (the picked one by default) instead of the defenders: that enemy takes the damage, read against its Defense.
  z.strictObject({ verb: z.literal("RedirectAttack"), target: cardRefSchema.optional(), ...when }),
  // Shadow effect of an enemy card ("Wolf Rider attacks the defending player", 01081:A:2): the source attacks the player the attack it
  // was dealt to is made against, once that attack has ended, and goes to the top of the encounter deck at the end of the combat phase.
  z.strictObject({ verb: z.literal("ShadowAttacks"), ...when }),
  // Engine use: the first of these shadow cards attacks the defending player, once the instructions before it have run (the "after" of
  // the attack the shadow cards were dealt to, src/rules/combat/shadow.ts finishAttack).
  z.strictObject({ verb: z.literal("StartShadowAttack"), attackers: z.array(z.string().min(1)).min(1), ...when }),
  // A stat change that holds only while the card (`target`) attacks the enemy `versus` ("+2 Attack while attacking that enemy").
  z.strictObject({
    verb: z.literal("ModifyStatVersus"),
    stat: z.enum(["attack", "defense"]),
    amount: z.number().int(),
    until: z.enum(["endOfPhase", "endOfRound"]),
    target: cardRefSchema,
    versus: cardRefSchema,
    ...when,
  }),
] as const;

const TRIGGERS = [
  // About an enemy: its attack against a player (the event's seat) has begun, before defenders are declared ("After an enemy
  // is declared as an attacker against you", "When an enemy attacks a player").
  "enemyAttacks",
  // About each character that defended an attack, as the attack ends (the other card is the enemy): "After ~ defends", "After
  // an attack in which ~ defended resolves". `defendedUnharmed` when it took no damage from that attack; `defenderDestroyed`
  // when it was destroyed while defending it.
  "defended",
  "defendedUnharmed",
  "defenderDestroyed",
  // About a character: it took damage from an enemy attack and is still in play (the amount is the damage).
  "damagedByAttack",
  // About the seat: shadow cards were just dealt to the enemies engaged with it (rr.step-6-2).
  "shadowsDealt",
  // About the attacking enemy: a shadow card just increased its Attack (the other card is the defender).
  "shadowRaisedAttack",
  // About a card: it changed control.
  "changedControl",
  // About a character an enemy's attack destroyed with its combat damage (the other card is the enemy): "After a character is destroyed by a
  // Hill Troll" (01130:A:4). Raised only in a game where some card hears it.
  "characterDestroyedByAttack",
] as const;

const FLAGS = [
  // On an enemy: the damage a player card's effect would place on it is not placed ("While The Watcher is in the staging area, it cannot be damaged by player card effects", 901502:A:1). The damage of a character's attack, and the damage an encounter card's effect deals, are.
  "noPlayerEffectDamage",
  // Damage assigned to the holder goes to the host of the modifier's source instead ("attached hero takes all damage assigned
  // to the chosen hero").
  "damageToSourceHost",
  // The holder may take the damage of an undefended attack against the player who controls the modifier's source ("Damage
  // from undefended attacks against you may be assigned to attached ally").
  "undefendedForSourceController",
  // On a seat: that player may declare any number of eligible characters as defenders against each attack.
  "declaresManyDefenders",
  // On a seat: shadow cards dealt to the enemies engaged with that player are dealt face up.
  "shadowsFaceUp",
  // The holder uses its Willpower instead of its Defense.
  "defenseFromWillpower",
  // Progress the players would place on the quest from questing successfully is assigned as damage to the holder (after the
  // active location takes what it needs).
  "takesQuestProgress",
  // On a seat: that player resolves the step in which they attack enemies before enemy attacks are resolved this phase;
  // `attackedFirst` (engine use) once those attacks are done.
  "attacksFirst",
  "attackedFirst",
  // On an enemy: the combat damage its attack deals beyond the remaining hit points of the character it damages is assigned as an
  // increase to its controller's threat (Hill Troll, 01082:A:1). The damage still goes on the character.
  "excessToThreat",
  // On an enemy: each point of the combat damage its attack deals beyond the remaining hit points of the character it damages is 1 damage the defending player assigns to another character he controls, once the attack ends (Cave-troll, 03020:A:1; families/defense/excess.ts).
  "excessToDamage",
  // On an enemy: each point of damage its attack places on a character raises the defending player's threat by 1 ("Each damage dealt by Wainriders raises the defending player's threat by 1", 00004:A:1). The player the attack is against is the
  // defending player even when another player's Sentinel character defended; damage canceled or shielded is not dealt, and a shadow card's damage is not this enemy's attack.
  "damageToThreat",
  // The holder does not exhaust to defend against enemies with the Trait of the modifier's `when` (`defendingAgainst`): "Grimbeorn the Old does not exhaust to defend against Troll enemies" (02037:A:1).
  "noExhaustDefendVersus",
  // On an enemy: its Defense cannot be reduced, whatever lowers it (900506:A:1); increases still count.
  "cannotReduceDefense",
] as const;

export const manifest = { name: "defense", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
