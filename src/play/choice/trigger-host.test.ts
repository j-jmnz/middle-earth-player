// Rules: rr.action (data/rules/entries.json). An Action row of an attachment names the card it lies on, so two copies on
// two heroes read apart (docs/design-system-table.md, Choice tray); a hero's own row is its name alone.
import { describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/legal.ts";
import { updateCard } from "../../rules/core/state.ts";
import { HERO, HERO2, tableFromLayout } from "../../../test/harness/scene-kit.ts";

import type { SheetNames } from "./sheet-types.ts";
import { triggerOptions } from "./sheets.ts";

describe("an attachment's Action row", () => {
  it("names the hero it lies on, one row per copy", () => {
    const made = tableFromLayout("the-dead-marshes", { phase: "Planning", attached: [{ code: "01057", to: HERO }, { code: "01057", to: HERO2 }] }, { extra: ["01057"] });
    let state = made.state;
    for (const id of [made.hero, made.hero2]) state = updateCard(state, id, { exhausted: true });
    const names: SheetNames = { card: (id) => (id === made.hero ? "Aragorn" : id === made.hero2 ? "Gimli" : (made.ctx.cards.get(state.cards[id]?.code ?? "")?.name ?? id)), line: () => null };
    const labels = triggerOptions(state, made.ctx, legalIntents(state, made.ctx), names).map((row) => row.label);
    expect(labels).toEqual(expect.arrayContaining(["Unexpected Courage · on Aragorn", "Unexpected Courage · on Gimli"]));
  });
});
