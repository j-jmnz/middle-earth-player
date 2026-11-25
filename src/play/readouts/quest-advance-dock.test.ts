// Rules: rr.quest-advancement (data/rules/entries.json). The words under the waiting primary of a quest advance question (41005:A:1): the options sit on the advance screen, so they say "above", name no glowing card and are never empty.
import { beforeAll, describe, expect, it } from "vitest";

import type { EngineStep } from "../../rules/core/intents.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { runInstruction } from "../../rules/interpret/interpret.ts";
import { settle } from "../../rules/engine/machine.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { cavesTable, loadCavesWorld, type CavesWorld } from "../../../test/scenarios/the-caves-of-nibin-dum/scene.ts";

import { sheetFor } from "../choice/sheets.ts";
import type { Sheet, SheetNames } from "../choice/sheet-types.ts";
import { dockFor } from "../choice/table-choice.ts";

let world: CavesWorld;
const names: SheetNames = { card: (id) => id, line: () => null };

beforeAll(async () => {
  world = await loadCavesWorld();
});

// The dock's waiting sentence of the question the Surprise Attack advance asks (41005:A:1), worded for the advance screen (surface "panel", as use-table-choice.ts picks while the screen holds the moment).
function whyOf(shape: (sheet: Sheet) => Sheet): string | null {
  const made = cavesTable(world, { seats: 2, stage: "41004", progress: 0, setAside: ["41027"], deck: ["41030", "41031"], discard: ["41031"] });
  const steps: EngineStep[] = [];
  const placed = runInstruction({ ...syncConstants(made.state, made.ctx), window: null }, { verb: "ProgressQuest", amount: 8 }, { seat: 0, sourceId: made.state.questStage }, made.ctx, steps);
  const state = settle(syncConstants(placed, made.ctx), made.ctx, steps);
  const legal = legalIntents(state, made.ctx);
  const found = sheetFor(state, made.ctx, legal, names);
  if (!found) throw new Error("no sheet");
  const sheet = shape(found);
  return dockFor(sheet, { key: sheet.key, ids: [], shares: [] }, { game: state, ctx: made.ctx, legal, names }, { overlay: false, passLegal: false, surface: "panel" }).why;
}

describe("the quest advance question's waiting words", () => {
  it("points a card pick at the options above, names no glowing card and is not empty", () => {
    const why = whyOf((sheet) => sheet);
    expect(why).toBe("Choose one above.");
  });

  it("points a multi pick with no empty answer at the options above too", () => {
    const why = whyOf((sheet) => (sheet.kind === "pick" ? { kind: "multi", key: sheet.key, step: sheet.step, title: sheet.title, note: sheet.note, verb: "Search", options: sheet.options, build: { kind: "Commit" }, allowEmpty: false, preselected: [], alternative: null } : sheet));
    expect(why).toBe("Choose at least one above.");
  });
});
