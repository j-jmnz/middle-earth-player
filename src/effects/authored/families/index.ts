import type { Effect } from "../../../catalog/boundary.ts";

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
import * as sea from "./sea.ts";

// Records written by mechanic family rather than by pack (docs/agents/effect-authoring.md).
const FAMILIES = [attack, defense, encounter, quest, play, costs, deck, attachments, sidequests, misc, sea];

export const FAMILY_AUTHORED_EFFECTS: readonly Effect[] = FAMILIES.flatMap((family) => family.RECORDS);
export const FAMILY_AUTHORED_REPLACES: readonly string[] = FAMILIES.flatMap((family) => family.REPLACES);
