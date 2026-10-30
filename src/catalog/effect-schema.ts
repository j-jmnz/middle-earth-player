import { z } from "zod";

// Effect records are data. The vocabulary here (verbs, conditions, triggers, timings) is owned by the
// catalog, and the reducer reads it. Amounts in authored records are fine; a player intent never supplies one.
// The vocabulary is split by behavior: stat modifiers (effect-schema-stats.ts), what a Pick offers (effect-schema-pick.ts), conditions and
// targets (effect-schema-conditions.ts), and the simple verbs (effect-schema-verbs.ts). This file composes them and keeps every export.
import { amountExprSchema, amountSchema, cardRefSchema } from "./effect-schema-amount.ts";
import { conditionSchema, targetSchema, when } from "./effect-schema-conditions.ts";
import { pickSchema, sphereSchema, whoSchema } from "./effect-schema-pick.ts";
import { modifierStatSchema, modifierUntilSchema } from "./effect-schema-stats.ts";
import { simpleInstructionSchema, simpleVerbs } from "./effect-schema-verbs.ts";
import { FAMILY_TRIGGERS } from "./families/index.ts";

export { isStatCondition, phaseNameSchema, type Condition } from "./effect-schema-conditions.ts";
export { amountExprSchema, amountSchema, cardRefSchema, conditionSchema, modifierStatSchema, modifierUntilSchema, pickSchema, sphereSchema, targetSchema };

// Events the engine announces. Forced and triggered effects name one of these.
export const triggerSchema = z.enum([
  "revealed",
  "hideFailed",
  "endOfPhase",
  "endOfRound",
  "firstPlayerTokenPassed",
  "hideSucceeded",
  "traveled",
  "leftPlay",
  // A hero or ally was destroyed by damage (not discarded, not returned to hand).
  "characterDestroyed",
  // Heard by the card itself: it was played from the hand, it entered play (played or put into play), it was committed to
  // the quest, it took damage. `allyLeftPlay` is heard by every card: an ally card left play.
  "played",
  "enteredPlay",
  "committed",
  "damaged",
  "allyLeftPlay",
  // A Response here can cancel what is about to happen: the "when revealed" effects of the card just revealed, the
  // shadow effect of the card just turned up in an attack (rr.cancel).
  "whenRevealedPending",
  "shadowPending",
  // An encounter card was just revealed from the encounter deck, before any of its effects (keywords included) resolve.
  // A Response here can cancel all of them (Frodo Baggins, 141001).
  "encounterRevealed",
  // Heard by every card that was attached to a location that left play (the event's subject).
  "hostLeftPlay",
  // An enemy was engaged with a player (subject), and a player's attack destroyed an enemy (heard by each attacker).
  "engaged",
  "attackDestroyed",
  // The staging step of the quest phase begins, before the first card is revealed (141051:A:2, rr.step-3-3).
  "stagingStepBegins",
  // Heard by the location itself: it became the active location (141048:A:2, rr.active-location).
  "becameActive",
  // Heard by the enemy itself: it attacks, before the defender is declared (141069:A:2, rr.step-6-4b).
  "attacks",
  // About a character: it was declared as a defender (the event's other card is the attacking enemy), or as an attacker (the
  // other card is the enemy it attacks).
  "declaredDefender",
  "declaredAttacker",
  // About the seat: its quest succeeded or failed this phase (rr.step-3-4), its threat was raised.
  "questSucceeded",
  "questFailed",
  "threatRaised",
  // About an encounter card: it was added to the staging area (revealed or put there).
  "addedToStaging",
  // About an enemy: its attack is over (the other card is the defender, when there was one).
  "attackResolved",
  // About a card: it was healed, it exhausted, it readied, it was discarded from a player's hand or deck.
  "healed",
  "exhausted",
  "readied",
  "discardedFromHand",
  "discardedFromDeck",
  // About the seat: a phase begins (the event's phase names it).
  "beginningOfPhase",
  // About a hero: a card effect added resources to its pool.
  "resourcesAdded",
  // About an enemy: damage destroyed it (any player's attack or effect).
  "enemyDestroyed",
  // About a character: damage was just dealt to it, before it can be destroyed by it. The window for "cancel X damage just
  // dealt" and "place that damage on ~ instead" (CancelDamage; the event's amount is `{ dealt: true }`).
  "damageDealt",
  // The triggers each mechanic family adds (src/catalog/families).
  ...FAMILY_TRIGGERS,
]);

// What a player pays to use an Action or Response. Resources come from the payments on the Trigger intent. A cost that asks
// the player to choose a card (exhaust a Dwarf character, discard a card from your hand) is the first instructions of the
// effect, with a condition that the choice can be made.
export const costSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("exhaustSelf") }),
  z.strictObject({ kind: z.literal("addSelfToVictory") }),
  z.strictObject({ kind: z.literal("discardSelf") }),
  // The card the source is attached to exhausts too ("Exhaust ~ and attached hero").
  z.strictObject({ kind: z.literal("exhaustHost") }),
  // A card in play with this code exhausts (The One Ring).
  z.strictObject({ kind: z.literal("exhaustCode"), code: z.string().min(1) }),
  z.strictObject({ kind: z.literal("raiseThreat"), amount: z.number().int().positive() }),
  // Damage on the source itself ("Deal 1 damage to ~ to ...").
  z.strictObject({ kind: z.literal("damageSelf"), amount: z.number().int().positive() }),
  z.strictObject({ kind: z.literal("returnSelfToHand") }),
  // The top cards of the actor's deck go to the discard pile.
  z.strictObject({ kind: z.literal("discardDeckTop"), amount: z.number().int().positive() }),
  // `from`: only resources in the source's own pool (`self`), or its host's pool (`host`), may pay. Any hero of the actor's,
  // with a matching icon, otherwise.
  z.strictObject({
    kind: z.literal("resources"),
    amount: z.number().int().positive(),
    sphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]).optional(),
    from: z.enum(["self", "host"]).optional(),
  }),
  // An event used from the hand: its printed cost is paid, and the card is discarded when the effect is done.
  z.strictObject({ kind: z.literal("playEvent") }),
]);


const choiceSchema = z.strictObject({
  verb: z.literal("Choose"),
  who: whoSchema,
  // Each option may be taken once in this effect: a later Choose of the same effect offers only the options not taken yet
  // ("each player chooses 1 different option", src/rules/families/deck-choose.ts).
  different: z.boolean().optional(),
  options: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        requires: conditionSchema.optional(),
        instructions: z.array(simpleInstructionSchema),
      }),
    )
    .min(1),
});

// `endOfAttack`: when the player attack in progress ends (rr.step-6-8-4; "After this attack resolves, discard ~"), with the
// attacked enemy as the frame's other card (src/rules/families/attack-flow.ts).
const delaySchema = z.strictObject({
  verb: z.literal("Delay"),
  // `questSucceeded`: when the players quest successfully this phase, and never if they do not ("If the players quest
  // successfully, deal 1 damage to that enemy", 19112:A:1).
  // `startOfGame`: once the opening hands and mulligans are done, before the first round (a Setup that needs the players to choose).
  // `questFailed`: when the players quest unsuccessfully this phase, and never if they do not ("If the players quest unsuccessfully this phase,
  // put the Nazgûl of Dol Guldur into play", 900307:A:1; rr.step-3-4).
  until: z.enum(["endOfPhase", "endOfRound", "questSucceeded", "questFailed", "endOfAttack", "startOfGame"]),
  uncancelable: conditionSchema.optional(),
  // The delayed instructions act on the card the last Pick chose (Sneak Attack's ally).
  subject: z.literal("picked").optional(),
  instructions: z.array(simpleInstructionSchema),
});

// Instructions that run, with the attacking enemy as the source, once the attack in progress ends. `when` is read as the shadow effect
// resolves, while the attack is still in progress ("If undefended, move the damage to the hero damaged by this attack", 900209:A:2).
const afterAttackSchema = z.strictObject({
  verb: z.literal("AfterAttack"),
  instructions: z.array(simpleInstructionSchema),
  ...when,
});

const forEachPlayerSchema = z.strictObject({
  verb: z.literal("ForEachPlayer"),
  order: z.enum(["lastFirst", "firstFirst"]),
  instructions: z.array(z.discriminatedUnion("verb", [...simpleVerbs, choiceSchema])),
});

// Runs the instructions once for each card that matches the filter now, each time with that card as the picked card ("Ready
// each Dwarf character", "Deal 1 damage to each enemy in the staging area"). Nobody chooses.
const eachSchema = z.strictObject({
  verb: z.literal("Each"),
  pick: pickSchema,
  // A Delay here is made once for each card ("If any of those allies are still in play at the end of the round, discard them").
  instructions: z.array(z.discriminatedUnion("verb", [...simpleVerbs, choiceSchema, delaySchema])),
  // The actor chooses up to this many (`any`: any number) of the matching cards, one at a time, and may stop ("search the top
  // 10 cards for up to 4 Rohan allies"); the instructions then run for each chosen card, and the effect's X becomes how many
  // were chosen. `totalCost`: the chosen cards' printed costs add up to at most this. `taken` is engine use: the cards chosen
  // so far (src/rules/families/deck-each.ts).
  upTo: z.union([z.number().int().positive(), z.literal("any")]).optional(),
  totalCost: amountSchema.optional(),
  taken: z.array(z.string()).optional(),
  ...when,
});

// Runs the instructions this many times ("Resolve that effect again for each copy of ~ in your discard pile").
const repeatSchema = z.strictObject({
  verb: z.literal("Repeat"),
  times: amountSchema,
  instructions: z.array(z.discriminatedUnion("verb", [...simpleVerbs, choiceSchema])),
});

export const instructionSchema = z.discriminatedUnion("verb", [...simpleVerbs, choiceSchema, delaySchema, afterAttackSchema, forEachPlayerSchema, eachSchema, repeatSchema]);

export const timingSchema = z.enum([
  "setup",
  "forced",
  // A mandatory reaction that is not printed as Forced. It resolves before Forced effects on the same event.
  "triggered",
  "whenRevealed",
  "response",
  "action",
  "shadow",
  "constant",
  "questResolution",
  // The Setup and the Resolution printed on a campaign card (front and back).
  "campaignSetup",
  "resolution",
  "travel",
  "engagement",
  "beginningOfPhase",
  "endOfPhase",
  "endOfRound",
]);

// An optional paid cancel offered to the first player before the effect resolves.
export const cancelSchema = z.strictObject({
  cost: z.number().int().positive(),
  sphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]).optional(),
  // The effect cannot be canceled while this holds.
  unless: conditionSchema.optional(),
});

// The uses an ability allows (rr.limits): `oncePerRoundEachPlayer` lets each player use it once a round; a `Group` limit counts
// every copy of the card for the whole group of players.
export const limitSchema = z.enum([
  "oncePerPhase",
  "oncePerRound",
  "oncePerRoundEachPlayer",
  "twicePerPhase",
  "twicePerRound",
  "thricePerPhase",
  "fivePerPhase",
  "oncePerAttack",
  "oncePerGame",
  // Once per campaign: the use is recorded in the Campaign Log's `usedOnce` facts, by the card's code, so a later scenario's copy
  // of the card cannot use it again ("Limit once per campaign. Record in Campaign Log when used.", 41044:A:3; rules/usage.ts).
  "oncePerCampaign",
  "oncePerGameGroup",
  "thricePerGameGroup",
  // Once a round for each player, counting every copy of the card ("You cannot trigger this ability if you have already
  // triggered the ability of a Steward of Orthanc this round").
  "oncePerRoundGroupEachPlayer",
  // Once a phase for each player, counting every copy of the card; on an event's Action, its play ("You can only play 1 copy
  // of The Tree People each phase", src/rules/families/deck-play.ts).
  "oncePerPhaseGroupEachPlayer",
]);

// Which card an event must be about for an effect to hear it. Without it, an event about one card is heard by that card only.
// `self`: the source; `host`: the card it is attached to; a filter: any card that matches, from the source controller's side
// ("After a Silvan ally enters play", "After an enemy is added to the staging area").
export const subjectSchema = z.union([z.enum(["self", "host"]), pickSchema]);

export const effectSchema = z.strictObject({
  // "<code>:<timing>:<n>"
  id: z.string().min(1),
  cardCode: z.string(),
  // The printed lines this record implements, as "<code>:<side>:<n>" ledger line ids (data/printed). Every record names
  // at least one; scripts/effect-coverage.test.ts checks that they exist, belong to cardCode and match the timing.
  lines: z.array(z.string().min(1)).min(1),
  timing: timingSchema,
  trigger: triggerSchema.optional(),
  // `oncePerRoundEachPlayer`: each player may use it once a round, and any player may.
  limit: limitSchema.optional(),
  // One cost, or several paid together ("Exhaust ~ and raise your threat by 1").
  cost: z.union([costSchema, z.array(costSchema).min(1)]).optional(),
  subject: subjectSchema.optional(),
  // The event happened to the source controller (`you`: "After you engage an enemy") or to another player (`other`).
  eventSeat: z.enum(["you", "other"]).optional(),
  // Any player may use this Action or Response, not only its controller ("Any player may trigger this ability").
  anyPlayer: z.boolean().optional(),
  // This Action or Response of a card that is not an event is used from its owner's hand, and only there ("put ~ into play
  // from your hand", rr.in-play-and-out-of-play: an ability that refers to being used from an out-of-play area).
  fromHand: z.literal(true).optional(),
  // A "revealed" event is heard only when the encounter deck itself revealed the card (staging, a surge, the top card;
  // rr.staging), not when a player searched for it and revealed it ("as it is revealed by the encounter deck", 01006:A:1).
  byEncounterDeck: z.literal(true).optional(),
  cancel: cancelSchema.optional(),
  // While this holds, nothing may cancel the effect ("If The One Ring is exhausted, this effect cannot be canceled").
  uncancelable: conditionSchema.optional(),
  condition: conditionSchema.optional(),
  instructions: z.array(instructionSchema),
});

export type Instruction = z.infer<typeof instructionSchema>;
export type SimpleInstruction = z.infer<typeof simpleInstructionSchema>;
export type PickSpec = z.infer<typeof pickSchema>;
export type Target = z.infer<typeof targetSchema>;
export type Trigger = z.infer<typeof triggerSchema>;
export type Timing = z.infer<typeof timingSchema>;
export type Cost = z.infer<typeof costSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type ModifierUntil = z.infer<typeof modifierUntilSchema>;
export type ModifierStat = z.infer<typeof modifierStatSchema>;
export type Limit = z.infer<typeof limitSchema>;
export type Subject = z.infer<typeof subjectSchema>;
export type Amount = z.infer<typeof amountSchema>;
export type AmountExpr = z.infer<typeof amountExprSchema>;
export type CardRef = z.infer<typeof cardRefSchema>;
