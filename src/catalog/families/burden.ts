// The vocabulary the burden deck, the Ring-bearer's life and the other encounter effects of Flight to the Ford add to effect records: simple verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them.
import { z } from "zod";

import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";

export const VERBS = [
  // Setup: the Ring-bearer's life is set to `value` (mec109.ringbearers-life). The scenario's definition already starts the
  // game with it (data/scenarios `life`); this verb is how the Setup record says so.
  z.strictObject({ verb: z.literal("SetLife"), value: z.number().int().positive(), ...when }),
  // The Ring-bearer's life goes down by `amount`, to a minimum of 0, and the step names its cause. Healing never raises it. At 0
  // the players lose the game (mec109.ringbearers-life). Nothing happens in a game with no life number.
  z.strictObject({ verb: z.literal("ReduceLife"), amount: positiveAmountSchema, ...when }),
  // Setup: the burden deck is shuffled (mec109.burden-deck).
  z.strictObject({ verb: z.literal("ShuffleBurdenDeck"), ...when }),
  // The actor reveals the top card of the burden deck and resolves it as if it were just revealed from the encounter deck: its
  // keywords and When Revealed effects resolve, and a treachery goes to the encounter discard pile (mec109.burden-deck). It is
  // not offered to the cancels of a card revealed from the encounter deck. Nothing is revealed when the burden deck is empty.
  z.strictObject({ verb: z.literal("RevealBurden"), ...when }),
  // The top card of the burden deck goes into the encounter deck: shuffled in (`encounterShuffle`), or placed on top
  // (`encounterTop`). Nothing happens when the burden deck is empty.
  z.strictObject({ verb: z.literal("MoveBurden"), to: z.enum(["encounterShuffle", "encounterTop"]), ...when }),
  // When Revealed: the source treachery is attached to the Ring-bearer, the hero that has the Ring-bearer trait ("Attach to the
  // Ring-bearer"). It stays in the encounter discard pile when there is no Ring-bearer in play.
  z.strictObject({ verb: z.literal("AttachSelfToRingBearer"), ...when }),
  // Each enemy engaged with a player makes an immediate attack against that player, one after the other in player order
  // (rr.attacks-outside-the-combat-phase). The running effect counts the attacks made, so `noneReturned` reads true when no
  // enemy attacked. `enemy` is engine use: the enemy whose attack is next.
  // `trait`: only the engaged enemies with this trait ("All engaged Troll enemies attack", 900208:A:1); `notTrait`: only those without it ("Each engaged non-Ship enemy makes an immediate attack", 11067:A:1).
  z.strictObject({ verb: z.literal("ImmediateAttackEach"), enemy: z.string().min(1).optional(), trait: z.string().min(1).optional(), notTrait: z.string().min(1).optional(), ...when }),
  // The first player token passes to the next player in the game; with no other player it stays (rr.first-player).
  z.strictObject({ verb: z.literal("PassFirstPlayer"), ...when }),
  // The quest phase ends at once: the cards it has yet to reveal are not revealed and the quest is not resolved
  // (rr.step-3-3). Nothing happens outside the quest phase.
  z.strictObject({ verb: z.literal("EndQuestPhase"), ...when }),
  // All the progress on the current quest card is removed.
  z.strictObject({ verb: z.literal("RemoveAllQuestProgress"), ...when }),
  // A lasting set: the stat of each card that matches `holders` now is set to `value` until `until`, whatever else modifies it
  // (rr.modifiers: "reduce ... to 0"). `holders` is read from the actor's side.
  z.strictObject({
    verb: z.literal("SetStatUntil"),
    stat: z.enum(["willpower", "attack", "defense"]),
    value: z.number().int().min(0),
    until: z.enum(["endOfPhase", "endOfRound"]),
    holders: pickSchema,
    ...when,
  }),
] as const;

export const TRIGGERS = [
  // About a card in play (a location): progress was just placed on it and it is still in play (141061:A:2). Each placement is one
  // event, whatever the number of tokens.
  "progressPlaced",
] as const;

export const FLAGS = [
  // On a hero: damage that would be placed on it reduces the Ring-bearer's life by that much instead (141057:A:2).
  "damageToLife",
  // On a card: damage cannot be healed from it (141057:A:1).
  "cannotBeHealed",
  // On an enemy: it is not dealt a shadow card (141061:A:1).
  "noShadowDealt",
] as const;
