// Rules: rr.travel, rr.first-player, rr.the-word-choose (data/rules/entries.json); ledger line 12160:A:1. The sheets of Streets of Umbar's travel on the City of Corsairs table
// (test/scenarios/the-city-of-corsairs/scene.ts): "Do not travel" and each taxed location row say what the 2 resources cost before the confirm sends, and the Raider prompt of
// a tax paid for traveling away names Streets of Umbar, not the location the players go to (docs/design-system-table.md, Choice tray).
import { beforeAll, describe, expect, it } from "vitest";

import { CODES, corsairsTable, idOf, loadCorsairsWorld, type CorsairsLayout, type CorsairsWorld } from "../../../test/scenarios/the-city-of-corsairs/scene.ts";
import { expectOk } from "../../rules/core/test-fixture.ts";
import { legalIntents, reduce, type ScenarioState } from "../../rules/engine/reduce.ts";
import { topFrame } from "../../rules/windows/windows.ts";

import type { PickSheet, SheetNames } from "./sheet-types.ts";
import { sheetFor } from "./sheets.ts";

let world: CorsairsWorld;
beforeAll(async () => {
  world = await loadCorsairsWorld();
});

const namesFor = (state: ScenarioState): SheetNames => ({ card: (id) => world.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null });
const table = (layout: CorsairsLayout) => corsairsTable(world, { phase: "Travel", ...layout });
const sheetOf = (made: ReturnType<typeof table>, state = made.state): PickSheet => {
  const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), namesFor(state));
  if (sheet?.kind !== "pick") throw new Error("not a pick sheet");
  return sheet;
};
const TAX = "Tap again: 2 resources go on a Raider enemy (Streets of Umbar)";

describe("Streets of Umbar's travel sheet (12160:A:1)", () => {
  it("states the 2 resources on Do not travel and on each other location before the confirm, and not on Streets of Umbar itself", () => {
    const made = table({ staging: [CODES.streetsOfUmbar, CODES.waterspout, CODES.umbarRaider] });
    const sheet = sheetOf(made);
    expect(sheet.alternative).toMatchObject({ label: "Do not travel", caution: TAX });
    const rows = Object.fromEntries(sheet.options.map((option) => [option.label.split(" · ")[0], "caution" in option ? option.caution : undefined]));
    expect(rows).toMatchObject({ Waterspout: TAX, "Streets of Umbar": undefined });
  });

  it("says nothing without a Raider to take the resources (the players must travel to Streets of Umbar), and nothing in a table with no such location", () => {
    const forced = sheetOf(table({ staging: [CODES.streetsOfUmbar, CODES.waterspout] }));
    expect(forced.alternative).toBeNull();
    expect(forced.options.every((option) => !("caution" in option) || option.caution === undefined)).toBe(true);
    const plain = sheetOf(table({ staging: [CODES.waterspout, CODES.umbarRaider] }));
    expect(plain.options.every((option) => !("caution" in option) || option.caution === undefined)).toBe(true);
  });

  it("names Streets of Umbar, not the destination, where the first player chooses the Raider for the resources of traveling away", () => {
    const made = table({ staging: [CODES.streetsOfUmbar, CODES.waterspout, CODES.umbarRaider, CODES.umbarRaider] });
    const away = expectOk(reduce(made.state, { type: "Travel", locationId: idOf(made.state, CODES.waterspout) }, made.ctx)).state;
    expect(away.window?.kind).toBe("choose");
    expect(topFrame(away)?.cardId).toBe(idOf(made.state, CODES.streetsOfUmbar));
    const sheet = sheetOf(made, away);
    expect(sheet.note).toMatch(/^Streets of Umbar: choose a Raider enemy to get 2 resources\./);
    expect(sheet.note).not.toContain("Waterspout");
    // Declining to travel asks the same, in a frame of its own.
    const declined = expectOk(reduce(made.state, { type: "DeclineTravel" }, made.ctx)).state;
    expect(sheetOf(made, declined).note).toMatch(/^Streets of Umbar: choose a Raider enemy to get 2 resources\./);
  });
});
