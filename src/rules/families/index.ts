import type { Instruction } from "../../catalog/boundary.ts";
import type { EngineStep } from "../core/intents.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import type { Focus, RulesFamily } from "../interpret/family-manifest.ts";
import type { ScenarioState } from "../core/state.ts";

import { manifest as attack } from "./attack/index.ts";
import { manifest as defense } from "./defense/index.ts";
import { manifest as encounter } from "./encounter/index.ts";
import { manifest as quest } from "./quest/index.ts";
import { manifest as play } from "./play/index.ts";
import { manifest as costs } from "./costs/index.ts";
import { manifest as deck } from "./deck/index.ts";
import { manifest as attachments } from "./attachments/index.ts";
import { manifest as sidequests } from "./sidequests/index.ts";
import { manifest as misc } from "./misc/index.ts";
import { manifest as burden } from "./burden/index.ts";
import { manifest as south } from "./south/index.ts";
import { manifest as campaign } from "./campaign/index.ts";
import { manifest as objectives } from "./objectives/index.ts";
import { manifest as prisoner } from "./prisoner/index.ts";
import { manifest as dungeon } from "./dungeon/index.ts";
import { manifest as caves } from "./caves/index.ts";
import { manifest as nightmare } from "./nightmare/index.ts";
import { manifest as moria } from "./moria/index.ts";
import { manifest as breaking } from "./breaking/index.ts";
import { manifest as dreamchaser } from "./dreamchaser/index.ts";
import { manifest as sea } from "./sea/index.ts";
import { manifest as uncharted } from "./uncharted/index.ts";
import { manifest as aflame } from "./aflame/index.ts";
import { manifest as stormcaller } from "./stormcaller/index.ts";
import { manifest as grapple } from "./grapple/index.ts";
import { manifest as island } from "./island/index.ts";
import { manifest as wilderland } from "./wilderland/index.ts";
import { registerFamilies } from "../interpret/family-hooks.ts";

export type { Focus };

// The mechanic families' rules, in play order: where two runners could answer one verb, the first in this list does (docs/architecture.md, Mechanic families).
// The order is the catalog list's (src/catalog/families/index.ts).
export const RULES_FAMILIES: readonly RulesFamily[] = [
  attack, defense, encounter, quest, play, costs, deck, attachments, sidequests, misc, burden, south, campaign, objectives, prisoner, dungeon, caves, nightmare, moria, breaking, dreamchaser, sea, uncharted, aflame, stormcaller, grapple, island, wilderland,
];

// The order the families' settle hooks run in within a phase (src/rules/engine/machine.ts, settle), in this order.
// Every family with a hook for the phase is listed (settleHooks throws on one that is not). The order is the one the core's chain had when it called the families by name, and it is not the list's.
// `before`: after the constant win check, before the core refills the encounter deck. `after`: right after that refill. `sweep`: after the core's own sweeps.
export const SETTLE_ORDER: Readonly<Record<"before" | "after" | "sweep", readonly string[]>> = {
  before: ["burden", "island", "south"],
  after: ["sea", "stormcaller", "island", "wilderland"],
  sweep: ["aflame", "objectives", "sea"],
};

/** Runs a verb a mechanic family adds (src/catalog/families), or returns null when no family owns it. */
export function runFamilyVerb(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  for (const family of RULES_FAMILIES) {
    const next = family.run(state, instruction, focus, ctx, steps);
    if (next) return next;
  }
  return null;
}

// The core's hook calls (interpret/family-hooks.ts) walk these lists.
registerFamilies(RULES_FAMILIES, SETTLE_ORDER);
