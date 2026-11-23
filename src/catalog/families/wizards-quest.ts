// The Wizard's Quest family (docs/scenarios/standalone-scenarios/the-wizards-quest.md, The Wizard's Quest): the scenario kit's Quick-build (7 of the 14 encounter sets, one stage 2 and one stage 3 chosen) and the searches of the quest stages' "opposing team" lines.
// The opposing team's choices are made by the engine in the manner that gives the players the greatest challenge (reading 3): the search fields `byChallenge`, `maxCost`, `maxCostMulti`, `types` and `top` of the search verbs (src/catalog/effect-schema-verbs.ts)
// and the pick field `challenge` (src/catalog/effect-schema-pick.ts) are its policy. src/rules/families/wizards-quest/ runs the verbs.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const code = z.string().min(1);

const VERBS = [
  // Setup, the Quick-build rule of the kit (docs/scenarios/standalone-scenarios/the-wizards-quest.md, The Wizard's Quest, reading 2): of the encounter sets named by `sets` that the encounter deck holds, the game's seed picks `keep`; the cards of the others leave the encounter deck and lie set aside, out of play, for the whole game.
  verbFlags(z.strictObject({ verb: z.literal("BuildQuickDeck"), sets: z.array(z.string().min(1)).min(2), keep: z.number().int().positive(), ...when }), { setupRuns: "top" }),
  // Setup, the Quick-build rule (reading 2): the first player chooses one of the quest cards in the quest deck with these `codes` (a stage 2 or a stage 3); the others lie set aside, out of play, and leave the quest's order. Nothing is asked when one is left.
  verbFlags(z.strictObject({ verb: z.literal("ChooseQuestStage"), codes: z.array(code).min(2), ...when }), { setupRuns: "top" }),
  // The When Revealed of the stage 2 and stage 3 cards (51003:A:1 to 51009:A:1): "The opposing team searches the top `top` cards of the encounter deck for a card with cost `maxCost` or less (`maxCostMulti` or less if there are two or more players), sets it aside, and shuffles the encounter deck. Reveal the set aside card.
  // Its 'when revealed' effects cannot be canceled." The card nearest the top that qualifies is the one (reading 3: no measure ranks the types); it is set aside, the deck is shuffled, and it is revealed as an encounter card, its When Revealed effects uncancelable. With none, only the shuffle (reading 5).
  // `maxCostStage` (51138:A:1, "a card with cost equal to or less than the stage number of the main quest"): the limit is the stage number of the current quest card, for any number of players, and takes the place of `maxCost` and `maxCostMulti`.
  // `cancelable` (51138:A:1 prints no bar): the revealed card's When Revealed effects can be canceled.
  z.strictObject({ verb: z.literal("SearchTopReveal"), top: z.number().int().positive(), maxCost: z.number().int().min(0).optional(), maxCostMulti: z.number().int().min(0).optional(), maxCostStage: z.literal(true).optional(), cancelable: z.literal(true).optional(), ...when }).refine(
    (verb) => (verb.maxCostStage === true ? verb.maxCost == null && verb.maxCostMulti == null : verb.maxCost != null && verb.maxCostMulti != null),
    "SearchTopReveal takes maxCost with maxCostMulti, or maxCostStage alone",
  ),
  // "places them faceup under this stage as guarded objectives" (51004:B:1) and "place faceup under Necromancer's Pass as a guarded objective" (51013:A:1): the last picked card, an ally in play or a card of a hand, lies faceup under the source card, still its owner's, out of play (docs/scenarios/standalone-scenarios/the-wizards-quest.md, The Wizard's Quest, readings 9 and 3).
  // An ally in play loses its tokens and its attachments are discarded as it leaves play. The source gives them back (ReturnFacedownToHands) and, while they lie there, no copy of their title can be played (src/rules/families/wizards-quest/held.ts).
  // With `returnsExhausted` (Goblin Dungeon: "When Goblin Dungeon is explored, return that ally to its owner's control exhausted", 51340:A:1; docs/scenarios/standalone-scenarios/escape-from-khazad-dum.md, Escape from Khazad-dûm, reading 28): once the source has left play the card enters play exhausted under its owner, not into his hand.
  // With `barsPutting` (Narrow Paths: "Players cannot play or put into play any attachment that shares a title with an attachment guarded by this stage", 51205:B:1): the title cannot be put into play by an effect either, and the held card is an attachment taken out of play from its host.
  z.strictObject({ verb: z.literal("HoldPickedUnder"), barsPutting: z.literal(true).optional(), returnsExhausted: z.literal(true).optional(), ...when }),
  // "The opposing team searches the top 5 cards of the encounter deck for a card with cost X or less, where X is the stage number of the main quest, and places that card facedown under the main quest. After the next time the players quest successfully, reveal that card." (51241:A:1; docs/scenarios/standalone-scenarios/the-mines-of-moria.md, The Mines of Moria, reading 11):
  // the card nearest the top that qualifies lies facedown under the main quest, the encounter deck is shuffled (reading 14), and the card is revealed in full after the next successful quest, each hidden card in the order placed (src/rules/families/wizards-quest/hidden.ts). With none, only the shuffle.
  z.strictObject({ verb: z.literal("HideUnderQuest"), top: z.number().int().positive(), maxCostStage: z.literal(true), ...when }),
  // "The opposing team looks at the top 2 cards of the encounter deck, puts 1 on the bottom, and puts the other back on top." (51203:B:1; reading 9): the weaker of the top two cards goes to the bottom and the stronger stays on top, no one is asked.
  // An enemy is stronger than a treachery and a treachery than a location; of two enemies or two locations the one with the higher Threat (an enemy: then the higher Attack) is; level, the top card stays on top. A deck of one card changes nothing.
  z.strictObject({ verb: z.literal("ArrangeTopByChallenge"), ...when }),
  // A constant marker of the card that holds player cards under it (51004:B:2, 51013:A:1): "copies of that card cannot be played" while it lies there. The bar is the engine's (a card held by HoldPickedUnder bars its title, families/wizards-quest/held.ts), so run alone it does nothing.
  z.strictObject({ verb: z.literal("BarHeldTitles") }),
  // Shadow effect, "Remove the defending character from the attack. A different defending character may be declared." (51335:A:2): the defender leaves the attack (it stays exhausted) and the defending player names another defender or none (an undefended attack), when no shadow effect already made it undefended.
  // The removed character cannot be declared as the defender of this attack again (docs/scenarios/standalone-scenarios/escape-from-khazad-dum.md, Escape from Khazad-dûm, reading 21). Nothing happens when the attack has no defender.
  z.strictObject({ verb: z.literal("RemoveDefender"), ...when }),
  // Shadow effect, "The opposing team searches the top 5 cards of the encounter deck for a card and deals it to attacking enemy as a shadow card" (51342:A:2): the card among the top `top` that the opposing team picks (an enemy of the highest Attack, else the card nearest the top, reading 27) is dealt to the attacking enemy as a shadow card (not revealed);
  // it resolves after the shadow card being resolved, as an additional one. The encounter deck is not shuffled. With no card in the deck nothing happens.
  z.strictObject({ verb: z.literal("SearchTopShadow"), top: z.number().int().positive(), ...when }),
  // A constant marker on the attachment of the main quest that says "Forced: When a 'when revealed' effect would be canceled, discard ~ instead" (51320:A:2): the cancel of a When Revealed effect does not happen, the card is discarded in its place
  // (src/rules/families/wizards-quest/bones.ts; reading 20). It does nothing when run.
  z.strictObject({ verb: z.literal("ReplacesRevealCancel") }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [
  // On an encounter card revealed by SearchTopReveal: its When Revealed effects cannot be canceled ("Its 'when revealed' effects cannot be canceled", 51003:A:1). Read by cancelBarred (rules/families/encounter/cancel.ts).
  "revealUncancelable",
  // On an enemy a constant ModifyStat of its attachment names (51017:A:1, "When attached enemy is dealt enough damage to destroy it, cancel the damage and discard Smoking Blood instead"): damage that would destroy the card is canceled, and the card that granted the flag is discarded. Read by placeDamage (rules/core/keywords.ts).
  "cancelsLethalDamage",
  // On the table, while a card in play says so ("Shadow effects cannot be canceled", 51348:A:2): no Response is offered to cancel a shadow effect, whoever's enemy it is on. Read by cancelBarred (rules/families/encounter/cancel.ts).
  "allShadowsUncancelable",
  // On an enemy: "While Black Uruks is attacking, it gets +1 Attack for each shadow card dealt for this attack" (51342:A:1): the amount times the shadow cards the enemy holds, read while the stat is read and only while the enemy is the one attacking (khazad.ts, perShadow).
  "attackPerShadow",
] as const;

// The cards Hidden Threat hid facedown under the quest (51241:A:1) are set aside once the players quest successfully and revealed one at a time: the ones that wait their turn are still facedown.
const ASIDE_SECRETS = [{ verb: "HideUnderQuest", deck: true }] as const;

// The Quick-build keeps 7 of the kit's encounter sets (51001:A:1): the cards of the others are no part of the game, and the engine parks them in the set-aside zone. `sets` names all 14;
// the ones left out are those with every card still set aside.
const ASIDE_UNUSED = [{ verb: "BuildQuickDeck", sets: ["sets"] }] as const;

export const manifest = { name: "wizards-quest", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS, asideSecrets: ASIDE_SECRETS, asideUnused: ASIDE_UNUSED } as const satisfies CatalogFamily;
