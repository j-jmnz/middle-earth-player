// The vocabulary the quest phase, locations, travel, progress, threat and engagement adds to effect records: simple verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them.
import { z } from "zod";

import { cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";

export const VERBS = [
  // Commits the card (the picked card by default) to the quest without exhausting it, and announces `committed`. `stat:
  // "attack"`: it quests with its Attack instead of its Willpower until the end of the phase (11005:A:2).
  z.strictObject({ verb: z.literal("CommitToQuest"), target: cardRefSchema.optional(), stat: z.literal("attack").optional(), ...when }),
  // The location (the picked card by default) becomes the active location; any other active location returns to the staging
  // area. This is not traveling: no Travel cost or Travel effect, no `traveled` event (131013:A:2, 19034:A:1).
  z.strictObject({ verb: z.literal("MakeActive"), target: cardRefSchema.optional(), ...when }),
  // Moves progress tokens to the last picked location, from the source card, the current quest card or the card picked before
  // the last: `amount` (at most what is there), or `all`. With `choose` the actor chooses how many, from 1 to `amount` (or to
  // all of them). Progress placed on a location can explore it (04008:A:1, 12037:A:2, 17034:A:2).
  z.strictObject({
    verb: z.literal("MoveProgress"),
    from: z.enum(["self", "quest", "pickedBefore"]),
    amount: positiveAmountSchema.optional(),
    all: z.boolean().optional(),
    choose: z.boolean().optional(),
    ...when,
  }),
  // The card (the picked card by default) gets -`amount` Threat until `until`. The effect's X becomes 1 when this took its
  // Threat from above 0 to 0, else 0: "If this effect reduces the enemy's Threat to 0, deal 1 damage to it" (12082:A:2).
  z.strictObject({ verb: z.literal("LowerCardThreat"), amount: positiveAmountSchema, until: z.enum(["endOfPhase", "endOfRound"]), target: cardRefSchema.optional(), ...when }),
  // Deals `amount` damage to each card that matches `pick` (from the actor's side), or to each enemy engaged with the picked
  // player (`engagedWith: "picked"`). A player card's damage: immunity applies (02095:A:2, 08060:A:1, 12065:A:2).
  z.strictObject({ verb: z.literal("DamageEach"), amount: positiveAmountSchema, pick: pickSchema.optional(), engagedWith: z.literal("picked").optional(), ...when }),
  // Exhausts each card that matches `pick`, from the actor's side ("Exhaust each damaged character you control", 01137:A:3). Nobody chooses.
  z.strictObject({ verb: z.literal("ExhaustEach"), pick: pickSchema, ...when }),
  // Readies every character the actor controls, with this trait when one is named (22029:A:1).
  z.strictObject({ verb: z.literal("ReadyAll"), trait: z.string().min(1).optional(), ...when }),
  // The enemy (the picked card by default) does not make engagement checks against the actor (`checks`, 19009:A:2, 22061:A:1),
  // or cannot engage the actor at all (`engage`, 06056:A:1), until `until`.
  z.strictObject({ verb: z.literal("BarEngagement"), what: z.enum(["checks", "engage"]), until: z.enum(["endOfPhase", "endOfRound"]), target: cardRefSchema.optional(), ...when }),
  // Each player (`eachSeat`) or the picked player does not raise their threat from questing unsuccessfully until `until`
  // (03005:A:1, 10117:A:1).
  z.strictObject({ verb: z.literal("WaiveQuestThreat"), who: z.enum(["eachSeat", "picked"]), until: z.enum(["endOfPhase", "endOfRound"]), ...when }),
  // The quest phase of this round is skipped: the planning phase is followed by the travel phase (10117:A:2).
  z.strictObject({ verb: z.literal("SkipQuestPhase"), ...when }),
  // Engine use: the actor raises their threat by the amount the quest failed by, unless they do not raise threat from questing
  // unsuccessfully (rr.step-3-4). It runs after the Responses to the failed quest.
  z.strictObject({ verb: z.literal("RaiseQuestThreat"), amount: z.number().int().positive(), ...when }),
  // The actor's threat is reduced to their starting threat level; nothing happens when it is at or below it (04053:A:2).
  z.strictObject({ verb: z.literal("ResetThreat"), ...when }),
  // The quest advances to its next stage now, whatever progress is on it ("Advance to stage 2", 142020:B:1); that stage's When Revealed
  // effects resolve. Advancing the last stage defeats the quest (rr.winning-the-game).
  z.strictObject({ verb: z.literal("AdvanceStage"), ...when }),
  // The source attachment moves to the card (the picked card by default) and passes to that card's controller (19010:A:4).
  z.strictObject({ verb: z.literal("ReattachSelf"), target: cardRefSchema.optional(), ...when }),
  // On a quest card's Forced effect "When you defeat this stage, proceed to one of the 2 \"A Chosen Path\" stages, at random" (01120:B:1):
  // the stage's defeat proceeds to one of `codes`, chosen with the scenario's seed, and the others are removed from the game. The
  // scenario definition copies it onto the stage (`stages[i].branch`) and advanceStage (rules/quest.ts) takes the branch, so running
  // it does nothing. A stage reached by a branch is the last one: defeating it wins the game.
  z.strictObject({ verb: z.literal("BranchStage"), codes: z.array(z.string().min(1)).min(2) }),
  // Setup: "Shuffle each stage 2 card in the quest deck so that their order is random, leaving stage 3 on the bottom" (11016:A:1). The quest cards
  // named by `codes` that are in the quest deck are put in a random order (the scenario's seed) on top of it, the others below them in the
  // order they were. A quest with such a deck advances in the order of its quest deck (LookAtStages).
  z.strictObject({ verb: z.literal("ShuffleStages"), codes: z.array(z.string().min(1)).min(2) }),
  // On a quest stage: "When this stage is defeated, if you are on-course (Sun), look at the top 2 stages of the quest deck and advance to one of
  // your choice, placing the other on the bottom of the quest deck. Otherwise, advance to the top stage of the quest deck" (11016:B:3,
  // 11017:B:3). The scenario definition copies `count` onto the stage (`stages[i].look`), and a quest with one advances in the order of its
  // quest deck (rules/quest.ts): off-course, to the top stage; on-course, the first player chooses one of the top `count` stages (the choice
  // runs this record, so a choice is a frame like any other) and the others go to the bottom. Defeating the last stage wins the game.
  z.strictObject({ verb: z.literal("LookAtStages"), count: z.number().int().min(2) }),
  // Removes `amount` progress tokens from the current quest card, no more than it holds ("Remove 4 progress tokens from the current quest
  // card. (If there are fewer than 4 progress tokens on the quest, remove all progress tokens from that quest.)", 01086:A:1; "remove 1
  // progress token from the current quest", 01111:A:1). RemoveQuestProgress counts progress per player instead.
  z.strictObject({ verb: z.literal("RemoveProgressFromQuest"), amount: positiveAmountSchema, ...when }),
] as const;

export const TRIGGERS = [
  // About each character committed to the quest when it resolved: the quest succeeded ("After ~ quests successfully"), or it
  // resolved at all ("After resolving a quest to which ~ was committed").
  "questedSuccessfully",
  "committedQuestResolved",
  // About the active location: it was explored. The event's amount (the effect's X) is the number of attachments it had.
  "activeExplored",
  // About the seat: a player card effect reduced its threat (the event's subject is that card), or its threat was raised by
  // questing unsuccessfully or by an encounter or quest card effect.
  "threatLowered",
  "threatRaisedByEncounter",
  // About a character: a card effect removed it from the quest.
  "removedFromQuest",
  // About an enemy: the seat optionally engaged it (rr.optional-engagement).
  "optionallyEngaged",
  // About the seat: it reached its threat elimination level and a card in play would keep it in the game (10124:A:2).
  "wouldBeEliminated",
  // About a quest card: it was defeated, a stage of the main quest (the event's subject, now out of play) or a side quest. A Response
  // with a `subject` filter of any card hears it ("After a quest card is defeated", 01135:A:3); a Forced effect with `subject: "self"`
  // is the card's own ("When you defeat this stage", 01120:B:1). The winning stage is not announced: the game is over.
  "questCardDefeated",
] as const;

export const FLAGS = [
  // On a seat: it does not raise threat from questing unsuccessfully; a player card effect that reduces its threat reduces it by
  // at most 1 (22054:A:1); it may optionally engage this many additional enemies (09002:A:2), and the optional engagements it
  // made this phase (engine use).
  "noQuestThreat",
  "threatReductionToOne",
  "extraOptionalEngage",
  "optionalEngagements",
  // On "table": the quest phase is skipped this round; an enemy was engaged this phase (engine use, the encounter phase).
  "skipQuestPhase",
  "engagedThisPhase",
  // On a character: it can commit to the quest while exhausted (11009:A:1); it quests with its Attack instead of its
  // Willpower; its Willpower cannot be reduced (09013:A:2).
  "commitsExhausted",
  "questsWithAttack",
  "cannotReduceWillpower",
  // On the current quest card: it has Battle / Siege, so committed characters count Attack / Defense instead of Willpower
  // (hon.battle, hon.siege).
  "battle",
  "siege",
  // On an enemy, for the modifier's seat only: it makes no engagement checks against that player; it cannot engage that player.
  "noChecksAgainst",
  "cannotEngageSeat",
  // On "table": the staging step of the quest phase is skipped (01128:B:2, "for the remainder of the game" while the stage is current).
  "skipStaging",
] as const;
