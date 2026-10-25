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
  // `victory`: the source is in the victory display, and its constant effects work from there (141046:A:2).
  z.strictObject({ kind: z.literal("sourceIn"), zone: z.enum(["activeLocation", "staging", "engaged", "questStage", "play", "victory"]) }),
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
]);

// The conditions a stat modifier carries and checks each time the stat is read.

export type Condition = z.infer<typeof conditionSchema>;

export function isStatCondition(condition: Condition | undefined): condition is Extract<Condition, { kind: "versusHighEngagement" }> {
  return condition?.kind === "versusHighEngagement";
}

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

export const when = { when: conditionSchema.optional() };
