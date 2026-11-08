import { collect } from "../family-manifest.ts";
import { manifest as attack } from "./attack.ts";
import { manifest as defense } from "./defense.ts";
import { manifest as encounter } from "./encounter.ts";
import { manifest as quest } from "./quest.ts";
import { manifest as play } from "./play.ts";
import { manifest as costs } from "./costs.ts";
import { manifest as deck } from "./deck.ts";
import { manifest as attachments } from "./attachments.ts";
import { manifest as sidequests } from "./sidequests.ts";
import { manifest as misc } from "./misc.ts";
import { manifest as burden } from "./burden.ts";
import { manifest as south } from "./south.ts";
import { manifest as campaign } from "./campaign.ts";
import { manifest as objectives } from "./objectives.ts";
import { manifest as prisoner } from "./prisoner.ts";
import { manifest as dungeon } from "./dungeon.ts";
import { manifest as caves } from "./caves.ts";
import { manifest as nightmare } from "./nightmare.ts";
import { manifest as moria } from "./moria.ts";
import { manifest as breaking } from "./breaking.ts";
import { manifest as dreamchaser } from "./dreamchaser.ts";
import { manifest as sea } from "./sea.ts";
import { manifest as uncharted } from "./uncharted.ts";
import { manifest as aflame } from "./aflame.ts";
import { manifest as stormcaller } from "./stormcaller.ts";
import { manifest as grapple } from "./grapple.ts";
import { manifest as island } from "./island.ts";
import { manifest as wilderland } from "./wilderland.ts";
import { manifest as pursuit } from "./pursuit.ts";
import { manifest as captives } from "./captives.ts";

// The mechanic families, in the order their verbs, triggers and flags join the shared enums (docs/architecture.md, Mechanic families). A new family is
// one file here and one in src/rules/families, and one line in this list and one in the rules list.
export const CATALOG_FAMILIES = [
  attack, defense, encounter, quest, play, costs, deck, attachments, sidequests, misc, burden, south, campaign, objectives, prisoner, dungeon, caves, nightmare, moria, breaking, dreamchaser, sea, uncharted, aflame, stormcaller, grapple, island, wilderland, pursuit, captives,
] as const;

export const FAMILY_VERBS = collect(CATALOG_FAMILIES, "verbs");
export const FAMILY_TRIGGERS = collect(CATALOG_FAMILIES, "triggers");
export const FAMILY_FLAGS = collect(CATALOG_FAMILIES, "flags");
