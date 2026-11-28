// The vocabulary The Vengeance of Mordor cycle (A Shadow in the East, The River Running and the scenarios after it) adds to effect records: verbs, triggers and stat flags. effect-schema-verbs.ts, effect-schema.ts and
// effect-schema-stats.ts compose them. src/rules/families/mordor runs the verbs below and answers the one hook the shared engine calls (a holder class of a lasting effect, damage barred to a seat's engaged enemies and a threat raise noted, the enemies that engage by a constant line).
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { verbFlags } from "../verb-flags.ts";
import { pickSchema } from "../effect-schema-pick.ts";
import { cardRefSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // "Attach the top Easterling treachery in the discard pile to it" (21021:A:1, 21021:A:2, 21024:A:2), "Attach that treachery to Easterling Captain" (21017:A:1): a treachery of the encounter discard pile lies attached to the enemy `to` (the source, the answered event's
  // subject, the attacking enemy ...) without its When Revealed or Surge resolving (rr.attachment-cards). `from: discardTop`: the topmost treachery of the pile with `trait` (the last one put there); `from: picked`: the card the running effect picked last
  // (a DiscardUntil that discarded it), only while it lies in the pile. Nothing attaches with no such card, or to a host that cannot have it.
  z.strictObject({ verb: z.literal("AttachTreachery"), from: z.enum(["discardTop", "picked"]), trait: z.string().min(1).optional(), to: cardRefSchema, ...when }),
  // "Each exhausted character gets -1 Willpower until the end of the phase" (21027:A:2), "Each copy of Rolling Plains gets +2 Threat until the end of the phase" (21025:A:1): a lasting effect on a class of cards, read live (faq.lasting-effects), so a card that joins the class later in the
  // phase is held too and one that leaves it is not. `holders: exhaustedCharacters`: every character in play that is exhausted now; `holders: sourceTitle`: every card in play (staging area, engaged or the active location) with the title of the source.
  z.strictObject({ verb: z.literal("ModifyHeld"), stat: z.enum(["willpower", "threat"]), amount: z.number().int(), holders: z.enum(["exhaustedCharacters", "sourceTitle"]), until: z.literal("endOfPhase"), ...when }),
  // "Add 1 random set aside Plot objective to the staging area" (21078:A:1), "Add 1 random set-aside Cultist enemy to the staging area" (21079:A:1): one set-aside card with the Trait, drawn by the game seed, is added to the staging area (entering play, not revealed). The player who resolves the card
  // draws without looking (docs/scenarios/vengeance-of-mordor/danger-in-dorwinion.md, Readings); with none set aside with the Trait nothing is added.
  z.strictObject({ verb: z.literal("AddRandomSetAsideToStaging"), trait: z.string().min(1), ...when }),
  // Secret Cultist (21039:A:1), the source attached to an ally: the ally loses the ally card type and gains the enemy card type, its text box blank, and engages its owner. The ally keeps its card with the code `<code>~enemy` (rules/core/printed.ts, the code of a fallen hero), engaged with its owner.
  z.strictObject({ verb: z.literal("ConvertAttachedAlly"), ...when }),
  // "If Secret Cultist is discarded, or the attached ally's owner is eliminated, discard attached ally" (21039:A:1): every converted ally still an enemy, or defeated as one, is its owner's card again in the owner's discard pile. `ifOwnerGone`: only when the owner of the ally the source is attached to is
  // eliminated, and then the source is discarded too.
  z.strictObject({ verb: z.literal("ReturnConvertedAlly"), ifOwnerGone: z.literal(true).optional(), ...when }),
  // "Resolve the Travel effect on the active location" (21051:A:1, 21051:A:2): the Travel line of the active location runs as an effect, its cost unpaid and the location not moved (rr.travel, rr.cost). With no active location, or no Travel line on it, nothing happens.
  verbFlags(z.strictObject({ verb: z.literal("ResolveActiveTravel"), ...when }), { runsInFrame: true }),
  // "Do not discard shadow cards dealt to Black Númenórean if they have a shadow effect" (21032:A:2): the shadow card the source enemy was just dealt (the card of the answered `shadowDealtTo` event) is kept faceup after its attack, past the end of the combat phase, when it has a shadow effect; it comes before the
  // cards the enemy held already, so the attack resolves it and the cards held stay as they are.
  z.strictObject({ verb: z.literal("KeepDealtShadow"), ...when }),
  // "When Black Númenórean attacks, resolve each of his faceup shadow cards as if they had been dealt this round" (21032:A:3): the shadow effects of the faceup shadow cards the source holds resolve against the attack in progress, in the order dealt, the defending player resolving them.
  verbFlags(z.strictObject({ verb: z.literal("ResolveHeldShadowEffects"), ...when }), { runsInFrame: true }),
  // "Place 1 resource here for each event discarded this way" (21033:A:2): one resource goes on the source for each card of the type that the effect discarded from the top of the players' decks (DiscardFromDeck), all the decks counted together.
  z.strictObject({ verb: z.literal("PlaceResourcePerDiscarded"), cardType: z.literal("event"), ...when }),
  // "Reveal each facedown card under it" (21047:A:2): each card facedown under the source is revealed as an encounter card, not from the encounter deck (rr.reveal), by the actor.
  verbFlags(z.strictObject({ verb: z.literal("RevealFacedownUnder"), ...when }), { runsInFrame: true }),
  // "Until the end of the round, enemies engaged with the first player cannot take damage" (21042:A:2): a lasting effect of an encounter card read live (faq.lasting-effects): every enemy engaged with the first player now cannot take damage, one that engages him later too.
  z.strictObject({ verb: z.literal("BarDamageToEngaged"), who: z.literal("firstPlayer"), until: z.literal("endOfRound"), ...when }),
  // "Shuffle each of the stage 2 quest cards together and place them facedown under this stage" (21080:A:1): the stages named by `codes` go on top of the quest deck in a random order, as ShuffleStages does, and the quest advances in the order of its quest deck: the stage that names it is `ordered`
  // (src/catalog/stage-order.ts) and each stage that prints Victory is added to the victory display when it is defeated, the last one defeated winning the game (families/quest/order.ts).
  z.strictObject({ verb: z.literal("ShuffleStagesUnder"), codes: z.array(z.string().min(1)).min(2) }),
  // "Reveal the top card of the Power of Mordor deck. If you cannot, the players lose the game" (21053:A:1; vom.power-of-mordor-deck-the-temple-of-doom): the first player reveals the top card of the pile `powerOfMordor` as an encounter card (rr.reveal); it goes to the staging area, or to the encounter discard pile, never
  // back to its deck. `onEmpty: loseGame`: with no card to reveal the players lose the game. `removeDamage`: that many damage tokens come off the card with the code first, then the card is revealed (21053:A:1 "remove 4 of them and reveal").
  verbFlags(z.strictObject({ verb: z.literal("RevealPowerOfMordor"), onEmpty: z.literal("loseGame"), removeDamage: z.strictObject({ code: z.string(), amount: z.number().int().positive() }).optional(), ...when }), { runsInFrame: true }),
  // "Attach to the Easterling enemy with the lowest Defense without a copy of Fanaticism" (21060:A:2): of the cards the pick matches, the one with the lowest Defense as the table shows it becomes the picked card; the first player chooses among those tied (rr.first-player).
  // Nothing is picked when none matches.
  z.strictObject({ verb: z.literal("PickLowestDefense"), pick: pickSchema, ...when }),
  // "Each player places the top 10 cards of his deck facedown under his threat dial (without looking at them)" (21065:A:1): the top `count` cards of the actor's deck lie facedown under the source, still his, in the order of his deck.
  z.strictObject({ verb: z.literal("PutUnderDial"), count: z.number().int().positive(), ...when }),
  // "he discards the top card from under his threat dial" (21065:A:2): the top card the source holds under the actor's threat dial goes to his discard pile; with none under it nothing happens. The cards go back into their owners' decks, shuffled, when the source is defeated (the settle sweep, src/rules/families/mordor/dial.ts).
  z.strictObject({ verb: z.literal("DiscardUnderDial"), ...when }),
  // "he must discard those copies as well" (21084:B:1): after a DiscardFromDeck, the actor discards each card in his hand and each card he controls in play that has the title of a card that discard took from his deck.
  z.strictObject({ verb: z.literal("DiscardCopiesOfLooked"), ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [
  // On a table: a seat's raised threat is noted until the end of the round (the Setup of Danger in Dorwinion sets it), for the condition `raisedThreatThisRound` (21048:A:2).
  "noteThreatRaised",
  // On a seat (engine use): its threat was raised this round.
  "raisedThreat",
  // On a shadow card (engine use): kept faceup on its enemy (KeepDealtShadow).
  "keptShadow",
  // Engine use, held by `mordor:noDamage:<seat>`: the enemies engaged with the seat cannot take damage (BarDamageToEngaged).
  "noDamageToEngaged",
  // On an enemy (21066:A:2): it engages the first player at once, whatever its engagement cost, and stays engaged with him (the settle sweep, src/rules/families/mordor/engage.ts).
  "engagesFirstPlayer",
  // On an enemy (21058:A:1): it engages the player Thane Ulchor is engaged with at once, and stays engaged when he leaves.
  "engagesWithUlchor",
  // On an enemy (21066:A:3): only the player it is engaged with can declare defenders against it; the flag `attackOnlyByEngaged` bars the other attackers.
  "defendOnlyByEngaged",
  // On a quest stage (21085:B:2): no more than this much progress can be placed on this stage this round, whoever places it; 0 holds it shut. `stageProgressPlaced` is the count of the round (engine use, src/rules/families/mordor/stage-cap.ts).
  "stageProgressCap",
  "stageProgressPlaced",
] as const;

export const manifest = { name: "mordor", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
