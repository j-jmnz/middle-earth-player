import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/core/test-fixture.ts";
import { legalIntents, reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/engine/reduce.ts";
import { FORD_GOLDENS, fordIntent, fordStart, fordWorld, type FordGolden } from "../../test/scenarios/flight-to-the-ford/game.ts";
import { intentsOf } from "../../test/harness/sheet-intents.ts";

import { actionsSheet, commitSheet } from "./bar-sheets.ts";
import { railFor } from "./rail.ts";
import type { PickSheet, Sheet, SheetNames } from "./sheet-types.ts";
import { isStepWindow, sheetFor } from "./sheets.ts";

// Rules: rr.response, rr.first-player, rr.step-3-3, mec109.ringbearers-life, mec109.burden-deck (data/rules/entries.json).
// Flight to the Ford on the phase 11 table: in every window of whole games (the phase 13 goldens: wins with the big-number
// loadout, losses with the starter decks and the weak heroes) every option a sheet offers is an intent the reducer accepts,
// a Choose between two instructions names each in words (141063:A:2, 141080:A:2, 141081:A:2), the campaign card's Response
// is a sheet any seat can answer (141056:A:2), the win ends on Victory and the rail never names another step.
let ctxs: Record<string, ReduceContext>;

beforeAll(async () => {
  ctxs = { starter: (await fordWorld("starter")).ctx, strong: (await fordWorld("strong")).ctx, weak: (await fordWorld("weak")).ctx };
}, 60_000);

function namesFor(state: ScenarioState, ctx: ReduceContext): SheetNames {
  return { card: (id) => ctx.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
}

const bare = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

type Seen = { windows: Set<string>; branches: Map<string, Set<string>>; responses: Set<string> };

function playChecked(golden: FordGolden, seen: Seen): ScenarioState {
  const ctx = ctxs[golden.decks]!;
  let state = startScenario(fordStart(golden.seatCount, golden.seed, golden.difficulty, golden.decks), ctx);
  const memory = new Set<string>();
  for (let turn = 0; turn < 6000 && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
    const legal = legalIntents(state, ctx);
    const names = namesFor(state, ctx);
    const sheet: Sheet | null = sheetFor(state, ctx, legal, names);
    expect(railFor(state).current).not.toBe("");
    if (sheet) {
      seen.windows.add(sheet.kind === "outcome" ? sheet.result : `${state.window?.kind}:${sheet.kind}`);
      if (state.window?.kind === "choose" && sheet.kind === "pick") checkChoose(state, sheet, seen);
      if (state.window?.kind === "response" && sheet.kind === "trigger") for (const option of sheet.options) seen.responses.add(`${option.code}:${option.effectId}`);
      for (const intent of intentsOf(state, sheet)) expect(reduce(state, intent, ctx).ok, `${state.window?.kind} ${JSON.stringify(intent)}`).toBe(true);
    } else {
      expect(state.window?.kind === "pass" || isStepWindow(state), state.window?.kind).toBe(true);
      if (state.mode === "questCommit" && legal.some((intent) => intent.type === "Commit")) {
        for (const intent of intentsOf(state, commitSheet(state, ctx, names))) expect(reduce(state, intent, ctx).ok).toBe(true);
      }
      for (const intent of intentsOf(state, actionsSheet(state, ctx, legal, names))) expect(reduce(state, intent, ctx).ok).toBe(true);
    }
    state = expectOk(reduce(state, fordIntent(state, ctx, memory), ctx)).state;
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
      expect(option.label).not.toBe(bare(option.id));
      labels.add(option.label);
    }
    seen.branches.set(source, labels);
  } else if (data?.wait?.kind === "target") {
    expect(sheet.note ?? "").toMatch(/^Choose /);
    for (const option of sheet.options) expect(option.label).not.toBe(option.id);
  }
  if (state.seatCount > 1) expect(sheet.note ?? "").toContain(`Player ${window.seat + 1} chooses.`);
}

describe("Flight to the Ford on the table", () => {
  it("every option a sheet offers is accepted, in every window of whole games, and the end shows Victory or Defeat", () => {
    const seen: Seen = { windows: new Set(), branches: new Map(), responses: new Set() };
    for (const golden of FORD_GOLDENS.filter((item) => item.decks !== "weak")) {
      const end = playChecked(golden, seen);
      expect(end.lost, golden.name).toBe(golden.outcome === "lost");
      const outcome = sheetFor(end, ctxs[golden.decks]!, legalIntents(end, ctxs[golden.decks]!), namesFor(end, ctxs[golden.decks]!));
      expect(outcome?.kind).toBe("outcome");
      if (outcome?.kind === "outcome") seen.windows.add(outcome.result);
      expect(railFor(end).current).toBe(golden.outcome === "won" ? "Victory" : "Defeat");
    }
    for (const key of ["mulligan:pick", "travel:pick", "response:trigger", "won", "lost"]) expect(seen.windows, key).toContain(key);
    // The campaign card's Response is on a sheet (141056:A:2).
    expect(seen.responses).toContain("141056:141056:response:1");
    // A Fell Rider in the staging area: the first player's either/or, in words (141063:A:2).
    const rider = [...(seen.branches.get("141063") ?? [])];
    expect(rider).toContain("Reduce the Ring-bearer's life by 1");
    expect(rider.some((label) => /^Engage /.test(label))).toBe(true);
  }, 240_000);
});
