// Rules: rr.keywords, rr.blank, rr.sentinel, mec109.archery, mec113.phantom (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import type { ModifierStat } from "../../catalog/boundary.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import type { ScenarioState } from "../../rules/engine/reduce.ts";
import { buildTable, FRODO, idsOf, sceneCards } from "../../../test/harness/scene.ts";

import { cardKeywords } from "./card-keywords.ts";

let base: Awaited<ReturnType<typeof sceneCards>>;

beforeAll(async () => {
  const scene = await sceneCards();
  const cards = new Map(scene.cards);
  cards.set("kw-orc", definePrinted({ code: "kw-orc", name: "Orc", type: "enemy", threat: 1, engagementCost: 20, attack: 1, defense: 1, health: 3, keywords: { peril: true, archery: 1 } }));
  cards.set("kw-ghost", definePrinted({ code: "kw-ghost", name: "Ghost", type: "enemy", threat: 1, engagementCost: 20, attack: 1, defense: 1, health: 3, keywords: { phantom: true, indestructible: true } }));
  base = { definition: scene.definition, cards };
});

function hold(state: ScenarioState, id: string, stat: ModifierStat, amount = 1): ScenarioState {
  return { ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: id, stat, amount, until: "endOfRound" }] };
}

const words = (list: ReturnType<typeof cardKeywords>) => list.map((item) => `${item.word}${item.lost ? " (lost)" : ""}`);

describe("a card's keywords now", () => {
  it("lists the printed ones with their values", () => {
    const table = buildTable(base, { staging: ["kw-orc"] });
    expect(words(cardKeywords(table.state, table.ctx, idsOf(table, "kw-orc")))).toEqual(["Peril", "Archery 1"]);
  });

  it("adds a keyword an effect gives", () => {
    const table = buildTable(base);
    const frodo = idsOf(table, FRODO);
    expect(cardKeywords(table.state, table.ctx, frodo)).toEqual([]);
    const gained = hold(table.state, frodo, "sentinel");
    expect(words(cardKeywords(gained, table.ctx, frodo))).toEqual(["Sentinel"]);
  });

  it("raises a numbered keyword by what is held", () => {
    const table = buildTable(base, { staging: ["kw-orc"] });
    const orc = idsOf(table, "kw-orc");
    expect(words(cardKeywords(hold(table.state, orc, "archery"), table.ctx, orc))).toEqual(["Peril", "Archery 2"]);
  });

  it("keeps a printed keyword that is lost for now, marked lost", () => {
    const table = buildTable(base, { staging: ["kw-ghost"] });
    const ghost = idsOf(table, "kw-ghost");
    expect(words(cardKeywords(hold(table.state, ghost, "losesPhantom"), table.ctx, ghost))).toEqual(["Indestructible", "Phantom (lost)"]);
    // Lost keywords follow the engine's readers: Indestructible honours losesKeywords, hasPhantom reads only losesPhantom.
    expect(words(cardKeywords(hold(table.state, ghost, "losesKeywords"), table.ctx, ghost))).toEqual(["Indestructible (lost)", "Phantom"]);
  });

  it("has no printed keywords while the text box is blank", () => {
    const table = buildTable(base, { staging: ["kw-orc"] });
    const orc = idsOf(table, "kw-orc");
    expect(cardKeywords(hold(table.state, orc, "blankText"), table.ctx, orc)).toEqual([]);
  });
});
