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
import { manifest as pursuit } from "./pursuit/index.ts";
import { manifest as captives } from "./captives/index.ts";
import { manifest as fortress } from "./fortress/index.ts";
import { manifest as wizardry } from "./wizardry/index.ts";
import { manifest as mire } from "./mire/index.ts";
import { manifest as gollum } from "./gollum/index.ts";
import { manifest as harad } from "./harad/index.ts";
import { manifest as greyCompany } from "./grey-company/index.ts";
import { manifest as pelennor } from "./pelennor/index.ts";
import { manifest as cirithUngol } from "./cirith-ungol/index.ts";
import { manifest as blackGate } from "./black-gate/index.ts";
import { manifest as mountDoom } from "./mount-doom/index.ts";
import { manifest as angmar } from "./angmar/index.ts";
import { manifest as captured } from "./captured/index.ts";
import { manifest as escape } from "./escape/index.ts";
import { manifest as guardian } from "./guardian/index.ts";
import { manifest as smaug } from "./smaug/index.ts";
import { manifest as erech } from "./erech/index.ts";
import { registerFamilies } from "../interpret/family-hooks.ts";

export type { Focus };

// The mechanic families' rules, in play order: where two runners could answer one verb, the first in this list does (docs/architecture.md, Mechanic families).
// The order is the catalog list's (src/catalog/families/index.ts).
let listed: readonly RulesFamily[] | null = null;
// Built on first use, not when this module runs: a family reached first (a test that imports one) pulls in the core, which pulls in this file while that family is still loading, and a list built here would hold its manifest as undefined.
export function rulesFamilies(): readonly RulesFamily[] {
  return (listed ??= [
    attack, defense, encounter, quest, play, costs, deck, attachments, sidequests, misc, burden, south, campaign, objectives, prisoner, dungeon, caves, nightmare, moria, breaking, dreamchaser, sea, uncharted, aflame, stormcaller, grapple, island, wilderland, pursuit, captives, fortress, wizardry, mire, gollum, harad, greyCompany, pelennor, cirithUngol, blackGate, mountDoom, angmar, captured, escape, guardian, smaug, erech,
  ]);
}

// The order the families' settle hooks run in within a phase (src/rules/engine/machine.ts, settle), in this order.
// Every family with a hook for the phase is listed (settleHooks throws on one that is not). The order is the one the core's chain had when it called the families by name, and it is not the list's.
// `before`: after the constant win check, before the core refills the encounter deck. `after`: right after that refill. `sweep`: after the core's own sweeps.
export const SETTLE_ORDER: Readonly<Record<"before" | "after" | "sweep", readonly string[]>> = {
  before: ["burden", "island", "south", "quest"],
  after: ["sea", "stormcaller", "island", "wilderland", "captives"],
  sweep: ["aflame", "objectives", "sea", "wilderland", "south", "deck", "angmar", "quest", "escape", "erech"],
};

/** Runs a verb a mechanic family adds (src/catalog/families), or returns null when no family owns it. */
export function runFamilyVerb(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  for (const family of rulesFamilies()) {
    const next = family.run(state, instruction, focus, ctx, steps);
    if (next) return next;
  }
  return null;
}

// The core's hook calls (interpret/family-hooks.ts) walk these lists.
registerFamilies(rulesFamilies, SETTLE_ORDER);
