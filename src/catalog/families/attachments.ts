// The vocabulary attachments on enemies, locations, quests and threat dials: Traps, Guarded, played unattached adds to effect records: simple verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them.
import { z } from "zod";

import { cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";

// The encounter card types a Guarded keyword names: "Guarded (enemy)", "Guarded (location)", "Guarded (enemy or location)".
const guardType = z.enum(["enemy", "location"]);

export const VERBS = [
  // Constant on an attachment: it is played (or put into play) unattached into the staging area ("Play Ranger Spikes into
  // the staging area unattached") or into its player's own play area ("Play into your play area unattached"), or onto a
  // player's threat dial ("Attach to a player's threat dial"): into that player's play area, under their control. The table
  // offers "staging" or "seat:N" as its host. `limitPerPlayer`: not onto the dial of a player who already controls a copy
  // ("Limit 1 per player").
  z.strictObject({ verb: z.literal("PlayInto"), into: z.enum(["staging", "playArea", "threatDial"]), limitPerPlayer: z.boolean().optional(), ...when }),
  // The source attachment is attached to the card the reference names ("attach Ranger Spikes to the next eligible enemy that
  // enters the staging area": `subject`), when that card is in play and may have it (not immune to player card effects, not
  // barred from having attachments). It leaves the staging area, a play area or its old host and goes into its controller's
  // play area on that card; the `attached` event is announced.
  z.strictObject({ verb: z.literal("AttachSourceTo"), card: cardRefSchema, ...when }),
  // Constant on an attachment, the Guarded (X) keyword: when the card is played or put into play, its player reveals
  // encounter cards one at a time until a card of one of these types is revealed and is in play; the attachment is then
  // guarded by that card: out of play, shown attached to it, until it leaves play. Then its player puts the attachment into
  // play (the `unguarded` event, PutAttachmentIntoPlay). With no card of those types in the encounter deck it enters play at
  // once.
  z.strictObject({ verb: z.literal("Guarded"), types: z.array(guardType).min(1), ...when }),
  // Engine use (Guarded): reveals the next encounter card for the actor, then (`since`: the clock before that reveal) guards
  // `card` with the first card of one of `types` that entered play since and is still in play, or reveals again.
  z.strictObject({ verb: z.literal("GuardWith"), card: z.string().min(1), types: z.array(guardType).min(1), since: z.number().int().min(0).optional(), ...when }),
  // Puts an attachment into play under its owner's control, attached to a card it may be attached to (the actor chooses when
  // there are several): the picked card ("Search your deck for a Guarded attachment and put it into play"), or the source.
  // A Guarded attachment put into play from out of play is guarded first, unless `unguarded` (its guard just left play). One
  // with nothing to attach to does not enter play; one its guard released goes to its owner's discard pile.
  z.strictObject({ verb: z.literal("PutAttachmentIntoPlay"), card: z.enum(["picked", "self"]).optional(), unguarded: z.boolean().optional(), ...when }),
  // The actor heals up to `amount` damage from among the cards that match `pick` (from their side), one damage at a time on
  // the card they choose each time, and may stop ("heals up to 5 damage from among characters he controls").
  z.strictObject({ verb: z.literal("HealAmong"), amount: positiveAmountSchema, pick: pickSchema, healed: z.number().int().min(0).optional(), ...when }),
  // Shows the actor the top `amount` cards of the encounter deck ("the top X cards ..., where X is that enemy's printed
  // Threat"), as LookAtTop does with a printed number: the cards shown can be chosen with PickEncounter `from: "looked"`.
  z.strictObject({ verb: z.literal("LookAtEncounterCards"), amount: positiveAmountSchema, ...when }),
  // The actor declares an attack against the card the reference names ("declare an attack against the attached enemy"): they
  // choose its attackers one at a time among their ready characters that may attack it, then stop; each exhausts (unless it
  // does not exhaust to attack) and the attack resolves (rr.step-6-8-1). It is an attack an effect makes, beside the one the
  // framework allows against each enemy (faq.limitations-on-attacks). `discardSource`: the source is discarded first, its
  // host read before ("discards Ambush to declare an attack against the attached enemy"). `enemy` and `attackers` are engine
  // use: the enemy read, the attackers chosen so far.
  z.strictObject({
    verb: z.literal("DeclareAttack"),
    target: cardRefSchema,
    discardSource: z.boolean().optional(),
    enemy: z.string().optional(),
    attackers: z.array(z.string()).optional(),
    ...when,
  }),
  // Engine use (takesQuestProgress): the player answers whether progress from questing successfully goes on the locations
  // that may take it first (`first`), this quest phase.
  z.strictObject({ verb: z.literal("QuestProgressFirst"), first: z.boolean(), ...when }),
] as const;

export const TRIGGERS = [
  // Heard by each card (the event's card) that was attached to the event's other card: an enemy that damage destroyed
  // (rr.destroy), or a quest card that was defeated (its stage advanced, rr.quest-advancement). The attachment hears it from
  // wherever it went ("When attached enemy is destroyed", "After attached quest card is defeated": that card is `other`).
  "hostDefeated",
  // Heard by a Guarded attachment (the event's card) whose guard just left play: its player puts it into play.
  "unguarded",
] as const;

export const FLAGS = [
  // On an enemy: any character may choose it as the target of an attack, in the staging area or engaged with any player
  // ("Any character may choose attached enemy as the target of an attack").
  "attackableByAny",
  // Held by the table: the total Threat in the staging area is reduced by this much, not below 0 ("reduce the total Threat in
  // the staging area by X").
  "lessStagingThreat",
  // On a card: its printed text box is blank, except for its traits (rr.blank): its own records do not apply. Text gained from
  // another source is not blanked.
  "blankText",
  // On a location: progress from questing successfully may be placed on it after the active location and before the current
  // quest (Explorer's Almanac). The players answer once each quest phase (QuestProgressFirst).
  "takesQuestProgress",
  // Held by the table until the end of the phase: the players' answer (1: yes, 0: no) for takesQuestProgress.
  "progressFirst",
] as const;
