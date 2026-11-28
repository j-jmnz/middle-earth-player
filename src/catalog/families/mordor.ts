// The vocabulary The Vengeance of Mordor cycle (A Shadow in the East, The River Running and the scenarios after it) adds to effect records: verbs, triggers and stat flags. effect-schema-verbs.ts, effect-schema.ts and
// effect-schema-stats.ts compose them. src/rules/families/mordor runs the verbs below and answers the one hook the shared engine calls (a holder class of a lasting effect, damage barred to a seat's engaged enemies and a threat raise noted).
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { verbFlags } from "../verb-flags.ts";
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
  // A constant marker on an objective: "When Evidence of the Cult is free of encounters, add it to the victory display. Then, place 1 resource on the main quest" (21036:A:3). The settle sweep adds the card in the staging area to the victory display once nothing guards it and places `amount` resources on the main quest.
  z.strictObject({ verb: z.literal("VictoryWhenFreeAddsResource"), amount: z.number().int().positive() }),
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
] as const;

export const manifest = { name: "mordor", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
