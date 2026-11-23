// The vocabulary Flies and Spiders (The Hobbit: On the Doorstep, hob.venom-poison, hob.unconscious-characters, hob.staging-area-creating, hob.staging-area-combining) adds to effect records: poison and the unconscious state, and the
// partial split of the staging areas its stages make. src/rules/families/poison runs them. The pick filters `poisoned`, `unconscious`, `mostPoison` and `poison`, the amount `poison` are in effect-schema-pick.ts and effect-schema-amount.ts.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { cardRefSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // The character (the last picked card by default) gets `amount` poison, 1 by default: for each, the top card of its controller's deck is attached to it facedown, a Condition attachment that is out of play under the character (`poison` on the card; hob.venom-poison).
  // A controller whose deck is empty gives none. A character with the flag `cannotBePoisoned` (an unconscious one) gets none. With poison equal to the character's printed hit points it is made unconscious at once and its poison is discarded (hob.unconscious-characters).
  z.strictObject({ verb: z.literal("GivePoison"), amount: z.number().int().positive().optional(), target: cardRefSchema.optional(), ...when }),
  // `amount` poison, or `all` of it, is discarded from the character (the last picked card by default): each goes to the discard pile of the player who owns it (the player whose deck it came from, not whoever controls the character now). Nothing happens to a character with none.
  z.strictObject({ verb: z.literal("DiscardPoison"), amount: z.number().int().positive().optional(), all: z.literal(true).optional(), target: cardRefSchema.optional(), ...when }),
  // The character (the last picked card by default) is made unconscious: it is rotated 180 degrees (`unconscious` on the card), which replaces ready and exhausted, it leaves the quest, and its poison is discarded (hob.unconscious-characters). A character already unconscious is left as it is.
  z.strictObject({ verb: z.literal("MakeUnconscious"), target: cardRefSchema.optional(), ...when }),
  // "Ready an unconscious character": the character (the last picked card by default) is no longer unconscious and is ready. This is the one way an unconscious character readies, the effects "that target unconscious characters" (hob.unconscious-characters). A character not unconscious is left as it is.
  z.strictObject({ verb: z.literal("ReadyUnconscious"), target: cardRefSchema.optional(), ...when }),
  // "This enemy attacks the character with the most poison attached" (132029:A:2): the source, an enemy in the staging area, attacks the player who controls the last picked character now, with a shadow card, outside the combat phase and with no engagement (rr.attacks-outside-the-combat-phase). The record picks the character first
  // (the pick filter `mostPoison`: the first player chooses among those tied). Nothing happens when nothing was picked.
  z.strictObject({ verb: z.literal("AttackPickedPlayer"), ...when }),
  // "Each player may shuffle 1 copy of ~ into his deck" (132067:A:1): the set-aside card with the printed code goes into the acting player's deck, and the deck is shuffled. Nothing happens when none is set aside.
  z.strictObject({ verb: z.literal("ShuffleSetAsideIntoDeck"), code: z.string().min(1), ...when }),
  // Stage 2B (132068:B:1): after the first player took his own stage, every other player advances to the stage with this printed code, and they keep the staging area they share, with the cards in it (hob.staging-area-creating). With no other player the stage they left and each card in its staging area are discarded instead, and the first player stays alone at his stage.
  // Run it after SplitToOwnStage, which leaves the shared stage to the other players.
  z.strictObject({ verb: z.literal("AdvanceOtherPlayers"), code: z.string().min(1), ...when }),
  // Stage 3B (132069:B:2): the acting player, whose stage is complete, goes on to the stage with this printed code: he joins the players who are at it, and the cards of his staging area and his active location join theirs, engaged enemies stay engaged, and the stage is not revealed again (hob.staging-area-combining);
  // with no player at it he advances alone and it is revealed. Nothing happens when the stage is not in the quest deck.
  z.strictObject({ verb: z.literal("JoinAtStage"), code: z.string().min(1), ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [
  // On an enemy: it has the Venom keyword ("Venom.", 132028:A:1). An enemy that damages a character in an attack gives that character 1 poison for that damage, whatever the damage; none when the damage is canceled or absorbed, or destroys the character (hob.venom-poison; rules/families/poison/venom.ts).
  "venom",
  // On a character: it cannot be given poison ("Unconscious characters cannot ... be poisoned", 132067:B:1).
  "cannotBePoisoned",
  // On a card: its Forced effects do not trigger ("Unconscious characters cannot ... trigger abilities", 132067:B:1). `cannotTriggerEffects` bars its Actions and Responses; this bars the Forced effects too (hob.unconscious-characters).
  "cannotTriggerForced",
] as const;

export const manifest = { name: "poison", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
