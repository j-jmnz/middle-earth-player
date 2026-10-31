// The uncharted family (phase 41, The Fate of Númenor): the Uncharted deck and its double-sided locations (dcce.uncharted, dcce.uncharted-deck), the objective ally Calphon, the
// bottom of a deck, and the Campaign Setup choices of the campaign card 11179. Simple verbs; effect-schema-verbs.ts composes them and src/rules/families/uncharted.ts runs them (the
// helpers are in uncharted-*.ts). The rules are the Dream-chaser Campaign Expansion rulebook (dcce.*, data/rules/entries.json).
import { z } from "zod";

import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

const who = z.enum(["actor", "firstPlayer", "picked"]);

export const VERBS = [
  // Setup: "Prepare the Uncharted deck" (dcce.uncharted-deck). The double-sided locations dealt as the Uncharted deck are shuffled, each Lost Island side up.
  z.strictObject({ verb: z.literal("PrepareUnchartedDeck"), ...when }),
  // "Add N copies of Lost Island from the top of the Uncharted deck to the staging area" (11025:A:1, 11025:B:3, 11026:A:1, 11035:A:2): the top `count` cards of the deck join the
  // staging area without being revealed, Lost Island side up. The Uncharted deck is not shuffled by this verb.
  z.strictObject({ verb: z.literal("AddLostIslands"), count: positiveAmountSchema, ...when }),
  // "Add Shrine to Morgoth to the staging area, Lost Island side faceup" (11026:A:1): the card with this code, set aside, joins the staging area on its Lost Island side.
  z.strictObject({ verb: z.literal("AddSetAsideLostIsland"), code: z.string().min(1), ...when }),
  // "Remove all progress from each Uncharted location in the staging area and shuffle them so that the players do not know which one is which" (11026:A:1, 11035:A:2): each
  // Lost Island in the staging area loses its progress and the seed shuffles their places in the staging area among themselves.
  z.strictObject({ verb: z.literal("ScrambleUncharted"), ...when }),
  // "Flip it over" (11030:B:3 and the other Lost Island sides, dcce.uncharted): the card (the source by default) turns to its other side, loses all progress, and is announced
  // as flipped over, which the Forced effects "After ~ is flipped over while active" hear.
  z.strictObject({ verb: z.literal("FlipUncharted"), target: z.enum(["self", "picked", "subject"]).optional(), ...when }),
  // "Look at its facedown side" (11030:B:4, 11032:A:1): the actor sees the other side of a Lost Island, the card itself (or the picked one), in a look window; the card stays
  // facedown and none of the Forced effects of its other side happen (dcce.uncharted). `remove`: this much progress is first taken off the card ("Remove 4 progress from Lost
  // Island to look at its facedown side").
  z.strictObject({ verb: z.literal("LookAtFacedown"), target: z.enum(["self", "picked"]).optional(), remove: z.number().int().positive().optional(), ...when }),
  // "Add progress to Explore the Island equal to that location's printed quest points" (11025:B:2): the quest card's own effect, which puts progress on the current quest card
  // even where the quest card says no other progress can be placed on it (a quest effect, not a player card effect or the quest phase). A full stage advances.
  z.strictObject({ verb: z.literal("AddStageProgress"), amount: positiveAmountSchema, ...when }),
  // Setup: "The first player takes control of Calphon" (11025:A:1): the set-aside copy of the card with this name comes into play, ready, under the first player.
  z.strictObject({ verb: z.literal("PutSetAsideInPlay"), name: z.string().min(1), ...when }),
  // Campaign Setup: "Attach Spyglass to Calphon" (11179:A:2): the set-aside copy of the card with this code is attached to the card in play with that name. A card dealt on its
  // Upgraded side stays so.
  z.strictObject({ verb: z.literal("AttachSetAsideTo"), code: z.string().min(1), to: z.string().min(1), ...when }),
  // Campaign Setup: "For each character in play, its controller may deal 1 damage to it to reduce their threat by 1" (11179:A:2). In player order, each character in play is
  // offered to its controller (trade or keep); a trade deals `damage` to it and lowers that player's threat by `threat`. `character` is engine use: the character being decided.
  z.strictObject({ verb: z.literal("TradeDamageForThreat"), damage: z.number().int().positive(), threat: z.number().int().positive(), character: z.string().optional(), ...when }),
  // The campaign card stays beside the quest deck while the scenario is played, because a card of the scenario places resources on it (Revenant, 11181:A:4) and its Resolution
  // counts them (11179:B:4). Changes nothing when it runs; rules/families/burden-campaign.ts reads it.
  z.strictObject({ verb: z.literal("KeepCampaignCard"), ...when }),
  // "Place 1 resource on the campaign card" (11181:A:4): the campaign card in play gains `amount` resource tokens.
  z.strictObject({ verb: z.literal("AddCampaignResource"), amount: positiveAmountSchema, ...when }),
  // "Look at the bottom card of your deck" / "the bottom 5 cards" (110013:A:2, 110013:B:3): the deck of the actor, or of the last picked player (`picked`), shown in a look
  // window. The cards shown are the ones the effect looked at, the bottom one the picked card, so a Pick with `looked` and SwapPicked can switch one with a card in hand.
  z.strictObject({ verb: z.literal("LookAtBottom"), count: positiveAmountSchema.optional(), deck: z.enum(["own", "picked", "encounter"]).optional(), ...when }),
  // "Discard the bottom card of your deck" (11033:A:2, 11034:A:1, 11071:A:2, 11070:A:2): the bottom card of the deck of `who` (the actor; the first player) goes to its owner's discard pile, announced as discarded from the deck, and the effect remembers it, so the condition `discardedCost` can read its printed cost.
  z.strictObject({ verb: z.literal("DiscardBottom"), who: z.enum(["actor", "firstPlayer"]).optional(), ...when }),
  // "Then, he discards each card in his hand with a printed cost higher than that of the discarded card" (11034:A:1): from the hand of `who`, each card whose printed cost is higher
  // than that of the card DiscardBottom discarded goes to its owner's discard pile.
  z.strictObject({ verb: z.literal("DiscardCostlier"), who: who.exclude(["picked"]).optional(), ...when }),
  // "Discard the top X cards of the encounter deck" (11073:A:1): the top `count` cards go to the encounter discard pile, face up, and are the cards the effect looked at.
  z.strictObject({ verb: z.literal("DiscardEncounterTop"), count: positiveAmountSchema, ...when }),
  // "Each player adds an Undead enemy discarded by this effect to the staging area" (11073:A:1): in player order, each player adds one card of this trait and type among the
  // cards DiscardEncounterTop discarded and that are still in the encounter discard pile, choosing among them (`seat` is engine use: the player adding now).
  z.strictObject({ verb: z.literal("StageLooked"), trait: z.string().min(1), type: z.enum(["enemy"]), seat: z.number().int().min(0).optional(), ...when }),
  // "Each player must exhaust a character he controls" (11033:A:1): in player order, each player chooses one of the ready characters they control to exhaust, the card choosing
  // for itself when there is one; a player with none exhausts nothing (`seat` is engine use: the player exhausting now).
  z.strictObject({ verb: z.literal("EachExhaustsOne"), seat: z.number().int().min(0).optional(), ...when }),
  // "Look at a shadow card. You may discard it." (11180:B:3): the shadow card dealt to the last picked enemy has been looked at; the actor chooses to discard it or keep it.
  z.strictObject({ verb: z.literal("MayDiscardShadow"), ...when }),
  // "The players, as a group, must remove characters with a total of at least X Willpower from the quest" (11075:A:1): the first player removes committed characters of any
  // player, one at a time, until their Willpower adds up to `amount` or none is left (`left` is engine use: the Willpower still to remove).
  z.strictObject({ verb: z.literal("RemoveWillpowerFromQuest"), amount: positiveAmountSchema, left: z.number().int().min(0).optional(), ...when }),
] as const;

export const TRIGGERS = [
  // About a location: it was flipped over (FlipUncharted), now on its other side. "Forced: After Lush Jungle is flipped over while active" (the record's condition says
  // `sourceIn activeLocation`).
  "flippedOver",
] as const;

export const FLAGS = [
  // On a card: no more than this much damage is placed on it at a time, the rest is not placed ("When 3 or more damage would be placed on Revenant, place 2 damage instead",
  // 11181:A:3). The smallest limit the card holds counts; Revenant's Forced records set it when it joins the staging area and when it engages a player.
  "damageLimit",
  // On a seat ("your deck cannot be searched", 11069:A:1) or on the table ("players cannot draw cards or search their decks", 11027:A:1, with the flag cannotDraw): a Pick
  // from a deck that is not the cards the effect looked at offers nothing.
  "noDeckSearch",
  // On a character: it loses the ranged keyword it has (11030:A:1).
  "loseRanged",
  // On a card: no player card can be attached to it ("Cannot have player card attachments", the Lost Island side).
  "noPlayerAttachments",
  // On a location: while it is the active location it contributes its Threat to the staging area's ("it contributes its Threat to the staging area", 11072:A:1).
  "activeThreat",
] as const;
