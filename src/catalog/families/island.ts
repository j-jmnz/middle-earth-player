// The island family (phase 45, Temple of the Deceived): the Island Map and Exploration (dcce.island-map, dcce.exploration), the secrets the campaign card places under the Temple locations, the
// guarded Gate Key and the verbs and flags of the locations on the map. Simple verbs; effect-schema-verbs.ts composes them and src/rules/families/island/index.ts runs them (the helpers are beside it in src/rules/families/island/).
// The rules are the Dream-chaser Campaign Expansion rulebook (dcce.*, data/rules/entries.json).
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const VERBS = [
  // Setup: "Prepare the Island Map" (dcce.island-map). The double-sided locations the scenario dealt as its Uncharted deck are separated: the cards with the codes in `temple` (the three Temple of the
  // Deceived locations) are shuffled and laid in the right-hand column, the others are shuffled and fill the first four columns, a grid of three rows by five. Every card lies Lost Island (or
  // Temple of the Deceived) side up, which nobody looks at.
  verbFlags(z.strictObject({ verb: z.literal("PrepareIslandMap"), temple: z.array(z.string().min(1)).min(1), ...when }), { setupRuns: "top" }),
  // Setup: "Flip over the top-left and bottom-left locations of the Island Map (without resolving their Forced effects, if any)" (12067:A:1): both turn to their other side with no flip announced.
  z.strictObject({ verb: z.literal("RevealIslandCorners"), ...when }),
  // Setup: "choose one as the players' starting active location, using a resource token to represent which location is active" (12067:A:1): the picked location becomes the active location where it
  // lies. Not a travel: no Travel effect, no `traveled` event, no Forced effect of becoming active.
  z.strictObject({ verb: z.literal("SetIslandActive"), ...when }),
  // Setup: "Add Temple Guardian to the staging area and attach Gate Key to it, guarded" (12067:A:1): the set-aside copy of the card with this title (whichever printing the game deals) is attached to the
  // card in play with the title `to` and stays so until that card leaves play, when it returns to the staging area (rr.guarded).
  z.strictObject({ verb: z.literal("AttachGuarded"), name: z.string().min(1), to: z.string().min(1), ...when }),
  // Campaign Setup: "Shuffle Starla and both Recurring Nightmares together and place one facedown under each Temple of the Deceived location, as secrets" (11197:A:2): the set-aside copies of the cards
  // with these codes are shuffled and lie facedown under the Temple locations, one each, in the order the seed gives.
  verbFlags(z.strictObject({ verb: z.literal("PlaceSecrets"), codes: z.array(z.string().min(1)).min(1), ...when }), { setupRole: "afterSetup" }),
  // "Flip over a secret at your location. If it is a Recurring Nightmare, it engages you. If it is Starla, you gain control of her (ready)." (11197:A:3): the secret under the active location turns
  // faceup, and the actor takes the card as that line says. Nothing happens when the active location has no secret.
  z.strictObject({ verb: z.literal("FlipSecret"), ...when }),
  // "Look at the facedown side of a Temple of the Deceived location or secret" (110078:B:3): the actor sees the picked secret, which stays facedown.
  z.strictObject({ verb: z.literal("LookAtSecret"), ...when }),
  // "Put Temple Guardian into play from the victory display, engaged with the player with the highest threat" (12068:A:1): the card with this title leaves the victory display for the engagement area of
  // the player with the highest threat (the first player chooses among those tied). Nothing happens when it is in play or not in the victory display.
  z.strictObject({ verb: z.literal("EngageFromVictory"), name: z.string().min(1), ...when }),
  // "For each progress that would be placed on Searching the Island, you may place it on a location in the staging area, instead" (12067:B:2): the progress the stage heard (the effect's X) is placed by
  // the first player, who chooses a location in the staging area that can take progress and puts on it all that it can take, then chooses again for what is left, until none is left, no location can take
  // any or the first player keeps the rest on the stage (where it does nothing). With `required` the first player may not keep it ("Progress that would be placed on this quest is instead placed on locations in the staging area, divided as you choose", 10152:B:2): they divide it freely: each time they choose a location, then
  // how much of what is left goes on it (up to what it still needs), and the rest stays on the stage only when no location can take any more. `left` and `at` are engine use: the progress still to place and the location chosen, whose amount is asked next.
  z.strictObject({ verb: z.literal("PlaceProgressInStaging"), left: z.number().int().min(0).optional(), required: z.literal(true).optional(), at: z.string().min(1).optional(), ...when }),
  // "When Recurring Nightmare leaves play, shuffle it into any player's deck" (11199:A:2): the source card goes from the discard pile it went to into the deck of a player, shuffled in. The first player
  // chooses the player when there is more than one; `seat` is engine use: the seat chosen.
  z.strictObject({ verb: z.literal("ShuffleIntoPlayerDeck"), seat: z.number().int().min(0).optional(), ...when }),
  // Campaign Setup: "One player may raise their threat by 4 to attach Spyglass to a hero" (11197:A:2). In player order each player is offered it, if their threat can rise by `amount` without reaching
  // 50, and the first to accept raises their threat and chooses a hero (any player's) for the set-aside copy of the card with this code; nobody is offered it after that. `seat` and `accepted` are
  // engine use: the player being asked, and the player who said yes and now chooses the hero.
  verbFlags(z.strictObject({ verb: z.literal("RaiseThreatToAttach"), code: z.string().min(1), amount: z.number().int().positive(), seat: z.number().int().min(0).optional(), accepted: z.boolean().optional(), ...when }), { setupRole: "afterSetup" }),
] as const;

const TRIGGERS = [
  // About a card: it was drawn into a player's hand and is not a player card ("When Recurring Nightmare enters your hand", 11199:A:3). Announced only when a card of the types that are not played from
  // a hand (an enemy) is drawn, so no other game's events change.
  "enteredHand",
  // About a card: it is out of play, whichever way it left (destroyed, discarded, shuffled into a deck, returned to a hand, removed from the game; "When Recurring Nightmare leaves play", 11199:A:2).
  // Announced only to a card whose record hears it, once it is out of play, so no other game's events change.
  "exitedPlay",
] as const;

const FLAGS = [
  // On the table: the Exploration keyword is in force (dcce.exploration): a location that has progress equal to its quest points stays in play, the players travel from the active location when it
  // has, and the locations next to it are the staging area.
  "exploration",
  // On a location: while it is the active location, the location to its right (`1`) or the locations above and below it (`2`) are not considered to be in the staging area ("the location to its
  // right is not considered to be in the staging area", 12072:A:1; "the locations immediately above and below it", 12074:A:1).
  "islandBlock",
  // On a location: while it is the active location, the players may travel to a location up to this many locations away, still paying its Travel cost (12073:A:2).
  "islandReach",
  // On a quest stage: progress that would be placed on it may be placed on a location in the staging area instead; the stage hears the amount, once the active location has taken its share
  // (`progressReplaced`, "For each progress that would be placed on Searching the Island, you may place it on a location in the staging area, instead", 12067:B:2).
  "progressToStaging",
] as const;

export const manifest = { name: "island", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
