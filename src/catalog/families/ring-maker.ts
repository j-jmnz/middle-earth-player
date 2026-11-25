// The vocabulary The Ring-maker cycle (The Voice of Isengard, The Dunland Trap, The Three Trials, Trouble in Tharbad, The Nîn-in-Eilph, Celebrimbor's Secret, The Antlered Crown) adds to effect records. The Time X keyword itself is the angmar family's
// (src/catalog/families/angmar.ts); src/rules/families/ring-maker runs the verbs below and answers the hooks the flag needs.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const VERBS = [
  // "Remove 1 time counter from the current quest" (07020:A:2, 07022:A:1): up to `amount` time counters come off the current quest stage, one at a time, and the stage hears that its last one is gone (`lastTimeCounterRemoved`). A quest stage with no counter loses none.
  z.strictObject({ verb: z.literal("RemoveTimeFromQuest"), amount: positiveAmountSchema, ...when }),
  // "The first player draws this card into his hand" (07023:A:1): the source, an encounter card being revealed, goes into the hand of the actor and cannot leave it (`cannotLeaveHand`). It is no draw from a deck, so no card hears a draw, and the reveal does not discard it.
  z.strictObject({ verb: z.literal("DrawSelfIntoHand"), ...when }),
  // "Put the topmost Dunland enemy discarded this way into play engaged with that player" (07047:A:1): the enemy with this Trait among the cards the running effect's DiscardEncounterTop discarded that lies highest in the discard pile (the last one discarded) enters play engaged with the actor, who is
  // the player engaged. Nothing happens when none of those cards is such an enemy.
  z.strictObject({ verb: z.literal("EngageTopDiscarded"), trait: z.string().min(1), ...when }),
  // "Each player removes the top 20 cards of his deck and places them aside, as an out-of-play deck" (07062:A:1): each seat moves the top `count` cards of its deck (all it holds) into its out-of-play deck, a facedown pile of its own (the zones `outOfPlay0` and `outOfPlay1`). No card hears a draw or a discard.
  verbFlags(z.strictObject({ verb: z.literal("CreateOutOfPlayDecks"), count: z.number().int().positive(), ...when }), { setupRuns: "top" }),
  // "The first player takes Mugash plus 1 Mugash's Guard for each other player ... and randomly shuffles one facedown into each player's out-of-play deck" (07062:A:1): the set-aside copy of `once` and as many copies of `perOtherPlayer` as there are other seats are dealt one to each seat at random and every
  // out-of-play deck is shuffled; the Guards left stay set aside.
  verbFlags(z.strictObject({ verb: z.literal("ShuffleIntoOutOfPlayDecks"), once: z.string().min(1), perOtherPlayer: z.string().min(1), ...when }), { setupRuns: "top" }),
  // "Reveal the top card of each player's out-of-play deck" (07029:A:1) and "Searches X" (07027:A:2, 07028:A:1): the actor reveals the top `amount` cards of its out-of-play deck (all it holds). Each enemy is added to the staging area, not revealed; any other card is discarded to its owner's discard pile.
  // With `chooseForHand` the actor picks one of the other cards for its hand first. The deck is not shuffled. `revealed` is the verb's own note of the cards it asked about.
  z.strictObject({ verb: z.literal("RevealOutOfPlay"), amount: positiveAmountSchema, chooseForHand: z.literal(true).optional(), revealed: z.array(z.string()).optional(), ...when }),
  // "Return Mugash to the staging area" (07025:A:2, 07064:B:2): each enemy lying attached to a card as an attachment (`asAttachment`, AttachEnemyToPicked) with this title goes back to the staging area as an enemy. Mugash anywhere else is not moved.
  z.strictObject({ verb: z.literal("ReturnAttachedEnemy"), name: z.string().min(1), ...when }),
  // "The defending player shuffles 1 random card from his hand into his out-of-play deck" (07026:A:1): the actor puts one random card of its hand, not one that cannot leave the hand, facedown into its out-of-play deck, which is shuffled. An empty hand does nothing.
  z.strictObject({ verb: z.literal("ShuffleHandCardIntoOutOfPlay"), random: z.literal(true), ...when }),
] as const;

const FLAGS = [
  // On a card in a hand: it cannot leave that hand ("Ill Tidings cannot leave that player's hand", 07023:A:1). core/zones.ts moveCard refuses the move; a pick that would discard it and a random discard leave it out (families/wilderland/pick.ts barredFromPlayerDiscard).
  "cannotLeaveHand",
  // On an enemy in the staging area: it engages the player who controls a hero with Mugash attached, at once and whatever its engagement cost ("Mugash's Guard engages that player", 07025:A:1). The settle sweep is families/ring-maker/captor.ts.
  "engagesCaptiveHolder",
] as const;

export const manifest = { name: "ring-maker", verbs: VERBS, triggers: [], flags: FLAGS } as const satisfies CatalogFamily;
