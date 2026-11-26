// Rules: rm.scour, rr.first-player (data/rules/entries.json); ledger lines 08122:B:2, 08123:A:1, 08123:B:2, 08134:A:1.
// The words of the Scour order pick (TriggerScour, 08122:B:2 and the three records after it): the engine asks the first player which of two or more Scour cards resolves next (askTarget), not a record's Pick, so the scenario words test cannot reach it. Each test
// opens the record's own window on a table with two Scour cards in play, builds the sheet the player reads and checks the sentence of the asks entry (src/play/words/asks/celebrimbors-secret.ts) under its key.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { settle } from "../../rules/engine/machine.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { reduce } from "../../rules/engine/reduce.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { idOf, tableFromLayout } from "../../../test/harness/scene-kit.ts";
import { sheetFor } from "../choice/sheets.ts";

const ID = "celebrimbors-secret";
const SCOUT = "08128";
const TOWER = "08131";
const PLAZA = "08130";
const built = (seats: 1 | 2, stage = "08122") => tableFromLayout(ID, { seats, phase: "Quest", stage, staging: [SCOUT, TOWER], active: PLAZA, deckOf: ["filler", "filler", "filler"] });
type Table = ReturnType<typeof built>;

// The record's frame is pushed and settled until the engine opens its window: the live state the sheet is built from.
function opened(t: Table, code: string, effectId: string, frame: "whenRevealed" | "forced", source: string): ScenarioState {
  const effects = t.ctx.effects.filter((effect) => effect.cardCode === code && effect.id === effectId).map((effect) => ({ ...effect, condition: undefined }) as Effect);
  const pushed = pushCardEffects(t.state, frame, source, t.state.firstPlayer, false, effects, t.ctx, []);
  return settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, []);
}
const names = (t: Table, state: ScenarioState) => ({ card: (id: string) => t.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: (id: string) => id });
const sheetOf = (t: Table, state: ScenarioState) => {
  const sheet = sheetFor(state, t.ctx, legalIntents(state, t.ctx), names(t, state));
  if (sheet?.kind !== "pick") throw new Error(`no pick sheet: ${JSON.stringify(state.window)}`);
  return sheet;
};
const SAYS = "hoose which Scour effect resolves next. Each one finishes before the next starts, so damage from one can bury a location before Ancient Foundation counts locations.";
const TITLES = ["Bellach's Scout", "Collapsed Tower"];

// Each case: the asks key it proves, the card and record that open the window.
const cases = [
  { key: "08122:forced:1 @0 TriggerScour", line: "08122:B:2", code: "08122", effect: "08122:forced:1", frame: "forced", stage: "08122" },
  { key: "08123:forced:1 @0 TriggerScour", line: "08123:B:2", code: "08123", effect: "08123:forced:1", frame: "forced", stage: "08123" },
  { key: "08123:whenRevealed:1 @0 TriggerScour", line: "08123:A:1", code: "08123", effect: "08123:whenRevealed:1", frame: "whenRevealed", stage: "08123" },
] as const;

describe("the Scour order pick (TriggerScour, asked by the engine from the record's first step)", () => {
  for (const one of cases) {
    it(`${one.line} words the order of two Scour cards under the key ${one.key}: the verb Resolve, the sentence, and the player named two-handed only`, () => {
      const two = built(2, one.stage);
      const sheet = sheetOf(two, opened(two, one.code, one.effect, one.frame, two.state.questStage ?? ""));
      expect(sheet.options.map((option) => option.label).sort()).toEqual(TITLES);
      expect(sheet.verb).toBe("Resolve");
      expect(sheet.note).toContain(`Player 1: c${SAYS}`);
      const solo = built(1, one.stage);
      const alone = sheetOf(solo, opened(solo, one.code, one.effect, one.frame, solo.state.questStage ?? ""));
      expect(alone.note).toContain(`C${SAYS}`);
      expect(alone.note).not.toContain("Player 1");
    });
  }

  it("08134:A:1 words the order under the key 08134:whenRevealed:1 @0.scour.0 TriggerScour once the first player chose to trigger each Scour effect", () => {
    const t = tableFromLayout(ID, { seats: 2, phase: "Quest", staging: [SCOUT, TOWER, "08134"], active: PLAZA, deckOf: ["filler", "filler", "filler"] });
    const card = idOf(t.state, "08134");
    const first = opened(t, "08134", "08134:whenRevealed:1", "whenRevealed", card);
    const rows = sheetOf(t, first).options.map((option) => option.id);
    expect(rows).toEqual(expect.arrayContaining(["scour", "hand"]));
    const chose = reduce(first, { type: "Choose", optionId: "scour" }, t.ctx);
    if (!chose.ok) throw new Error(`refused: ${JSON.stringify(chose)}`);
    const sheet = sheetOf(t, chose.state);
    expect(sheet.options.map((option) => option.label).sort()).toEqual(TITLES);
    expect(sheet.verb).toBe("Resolve");
    expect(sheet.note).toContain(`Player 1: c${SAYS}`);
  });
});
