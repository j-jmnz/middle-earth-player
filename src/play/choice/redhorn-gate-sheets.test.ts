// Rules: rr.first-player, rr.quest-phase, dwd.caradhras (data/rules/entries.json); ledger lines 04016:A:1, 901302:A:2.
// The sheets of The Redhorn Gate that read the table: Fanuidhol's question names the hero and its owner, one for each committed hero with a resource (words/asks/the-redhorn-gate.ts), and Wolfpelt Goblin's damage says the number the table holds now.
import { describe, expect, it } from "vitest";

import { settle } from "../../rules/engine/machine.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
import { fireForced } from "../../rules/windows/triggers.ts";
import { revealFromTop, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { updateCard } from "../../rules/core/state.ts";
import { ledgerLine } from "../cards/ledger.ts";
import { previewCards } from "../cards/table-preview.ts";
import { sheetFor } from "./sheets.ts";

// The sheet open once the event has been announced.
function sheetAfter(layout: Layout, event: Parameters<typeof fireForced>[1]) {
  const made = tableFromLayout("the-redhorn-gate", layout);
  const steps: EngineStep[] = [];
  const state = settle(fireForced({ ...made.state, window: null }, event, made.ctx, steps), made.ctx, steps);
  const names = { card: (id: string) => made.cards.get(state.cards[id]?.code ?? id)?.name ?? id, line: () => null };
  const sheet = sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
  if (sheet?.kind !== "pick") throw new Error(`no pick sheet: ${JSON.stringify(state.window)}`);
  return sheet;
}

describe("Fanuidhol's question (04016:A:1)", () => {
  it("04016:A:1 names the hero, its pool and what each answer does", () => {
    const sheet = sheetAfter({ stage: "04011", active: "04016", heroResources: 1, committed: ["dh1", "dh2"] }, { trigger: "questTotalCounted", seat: null });
    expect(sheet.note).toContain("Fanuidhol: spend 1 resource from dh1's pool to count its Willpower, or keep it and count 0.");
    expect(sheet.options.map((option) => option.label)).toEqual(["Spend 1 resource from dh1's pool: its Willpower counts", "Keep the resource: dh1 counts 0 Willpower"]);
  });

  it("04016:A:1 leads with the player two-handed and names that player's hero", () => {
    const sheet = sheetAfter({ stage: "04011", seats: 2, active: "04016", heroResources: 1, committed: ["dh3"] }, { trigger: "questTotalCounted", seat: null });
    expect(sheet.note).toContain("dh3's pool");
  });
});

describe("Wolfpelt Goblin's pick (901302:A:2)", () => {
  it("901302:A:2 says the damage the active location's remaining quest points make now", () => {
    const sheet = sheetAfter({ active: { code: "04019", progress: 1 }, engaged: ["901302"] }, { trigger: "engaged", seat: 0, cardId: "i6" });
    expect(sheet.note).toContain("take 1 damage");
  });
});

describe("Blinding Blizzard's counter (901307:A:2)", () => {
  it("901307:A:2 reads its progress against its limit of 5 once its When Revealed has set the redirect, and a card without it reads the bare count", () => {
    const made = tableFromLayout("the-redhorn-gate", { deck: ["f0"], staging: [{ code: "04017", progress: 2 }] });
    const revealed = revealFromTop({ ...made.state, window: null }, made.ctx, "901307", []).state;
    const blizzard = Object.values(revealed.cards).find((card) => card.code === "901307")!.id;
    const held = updateCard(revealed, blizzard, { progress: 3 });
    const describeCode = (code: string) => ({ name: code, source: null });
    expect(previewCards(held, made.ctx, blizzard, describeCode, (id) => id, [], ledgerLine).cards[0]?.tokens).toEqual(["3 / 5 progress"]);
    const celebdil = Object.values(held.cards).find((card) => card.code === "04017")!.id;
    expect(previewCards(held, made.ctx, celebdil, describeCode, (id) => id, [], ledgerLine).cards[0]?.tokens).toEqual(["2 progress"]);
  });
});
