// The vocabulary the Wizardry timing of The Road to Isengard adds to effect records (mec112.wizardry): the marker a Wizardry line's record carries, the verb that triggers one, the trigger the enemies that
// hear a Wizardry shadow card use, and what the last stage needs to take back the progress an explored Orthanc cancels. The condition `hasWizardry` is in effect-schema-conditions.ts; src/rules/families/wizardry runs
// and reads them. A Wizardry line's printed timing stays what the data says (a constant line); its record is a `forced` effect whose trigger is `wizardry`.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // Triggers a Wizardry effect (mec112.wizardry): the one on the active location, without exploring it ("Trigger the Wizardry effect on the active location", 143062:A:1), or the one on the shadow card the answered
  // event names ("resolves that Wizardry effect", 143047:A:2). `asOnlyPlayer`: the acting player resolves it as if they are the only player in the game, so each "each player" reads them alone and the number of
  // players is 1 (143047:A:2). It does nothing for a card with no Wizardry line.
  z.strictObject({ verb: z.literal("TriggerWizardry"), target: z.enum(["activeLocation", "shadowCard"]), asOnlyPlayer: z.literal(true).optional(), ...when }),
  // Takes off the current quest card the progress placed on it since the phase began, the overflow of an explored active location included, and forgets it ("cancel any progress placed on the quest this phase", 143080:B:2).
  z.strictObject({ verb: z.literal("CancelPhaseProgress"), ...when }),
] as const;

const TRIGGERS = [
  // A Wizardry line's record: the location's own record answers it when the location is explored, in the staging area as well as the active location (mec112.wizardry), and TriggerWizardry reads it from there.
  "wizardry",
  // About an enemy: a shadow card with a Wizardry line was flipped in its attack (the event's other card is the shadow card, its seat the defending player; mec112.wizardry, 143047:A:2, 143052:A:1).
  "shadowWizardry",
] as const;

const FLAGS = [
  // On the table: the progress placed on the current quest card is noted until the end of the phase, for CancelPhaseProgress (143080:B:2). Only a game that holds it keeps the note.
  "trackQuestProgress",
  // On the table: the progress placed on the current quest card is noted while the quest phase lasts, to the end of the round, for the condition `questProgressNoted` alone (900501:A:4): the overflow of an explored location does not wait, and a Forced effect at the end of the quest phase still reads it.
  "noteQuestProgress",
  // The note itself, a modifier on the table that the end of the phase clears (the engine writes it; no record names it).
  "questProgressPhase",
] as const;

export const manifest = { name: "wizardry", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
