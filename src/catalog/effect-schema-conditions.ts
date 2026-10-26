// Conditions in effect records, the targets an instruction names, and the phase names a condition reads.
import { z } from "zod";

import { pickSchema } from "./effect-schema-pick.ts";

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


// The conditions that hold no other condition. `not`, `all` and `any` (below) combine these, one level deep.
const atomSchema = z.discriminatedUnion("kind", [
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
  // `victory`: the source is in the victory display, and its constant effects work from there (141046:A:2). `hand`: an Action
  // its player uses from the hand ("put Emery into play from your hand", families/deck-play.ts).
  z.strictObject({ kind: z.literal("sourceIn"), zone: z.enum(["activeLocation", "staging", "engaged", "questStage", "play", "victory", "hand"]) }),
  // A card with this code is in the victory display (`is`) or is not.
  z.strictObject({ kind: z.literal("inVictory"), code: z.string().min(1), is: z.boolean() }),
  // Some location other than the source is in the staging area or is the active location.
  z.strictObject({ kind: z.literal("otherLocationInPlay") }),
  // The actor controls a hero that is exhausted.
  z.strictObject({ kind: z.literal("heroExhausted") }),
  // The attack in progress has no defender (declared or considered).
  z.strictObject({ kind: z.literal("undefended") }),
  z.strictObject({ kind: z.literal("searchable"), trait: z.string().min(1).optional(), code: z.string().min(1).optional() }),
  // Some card matches this pick (for the actor now): a choice that could be made.
  z.strictObject({ kind: z.literal("canPick"), pick: pickSchema }),
  // Each of the actor's heroes has this trait, and the actor has one ("Play only if each of your heroes is a Hobbit",
  // 19121:A:1).
  z.strictObject({ kind: z.literal("heroesAll"), trait: z.string().min(1) }),
  // The actor has a card in hand.
  z.strictObject({ kind: z.literal("handHasCard") }),
  // The event is about the actor engaging an enemy whose engagement cost is higher than the actor's threat.
  z.strictObject({ kind: z.literal("engagedAboveThreat") }),
  // The card the event is about (a location that left play) had enough progress to be explored.
  z.strictObject({ kind: z.literal("subjectExplored") }),
  // Another player is still in the game.
  z.strictObject({ kind: z.literal("otherPlayer") }),
  // A card with this code is in play (`is`) or is not. Read at the end of a scenario, for a resolution.
  z.strictObject({ kind: z.literal("inPlay"), code: z.string().min(1), is: z.boolean() }),
  // A card with this code is attached to a hero (`is`) or is not.
  z.strictObject({ kind: z.literal("attachedToHero"), code: z.string().min(1), is: z.boolean() }),
  // Read while a stat is read, not when a constant effect is synced. `defending`: the holder is the declared defender
  // and the attacking enemy's engagement cost is higher than its controller's threat. `attacking`: the holder is
  // attacking an enemy whose engagement cost is higher than the holder's controller's threat.
  z.strictObject({ kind: z.literal("versusHighEngagement"), role: z.enum(["defending", "attacking"]) }),
  // The source card is attached to a card with this name.
  z.strictObject({ kind: z.literal("hostNamed"), name: z.string().min(1) }),
  // The actor controls a hero or ally in play with this code.
  z.strictObject({ kind: z.literal("controls"), code: z.string().min(1) }),
  // A copy of this card is out of play where an effect can take it from ("shuffle 1 out of play Ringwraith into the encounter
  // deck" on 141026:B:2, 141051:A:2, 141053:A:1, 141054:A:2): set aside, in the encounter discard pile or the victory display
  // (rr.in-play-and-out-of-play), or under a location (141049:A:1). See outOfPlayCopies in src/rules/conditions.ts.
  z.strictObject({ kind: z.literal("outOfPlay"), code: z.string().min(1) }),
  // The current quest card has progress on it (141026:B:2: removing progress is an effect that changes the game, rr.effects).
  z.strictObject({ kind: z.literal("questProgress") }),
  // An enemy (with this trait, if one is named) is in play (`is`) or none is (141027:B:1).
  z.strictObject({ kind: z.literal("enemyInPlay"), trait: z.string().min(1).optional(), is: z.boolean() }),
  // How many cards match the filter, from the actor's side, is at least `min` and at most `max` ("while you control at least
  // 5 Dwarf characters", "if there is at least 1 Gondor hero in play", "while you have no cards in your hand").
  z.strictObject({ kind: z.literal("count"), pick: pickSchema, min: z.number().int().min(0).optional(), max: z.number().int().min(0).optional() }),
  // Every card of `of` also matches `match`, and there is at least one ("if each hero you control has a printed Leadership
  // resource icon"; heroesAll is the Hobbit case).
  z.strictObject({ kind: z.literal("allMatch"), of: pickSchema, match: pickSchema }),
  // The actor's threat is at least `min` and at most `max` (Valour: 40 or higher; Secrecy: 20 or less).
  z.strictObject({ kind: z.literal("threat"), min: z.number().int().min(0).optional(), max: z.number().int().min(0).optional() }),
  // The source card, its host, the card the event was about, or the active location matches the filter (its zone is not
  // checked): "while ~ is committed to a quest", "if attached hero is a Dwarf", "if that enemy is an Orc".
  // `inPlay`: the card is in play now (`false`: it is not), for "if that ally is still in play".
  z.strictObject({
    kind: z.literal("matches"),
    card: z.enum(["self", "host", "subject", "other", "activeLocation", "picked", "attacker", "defender"]),
    pick: pickSchema.optional(),
    inPlay: z.boolean().optional(),
  }),
  // At most `max` other copies of the source card were played from the hand this round ("if this is the first time you
  // played a copy of ~ this round"); a card played again counts its earlier play. `you`: only the actor's plays count.
  z.strictObject({ kind: z.literal("copiesPlayedThisRound"), max: z.number().int().min(0), you: z.boolean().optional() }),
  // The actor's heroes with a resource icon that pays `sphere` (every player's, with `group`) hold at least `min` resources
  // ("the players as a group may spend 2 Leadership resources").
  z.strictObject({ kind: z.literal("resources"), min: z.number().int().positive(), sphere: z.enum(["leadership", "tactics", "spirit", "lore"]).optional(), group: z.boolean().optional() }),
  // The actor's quest succeeded this round (rr.step-3-4): "If you quest successfully this phase", read in the quest phase.
  // `committed`: and the source card was committed to it ("After Hirgon quests successfully").
  z.strictObject({ kind: z.literal("questSucceeded"), committed: z.boolean().optional() }),
  // Where the round is in its framework steps (rr.framework-steps): in the quest phase before the staging step, after it, or
  // before the quest is resolved; in the travel phase with no active location, so the players could travel (rr.step-4-2); in
  // the encounter phase after the engagement checks ("Play only after the staging step").
  z.strictObject({ kind: z.literal("step"), is: z.enum(["beforeStaging", "afterStaging", "beforeResolution", "canTravel", "afterEngagementChecks"]) }),
  // An enemy was engaged in this encounter phase (`is`), or none was (12065:A:2).
  z.strictObject({ kind: z.literal("engagedThisPhase"), is: z.boolean() }),
  // The current quest card has a printed keyword (`is`), or has none (17034:A:1).
  z.strictObject({ kind: z.literal("questKeywords"), is: z.boolean() }),
  // Where the combat phase is (rr.combat-phase): `beforeEnemyAttacks`, before the resolving enemy attacks step; `beforeAttacksResolve`,
  // after shadow cards have been dealt and before any attack has resolved; `afterEnemyAttacks`, once the resolving enemy attacks
  // step is complete.
  z.strictObject({ kind: z.literal("combatStep"), is: z.enum(["beforeEnemyAttacks", "beforeAttacksResolve", "afterEnemyAttacks"]) }),
  // The source is attached to the active location ("While attached location is the active location").
  z.strictObject({ kind: z.literal("hostActive") }),
  // The card is attacking in the player attack in progress (rr.step-6-8-4): read while a stat is read, for the stat's holder
  // (families/attack-strike.ts); elsewhere for `card` (the source by default). `enemy`: the attacked enemy matches the filter
  // (from that card's controller's side: `engaged`, `stagingOnly`, then its predicates); `notEnemy`: it does not ("an enemy
  // not engaged with you"); `alone`: no other character attacks with it; `ranged`: it is a ranged attack (rr.ranged).
  z.strictObject({
    kind: z.literal("attacking"),
    card: z.enum(["self", "host", "subject"]).optional(),
    enemy: pickSchema.optional(),
    notEnemy: pickSchema.optional(),
    alone: z.boolean().optional(),
    ranged: z.boolean().optional(),
  }),
  // The characters the actor controls have at least `min` different Traits between them ("a total of at least 9 different Traits
  // between them", 17064:A:1).
  z.strictObject({ kind: z.literal("distinctTraits"), min: z.number().int().positive() }),
  // The actor engaged an enemy this round (`is`), or did not ("If you have not engaged an enemy this round", 08056:A:2).
  z.strictObject({ kind: z.literal("engagedThisRound"), is: z.boolean() }),
]);

export const conditionSchema = z.discriminatedUnion("kind", [
  ...atomSchema.options,
  // The inner condition does not hold.
  z.strictObject({ kind: z.literal("not"), condition: atomSchema }),
  // Each inner condition holds.
  z.strictObject({ kind: z.literal("all"), conditions: z.array(atomSchema).min(1) }),
  // At least one inner condition holds.
  z.strictObject({ kind: z.literal("any"), conditions: z.array(atomSchema).min(1) }),
]);

// The conditions a stat modifier carries and checks each time the stat is read.

export type Condition = z.infer<typeof conditionSchema>;

export function isStatCondition(condition: Condition | undefined): condition is Extract<Condition, { kind: "versusHighEngagement" | "attacking" }> {
  return condition?.kind === "versusHighEngagement" || condition?.kind === "attacking";
}

export const targetSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("self") }),
  z.strictObject({ kind: z.literal("host") }),
  // The last picked card, the card the answered event was about, the attacking enemy.
  z.strictObject({ kind: z.literal("picked") }),
  z.strictObject({ kind: z.literal("subject") }),
  z.strictObject({ kind: z.literal("attacker") }),
  z.strictObject({ kind: z.literal("activeLocation") }),
  // The second card the answered event names (the enemy a character attacked).
  z.strictObject({ kind: z.literal("other") }),
  z.strictObject({
    kind: z.literal("engagedEnemies"),
    trait: z.string().min(1).optional(),
    who: z.enum(["actor", "each"]),
    pick: z.enum(["all", "choose"]),
  }),
]);

export const when = { when: conditionSchema.optional() };
