// The grapple family (phase 44, The Thing in the Depths): Grapple X (dcce.grapple), the encounter set swap of the scenario (dcce.stormcaller-and-the-thing), the Stormcaller Elite's flip to its objective
// ally sides (dcce.stormcaller-elite), the Campaign Mode only side of The Thing in the Depths (dcce.campaign-mode) and the cards the campaign card puts into hands. Simple verbs;
// effect-schema-verbs.ts composes them and src/rules/families/grapple/index.ts runs them (the helpers are beside it in src/rules/families/grapple/). The rules are the Dream-chaser Campaign Expansion rulebook (dcce.*,
// data/rules/entries.json).
import { z } from "zod";

import type { Instruction } from "../boundary.ts";
import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

/** "Each player must exhaust a character he controls to travel here" (12044:A:1, 146018:A:2): the cost of a Travel line, which the players cannot pay without a ready character each (rr.travel). Shared by the card that grants it and by the records that print it. */
export const EXHAUST_COST: Instruction = { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }] };

const VERBS = [
  // "Immediately attach that enemy facedown to the location in the staging area specified in parentheses" (dcce.grapple): the source enemy (or the last picked card) with the Grapple keyword
  // attaches to the staging-area location the keyword names, the first player choosing among those tied; with no location in the staging area it is added to the staging area. Resolved by a
  // revealed enemy as it is revealed, and by "resolve the Grapple keyword" (12053:A:3, 12054:A:3). `card` is engine use: the enemy to resolve for (a card the effect discarded).
  verbFlags(z.strictObject({ verb: z.literal("ResolveGrapple"), target: z.enum(["self", "picked"]).optional(), card: z.string().min(1).optional(), ...when }), { runsInFrame: true }),
  // "Discard the top 3 cards of the encounter deck. Resolve the Grapple keyword on each enemy discarded by this effect." (12055:A:1): `count` cards; each enemy among them resolves its keyword,
  // in the order discarded.
  z.strictObject({ verb: z.literal("DiscardTopGrapple"), count: positiveAmountSchema, ...when }),
  // "Discard cards from the top of the encounter deck until X Tentacle enemies are discarded ... Resolve the Grapple keyword on each of those enemies." (12041:A:1): until `count` enemies with the trait
  // are discarded, or the deck is empty; then each of them resolves its keyword.
  z.strictObject({ verb: z.literal("DiscardUntilGrapple"), trait: z.string().min(1), count: positiveAmountSchema, ...when }),
  // Campaign Setup: "Use The Thing in the Depths' 'Campaign Mode only' side" (dcce.campaign-setup-the-thing-in-the-depths): the card with this title shows its side B, with the stats and the text printed there: the set-aside one, or
  // the one the scenario dealt to the staging area ("Use Temple Guardian's 'Campaign Mode only' side", dcce.campaign-setup-temple-of-the-deceived).
  verbFlags(z.strictObject({ verb: z.literal("FlipSetAside"), name: z.string().min(1), ...when }), { setupRole: "afterSetup" }),
  // "Flip Captain Sahír and Na'asiyah to their objective sides, removing all tokens from them" (12040:B:1): the card in play with this title (the enemy side of a Stormcaller Elite card) turns
  // into the objective ally side, loses its tokens and joins the play area of the first or the last player (11077:A:1, 11079:A:1). It hears that it flipped over. A card out of play stays so.
  z.strictObject({ verb: z.literal("FlipElite"), name: z.string().min(1), to: z.enum(["firstPlayer", "lastPlayer"]), ...when }),
  // "Captain Sahír flips to his enemy side (removing all tokens) and makes an immediate attack against the first player" (12093:A:1): the Stormcaller Elite card in play with this title (its objective ally side) turns to its
  // enemy side in the staging area, faceup and without tokens, and attacks the first player now, dealt a shadow card as an attack outside the combat phase is. The effect goes on once the attack is over.
  z.strictObject({ verb: z.literal("FlipEliteAndAttack"), name: z.string().min(1), ...when }),
  // "Search the encounter deck, discard pile and all play areas for each encounter card from the Corsair Raiders encounter set and remove each of those cards from the game" (12040:B:1): every
  // card of the set in the encounter deck, the encounter discard pile, the staging area, a player's engaged enemies, the active location and the cards attached to them leaves the game.
  z.strictObject({ verb: z.literal("RemoveEncounterSet"), set: z.string().min(1), ...when }),
  // "Shuffle ... the previously set aside The Thing in the Depths encounter set into the encounter deck" (12040:B:1): every set-aside card of the set joins the encounter deck. The deck is
  // shuffled by the ShuffleEncounterDeck after it.
  z.strictObject({ verb: z.literal("ShuffleSetAsideSet"), set: z.string().min(1), ...when }),
  // "At the end of the round, if Captain Sahír and Na'asiyah are not in play, add 1 resource to each of them" (12039:B:2): the set-aside cards with these codes hold the tokens until they enter play.
  z.strictObject({ verb: z.literal("AddResourcesSetAside"), codes: z.array(z.string().min(1)).min(1), amount: positiveAmountSchema, ...when }),
  // "One player adds Come Together to their hand" (11194:A:3): the first player chooses the player; the set-aside card with this code joins that player's hand and is recorded as a card the campaign
  // card gave this game ("For this game, X is plus 1", ScenarioState.chosenAtSetup).
  z.strictObject({ verb: z.literal("AddSetAsideToHand"), code: z.string().min(1), ...when }),
  // Shadow effect of an enemy card ("After this attack, either put Giant Arm into play engaged with you and deal it a shadow card, or resolve its Grapple keyword", 12054:A:3): the actor chooses as the
  // shadow effect resolves, and what they chose is done once the attack is over. The source (a shadow card) comes into play engaged with the actor and is dealt a shadow card of its own, or it resolves its
  // Grapple keyword. Both options are always possible. `card` and `choice` are engine use: the shadow card and the choice, queued for the end of the attack.
  verbFlags(z.strictObject({ verb: z.literal("EngageOrGrapple"), card: z.string().min(1).optional(), choice: z.enum(["engage", "grapple"]).optional(), ...when }), { runsInFrame: true }),
  // "Sea Serpent makes an attack against the first player" (11196:B:4): the source enemy, in the staging area or engaged with any player, attacks the first player now, dealt a shadow card for the attack.
  z.strictObject({ verb: z.literal("AttackFirstPlayer"), ...when }),
  // "Each of those characters gain a Trait of your choice" (11195:A:5): the actor chooses a Trait printed in the game, which the last picked card has until the end of the round.
  z.strictObject({ verb: z.literal("GainChosenTrait"), ...when }),
  // "Remove Black Key (burden) from the game" (11194:A:3): the card in play with this code leaves the game, wherever it is attached.
  z.strictObject({ verb: z.literal("RemoveCodeFromGame"), code: z.string().min(1), ...when }),
] as const;

const TRIGGERS = [
  // About an enemy: it was detached from a location it was grappled with and added to the staging area, because the location became the active location or was explored ("After Crushing Arm is
  // detached from a location", 12052:A:3). The event names the enemy as its subject.
  "grappleDetached",
] as const;

const FLAGS = [
  // On a card: it counts as indestructible while the record holds ("Captain Sahír and Na'asiyah gain indestructible", 12039:B:1).
  "indestructible",
  // On a character: it has the Trait named by the modifier's `trait` (GainChosenTrait).
  "traitGained",
  // On an enemy engaged with a player: an enemy in the staging area with `attacksViaRelay` attacks that player in the combat phase, as if engaged with it, and is dealt a shadow card for the attack
  // ("While Eye of the Beast is engaged with a player, The Thing in the Depths attacks that player during the combat phase", 12050:A:3).
  "relaysAttack",
  "attacksViaRelay",
  // On the table: the players may travel to a location in the staging area while another location is the active location, which then returns to the staging area ("12041:B:1").
  "travelOverActive",
  // On a location: each player must exhaust a character they control to travel there ("each other Deck location in play gains: Travel: Each player must exhaust a character he controls", 12044:A:1).
  "travelExhaust",
] as const;

export const manifest = { name: "grapple", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
