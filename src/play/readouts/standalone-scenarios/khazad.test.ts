// Rules: rr.damage, rr.guarded, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 51301:B:1, 51307:B:2, 51307:B:3, 51340:A:1, 51351:A:1 (docs/brief.md, Escape from Khazad-dûm, The table; docs/design-system-table.md, Top bar).
// The top-bar dials of Escape from Khazad-dûm (the damage on the stage 3B against the 10 that lose the game, Durin's Bane set aside) and the held pills of Nameless Thing's guarded card and Goblin Dungeon's ally.
import { describe, expect, it } from "vitest";

import { idOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { isHeldFaceup, keptMark } from "./wizards-quest.ts";
import { khazadDials } from "./khazad.ts";

const ID = "escape-from-khazad-dum";
const realStages = (stage: string | undefined): string[] => (stage != null && ["51307", "51308", "51309"].includes(stage) ? ["51301", "51303", stage] : ["51301", "51303", "51307"]);
const made = (layout: Layout) => tableFromLayout(ID, { stages: realStages(layout.stage), ...layout });
const nameOfIn = (table: ReturnType<typeof made>) => (code: string) => table.cards.get(code)?.name ?? code;
const dials = (layout: Layout, damage = 0) => {
  const table = made(layout);
  const state = table.state.questStage ? updateCard(table.state, table.state.questStage, { damage }) : table.state;
  return khazadDials(state, table.ctx, nameOfIn(table));
};

describe("the damage on the stage 3B", () => {
  it("51307:B:3 counts the damage on The Bridge against the 10 that lose the game, and does not warm far from it", () => {
    const dial = dials({ stage: "51307" }, 1).find((one) => one.id === "damage");
    expect(dial).toMatchObject({ value: 1, limit: 10, warms: true, label: "Damage", limitWords: "10 damage on the stage loses the game" });
    expect(dial?.warn).toBeUndefined();
    expect(dial?.note).toContain("holds 1 of 10 damage");
  });

  it("51307:B:2 warns when Durin's Bane's next attack could lose the game, and when one damage does", () => {
    expect(dials({ stage: "51307" }, 3).find((one) => one.id === "damage")?.warn).toMatchObject({ level: "near" });
    expect(dials({ stage: "51307" }, 9).find((one) => one.id === "damage")?.warn).toEqual({ level: "critical", words: "One more damage on the stage loses the game." });
  });

  it("has no damage dial on a stage that does not lose to damage, or in another scenario", () => {
    expect(dials({ stage: "51308" }).find((one) => one.id === "damage")).toBeUndefined();
    const other = tableFromLayout("the-mines-of-moria", {});
    expect(khazadDials(other.state, other.ctx, nameOfIn(made({})))).toEqual([]);
  });
});

describe("Durin's Bane set aside", () => {
  it("51301:B:1 says Durin's Bane lies set aside, out of play, and shows its card on a tap", () => {
    const table = made({ stage: "51303", setAside: ["51311"] });
    const dial = khazadDials(table.state, table.ctx, nameOfIn(table)).find((one) => one.id === "bane");
    expect(dial).toMatchObject({ word: "Aside", cardId: idOf(table.state, "51311") });
    expect(dial?.note).toContain("set aside, out of play");
    expect(khazadDials(made({ stage: "51303" }).state, table.ctx, nameOfIn(table)).find((one) => one.id === "bane")).toBeUndefined();
  });
});

describe("the cards under Nameless Thing and Goblin Dungeon", () => {
  it("51351:A:1 the host counts the card it guards, with its owner, and the pill is gone once the card is not held", () => {
    const table = made({ staging: ["51351"], deckOf: ["c3", "filler"] });
    expect(keptMark(table.state, table.ctx, idOf(table.state, "51351"), isHeldFaceup)).toBeNull();
    const done = resolveRecords(table.state, table.ctx, "51351", "forced", idOf(table.state, "51351")).state;
    expect(keptMark(done, table.ctx, idOf(done, "51351"), isHeldFaceup)).toMatchObject({ text: "1 held", count: 1 });
    expect(keptMark(done, table.ctx, idOf(done, "dh1"), isHeldFaceup)).toBeNull();
  });

  it("51340:A:1 the host counts the ally it holds", () => {
    const table = made({ play: ["ally"] });
    const done = resolveRecords(table.state, table.ctx, "51340", "whenRevealed").state;
    const host = Object.values(done.cards).find((card) => card.code === "51340")?.id ?? "";
    expect(keptMark(done, table.ctx, host, isHeldFaceup)).toMatchObject({ text: "1 held", count: 1 });
  });
});
