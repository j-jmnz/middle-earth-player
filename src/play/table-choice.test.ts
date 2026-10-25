import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import { legalIntents, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import { nextIntent } from "../../scripts/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld, STARTER_SEEDS } from "../../scripts/starter-game.ts";

import { windowSheet } from "./bar-sheets.ts";
import { momentOf } from "./outcome.ts";
import { onTableFor, shownSeat } from "./selectors.ts";
import type { Sheet, SheetNames } from "./sheet-types.ts";
import { sheetFor } from "./sheets.ts";
import { choiceFor, dockFor, onTheTable, primaryReady, readoutFor, tap, tappable, type Choice, type Dock, type TapContext } from "./table-choice.ts";

// Rules: rr.action-windows, rr.step-3-4, rr.step-6-4-3 (data/rules/entries.json). The table answers every moment of whole
// starter games: a tap on a card only picks it (or opens the question it leads to), the dock's buttons send intents the
// reducer accepts, every button that would send one with nothing picked must be armed first, and the numbers beside the
// quest are the ones the engine then resolves it with.
let ctx: ReduceContext;
const names: SheetNames = { card: (id) => id, line: () => null };

beforeAll(async () => {
  ctx = (await starterWorld("wisdom-and-wizardry")).ctx;
});

function accepted(state: ScenarioState, intent: PlayerIntent): boolean {
  return reduce(state, intent, ctx).ok;
}

function sheetOf(state: ScenarioState): Sheet {
  const legal = legalIntents(state, ctx);
  return sheetFor(state, ctx, legal, names) ?? windowSheet(state, ctx, legal, names);
}

type Seen = { taps: number; opened: number; sent: number; armed: number };

function buttonsOf(dock: Dock) {
  return [...(dock.primary ? [{ button: dock.primary, ready: primaryReady(dock) }] : []), ...dock.secondary.map((button) => ({ button, ready: true }))];
}

// Each button of the dock that sends an intent: the reducer takes it. `fresh` is true for the sheet the window opened with
// nothing picked yet: there, every button that sends an intent must be armed first.
function checkDock(state: ScenarioState, sheet: Sheet, choice: Choice | null, table: TapContext, overlay: boolean, fresh: boolean, seen: Seen): void {
  const passLegal = table.legal.some((intent) => intent.type === "Pass");
  const dock = dockFor(sheet, choice, table, { overlay, passLegal });
  for (const { button, ready } of buttonsOf(dock)) {
    if (!ready || button.action.kind !== "intent") continue;
    expect(accepted(state, button.action.intent), `${sheet.kind} ${button.label} ${JSON.stringify(button.action.intent)}`).toBe(true);
    seen.sent += 1;
    if (fresh) {
      expect(button.arm, `${sheet.kind} ${button.label} sends an intent with nothing picked`).toBe(true);
      seen.armed += 1;
    }
  }
}

function checkSheet(state: ScenarioState, sheet: Sheet, table: TapContext, overlay: boolean, depth: number, seen: Seen): void {
  checkDock(state, sheet, null, table, overlay, !overlay && sheet.kind !== "distribute", seen);
  for (const cardId of [...tappable(sheet)].slice(0, 4)) {
    const result = tap(sheet, null, cardId, table);
    seen.taps += 1;
    // A tap never changes the game.
    expect(result.kind).not.toBe("intent");
    if (result.kind === "choice") checkDock(state, sheet, result.choice, table, overlay, false, seen);
    if (result.kind === "open" && depth < 2) {
      seen.opened += 1;
      checkSheet(state, result.sheet, table, true, depth + 1, seen);
    }
  }
}

describe("the table answers each moment", () => {
  it("with taps that only pick and buttons the reducer accepts, the ones that send with nothing picked armed, in whole games", () => {
    const seen: Seen = { taps: 0, opened: 0, sent: 0, armed: 0 };
    for (const seed of STARTER_SEEDS) {
      let state = startScenario(starterStart("wisdom-and-wizardry", seed), ctx);
      for (let turn = 0; turn < 600 && !state.lost && !state.stageCleared; turn += 1) {
        const legal = legalIntents(state, ctx);
        const sheet = sheetOf(state);
        const table: TapContext = { game: state, ctx, legal, names };
        checkSheet(state, sheet, table, false, 0, seen);
        // A sheet answered on the table names only cards drawn there.
        const onTable = onTableFor(state, shownSeat(state));
        if (onTheTable(sheet, onTable)) for (const id of tappable(sheet)) expect(onTable(id), `${sheet.kind} ${id}`).toBe(true);
        state = expectOk(reduce(state, nextIntent(state, ctx, { scout: "01002", prefer: "141035", protect: RING_BEARER, play: true, act: true }), ctx)).state;
      }
    }
    expect(seen.taps).toBeGreaterThan(50);
    expect(seen.opened).toBeGreaterThan(0);
    expect(seen.sent).toBeGreaterThan(100);
    expect(seen.armed).toBeGreaterThan(50);
  });

  it("a choice belongs to its sheet: a new sheet starts empty, a payment starts from the first guess", () => {
    const state = expectOk(reduce(startScenario(starterStart("wisdom-and-wizardry", 1), ctx), { type: "Keep" }, ctx)).state;
    const sheet = sheetOf(state);
    const stale: Choice = { key: "something else", ids: ["x"], shares: [] };
    expect(choiceFor(sheet, stale)).toEqual({ key: sheet.key, ids: [], shares: [] });
  });
});

describe("numbers beside the quest", () => {
  it("are the willpower and threat the engine resolves the quest with, and the banner says how it went", async () => {
    let compared = 0;
    let quests = 0;
    for (const [deck, seed] of ["stealth-and-steadfastness", "wisdom-and-wizardry"].flatMap((id) => STARTER_SEEDS.map((value) => [id, value] as const))) {
      const ctx = (await starterWorld(deck)).ctx;
      const sheetOf = (state: ScenarioState): Sheet => {
        const legal = legalIntents(state, ctx);
        return sheetFor(state, ctx, legal, names) ?? windowSheet(state, ctx, legal, names);
      };
      let state = expectOk(reduce(startScenario(starterStart(deck, seed), ctx), { type: "Keep" }, ctx)).state;
      for (let turn = 0; turn < 600 && !state.lost && !state.stageCleared; turn += 1) {
        const before = state;
        const readout = readoutFor(before, ctx, sheetOf(before), null);
        const result = expectOk(reduce(state, nextIntent(state, ctx, { scout: "01002", prefer: "141035", protect: RING_BEARER, play: true, act: true }), ctx));
        const quest = result.steps.find((step) => step.kind === "quest");
        if (quest?.kind === "quest") {
          quests += 1;
          // Shown after staging, while the window before quest resolution was open: the same numbers.
          if (before.mode === "resolution" && readout?.kind === "quest") {
            expect(readout.stats.map((stat) => stat.value)).toEqual([quest.willpower, quest.threat]);
            compared += 1;
          }
          const moment = momentOf(before, result.state, result.steps, names);
          expect(moment?.lines[0]?.text).toBe(`Willpower ${quest.willpower} against threat ${quest.threat}`);
          expect(moment?.title).toBe(quest.willpower > quest.threat ? "Quest succeeded" : quest.willpower < quest.threat ? "Quest failed" : "Quest held even");
          const raised = result.steps.some((step) => step.kind === "threat" && "rule" in step.cause && step.cause.rule === "rr.step-3-4");
          expect(raised).toBe(quest.willpower < quest.threat);
        }
        state = result.state;
      }
    }
    expect(quests).toBeGreaterThan(5);
    expect(compared).toBeGreaterThan(0);
  });
});
