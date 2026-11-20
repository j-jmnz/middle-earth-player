// Rules: rr.damage, rr.quest-advancement, rr.action (data/rules/entries.json); docs/brief.md (The Hunt for the Dreadnaught, The table); ledger lines 40013:A:1, 40013:A:2, 40013:A:3, 40004:B:2, 40005:B:1, 40001:B:2, 40002:B:1.
// The top-bar dials of The Hunt for the Dreadnaught: the Dreadnaught's hit points left (a goal dial that warns when the next end of the round flips it), the damage it took this round against its cap, the progress placed on the stage this round
// against its cap, and the mode card's Quest Action (Ready, then Used).
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { cardKeywords } from "../../cards/card-keywords.ts";
import { dialProps } from "../dials.ts";
import { huntDials } from "./hunt.ts";

const ID = "the-hunt-for-the-dreadnaught";
const nameOfIn = (made: ReturnType<typeof tableFromLayout>) => (code: string) => made.cards.get(code)?.name ?? code;
const made = (layout: Layout) => tableFromLayout(ID, { stages: ["40004", "40005"], ...layout });
const dialsOf = (layout: Layout) => {
  const table = made(layout);
  return huntDials(table.state, table.ctx, nameOfIn(table));
};
const byId = (layout: Layout, id: string) => dialsOf(layout).find((dial) => dial.id === id);

describe("the Dreadnaught's hit points dial", () => {
  it("40013:A:2 counts the hit points left of the 15 for each player who started, a goal dial", () => {
    const dial = byId({ staging: [{ code: "40013", damage: 4 }] }, "dreadnaught");
    expect(dial).toMatchObject({ value: 11, limit: 15, filled: 4, goal: true, label: "Dreadnaught · HP", limitWords: "15 hit points: destroy the Dreadnaught to win" });
    expect(dial?.warn).toBeUndefined();
    expect(dial?.note).toContain("holds 4 damage of 15 hit points (15 for each of 1 players who started)");
    expect(dialProps(dial!).limit).toBe(15);
    expect(byId({ seats: 2, staging: ["40013"] }, "dreadnaught")).toMatchObject({ value: 30, limit: 30 });
  });

  it("40013:A:3 warns when less than half its hit points are left, so the end of the round flips it, and says nothing once it is flipped", () => {
    expect(byId({ staging: [{ code: "40013", damage: 8 }] }, "dreadnaught")?.warn?.level).toBe("near");
    expect(byId({ staging: [{ code: "40013", damage: 7 }] }, "dreadnaught")?.warn).toBeUndefined();
    const flipped = byId({ staging: [{ code: "40013", damage: 9, upgraded: true }] }, "dreadnaught");
    expect(flipped?.warn).toBeUndefined();
    expect(flipped?.note).toContain("Damaged side");
  });
});

describe("the dial of the damage the Dreadnaught took this round", () => {
  it("40013:A:1 counts the damage taken this round against the cap of 5 for each player who started, and warns at the cap", () => {
    const table = made({ seats: 2, staging: ["40013"] });
    const id = idOf(table.state, "40013");
    const open = huntDials(table.state, table.ctx, nameOfIn(table)).find((dial) => dial.id === "damage");
    expect(open).toMatchObject({ value: 0, limit: 10, warms: true, label: "Damage", limitWords: "No more than 10 damage each round" });
    const spent = huntDials({ ...table.state, roundDamage: { [id]: 10 } }, table.ctx, nameOfIn(table)).find((dial) => dial.id === "damage");
    expect(spent).toMatchObject({ value: 10, warn: { level: "near", words: "The Dreadnaught takes no more damage this round." } });
  });
});

describe("the dial of the progress cap of the stage", () => {
  it("40004:B:2 counts the progress placed this round against 5 for each player on stage 1B, and warns at the cap", () => {
    const table = made({ stage: "40004" });
    const open = huntDials(table.state, table.ctx, nameOfIn(table)).find((dial) => dial.id === "cap");
    expect(open).toMatchObject({ value: 0, limit: 5, label: "Progress", limitWords: "No more than 5 progress each round" });
    const placed = { ...table.state, modifiers: [...table.state.modifiers, { instanceId: "table", sourceId: "table", stat: "questProgressPlaced" as const, amount: 5, until: "endOfRound" as const }] };
    expect(huntDials(placed, table.ctx, nameOfIn(table)).find((dial) => dial.id === "cap")?.warn?.level).toBe("near");
  });

  it("40005:B:1 shows the same cap on stage 2B", () => {
    expect(byId({ stage: "40005" }, "cap")).toMatchObject({ limit: 5 });
  });
});

describe("the dial of the Quest Action", () => {
  it("40002:B:1 says Ready, then Used once the whole table has used it", () => {
    const table = made({ modeCard: true });
    const [ready] = huntDials(table.state, table.ctx, nameOfIn(table)).filter((dial) => dial.id === "action");
    expect(ready).toMatchObject({ word: "Ready", label: "Quest Action", value: 1 });
    expect(ready?.note).toContain("then the top card of the encounter deck is revealed");
    const used = { ...table.state, uses: [{ effectId: "40002:action:1", sourceId: idOf(table.state, "40002"), seat: 0, round: 1, phase: "Quest" as const }] };
    const [spent] = huntDials(used as never, table.ctx, nameOfIn(table)).filter((dial) => dial.id === "action");
    expect(spent).toMatchObject({ word: "Used", value: 0 });
  });

  it("40001:B:2 on Easy Mode the Quest Action reveals no card", () => {
    const table = made({ modeCard: "easy" });
    const dial = huntDials(table.state, table.ctx, nameOfIn(table)).find((one) => one.id === "action");
    expect(dial?.note).not.toContain("revealed");
  });
});

describe("outside The Hunt for the Dreadnaught", () => {
  it("shows no dial in another scenario", () => {
    const other = tableFromLayout("the-old-forest", { staging: ["f0"] });
    expect(huntDials(other.state, other.ctx, nameOfIn(other))).toEqual([]);
  });
});

describe("the keyword chips of the box", () => {
  it("40014:A:1 shows Pillage with the printed number, and the Dreadnaught as Massive with its Archery for each player", () => {
    const table = made({ seats: 2, engaged: ["40014"], staging: ["40013"] });
    const chips = (code: string) => cardKeywords(table.state, table.ctx, idOf(table.state, code)).map((chip) => chip.word);
    expect(chips("40014")).toContain("Pillage 8");
    expect(chips("40013")).toEqual(expect.arrayContaining(["Massive", "Archery 2"]));
  });
});
