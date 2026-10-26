import * as attack from "./attack.ts";
import * as defense from "./defense.ts";
import * as encounter from "./encounter.ts";
import * as quest from "./quest.ts";
import * as play from "./play.ts";
import * as costs from "./costs.ts";
import * as deck from "./deck.ts";
import * as attachments from "./attachments.ts";
import * as sidequests from "./sidequests.ts";
import * as misc from "./misc.ts";
import * as burden from "./burden.ts";

// Each mechanic family's verbs, triggers and flags, in one list each (docs/plans/effect-authoring.md).
export const FAMILY_VERBS = [...attack.VERBS, ...defense.VERBS, ...encounter.VERBS, ...quest.VERBS, ...play.VERBS, ...costs.VERBS, ...deck.VERBS, ...attachments.VERBS, ...sidequests.VERBS, ...misc.VERBS, ...burden.VERBS] as const;
export const FAMILY_TRIGGERS = [...attack.TRIGGERS, ...defense.TRIGGERS, ...encounter.TRIGGERS, ...quest.TRIGGERS, ...play.TRIGGERS, ...costs.TRIGGERS, ...deck.TRIGGERS, ...attachments.TRIGGERS, ...sidequests.TRIGGERS, ...misc.TRIGGERS, ...burden.TRIGGERS] as const;
export const FAMILY_FLAGS = [...attack.FLAGS, ...defense.FLAGS, ...encounter.FLAGS, ...quest.FLAGS, ...play.FLAGS, ...costs.FLAGS, ...deck.FLAGS, ...attachments.FLAGS, ...sidequests.FLAGS, ...misc.FLAGS, ...burden.FLAGS] as const;
