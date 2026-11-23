// Rules: docs/scenarios/standalone-scenarios/the-stone-of-erech.md (The Stone of Erech, Night objectives); ledger lines 50301:A:1, 50308:A:1, 50308:A:2, 50309:A:1, 50309:A:2, 50310:A:1, 50317:A:2, 50327:A:2. The Night objectives: Eventide, Dusk and Midnight lie one at a time in the Night slot beside the current quest (the zone
// nightObjective), in play and never claimable. A "Dusk." line is live only while Dusk is the one in play, a "Midnight." line only while Midnight is (Midnight's values replace Dusk's: "instead"). The Night objective takes progress from its own Forced effect and from
// encounter cards, and a passive check (NightAdvance, a marker in its constant record) gives way to the next once its progress is at the limit: the card goes to the victory display with its progress and the next comes into play from the set aside cards with none.
import type { Condition } from "../../../catalog/boundary.ts";

import { constantInstructions } from "../../interpret/constant-records.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { placeProgress } from "../../interpret/effect-verbs.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";

type Night = Extract<Condition, { kind: "night" }>["is"];

/** The Night objective in play beside the current quest, or undefined with none. */
export function nightCard(state: ScenarioState): CardInstance | undefined {
  return Object.values(state.cards).find((card) => card.zone === "nightObjective");
}

// The printed code of each Night objective.
const CODES: Readonly<Record<"dusk" | "midnight", string>> = { dusk: "50309", midnight: "50310" };

/** Whether the Night objective in play is the one the condition names (`duskOrMidnight`: either). False with none in play. */
export function nightHolds(state: ScenarioState, is: Night): boolean {
  const night = nightCard(state);
  if (!night) return false;
  return is === "duskOrMidnight" ? night.code === CODES.dusk || night.code === CODES.midnight : night.code === CODES[is];
}

/** PutNightObjective: the set-aside card with this code comes into play in the Night slot, faceup, with no progress. Nothing when none is set aside, or another Night objective is in play. */
export function putNight(state: ScenarioState, code: string): ScenarioState {
  const id = state.setAside.find((other) => state.cards[other]?.code === code);
  if (!id || nightCard(state)) return state;
  return updateCard(moveCard(state, id, { zone: "nightObjective" }), id, { face: "up", progress: 0, exhausted: false });
}

/** PlaceNightProgress: progress on the Night objective in play, the way progress goes on a card with no quest points (it is never explored). */
export function placeNightProgress(state: ScenarioState, amount: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const night = nightCard(state);
  return night && amount > 0 ? placeProgress(state, night.id, amount, ctx, steps) : state;
}

/** The passive check of a Night objective (settle sweep): at its limit it goes to the victory display with its progress and the next comes into play. */
export function advanceNight(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const night = nightCard(state);
  if (!night || night.progress <= 0) return state;
  for (const { source, instruction } of constantInstructions(state, ctx)) {
    if (source.id !== night.id || instruction.verb !== "NightAdvance" || night.progress < instruction.at) continue;
    return putNight(moveCard(state, night.id, { zone: "victory" }), instruction.next);
  }
  return state;
}
