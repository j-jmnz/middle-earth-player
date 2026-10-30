// The vocabulary the Nightmare decks (phase 36, docs/plans/nightmare-mode.md) add to effect records: verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them. src/rules/families/nightmare.ts runs them.
import { z } from "zod";

import { when } from "../effect-schema-conditions.ts";

export const VERBS = [
  // The source (a treachery being revealed) attaches to the current quest card ("When Revealed: Attach to the current quest", 906107:A:2).
  // It leaves play with that stage, which discards it (rr.attachment-cards). With no quest card in play it stays where it is and goes to the
  // encounter discard pile as a revealed treachery does.
  z.strictObject({ verb: z.literal("AttachToQuest"), ...when }),
  // The card with this code's printed title is searched for in the encounter deck, then its discard pile, then the victory display, and the
  // first copy found is added to the staging area ("searches the encounter deck, discard pile, and victory display for Khamûl the Easterling and
  // adds it to the staging area", 906101:A:2; rr.search). It is not revealed. Nothing happens when no copy is in those places. The deck is
  // shuffled by a ShuffleEncounterDeck after it (the line says so).
  z.strictObject({ verb: z.literal("SearchToStaging"), code: z.string().min(1), ...when }),
  // The source enemy attacks the actor now, as an attack outside the combat phase: from the staging area though it is not engaged, or while
  // it is engaged with the actor ("Southern Spy makes an immediate attack against you", 906203:A:1). It is dealt a shadow card of its own.
  // Nothing happens when it is engaged with another player or out of play.
  z.strictObject({ verb: z.literal("AttackActor"), ...when }),
  // A shadow effect: once the attack in progress ends, the source (the shadow card) is attached faceup to the defending character if this
  // attack dealt it damage ("If the defending character is damaged by this attack, attach Blade Tip to that character", 906209:A:2). An
  // undefended attack has no defending character. `card`, `to` and `dealt` are engine use: the instruction the shadow effect leaves for the
  // end of the attack names the shadow card and the defender, and asks the attack to keep the damage it dealt.
  z.strictObject({ verb: z.literal("AttachToDamagedDefender"), card: z.string().min(1).optional(), to: z.string().min(1).optional(), dealt: z.literal(true).optional(), ...when }),
  // A marker on a When Revealed record, which does nothing when it runs: a Response on a card with this trait cannot cancel the card's effects
  // ("This effect cannot be canceled by the Ring-bearer's effect", 906208:A:1; rr.cancel). Read by the response window (rules/responses.ts).
  z.strictObject({ verb: z.literal("NotCanceledBy"), trait: z.string().min(1), ...when }),
] as const;

export const TRIGGERS = [
  // A quest card became the current stage ("When stage 3A is revealed", 906101:A:2). The event names the stage as its subject, so a record with
  // no `subject` hears it from any card in play (the Nightmare setup card, zone `nightmare`); a `matches` condition on `subject` says which stage.
  "stageRevealed",
  // The "when revealed" effects of an encounter card were canceled (a cancel Response to a card just revealed, or to its When Revealed effect;
  // rr.cancel). About no card: every card in play hears it ("After a 'when revealed' effect is canceled", 906304:A:1, 906406:A:1).
  "whenRevealedCanceled",
] as const;

export const FLAGS = [
  // On "table": no player may commit more than this many characters to a Hide test ("players cannot commit more than 2 characters to a Hide
  // test", 906106:A:1). The smallest amount held applies. Read by hideCommitReason (rules/hide.ts) through families/nightmare.ts.
  "hideCommitLimit",
  // On a card: it is immune to player card effects while the flag holds ("While Bill Ferny is in the staging area, he gains: Immune to player
  // card effects", 906201:A:2; mec109.immune-to-player-card-effects). Read with the printed keyword (rules/keywords.ts playerCardEffectCanChoose).
  "immuneToPlayerCards",
] as const;
