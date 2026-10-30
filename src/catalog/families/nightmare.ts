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
] as const;

export const TRIGGERS = [
  // A quest card became the current stage ("When stage 3A is revealed", 906101:A:2). The event names the stage as its subject, so a record with
  // no `subject` hears it from any card in play (the Nightmare setup card, zone `nightmare`); a `matches` condition on `subject` says which stage.
  "stageRevealed",
] as const;

export const FLAGS = [
  // On "table": no player may commit more than this many characters to a Hide test ("players cannot commit more than 2 characters to a Hide
  // test", 906106:A:1). The smallest amount held applies. Read by hideCommitReason (rules/hide.ts) through families/nightmare.ts.
  "hideCommitLimit",
] as const;
