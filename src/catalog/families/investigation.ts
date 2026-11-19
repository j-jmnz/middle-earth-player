// The investigation family (Murder at the Prancing Pony, docs/brief.md, Murder at the Prancing Pony): the Investigation deck, a pile of facedown Suspects, Hideouts and Taken by Surprise that the players look at but never draw, the Investigate X keyword, and the accusation that ends stage 2.
// The deck is the named pile `investigation` (src/rules/core/piles.ts). A card in it is never shown but by a look window: no step, log line or readout names a card of the pile or the hidden Suspect and Hideout set aside facedown. src/rules/families/investigation/ runs the verbs.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const code = z.string().min(1);

const VERBS = [
  // Setup (50701:A:1, "Randomly select 1 Suspect and 1 Hideout and set them aside out of play, facedown"): of the set-aside cards with the codes `suspects` one, and of those with `hideouts` one, are picked with the game's seed and stay set aside facedown. No step names them.
  verbFlags(z.strictObject({ verb: z.literal("HideSuspectAndHideout"), suspects: z.array(code).min(2), hideouts: z.array(code).min(2), ...when }), { setupRuns: "top" }),
  // Setup (50701:A:1, "Build the Investigation deck"): the set-aside cards with these `codes` (each Taken by Surprise) join the Investigation deck, which HideSuspectAndHideout filled with the Suspects and Hideouts not hidden; the deck is shuffled with the game's seed.
  verbFlags(z.strictObject({ verb: z.literal("BuildInvestigationDeck"), codes: z.array(code).min(1), ...when }), { setupRuns: "top" }),
  // "Investigate X" (50716:A:1 to 50720:A:1), a Forced effect of a location on `activeExplored`: the first player shuffles the Investigation deck and looks at the top X cards (X read, plus the cards the flag `investigateLooked` adds), which stay on top in the same order. With fewer cards the deck holds them all.
  // Nothing happens while a card in play ignores the keyword (IgnoreKeyword). The location then hears `investigated`, and each card looked at that hears the look (Taken by Surprise) is told once the effect has resolved.
  z.strictObject({ verb: z.literal("Investigate"), amount: positiveAmountSchema, ...when }),
  // "Look at the top 2 cards / the bottom card of the Investigation deck" (50715:A:1, 50722:A:1, 50726:A:2): the actor sees `count` cards (1 by default) of the top or the bottom of the deck; nothing is shuffled or moved. The look is told to the cards that hear it once the effect has resolved.
  z.strictObject({ verb: z.literal("LookAtInvestigation"), from: z.enum(["top", "bottom"]), count: positiveAmountSchema.optional(), ...when }),
  // "Choose 1 random card from the Investigation deck and remove it from the game (without looking at it)" (50702:B:1): the game's seed picks; the card is removed unseen and unnamed. An empty deck changes nothing.
  z.strictObject({ verb: z.literal("RemoveRandomInvestigation"), ...when }),
  // "Shuffle ~ into the Investigation deck" (50728:A:1, 50728:A:2): the source card, from the staging area or as a shadow card, joins the deck facedown and the deck is shuffled.
  z.strictObject({ verb: z.literal("ShuffleSelfIntoInvestigation"), ...when }),
  // "The first player names 1 Suspect and 1 Hideout" (50702:B:2): the actor chooses one of the cards with these `codes` by its title (any of them, a card in play too); the choice is kept for MakeAccusation. `kind` says which of the two is named.
  z.strictObject({ verb: z.literal("NameInvestigation"), kind: z.enum(["suspect", "hideout"]), codes: z.array(code).min(2), ...when }),
  // "Reveal the facedown out-of-play Suspect and Hideout and add them to the staging area. If either is not the one named, search the Investigation deck for each card just named that is not in play, add it to the staging area, and raise each player's threat by 3" (the insert, 50702:B:2).
  // `suspects` and `hideouts` are the codes of the ten cards, so the hidden pair is the set-aside cards among them.
  z.strictObject({ verb: z.literal("MakeAccusation"), suspects: z.array(code).min(2), hideouts: z.array(code).min(2), ...when }),
  // "If the looked at card is a Suspect or a Hideout, add it to the staging area" (50720:A:2): the top card of the Investigation deck, which the keyword just showed, goes to the staging area faceup when it has one of the `traits`.
  z.strictObject({ verb: z.literal("AddLookedToStaging"), traits: z.array(z.string().min(1)).min(1), ...when }),
] as const;

const TRIGGERS = [
  // About a location: the Investigate keyword on it has resolved (50720:A:2: "After triggering the Investigate keyword on Village Stable").
  "investigated",
  // About a card of the Investigation deck, that a player has just looked at (Investigate, LookAtInvestigation): it hears it from the deck (50714:A:1). The event's seat is the first player.
  "lookedAtInvestigationDeck",
] as const;

const FLAGS = [
  // On a location (a constant ModifyStat of the location itself): the cards its Investigate keyword looks at beyond its value ("look at 2 additional cards", 50719:A:2). Read by Investigate.
  "investigateLooked",
] as const;

export const manifest = { name: "investigation", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
