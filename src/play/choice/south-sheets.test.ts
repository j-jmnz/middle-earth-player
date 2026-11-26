import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../rules/core/test-fixture.ts";
import { legalIntents, reduce, startScenario, type ReduceContext, type ScenarioState } from "../../rules/engine/reduce.ts";
import { SOUTH_GOLDENS, southIntent, southStart, southWorld, type SouthGolden } from "../../../test/scenarios/the-ring-goes-south/game.ts";
import { intentsOf } from "../../../test/harness/sheet-intents.ts";

import { actionsSheet, commitSheet } from "./bar-sheets.ts";
import { railFor } from "../phases/rail.ts";
import type { PickSheet, Sheet, SheetNames } from "./sheet-types.ts";
import { isStepWindow, sheetFor } from "./sheets.ts";
import { zoneSelector } from "../store/selectors.ts";
import { widgetReadouts } from "../readouts/widgets.ts";

// Rules: rr.first-player, rr.response, rr.step-3-3, mec109.stage-4 (data/rules/entries.json).
// The Ring Goes South on the phase 11 table: in every window of whole games (the phase 14 goldens) every option a sheet offers is an
// intent the reducer accepts, a Choose between instructions names each in words (142020:B:1, 142028:A:2, 142037:A:1, 142038:A:2), a
// choice among cards (the faceup cards, Redhorn Pass's damage) is a pick of cards, the win ends on Victory, and the rail never names
// another step. The table holds both active locations and shows the Ring-bearer facedown under the Watcher.
let ctxs: Record<string, ReduceContext>;

beforeAll(async () => {
  ctxs = { starter: (await southWorld("starter")).ctx, strong: (await southWorld("strong")).ctx, weak: (await southWorld("weak")).ctx };
}, 60_000);

function namesFor(state: ScenarioState, ctx: ReduceContext): SheetNames {
  return { card: (id) => ctx.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
}

type Seen = { windows: Set<string>; branches: Map<string, Set<string>>; targets: Set<string>; secondActive: boolean; captive: boolean };

function playChecked(golden: SouthGolden, seen: Seen): ScenarioState {
  const ctx = ctxs[golden.decks]!;
  let state = startScenario(southStart(golden.seatCount, golden.seed, golden.difficulty, golden.decks), ctx);
  const memory = new Set<string>();
  for (let turn = 0; turn < 8000 && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
    const legal = legalIntents(state, ctx);
    const names = namesFor(state, ctx);
    const sheet: Sheet | null = sheetFor(state, ctx, legal, names);
    expect(railFor(state).current).not.toBe("");
    if (state.secondActiveLocation) {
      seen.secondActive = true;
      expect(zoneSelector("secondActiveLocation", 0)(state).entries).toHaveLength(1);
    }
    const watcher = Object.values(state.cards).find((card) => card.code === "142024" && card.zone === "staging");
    if (watcher && Object.values(state.cards).some((card) => card.zone === "captive")) {
      seen.captive = true;
      // The Ring-bearer is drawn under the Watcher, facedown.
      const entry = zoneSelector("staging", 0)(state).entries.find((item) => item.card.id === watcher.id);
      expect(entry?.attached.some((card) => card.zone === "captive" && card.face === "down")).toBe(true);
    }
    if (sheet) {
      seen.windows.add(sheet.kind === "outcome" ? sheet.result : `${state.window?.kind}:${sheet.kind}`);
      if (state.window?.kind === "choose" && sheet.kind === "pick") checkChoose(state, sheet, seen);
      for (const intent of intentsOf(state, sheet)) expect(reduce(state, intent, ctx).ok, `${state.window?.kind} ${JSON.stringify(intent)}`).toBe(true);
    } else {
      expect(state.window?.kind === "pass" || isStepWindow(state), state.window?.kind).toBe(true);
      if (state.mode === "questCommit" && legal.some((intent) => intent.type === "Commit")) {
        for (const intent of intentsOf(state, commitSheet(state, ctx, names))) expect(reduce(state, intent, ctx).ok).toBe(true);
      }
      for (const intent of intentsOf(state, actionsSheet(state, ctx, legal, names))) expect(reduce(state, intent, ctx).ok).toBe(true);
    }
    state = expectOk(reduce(state, southIntent(state, ctx, memory), ctx)).state;
  }
  return state;
}

function checkChoose(state: ScenarioState, sheet: PickSheet, seen: Seen): void {
  const window = state.window;
  if (window?.kind !== "choose") return;
  const frame = state.stack[state.stack.length - 1];
  const data = frame?.data.kind === "effect" ? frame.data : null;
  const source = state.cards[frame?.cardId ?? ""]?.code ?? "";
  if (data?.wait?.kind === "branch") {
    expect(sheet.confirm).toBe("Confirm");
    const labels = seen.branches.get(source) ?? new Set<string>();
    for (const option of sheet.options) {
      expect(option.label).not.toBe(option.id.charAt(0).toUpperCase() + option.id.slice(1));
      labels.add(option.label);
    }
    seen.branches.set(source, labels);
  } else if (data?.wait?.kind === "target") {
    seen.targets.add(`${data.wait.item.instruction.verb}`);
    // A pick of Redhorn Pass's damage names the card and the damage still to place ("Redhorn Pass: assign 1 damage to a character you control (2 of 3 left).").
    // The asks entries of the scenario's picks (The Council of Elrond's faceup cards, Storm of Howls' tied Wargs) lead with the card's name (the Choice tray), as the damage pick does.
    expect(sheet.note ?? "").toMatch(/^(Choose |[^:]+: )/);
    for (const option of sheet.options) expect(option.label).not.toBe(option.id);
  }
  if (state.seatCount > 1) expect(sheet.note ?? "").toContain(`Player ${window.seat + 1} chooses.`);
}

describe("The Ring Goes South on the table", () => {
  it("every option a sheet offers is accepted, in every window of whole games, and the end shows Victory or Defeat", () => {
    const seen: Seen = { windows: new Set(), branches: new Map(), targets: new Set(), secondActive: false, captive: false };
    for (const golden of SOUTH_GOLDENS.filter((item) => item.decks !== "weak")) {
      const end = playChecked(golden, seen);
      expect(end.lost, golden.name).toBe(golden.outcome === "lost");
      const ctx = ctxs[golden.decks]!;
      const outcome = sheetFor(end, ctx, legalIntents(end, ctx), namesFor(end, ctx));
      expect(outcome?.kind).toBe("outcome");
      if (outcome?.kind === "outcome") seen.windows.add(outcome.result);
      expect(railFor(end).current).toBe(golden.outcome === "won" ? "Victory" : "Defeat");
    }
    for (const key of ["mulligan:pick", "travel:pick", "won", "lost"]) expect(seen.windows, key).toContain(key);
    // The faceup cards of the Council of Elrond are a pick of cards, one per outcome.
    expect(seen.targets).toContain("AssignFaceup");
    // The second active location and the facedown Ring-bearer are on the table.
    expect(seen.secondActive).toBe(true);
    expect(seen.captive).toBe(true);
  }, 240_000);

  it("shows neither a life number nor a burden deck: the scenario declares neither", () => {
    const ctx = ctxs.strong!;
    const state = startScenario(southStart(1, 1, "Normal", "strong"), ctx);
    expect(widgetReadouts(state)).toEqual({ life: null, burdenDeck: null });
    expect(state.widgets.secondActiveLocation).toBe(true);
  });
});
