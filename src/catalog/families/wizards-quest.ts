// The Wizard's Quest family (docs/brief.md, The Wizard's Quest): the scenario kit's Quick-build (7 of the 14 encounter sets, one stage 2 and one stage 3 chosen) and the searches of the quest stages' "opposing team" lines.
// The opposing team's choices are made by the engine in the manner that gives the players the greatest challenge (reading 3): the search fields `byChallenge`, `maxCost`, `maxCostMulti`, `types` and `top` of the search verbs (src/catalog/effect-schema-verbs.ts)
// and the pick field `challenge` (src/catalog/effect-schema-pick.ts) are its policy. src/rules/families/wizards-quest/ runs the verbs.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const code = z.string().min(1);

const VERBS = [
  // Setup, the Quick-build rule of the kit (docs/brief.md, The Wizard's Quest, reading 2): of the encounter sets named by `sets` that the encounter deck holds, the game's seed picks `keep`; the cards of the others leave the encounter deck and lie set aside, out of play, for the whole game.
  verbFlags(z.strictObject({ verb: z.literal("BuildQuickDeck"), sets: z.array(z.string().min(1)).min(2), keep: z.number().int().positive(), ...when }), { setupRuns: "top" }),
  // Setup, the Quick-build rule (reading 2): the first player chooses one of the quest cards in the quest deck with these `codes` (a stage 2 or a stage 3); the others lie set aside, out of play, and leave the quest's order. Nothing is asked when one is left.
  verbFlags(z.strictObject({ verb: z.literal("ChooseQuestStage"), codes: z.array(code).min(2), ...when }), { setupRuns: "top" }),
  // The When Revealed of the stage 2 and stage 3 cards (51003:A:1 to 51009:A:1): "The opposing team searches the top `top` cards of the encounter deck for a card with cost `maxCost` or less (`maxCostMulti` or less if there are two or more players), sets it aside, and shuffles the encounter deck. Reveal the set aside card.
  // Its 'when revealed' effects cannot be canceled." The card nearest the top that qualifies is the one (reading 3: no measure ranks the types); it is set aside, the deck is shuffled, and it is revealed as an encounter card, its When Revealed effects uncancelable. With none, only the shuffle (reading 5).
  z.strictObject({ verb: z.literal("SearchTopReveal"), top: z.number().int().positive(), maxCost: z.number().int().min(0), maxCostMulti: z.number().int().min(0), ...when }),
  // "places them faceup under this stage as guarded objectives" (51004:B:1) and "place faceup under Necromancer's Pass as a guarded objective" (51013:A:1): the last picked card, an ally in play or a card of a hand, lies faceup under the source card, still its owner's, out of play (docs/brief.md, The Wizard's Quest, readings 9 and 3).
  // An ally in play loses its tokens and its attachments are discarded as it leaves play. The source gives them back (ReturnFacedownToHands) and, while they lie there, no copy of their title can be played or put into play (src/rules/families/wizards-quest/held.ts).
  z.strictObject({ verb: z.literal("HoldPickedUnder"), ...when }),
  // A constant marker of the card that holds player cards under it (51004:B:2, 51013:A:1): "copies of that card cannot be played" while it lies there. The bar is the engine's (a card held by HoldPickedUnder bars its title, families/wizards-quest/held.ts), so run alone it does nothing.
  z.strictObject({ verb: z.literal("BarHeldTitles") }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [
  // On an encounter card revealed by SearchTopReveal: its When Revealed effects cannot be canceled ("Its 'when revealed' effects cannot be canceled", 51003:A:1). Read by cancelBarred (rules/families/encounter/cancel.ts).
  "revealUncancelable",
  // On an enemy a constant ModifyStat of its attachment names (51017:A:1, "When attached enemy is dealt enough damage to destroy it, cancel the damage and discard Smoking Blood instead"): damage that would destroy the card is canceled, and the card that granted the flag is discarded. Read by placeDamage (rules/core/keywords.ts).
  "cancelsLethalDamage",
] as const;

export const manifest = { name: "wizards-quest", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
