import { z } from "zod";

// Effect records are data. The vocabulary here (verbs, conditions, triggers, timings) is owned by the
// catalog, and the reducer reads it. Amounts in authored records are fine; a player intent never supplies one.
// The vocabulary is split by behavior: stat modifiers (effect-schema-stats.ts), what a Pick offers (effect-schema-pick.ts), conditions and
// targets (effect-schema-conditions.ts), and the simple verbs (effect-schema-verbs.ts). This file composes them and keeps every export.
import { conditionSchema, targetSchema } from "./effect-schema-conditions.ts";
import { pickSchema, whoSchema } from "./effect-schema-pick.ts";
import { modifierStatSchema, modifierUntilSchema } from "./effect-schema-stats.ts";
import { simpleInstructionSchema, simpleVerbs } from "./effect-schema-verbs.ts";

export { isStatCondition, phaseNameSchema, type Condition } from "./effect-schema-conditions.ts";
export { conditionSchema, modifierStatSchema, modifierUntilSchema, pickSchema, targetSchema };

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
]);

// What a player pays to use an Action or Response. Resources come from the payments on the Trigger intent.
export const costSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("exhaustSelf") }),
  z.strictObject({ kind: z.literal("addSelfToVictory") }),
  z.strictObject({ kind: z.literal("discardSelf") }),
  z.strictObject({
    kind: z.literal("resources"),
    amount: z.number().int().positive(),
    sphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]).optional(),
  }),
  // An event used from the hand: its printed cost is paid, and the card is discarded when the effect is done.
  z.strictObject({ kind: z.literal("playEvent") }),
]);


const choiceSchema = z.strictObject({
  verb: z.literal("Choose"),
  who: whoSchema,
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

const delaySchema = z.strictObject({
  verb: z.literal("Delay"),
  until: z.enum(["endOfPhase", "endOfRound"]),
  uncancelable: conditionSchema.optional(),
  // The delayed instructions act on the card the last Pick chose (Sneak Attack's ally).
  subject: z.literal("picked").optional(),
  instructions: z.array(simpleInstructionSchema),
});

// Instructions that run, with the attacking enemy as the source, once the attack in progress ends.
const afterAttackSchema = z.strictObject({
  verb: z.literal("AfterAttack"),
  instructions: z.array(simpleInstructionSchema),
});

const forEachPlayerSchema = z.strictObject({
  verb: z.literal("ForEachPlayer"),
  order: z.enum(["lastFirst", "firstFirst"]),
  instructions: z.array(z.discriminatedUnion("verb", [...simpleVerbs, choiceSchema])),
});

export const instructionSchema = z.discriminatedUnion("verb", [...simpleVerbs, choiceSchema, delaySchema, afterAttackSchema, forEachPlayerSchema]);

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
  limit: z.enum(["oncePerPhase", "oncePerRound", "oncePerRoundEachPlayer"]).optional(),
  cost: costSchema.optional(),
  cancel: cancelSchema.optional(),
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
