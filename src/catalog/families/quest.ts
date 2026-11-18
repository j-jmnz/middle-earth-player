// The vocabulary the quest phase, locations, travel, progress, threat and engagement adds to effect records: simple verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";

const VERBS = [
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
  // scenario definition copies it onto the stage (`stages[i].branch`) and advanceStage (rules/quest/quest.ts) takes the branch, so running
  // it does nothing. A stage reached by a branch is the last one: defeating it wins the game.
  z.strictObject({ verb: z.literal("BranchStage"), codes: z.array(z.string().min(1)).min(2) }),
  // Setup: "Shuffle each stage 2 card in the quest deck so that their order is random, leaving stage 3 on the bottom" (11016:A:1). The quest cards
  // named by `codes` that are in the quest deck are put in a random order (the scenario's seed) on top of it, the others below them in the
  // order they were. A quest with such a deck advances in the order of its quest deck (LookAtStages).
  z.strictObject({ verb: z.literal("ShuffleStages"), codes: z.array(z.string().min(1)).min(2) }),
  // On a quest stage: "When this stage is defeated, if you are on-course (Sun), look at the top 2 stages of the quest deck and advance to one of
  // your choice, placing the other on the bottom of the quest deck. Otherwise, advance to the top stage of the quest deck" (11016:B:3,
  // 11017:B:3). The scenario definition copies `count` onto the stage (`stages[i].look`), and a quest with one advances in the order of its
  // quest deck (rules/quest/quest.ts): off-course, to the top stage; on-course, the first player chooses one of the top `count` stages (the choice
  // runs this record, so a choice is a frame like any other) and the others go to the bottom. Defeating the last stage wins the game.
  // With `bottom` (Mount Gundabad, 19134:B:1 and 19140:B:2: "look at the top 2 cards of the quest deck and choose 1 to place on the bottom of the quest deck"), the stage chosen goes to the bottom of the deck and the others stay on top in their order, and the
  // quest advances to the top stage; the choice is asked of every quest, on-course or not, since the stage defeated has no heading.
  z.strictObject({ verb: z.literal("LookAtStages"), count: z.number().int().min(2), bottom: z.literal(true).optional() }),
  // Removes `amount` progress tokens from the current quest card, no more than it holds ("Remove 4 progress tokens from the current quest
  // card. (If there are fewer than 4 progress tokens on the quest, remove all progress tokens from that quest.)", 01086:A:1; "remove 1
  // progress token from the current quest", 01111:A:1). RemoveQuestProgress counts progress per player instead. With `each` the progress comes off every quest card in play, the main quest card, each encounter side quest in the staging area and each player side quest
  // ("remove 2 progress from each quest card in play", 10100:A:1).
  z.strictObject({ verb: z.literal("RemoveProgressFromQuest"), amount: positiveAmountSchema, each: z.literal(true).optional(), ...when }),
  // Removes all the progress tokens from the card `target` (the picked card by default), or from each card in play that matches `pick`, read from the actor's side ("Remove all progress tokens from all Riverland locations", 02023:A:2; "remove all progress from that
  // location", 900409:A:1). A card with none is left as it is.
  z.strictObject({ verb: z.literal("RemoveAllProgress"), target: cardRefSchema.optional(), pick: pickSchema.optional(), ...when }),
  // Removes up to `amount` progress tokens from each card in play that matches `pick` (the staging area and the active location are in play), read from the actor's side, and the effect's X becomes the number of tokens removed in all, so a later instruction can count them
  // ("Remove 1 progress token from each location in play. Then ... for each progress token removed by this effect", 02093:A:1). A card with none loses none.
  z.strictObject({ verb: z.literal("RemoveProgressEach"), amount: positiveAmountSchema, pick: pickSchema, ...when }),
  // Places `amount` progress tokens on the last picked quest card (a pick with `questCard`): the actor's current quest stage (the active location does not take it: the card is named), an encounter side quest in the staging area or a player side quest in a quest area
  // ("place 1 progress token on a quest card in play", 10176:A:1). A full side quest is defeated as usual; a stage that rescues captured cards instead (10039:B:1) rescues.
  z.strictObject({ verb: z.literal("PlaceProgressOnQuestCard"), amount: positiveAmountSchema, ...when }),
] as const;

const TRIGGERS = [
  // The quest resolves: the committed Willpower is about to be counted against the staging area's threat, once the window after the staging step has closed (rr.step-3-4). Fanuidhol's payment is asked here (04016:A:1).
  "questTotalCounted",
  // About each character committed to the quest when it resolved: the quest succeeded ("After ~ quests successfully"), or it
  // resolved at all ("After resolving a quest to which ~ was committed").
  "questedSuccessfully",
  "committedQuestResolved",
  // About the active location: it was explored. The event's amount (the effect's X) is the number of attachments it had.
  "activeExplored",
  // About any location: it was explored, in the staging area (the event is its own) or as the active location (the activeExplored event, which this trigger also hears). "After a double-sided location is explored" (12092:B:2).
  "locationExplored",
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

const FLAGS = [
  // On a final quest stage that holds the win ("Forced: After this stage is defeated ... If this final Escape test is passed, the players ... won the game", 02106:B:1, 02106:B:2): defeating it does not win the game. The stage stays the current quest card, defeated, `questCardDefeated` is announced
  // to its own Forced effects, and the game is won only by what they do (`WinGame`) or the quest is reset (`ReturnToStage`). Read by rules/quest/quest.ts (advanceStage).
  "holdsWin",
  // On "table": no character may be committed to the quest ("Do not commit characters to the quest", 143078:B:1; rules/engine/legal.ts committers).
  "cannotCommit",
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
  // On an enemy: a player whose threat is at least this much cannot optionally engage it ("Each player with a threat of 25 or higher cannot optionally engage Goblin Scout", 03060:A:1; rr.optional-engagement).
  // An engagement check still engages him (rules/families/quest/engage.ts optionalThreatBarred).
  "optionalEngageThreat",
  // On a seat: its threat cannot be reduced below its starting threat level, the threat set at Setup step 2 (rr.initial-threat-level; "Each player cannot reduce his threat below his initial threat level", 145064:B:2): a reduction stops at that level.
  // The game keeps the starting level while a card of it holds this flag (recordStartingThreat).
  "threatFloor",
  // On "table": the staging step of the quest phase is skipped (01128:B:2, "for the remainder of the game" while the stage is current).
  "skipStaging",
  // On a hero, from the active location's constant: its Willpower counts toward the quest only while it holds `countsWillpower` ("heroes must spend 1 resource from their resource pool to count their Willpower during the quest phase", 04016:A:1; willpowerIgnored in
  // families/quest/conditions.ts). The location's Forced effect when the quest total is counted asks the controller of each committed hero with a resource whether to spend 1 from its pool, and a hero that paid holds `countsWillpower` until the end of the phase.
  "willpowerCostsResource",
  // On a treachery in the staging area, set by its own When Revealed until it leaves play ("Add Blinding Blizzard to the staging area. Progress that would be placed on the current quest or on Snow locations are instead placed on Blinding Blizzard. When the 5th progress is placed on Blinding Blizzard,
  // discard it", 901307:A:2): the card stays in the staging area after its reveal (windows/frames.ts), takes the progress that would go on the current quest stage or on a location with the Snow trait, in play or in the staging area, from questing or an effect, up to 5, and is discarded
  // with the 5th; what it cannot take is placed as it would have gone without it (families/quest/blizzard.ts, read where progress is placed: rules/quest/quest.ts putOnStage, interpret/effect-verbs.ts placeProgress, south/locations.ts placeOnActive, attachments/quest.ts).
  "progressRedirect",
  // On a location, from its own constant ("Progress tokens that would be placed on Doors of Durin are instead placed on the current quest card", 04065:A:1): what would be placed on it from a card effect goes on the main quest stage, and it is never explored
  // (families/quest/doors.ts, read in interpret/effect-verbs.ts placeProgress; questing places none on a location with no quest points).
  "progressToQuest",
  // Held by the table while the current stage holds it ("Snowdrifts" 04012:B:2: the stage is defeated while the characters are still committed, so Caradhras' -1 Willpower and stage 3B's discard at 0 reach them): the quest resolution keeps the commitments until its second pass
  // (rules/quest/quest.ts resolveQuest, stage-reveal.ts resolutionStep).
  "heldCommitted",
  // Held by the table until the end of the phase: `questTotalCounted` was announced this phase (rules/quest/stage-reveal.ts).
  "questTotalAnnounced",
] as const;

export const manifest = { name: "quest", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
