// Rules: rr.forced (data/rules/entries.json). What a move changes on the table, said in its words (table-changes.ts): the stats beyond a card's progress, the numbers of the table, bookkeeping that is not named, and what an order decides.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../rules/core/state.ts";
import { tableFromLayout } from "../../../test/harness/scene-kit.ts";

import { decidedBy, reachOf, said } from "./table-changes.ts";

const made = tableFromLayout("desert-crossing", { seats: 1, stage: "16068", progress: 6, temperature: 36, staging: ["16023"], phase: "Combat" });
const before = made.state as ScenarioState;
const stage = Object.values(before.cards).find((card) => card.code === "16068");
if (!stage) throw new Error("no stage");
const name = (id: string) => (id === stage.id ? "The Desert of Harad" : id);
const withCard = (patch: Partial<typeof stage>): ScenarioState => ({ ...before, cards: { ...before.cards, [stage.id]: { ...stage, ...patch } } });
const withTable = (stat: string, amount: number): ScenarioState => ({ ...before, modifiers: [...before.modifiers, { instanceId: "table", sourceId: "table", stat, amount, until: "endOfGame" } as ScenarioState["modifiers"][number]] });

describe("reachOf", () => {
  it("names a card's progress, damage and resource tokens in one form", () => {
    expect(reachOf(before, withCard({ progress: 2 }), name).parts).toEqual(["Progress on The Desert of Harad 6 to 2"]);
    expect(reachOf(before, withCard({ damage: 3 }), name).parts).toEqual(["Damage on The Desert of Harad 0 to 3"]);
    expect(reachOf(before, withCard({ resources: 2 }), name).parts).toEqual(["Resource tokens on The Desert of Harad 0 to 2"]);
  });

  it("names the temperature, and adds up the modifiers of one stat", () => {
    const hotter = withTable("temperature", 4);
    const reach = reachOf(before, hotter, name);
    expect(reach.parts).toHaveLength(1);
    expect(reach.parts[0]).toMatch(/^Temperature \d+ to \d+$/);
  });

  it("names no bookkeeping stat, and a bookkeeping difference alone leaves the tables equal", () => {
    const noted = withTable("moreStagingThreat", 2);
    const reach = reachOf(before, noted, name);
    expect(reach.parts).toEqual([]);
    expect(reach.table).toBe(reachOf(before, before, name).table);
  });

  it("leaves the tables equal for a difference that holds no game fact (the order cards entered play in, the frame counter)", () => {
    const moved = { ...withCard({ enteredPlay: stage.enteredPlay + 5 }), frameSeq: before.frameSeq + 3, nextId: before.nextId + 1 };
    expect(reachOf(before, moved, name).table).toBe(reachOf(before, before, name).table);
  });

  it("tells two tables apart when a card differs", () => {
    expect(reachOf(before, withCard({ progress: 2 }), name).table).not.toBe(reachOf(before, withCard({ progress: 3 }), name).table);
  });
});

describe("decidedBy", () => {
  const one = reachOf(before, withCard({ progress: 2, damage: 1 }), name);
  const other = reachOf(before, withCard({ progress: 3, damage: 1 }), name);

  it("names only what the orders do not share", () => {
    expect(decidedBy(one, [one, other])).toBe("Progress on The Desert of Harad 6 to 2");
    expect(decidedBy(other, [one, other])).toBe("Progress on The Desert of Harad 6 to 3");
  });

  it("names every change of a row that has no sibling to compare with (a hidden order beside it)", () => {
    expect(said(one.parts)).toBe("Progress on The Desert of Harad 6 to 2, Damage on The Desert of Harad 0 to 1");
    expect(said([])).toBe("nothing else changes");
  });

  it("does not say nothing changes when the tables differ in what the words do not name", () => {
    const quiet = reachOf(before, withCard({ committed: true }), name);
    const plain = reachOf(before, before, name);
    expect(decidedBy(quiet, [quiet, plain])).toContain("differs");
  });
});
