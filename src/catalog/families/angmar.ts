// The vocabulary Angmar Awakened (mec108) adds to effect records: Time X and its time counters, a card held facedown under a side quest, the cards a side quest holds from the players' hands, the current quest chosen among the quest cards in play, and the
// Setup of the campaign card that names a card and a trade of damage. The amount `questCards` and the conditions `currentQuest` and `questLeads` are in effect-schema-amount.ts and effect-schema-conditions.ts; src/rules/families/angmar runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const code = z.string().min(1);

const VERBS = [
  // The Time X keyword (mec108.time-x), a constant marker on the card ("Time 4.", 09024:A:1): when the card is revealed (from the encounter deck or by an effect) X resource tokens, its time counters, are put on it, and at the end of each refresh phase one comes off it
  // (RemoveTimeCounters). The last one's removal is heard by the card (`lastTimeCounterRemoved`). The verb itself does nothing when a record runs it.
  z.strictObject({ verb: z.literal("Time"), amount: z.number().int().positive() }),
  // The end of the refresh phase (engine use, run by the rules' own frame, not by a card): one time counter comes off each card in play with the Time X keyword that holds one, and a card whose last counter goes is announced (`lastTimeCounterRemoved`).
  z.strictObject({ verb: z.literal("RemoveTimeCounters") }),
  // The card in play with this code, controlled by a player, loses its controller and lies facedown underneath the source, still in play, with its attachments and tokens ("The first player loses control of Iârion and places him facedown underneath this stage", 09024:A:2;
  // rr.in-play-and-out-of-play: it does not leave play). It is in the captive zone (families/south/captive.ts) with no flag, so nothing that names a hero reads it. When the source is defeated the card returns to play under the first player, exhausted, faceup, with its attachments
  // ("When this stage is defeated, the first player takes control of Iârion and exhausts him": families/sidequests/quest.ts defeatSideQuest). Nothing happens when no player controls such a card.
  z.strictObject({ verb: z.literal("HoldUnder"), code, ...when }),
  // The card held under the source is discarded, to the pile its type says: it leaves play from where it lay, so a card that says "if this leaves play" hears it ("discard Iârion", 09024:A:3; mec108.objective-allies).
  z.strictObject({ verb: z.literal("DiscardHeld"), ...when }),
  // The actor places every card of their hand facedown underneath the source, an encounter side quest ("Each player places all cards in his hand facedown underneath Lost in the Wilderness", 09051:A:1). The cards stay their player's and are out of play; ReturnFacedownToHands gives
  // them back. An empty hand puts nothing.
  z.strictObject({ verb: z.literal("PlaceHandUnderSelf"), ...when }),
  // The first player chooses a quest card other than the current quest to be the current quest until the end of the phase: the main quest card or an encounter side quest in the staging area ("choose a different quest card in play to be the current quest", 09049:A:2;
  // mec108.side-quests-in-play). A player side quest in a quest area cannot be the current quest. Nothing is chosen when there is only the current one.
  z.strictObject({ verb: z.literal("ChooseCurrentQuest"), ...when }),
  // Campaign Setup: a copy of the card from the supply is put into play attached to the card in play with this title ("Attach Iârion's Pendant to Iârion", 10156:A:2). It resolves after the quest card's Setup, which puts the host into play; with no such host nothing is attached.
  verbFlags(z.strictObject({ verb: z.literal("AttachNewTo"), code, to: z.string().min(1) }), { setupRole: "afterSetup" }),
  // Campaign Setup: starting with the first player, each player may place `damage` damage on the card with this code to add `resources` resource to each of their heroes' pools ("each player may place 4 damage on Protect the Innocent to add 1 resource to each of their heroes'
  // resource pools", 10156:A:2). The tokens are placed, not dealt: nothing cancels them, and a player may take the card to its limit. `seat` is engine use: the player whose turn it is.
  // A constant marker on a quest stage ("The first Weather treachery card revealed each round gains surge", 09069:B:1): the first card with this Trait revealed in a round (from the encounter deck or by an effect) gains Surge as it is revealed (rr.surge).
  z.strictObject({ verb: z.literal("FirstTraitSurge"), trait: z.string().min(1) }),
  // The phase in progress ends once the effect that ends it has finished: the steps of the phase left are skipped and the next phase begins ("End the current phase", 09070:A:1; mec108.campaign-mode). In the quest phase the characters stay exhausted but are no longer committed and
  // the quest is not resolved (as EndQuestPhase); in the combat phase the attacks left are not made.
  z.strictObject({ verb: z.literal("EndPhase"), ...when }),
  // Campaign Setup: the card in play with this code gets the damage the Campaign Log noted for it ("place damage on it equal to the amount of damage noted for it in the Campaign Log", 10159:A:2): the Protect the Innocent damage, 0 when none is noted.
  // Only Protect the Innocent (10158) and Arnor Ravaged (100158) have damage the log notes (`protectDamage`), so no other code is accepted.
  verbFlags(z.strictObject({ verb: z.literal("PlaceLoggedDamageOn"), code: z.enum(["10158", "100158"]) }), { setupRole: "afterSetup" }),
  // Starting with the first player, each player may choose 1 of the boons that are still set aside and attach it to a hero they control ("each player may choose 1 of the following boons and attach it to a hero they control", 10160:A:3): the player picks a boon or none, then the hero.
  // A boon taken is not offered again. `seat` is engine use: the player whose turn it is.
  z.strictObject({ verb: z.literal("ChooseBoon"), codes: z.array(code).min(1), seat: z.number().int().min(0).optional(), ...when }),
  verbFlags(z.strictObject({ verb: z.literal("TradeDamageForResources"), code, damage: z.number().int().positive(), resources: z.number().int().positive(), seat: z.number().int().min(0).optional() }), { setupRole: "afterSetup" }),
] as const;

const TRIGGERS = [
  // About the card that held a time counter: its last one was just removed at the end of the refresh phase (the subject is the card; mec108.time-x): "After the last time counter is removed from this stage".
  "lastTimeCounterRemoved",
  // About the enemy whose attack just damaged a character (a hero or an ally; the other card is the character), once for the attack: "After an attack damages a character" (10158:A:1). Damage canceled or prevented is not damage, and an attack that damages nobody is not heard.
  "attackDamagedCharacter",
] as const;

const FLAGS = [
  // On a side quest: progress that would be placed on it removes that much damage from it instead (10158:A:2; families/wilderland/night-quest.ts placeOnCurrentSideQuest).
  "progressRemovesDamage",
  // On a card: it has the Surge keyword ("While there is only 1 quest card in play, Shrouded Hills gains surge", 09048:A:2): the reveal frame reads it as it reads the printed keyword (rr.surge; windows/frames.ts).
  "gainsSurge",
  // On the table, until the end of the round: a card with the Trait a FirstTraitSurge names was revealed (the round's first has gained surge).
  "traitRevealed",
  // On the characters a blankText modifier holds (target `damagedCharacters`): their keywords stay although the rest of the printed text box is treated as blank ("except for keywords and Traits", 09054:A:1; rr.blank).
  "keepsKeywords",
  // On the table, until the end of the phase: an EndPhase ran, and the phase ends once the effect that ran it has finished (families/angmar/phase.ts).
  "phaseEnds",
  // On a hero (target `host`), until the end of the phase: its controller may play an attachment from their discard pile onto this hero, paying its cost; the play uses it up ("Play an attachment from your discard pile on attached hero", 10165:A:4; families/angmar/discard-play.ts).
  "attachmentFromDiscard",
] as const;

export const manifest = { name: "angmar", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
