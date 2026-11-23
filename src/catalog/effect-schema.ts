import { z } from "zod";

// Effect records are data. The vocabulary here (verbs, conditions, triggers, timings) is owned by the
// catalog, and the reducer reads it. Amounts in authored records are fine; a player intent never supplies one.
// The vocabulary is split by behavior: stat modifiers (effect-schema-stats.ts), what a Pick offers (effect-schema-pick.ts), conditions and
// targets (effect-schema-conditions.ts), and the simple verbs (effect-schema-verbs.ts). This file composes them and keeps every export.
import { amountExprSchema, amountSchema, cardRefSchema } from "./effect-schema-amount.ts";
import { conditionSchema, targetSchema, when } from "./effect-schema-conditions.ts";
import { pickSchema, sphereSchema, whoSchema } from "./effect-schema-pick.ts";
import { modifierStatSchema, modifierUntilSchema } from "./effect-schema-stats.ts";
import { verbFlags } from "./verb-flags.ts";
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
  // A card in play that the player controls with this title exhausts, whichever printing the game deals ("exhaust The One Ring", 141001:A:1).
  z.strictObject({ kind: z.literal("exhaustNamed"), name: z.string().min(1) }),
  // `each`: every player's threat is raised, not only the payer's ("raise each player's threat by 2", 131079:A:3).
  z.strictObject({ kind: z.literal("raiseThreat"), amount: z.number().int().positive(), each: z.literal(true).optional() }),
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


// A Choose whose options hold simple verbs only. It is the whole schema of a choice inside another choice's option: the "you may" in an option ("Deal 2 damage to an enemy. You may engage it.",
// 11204:A:4).
const simpleChoiceSchema = z.strictObject({
  verb: z.literal("Choose"),
  who: whoSchema,
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

// An Each inside a choice's option: the verb is run for each card that matches ("Add 2 resources to each Círdan's Blessing", 11202:A:3; "discard any number of the top 10", 11202:A:5 with `upTo`).
// Its instructions are simple verbs or a simple choice, as in the Each of a record's own instructions.
const optionEachSchema = z.strictObject({
  verb: z.literal("Each"),
  pick: pickSchema,
  instructions: z.array(z.discriminatedUnion("verb", [...simpleVerbs, simpleChoiceSchema])),
  upTo: z.union([z.number().int().positive(), z.literal("any"), amountExprSchema]).optional(),
  taken: z.array(z.string()).optional(),
  ...when,
});

// An AfterAttack inside a choice's option: the instructions run once the attack in progress ends, as a record's own AfterAttack runs them ("Either raise your threat by 2, or return attacking enemy to the staging area after this attack", 145021:A:3).
const optionAfterAttackSchema = z.strictObject({ verb: z.literal("AfterAttack"), instructions: z.array(simpleInstructionSchema), ...when });

const choiceSchema = verbFlags(z.strictObject({
  verb: z.literal("Choose"),
  who: whoSchema,
  // Each option may be taken once in this effect: a later Choose of the same effect offers only the options not taken yet
  // ("each player chooses 1 different option", src/rules/families/deck/choose.ts).
  different: z.boolean().optional(),
  // The actor takes options one at a time, each once, up to this many (an amount: the number it reads, "choose up to X options, where X is its level", 11201:A:1), and may stop with "done"
  // (src/rules/windows/choices.ts). The options taken so far are kept as `different` keeps them; a Choose with `upTo` is `different`.
  upTo: z.union([z.number().int().positive(), amountExprSchema]).optional(),
  // An option holds simple verbs, a nested simple choice and an Each (a verb run for each matching card).
  options: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        requires: conditionSchema.optional(),
        instructions: z.array(z.discriminatedUnion("verb", [...simpleVerbs, simpleChoiceSchema, optionEachSchema, optionAfterAttackSchema])),
      }),
    )
    .min(1),
}), { runsInFrame: true });

// `endOfAttack`: when the player attack in progress ends (rr.step-6-8-4; "After this attack resolves, discard ~"), with the
// attacked enemy as the frame's other card (src/rules/families/attack/flow.ts).
const delaySchema = z.strictObject({
  verb: z.literal("Delay"),
  // `questSucceeded`: when the players quest successfully this phase, and never if they do not ("If the players quest
  // successfully, deal 1 damage to that enemy", 19112:A:1).
  // `startOfGame`: once the opening hands and mulligans are done, before the first round (a Setup that needs the players to choose).
  // `beginningOfTravel`: when the next travel phase begins ("advance to stage 3B at the beginning of the travel phase", 148004:B:2; rr.delayed-effects).
  // `questFailed`: when the players quest unsuccessfully this phase, and never if they do not ("If the players quest unsuccessfully this phase,
  // put the Nazgûl of Dol Guldur into play", 900307:A:1; rr.step-3-4).
  until: z.enum(["endOfPhase", "endOfRound", "questSucceeded", "questFailed", "endOfAttack", "startOfGame", "beginningOfTravel"]),
  uncancelable: conditionSchema.optional(),
  // With `endOfPhase`: the named phase, not the one running now ("At the end of the quest phase", 131073:A:1; revealed in another phase it waits for the next quest phase).
  phase: z.literal("Quest").optional(),
  // The delayed instructions act on the card the last Pick chose (Sneak Attack's ally).
  subject: z.literal("picked").optional(),
  instructions: z.array(simpleInstructionSchema),
  // The Delay is scheduled only when this holds ("The first player chooses a Stone-giant ... it engages ... at the end of the quest phase", 131073:A:1).
  ...when,
});

// Runs the instructions once for each card that matches the filter now, each time with that card as the picked card ("Ready
// each Dwarf character", "Deal 1 damage to each enemy in the staging area"). Nobody chooses.
const eachSchema = verbFlags(z.strictObject({
  verb: z.literal("Each"),
  pick: pickSchema,
  // A Delay here is made once for each card ("If any of those allies are still in play at the end of the round, discard them").
  instructions: z.array(z.discriminatedUnion("verb", [...simpleVerbs, choiceSchema, delaySchema])),
  // The actor chooses up to this many (`any`: any number, an amount: the number it reads, "Choose up to X characters", 11195:A:1) of the matching cards, one at a time, and may stop ("search the top
  // 10 cards for up to 4 Rohan allies"); the instructions then run for each chosen card, and the effect's X becomes how many
  // were chosen. `totalCost`: the chosen cards' printed costs add up to at most this. `taken` is engine use: the cards chosen
  // so far (src/rules/families/deck/each.ts).
  upTo: z.union([z.number().int().positive(), z.literal("any"), amountExprSchema]).optional(),
  totalCost: amountSchema.optional(),
  taken: z.array(z.string()).optional(),
  // With `upTo`: the actor must choose that many (or all of them when fewer match: nothing is asked then), and `rest` runs for each matching card he did not choose, as the picked card ("Discard all but X allies you control", 148004:A:1). The chosen cards get `instructions`.
  rest: z.array(z.discriminatedUnion("verb", simpleVerbs)).optional(),
  ...when,
}), { runsInFrame: true });

// A Shadow effect with it at its top level runs in a frame (the instructions it expands for each player queue behind it).
const forEachPlayerSchema = verbFlags(z.strictObject({
  verb: z.literal("ForEachPlayer"),
  order: z.enum(["lastFirst", "firstFirst"]),
  // `guardian`: only the player guarding Gollum, the instructions run for him as the acting player ("Raise the threat of the player guarding Gollum by 8", 02135:A:1). While a card says an effect that targets him also targets each other player (Dry Watercourse, 02132:A:1;
  // Ambushing Orcs, 900902:A:1) the other players follow, in player order (src/rules/families/guardian/seats.ts).
  // `otherThanGuardian`: each player but him, in player order ("reduce the threat of each player not guarding Gollum by 2", 02133:A:2).
  // `engaged`: only the player the source enemy is engaged with ("the engaged player chooses", 901703:A:2); nobody when it is not engaged.
  seats: z.enum(["guardian", "otherThanGuardian", "engaged"]).optional(),
  // At most this many players, in the order the effect runs ("one different 0 cost location per player (limit 2)", 51048:A:1).
  limit: z.number().int().positive().optional(),
  // An Each runs for the player acting: "deal 1 damage to each character controlled by the player guarding Gollum" is an Each of the characters he controls (02138:A:2).
  instructions: z.array(z.discriminatedUnion("verb", [...simpleVerbs, choiceSchema, eachSchema])),
}), { runsInFrame: true });

// Instructions that run, with the attacking enemy as the source, once the attack in progress ends (a ForEachPlayer among them: "Captain Sahír makes an attack ... Each player searches ...", 12093:A:1). `when` is read as the shadow effect
// resolves, while the attack is still in progress ("If undefended, move the damage to the hero damaged by this attack", 900209:A:2).
const afterAttackSchema = z.strictObject({
  verb: z.literal("AfterAttack"),
  instructions: z.array(z.discriminatedUnion("verb", [...simpleVerbs, forEachPlayerSchema])),
  ...when,
});

// Runs the instructions this many times ("Resolve that effect again for each copy of ~ in your discard pile").
const repeatSchema = verbFlags(z.strictObject({
  verb: z.literal("Repeat"),
  times: amountSchema,
  instructions: z.array(z.discriminatedUnion("verb", [...simpleVerbs, choiceSchema])),
}), { runsInFrame: true });

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
  "thricePerRound",
  "thricePerPhase",
  "fivePerPhase",
  "oncePerAttack",
  "oncePerGame",
  // Once per campaign: the use is recorded in the Campaign Log's `usedOnce` facts, by the card's code, so a later scenario's copy
  // of the card cannot use it again ("Limit once per campaign. Record in Campaign Log when used.", 41044:A:3; rules/player/usage.ts).
  "oncePerCampaign",
  "oncePerGameGroup",
  "thricePerGameGroup",
  // Once a round for each player, counting every copy of the card ("You cannot trigger this ability if you have already
  // triggered the ability of a Steward of Orthanc this round").
  "oncePerRoundGroupEachPlayer",
  // Once a phase for each player, counting every copy of the card; on an event's Action, its play ("You can only play 1 copy
  // of The Tree People each phase", src/rules/families/deck/play.ts).
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
  // at least one; scripts/checks/effect-coverage.test.ts checks that they exist, belong to cardCode and match the timing.
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
  // This Response is the player's the event happened to, whoever controls the source ("the engaged player may ...", 12125:A:3): the seat of the event answers it, and it is not offered when the event names no seat.
  // `guardian`: the player guarding Gollum answers it ("the player guarding Gollum may choose a new player to guard him", 02134:A:1).
  answeredBy: z.enum(["eventSeat", "guardian"]).optional(),
  // This Action, Response or Forced effect of a card that is not an event is used from its owner's hand, and only there ("put ~ into play
  // from your hand", rr.in-play-and-out-of-play: an ability that refers to being used from an out-of-play area; Lost in the Wild's Forced effect, 18026:A:1).
  fromHand: z.literal(true).optional(),
  // This Forced effect of a card works from the victory display and only there ("While Louis is in the victory display, each Troll enemy gains: Forced: ...", 900504:A:2; rr.in-play-and-out-of-play: an ability that refers to the out-of-play area it works from).
  fromVictory: z.literal(true).optional(),
  // A "revealed" event is heard only when the encounter deck itself revealed the card (staging, a surge, the top card;
  // rr.staging), not when a player searched for it and revealed it ("as it is revealed by the encounter deck", 01006:A:1).
  byEncounterDeck: z.literal(true).optional(),
  // A "revealed" event is not heard when the card was found in the encounter discard pile by a search ("revealed from the encounter deck" counts a search of the deck, 09016:A:3).
  notFromDiscard: z.literal(true).optional(),
  // This Forced effect resolves before the other Forced effects of the same moment, whatever the age of their cards (the engine resolves the oldest card's first): "after resolving the Forced effect on each stage 3 in play" (50907:A:1; docs/scenarios/standalone-scenarios/attack-on-dol-guldur.md, Attack on Dol Guldur, reading 5).
  early: z.literal(true).optional(),
  cancel: cancelSchema.optional(),
  // While this holds, nothing may cancel the effect ("If The One Ring is exhausted, this effect cannot be canceled").
  uncancelable: conditionSchema.optional(),
  condition: conditionSchema.optional(),
  instructions: z.array(instructionSchema),
}).refine((effect) => effect.timing === "resolution" || !effect.instructions.some((instruction) => instruction.verb === "GainXp"), {
  // The Resolution is the only place XP is awarded (dcce.gaining-xp): a GainXp line anywhere else would silently do nothing.
  message: "GainXp is a Resolution verb",
  path: ["timing"],
}).refine((effect) => effect.instructions.every((instruction) => instruction.verb !== "RemoveFromPool" || (instruction.codes != null) !== (instruction.choice != null)), {
  // RemoveFromPool takes the encounter cards it names or lets each player choose, never both and never neither (emce.campaign-pool-encounter).
  message: "RemoveFromPool names exactly one of codes and choice",
  path: ["instructions"],
}).refine((effect) => effect.instructions.every((instruction) => instruction.verb !== "AddEncounterToPool" || (instruction.codes != null) !== (instruction.fromDeck != null)), {
  // AddEncounterToPool names the codes it adds or the deck whose enemies in play it adds, never both and never neither (emce.campaign-pool-encounter).
  message: "AddEncounterToPool names exactly one of codes and fromDeck",
  path: ["instructions"],
}).refine((effect) => effect.instructions.every((instruction) => instruction.verb !== "RaiseStagingThreat" || (instruction.amount != null) !== (instruction.live != null)), {
  // RaiseStagingThreat names the amount it raises or the live count (the allies in a discard pile), never both and never neither (01104:A:1, 145060:A:2).
  message: "RaiseStagingThreat names exactly one of amount and live",
  path: ["instructions"],
}).refine((effect) => effect.instructions.every((instruction) => instruction.verb !== "AddSetAsideToStaging" || (instruction.code != null) !== (instruction.trait != null)), {
  // AddSetAsideToStaging names the code it adds or the trait the set aside cards share, never both and never neither (145078:B:1).
  message: "AddSetAsideToStaging names exactly one of code and trait",
  path: ["instructions"],
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
