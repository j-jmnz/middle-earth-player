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
import * as south from "./south.ts";
import * as campaign from "./campaign.ts";
import * as objectives from "./objectives.ts";
import * as prisoner from "./prisoner.ts";
import * as dungeon from "./dungeon.ts";
import * as caves from "./caves.ts";
import * as nightmare from "./nightmare.ts";
import * as moria from "./moria.ts";
import * as breaking from "./breaking.ts";

// Each mechanic family's verbs, triggers and flags, in one list each (docs/plans/effect-authoring.md).
export const FAMILY_VERBS = [...attack.VERBS, ...defense.VERBS, ...encounter.VERBS, ...quest.VERBS, ...play.VERBS, ...costs.VERBS, ...deck.VERBS, ...attachments.VERBS, ...sidequests.VERBS, ...misc.VERBS, ...burden.VERBS, ...south.VERBS, ...campaign.VERBS, ...objectives.VERBS, ...prisoner.VERBS, ...dungeon.VERBS, ...caves.VERBS, ...nightmare.VERBS, ...moria.VERBS, ...breaking.VERBS] as const;
export const FAMILY_TRIGGERS = [...attack.TRIGGERS, ...defense.TRIGGERS, ...encounter.TRIGGERS, ...quest.TRIGGERS, ...play.TRIGGERS, ...costs.TRIGGERS, ...deck.TRIGGERS, ...attachments.TRIGGERS, ...sidequests.TRIGGERS, ...misc.TRIGGERS, ...burden.TRIGGERS, ...south.TRIGGERS, ...campaign.TRIGGERS, ...objectives.TRIGGERS, ...prisoner.TRIGGERS, ...dungeon.TRIGGERS, ...caves.TRIGGERS, ...nightmare.TRIGGERS, ...moria.TRIGGERS, ...breaking.TRIGGERS] as const;
export const FAMILY_FLAGS = [...attack.FLAGS, ...defense.FLAGS, ...encounter.FLAGS, ...quest.FLAGS, ...play.FLAGS, ...costs.FLAGS, ...deck.FLAGS, ...attachments.FLAGS, ...sidequests.FLAGS, ...misc.FLAGS, ...burden.FLAGS, ...south.FLAGS, ...campaign.FLAGS, ...objectives.FLAGS, ...prisoner.FLAGS, ...dungeon.FLAGS, ...caves.FLAGS, ...nightmare.FLAGS, ...moria.FLAGS, ...breaking.FLAGS] as const;
