import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../rules/core/test-fixture.ts";
import { legalIntents, reduce, startScenario, type ReduceContext, type ScenarioState } from "../../rules/engine/reduce.ts";
import { starterStart, starterWorld } from "../../../test/scenarios/a-shadow-of-the-past/game.ts";
import { windowSheet } from "./bar-sheets.ts";
import { pausedFor, PHASE_PAUSE_MS } from "./dock/phase-pause.ts";
import type { SheetNames } from "./sheet-types.ts";
import { sheetFor } from "./sheets.ts";
import { dockFor, type Dock } from "./table-choice.ts";

// docs/design-system-table.md, Two taps: a Pass that closes one window stays silver; an answer that reaches past it is gold. Planning's
// pass ends the player's phase, so it is End planning with reach "phase"; Pass to stop runs to the next stop, reach "run".
let ctx: ReduceContext;
const names: SheetNames = { card: (id) => id, line: () => null };
const STOP_PASS = "Tap again: pass until planning";

beforeAll(async () => {
  ctx = (await starterWorld("wisdom-and-wizardry")).ctx;
});

function dockAt(state: ScenarioState): Dock {
  const legal = legalIntents(state, ctx);
  const sheet = sheetFor(state, ctx, legal, names) ?? windowSheet(state, ctx, legal, names);
  return dockFor(sheet, { key: sheet.key, ids: [], shares: [] }, { game: state, ctx, legal, names }, { overlay: false, passLegal: legal.some((intent) => intent.type === "Pass"), surface: "table", stopPass: STOP_PASS });
}

// The opening action window (before planning), then planning itself.
function windowThenPlanning(): { window: ScenarioState; planning: ScenarioState } {
  const window = expectOk(reduce(startScenario(starterStart("wisdom-and-wizardry", 1), ctx), { type: "Keep" }, ctx)).state;
  const planning = expectOk(reduce(window, { type: "Pass" }, ctx)).state;
  return { window, planning };
}

describe("how far a pass reaches", () => {
  it("draws an action window's Pass silver, and its Pass to stop as a gold run", () => {
    const { window } = windowThenPlanning();
    expect(window.mode).not.toBe("planning");
    const dock = dockAt(window);
    expect(dock.primary).toMatchObject({ label: "Pass", testID: "table-pass", arm: true });
    expect(dock.primary?.reach).toBeUndefined();
    expect(dock.secondary.find((button) => button.testID === "table-pass-to-stop")).toMatchObject({ label: "Pass to stop", reach: "run", armed: STOP_PASS });
  });

  it("draws planning's pass as the gold End planning, armed as before", () => {
    const { planning } = windowThenPlanning();
    expect(planning.mode).toBe("planning");
    const dock = dockAt(planning);
    expect(dock.primary).toMatchObject({ label: "End planning", testID: "table-pass", arm: true, armed: "Tap again: planning ends", reach: "phase" });
    expect(dock.primary?.action).toEqual({ kind: "intent", intent: { type: "Pass" } });
  });

  it("ignores a tap on an answer that ends the phase for a moment after it appears, and nothing else", () => {
    expect(pausedFor({ reach: "phase" }, 1000, 1000 + PHASE_PAUSE_MS - 1)).toBe(true);
    expect(pausedFor({ reach: "phase" }, 1000, 1000 + PHASE_PAUSE_MS)).toBe(false);
    expect(pausedFor({ reach: "run" }, 1000, 1001)).toBe(false);
    expect(pausedFor({}, 1000, 1001)).toBe(false);
  });
});
