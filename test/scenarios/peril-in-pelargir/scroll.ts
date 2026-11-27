// Test helpers for the Peril in Pelargir tests (src/rules/families/pelargir/index.test.ts, src/campaign/scenarios/peril-in-pelargir/lines.test.ts): Alcaron's Scroll on a hero, and an event announced to the Forced effects.
import type { EngineStep } from "../../../src/rules/core/intents.ts";
import type { GameEvent, ScenarioState } from "../../../src/rules/core/state.ts";
import { spawn } from "../../../src/rules/core/zones.ts";
import { settle } from "../../../src/rules/engine/machine.ts";
import { syncConstants } from "../../../src/rules/interpret/constants.ts";
import { fireForced } from "../../../src/rules/windows/triggers.ts";

import { claimedBy, finish, idOf, tableFromLayout, type Layout, type LayoutTable } from "../../harness/scene-kit.ts";

export const SCENARIO = "peril-in-pelargir";
export const SCROLL = "05019";

// The Scroll on a hero (the first by default), claimed, as the quest card's Setup leaves it (`claimedBy`, as the layout's `claimed` builds it; a layout's `attached` objective is a plain one in play).
export function withScroll(table: LayoutTable, hostCode = "dh1"): LayoutTable {
  const hostId = idOf(table.state, hostCode);
  const spawned = spawn(table.state, SCROLL, { zone: "staging" }, "up");
  return { ...table, state: syncConstants(claimedBy(spawned.state, spawned.id, hostId), table.ctx) };
}

export const scrollTable = (layout: Layout, hostCode = "dh1"): LayoutTable => withScroll(tableFromLayout(SCENARIO, layout), hostCode);

// The engine announces an event to the Forced effects; the choices they open take their first option.
export function announced(table: LayoutTable, event: GameEvent): ScenarioState {
  const steps: EngineStep[] = [];
  return finish({ state: settle(fireForced({ ...table.state, window: null }, event, table.ctx, steps), table.ctx, steps), steps }, table.ctx).state;
}
