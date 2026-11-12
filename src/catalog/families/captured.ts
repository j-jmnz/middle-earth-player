// The vocabulary Escape from Mount Gram (mec108.captured-deck, mec108.captured-cards, mec108.capture-x, mec108.joining-another-player) adds to effect records: the captured deck each player prepares, Capture X, the cards captured underneath
// another card and their rescue, and the players who join one another's staging areas. The amount `captured`, the condition `captured` and the pick filter `captured` are in the shared schemas; src/rules/families/captured runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const code = z.string().min(1);

const VERBS = [
  // The Capture X keyword (mec108.capture-x), a constant marker on the card ("Capture 7.", 10039:A:1): when the card enters play (revealed, added to the staging area, put into play engaged, or a quest card that becomes a stage), before its When Revealed resolves, each player sharing its
  // staging area captures the top X cards of their captured deck underneath it (fewer when the deck is shorter). The verb itself does nothing when a record runs it.
  z.strictObject({ verb: z.literal("Capture"), amount: z.number().int().positive() }),
  // A constant marker: the card is "considered to be in each player's staging area" (10175:A:1): it is in every seat's staging area when stages are separate, one card with one set of tokens and one pile of captured cards.
  z.strictObject({ verb: z.literal("InEveryArea") }),
  // Setup (10038:A:1), after the player chose their starting hero (the last Pick): the player's captured deck is made of every ally, Item attachment, Mount attachment and Artifact attachment of their deck and every hero but the starting hero, shuffled, with one of those heroes
  // (chosen at random with the game's seed) put on top; the starting hero gets 2 resources and the player's threat is set to its threat cost (mec108.captured-deck). A hero's permanent boons wait with it for the campaign card's Setup to set them aside.
  verbFlags(z.strictObject({ verb: z.literal("PrepareCapturedDeck") }), { setupRuns: "inForEachPlayer" }),
  // Campaign Setup (10174:A:2): the permanent boons attached to heroes that are in a captured deck are set aside, still the hero's: they are attached again when the hero is put into play (AttachHeroBoons).
  verbFlags(z.strictObject({ verb: z.literal("SetAsideCapturedBoons") }), { setupRole: "beforeReveal" }),
  // The actor (`eachSeat`: every living player, the first player first) captures `amount` cards from the top or the bottom of their captured deck underneath the source (`self`) or the card in play with this code ("capture an additional 2 cards from the top of your captured deck
  // underneath that copy of Prison Cell", 10039:A:2; "capturing the bottom 5 cards of each player's captured deck underneath it", 10174:A:2). A shorter deck gives what is left.
  verbFlags(z.strictObject({ verb: z.literal("CaptureFromDeck"), amount: z.number().int().positive(), end: z.enum(["top", "bottom"]), under: z.union([z.literal("self"), z.strictObject({ code })]), who: z.enum(["actor", "eachSeat"]).optional(), ...when }), { setupRole: "beforeReveal" }),
  // The last card picked before the last pick is captured underneath the card the last pick chose ("captures it underneath the encounter card with the highest Threat", 10051:A:1): an ally the actor controls, captured from play; nothing happens when the pick before found no ally.
  z.strictObject({ verb: z.literal("CapturePicked"), ...when }),
  // Each attachment attached to the defending character is captured underneath the attacking enemy ("Capture each attachment attached to the defending character underneath the attacking enemy", 10048:A:3); an encounter attachment too (rescued to the encounter discard pile).
  z.strictObject({ verb: z.literal("CaptureAttachments"), ...when }),
  // A replacement: an ally the attack would damage is captured underneath the attacking enemy instead, with no damage dealt ("When Cruel Torturer would damage an ally by an attack, capture that ally underneath Cruel Torturer instead", 10043:A:2). On the enemy it is a marker the
  // damage step reads; run as a Shadow effect it makes the attack in progress do it ("If this attack would damage an ally, capture that ally underneath the attacking enemy instead", 10051:A:2).
  z.strictObject({ verb: z.literal("CaptureInsteadOfDamage") }),
  // The last card picked is put into play at no cost under its owner: an ally or a hero, or an attachment attached to a hero its owner controls (the owner chooses which when several can have it; mec108.captured-cards). A card that is not one of those stays where it is.
  z.strictObject({ verb: z.literal("PutCapturedIntoPlay"), ...when }),
  // The source discards each card captured underneath it, each to its owner's discard pile (a hero that goes there is dead), and each player raises their threat by `threat` for each of their own characters (heroes and allies) so discarded ("raise each player's threat by 3 for each of
  // his characters that was discarded by this effect", 10053:A:3).
  z.strictObject({ verb: z.literal("DiscardCapturedUnder"), threat: z.number().int().positive().optional(), ...when }),
  // Each player sharing the staging area, in turn, discards the top card of their captured deck to their discard pile and, with `raiseByCost`, raises their threat by its printed resource cost (a hero, with none, 0); a player with no card to discard discards none ("Each player discards the top
  // card of his captured deck and raises his threat by that card's printed resource cost", 10052:A:1). The condition `captured: someoneEmpty` then says whether any player had none.
  z.strictObject({ verb: z.literal("DiscardCapturedTop"), raiseByCost: z.literal(true).optional(), ...when }),
  // The source enemy engages the player the last pick chose, leaving any other engagement, and keeps the one it has with that player: no engagement check ("Jailor Gornákh engages the player with the highest threat", 10041:A:1).
  z.strictObject({ verb: z.literal("EngageSelfWithPicked"), ...when }),
  // The seat whose stage the source is, when its own stage has no captured cards, joins another player: its staging cards move to that player's area, its active location is discarded, its stage leaves play and it shares that player's area and stage from then on; when no other
  // area exists every player advances together to the stage with this code, and the staging areas become the one shared area ("join another player ... If you cannot join another player, all players advance to stage 3A together", 10039:B:2; mec108.joining-another-player).
  z.strictObject({ verb: z.literal("JoinAnotherPlayer"), advanceTo: code, ...when }),
  // After a hero enters play (campaign mode): each permanent boon set aside for that hero (SetAsideCapturedBoons) is attached to it, in the order they were set aside ("attach to that hero each set-aside permanent boon attachment assigned to that character in the Campaign Log", 10174:B:2).
  z.strictObject({ verb: z.literal("AttachHeroBoons"), ...when }),
  // Resolution (10174:B:3): for each player, the unique cards still in their captured deck are recorded in the Campaign Log's stolen cards; the campaign refuses them in that player's deck and as that player's hero for the rest of the campaign.
  z.strictObject({ verb: z.literal("RecordStolenCards") }),
  // The Loot the Dungeons reward (10175:A:2): in order from the first player, each player may choose one of the boons that are still set aside and add it to their hand; the boon joins the Campaign Pool. A boon taken is not offered again. `seat` is engine use: the player whose turn it is.
  z.strictObject({ verb: z.literal("ChooseBoonToHand"), codes: z.array(code).min(1), seat: z.number().int().min(0).optional(), ...when }),
] as const;

const TRIGGERS = [
  // About the card the captured cards were under: the cards captured underneath it were just rescued, once for everything one effect rescued (the host is the subject; it may have left play): "After 1 or more captured cards are rescued" (10041:A:1), "After the captured card(s) underneath Dungeon Guard are rescued" (10044:A:2).
  "capturedRescued",
  // About a hero (the subject) that entered play after the game began: a rescued hero, or one put into play from under a card ("After a hero enters play", 10174:B:2).
  "heroEnteredPlay",
  // Never announced: the line of an enemy whose attack replaces damage with a capture is a marker the damage step reads (CaptureInsteadOfDamage).
  "wouldDamageAlly",
] as const;

const FLAGS = [
  // On a quest stage: progress that would be placed on it rescues that many captured cards underneath it at random instead ("rescue an equal number of captured cards at random from underneath it instead", 10039:B:1; progress goes to the active location first).
  "progressRescues",
] as const;

export const manifest = { name: "captured", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
