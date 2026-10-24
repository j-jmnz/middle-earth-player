import { z } from "zod";

// Effect records are data. The vocabulary here (verbs, conditions, triggers, timings) is owned by the
// catalog, and the reducer reads it. Amounts in authored records are fine; a player intent never supplies one.

export const modifierUntilSchema = z.enum(["endOfPhase", "endOfRound", "endOfAttack", "whileSourceInPlay"]);

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
]);

export const phaseNameSchema = z.enum([
  "Setup",
  "Mulligan",
  "Beginning of round",
  "Resource",
  "Planning",
  "Quest",
  "Travel",
  "Encounter",
  "Combat",
  "Refresh",
  "End of round",
]);

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
]);

const whoSchema = z.enum(["actor", "firstPlayer"]);

export const conditionSchema = z.discriminatedUnion("kind", [
  // The actor failed a Hide test in the current phase or round.
  z.strictObject({ kind: z.literal("hideFailed"), scope: z.enum(["phase", "round"]) }),
  // The actor has an enemy engaged with them, with this trait if one is named.
  z.strictObject({ kind: z.literal("hasEngaged"), trait: z.string().min(1).optional() }),
  // A card with this code is in play and its exhausted state is `is`.
  z.strictObject({ kind: z.literal("exhausted"), code: z.string().min(1), is: z.boolean() }),
  // The source is an enemy engaged with the actor.
  z.strictObject({ kind: z.literal("engagedWithActor") }),
  // The running effect has returned no enemy to staging.
  z.strictObject({ kind: z.literal("noneReturned") }),
  z.strictObject({ kind: z.literal("phase"), is: phaseNameSchema }),
  // The encounter deck or discard pile holds a card with this code or trait.
  // Where the source card is now. `play` means any zone the source's controller plays from.
  z.strictObject({ kind: z.literal("sourceIn"), zone: z.enum(["activeLocation", "staging", "engaged", "questStage", "play"]) }),
  // A card with this code is in the victory display (`is`) or is not.
  z.strictObject({ kind: z.literal("inVictory"), code: z.string().min(1), is: z.boolean() }),
  // Some location other than the source is in the staging area or is the active location.
  z.strictObject({ kind: z.literal("otherLocationInPlay") }),
  // The actor controls a hero that is exhausted.
  z.strictObject({ kind: z.literal("heroExhausted") }),
  // The attack in progress has no defender (declared or considered).
  z.strictObject({ kind: z.literal("undefended") }),
  z.strictObject({ kind: z.literal("searchable"), trait: z.string().min(1).optional(), code: z.string().min(1).optional() }),
]);

export const targetSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("self") }),
  z.strictObject({ kind: z.literal("host") }),
  z.strictObject({ kind: z.literal("activeLocation") }),
  z.strictObject({
    kind: z.literal("engagedEnemies"),
    trait: z.string().min(1).optional(),
    who: z.enum(["actor", "each"]),
    pick: z.enum(["all", "choose"]),
  }),
]);

const when = { when: conditionSchema.optional() };

function verb<const Verb extends string>(name: Verb) {
  return z.strictObject({ verb: z.literal(name), ...when });
}

function codeVerb<const Verb extends string>(name: Verb) {
  return z.strictObject({ verb: z.literal(name), code: z.string().min(1), ...when });
}

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
]);

const modifyStatSchema = z.strictObject({
  verb: z.literal("ModifyStat"),
  stat: modifierStatSchema,
  amount: z.number().int(),
  until: modifierUntilSchema,
  // Whose stat changes. The default is the source card. `attacker` is the enemy in the attack in progress.
  // `host` is the card the source is attached to. `table` is every seat. `engagedSeat` is the seat the
  // source is engaged with. `eachSeat` is one holder per living seat.
  target: z.enum(["self", "attacker", "host", "table", "engagedSeat", "eachSeat"]).optional(),
  // Multiplies the amount by this count when the stat is read.
  per: z.enum(["committed", "ally"]).optional(),
  ...when,
});

const searchSelector = { code: z.string().min(1).optional(), trait: z.string().min(1).optional() };

const simpleVerbs = [
  z.strictObject({ verb: z.literal("Draw"), perHero: z.string().min(1).optional(), ...when }),
  verb("GainResources"),
  verb("PayCost"),
  verb("PlayAlly"),
  verb("Attach"),
  z.strictObject({
    verb: z.literal("Exhaust"),
    target: z.strictObject({ kind: z.literal("byCode"), code: z.string().min(1) }).optional(),
    ...when,
  }),
  verb("Ready"),
  verb("Commit"),
  verb("RevealStaging"),
  verb("PlaceProgress"),
  z.strictObject({
    verb: z.literal("RaiseThreat"),
    amount: z.number().int().positive().optional(),
    who: whoSchema.optional(),
    ...when,
  }),
  z.strictObject({ verb: z.literal("Travel"), to: z.literal("self").optional(), ...when }),
  verb("Engage"),
  verb("DealShadow"),
  verb("DeclareDefender"),
  verb("DealDamage"),
  verb("Attack"),
  verb("AdvanceStep"),
  verb("ResolveEffect"),
  modifyStatSchema,
  codeVerb("AddToStaging"),
  codeVerb("MakeActiveLocation"),
  codeVerb("SetAside"),
  codeVerb("AttachToRingBearer"),
  // Moves a card that was set aside, out of play, into the staging area. It is not a reveal.
  codeVerb("AddSetAsideToStaging"),
  verb("ShuffleEncounterDeck"),
  // Setup: each player draws this many fewer cards in the starting hand (and in a mulligan redraw).
  z.strictObject({ verb: z.literal("ReduceOpeningHand"), amount: z.number().int().positive(), ...when }),
  // Moves one matching card from the encounter discard pile into the encounter deck, then shuffles.
  z.strictObject({ verb: z.literal("ShuffleIntoDeck"), ...searchSelector, ...when }),
  // Finds a card in the encounter deck or discard pile and reveals it.
  z.strictObject({ verb: z.literal("SearchReveal"), ...searchSelector, who: whoSchema, ...when }),
  // Finds a card in the encounter deck or discard pile and puts it out without revealing it.
  z.strictObject({
    verb: z.literal("SearchMove"),
    ...searchSelector,
    to: z.enum(["staging", "engagedFirstPlayer"]),
    ...when,
  }),
  z.strictObject({ verb: z.literal("ReturnToStaging"), target: targetSchema, ...when }),
  z.strictObject({
    verb: z.literal("EngageAll"),
    trait: z.string().min(1).optional(),
    who: whoSchema,
    ...when,
  }),
  z.strictObject({ verb: z.literal("Discard"), target: targetSchema, ...when }),
  z.strictObject({
    verb: z.literal("AttachSelf"),
    to: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("hero") }),
      z.strictObject({ kind: z.literal("enemy"), trait: z.string().min(1) }),
    ]),
    ...when,
  }),
  z.strictObject({ verb: z.literal("UncommitAll"), who: whoSchema, ...when }),
  z.strictObject({ verb: z.literal("TakeControl"), who: whoSchema, ...when }),
  verb("GainSurge"),
  z.strictObject({ verb: z.literal("HideTest"), x: z.number().int().positive(), ...when }),
  verb("ImmediateAttack"),
  // The attack in progress counts as undefended, even if a defender was declared.
  verb("ConsiderUndefended"),
  // The actor readies one hero they control.
  verb("ReadyHero"),
  // Places progress on a non-unique location in play: `perPlayer` for each player in the game.
  z.strictObject({ verb: z.literal("PlaceProgressOnLocation"), perPlayer: z.number().int().positive(), ...when }),
  // The actor picks an enemy engaged with them. It cannot attack them until the end of the round.
  verb("BarAttack"),
  // Constants: a rule the engine checks while the source is in play.
  z.strictObject({
    verb: z.literal("Restrict"),
    what: z.enum(["advance", "travel", "attach", "heroLimit"]),
    exceptTrait: z.string().min(1).optional(),
    ...when,
  }),
  // The source enemy leaves the player it is engaged with and engages the next player.
  verb("EngageNextPlayer"),
  // The host of the source card, its resource pool, and every card attached to it pass to a seat.
  z.strictObject({ verb: z.literal("TransferHost"), who: whoSchema, ...when }),
  // The players win the scenario. The resolution choices follow.
  verb("WinGame"),
] as const;

const simpleInstructionSchema = z.discriminatedUnion("verb", simpleVerbs);

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
  timing: timingSchema,
  trigger: triggerSchema.optional(),
  limit: z.enum(["oncePerPhase", "oncePerRound"]).optional(),
  cost: costSchema.optional(),
  cancel: cancelSchema.optional(),
  condition: conditionSchema.optional(),
  instructions: z.array(instructionSchema),
});

export type Instruction = z.infer<typeof instructionSchema>;
export type SimpleInstruction = z.infer<typeof simpleInstructionSchema>;
export type Condition = z.infer<typeof conditionSchema>;
export type Target = z.infer<typeof targetSchema>;
export type Trigger = z.infer<typeof triggerSchema>;
export type Timing = z.infer<typeof timingSchema>;
export type Cost = z.infer<typeof costSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type ModifierUntil = z.infer<typeof modifierUntilSchema>;
export type ModifierStat = z.infer<typeof modifierStatSchema>;
