// Rules: rr.keywords, rr.blank, rr.sentinel, mec109.archery, mec113.phantom, dcce.uncharted (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import type { ModifierStat } from "../../catalog/boundary.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { archeryTotal } from "../../rules/combat/combat.ts";
import type { ScenarioState } from "../../rules/engine/reduce.ts";
import { buildTable, FRODO, idsOf, sceneCards } from "../../../test/harness/scene.ts";

import { cardKeywords } from "./card-keywords.ts";

let base: Awaited<ReturnType<typeof sceneCards>>;

beforeAll(async () => {
  const scene = await sceneCards();
  const cards = new Map(scene.cards);
  cards.set("kw-orc", definePrinted({ code: "kw-orc", name: "Orc", type: "enemy", threat: 1, engagementCost: 20, attack: 1, defense: 1, health: 3, keywords: { peril: true, archery: 1 } }));
  cards.set("kw-ghost", definePrinted({ code: "kw-ghost", name: "Ghost", type: "enemy", threat: 1, engagementCost: 20, attack: 1, defense: 1, health: 3, keywords: { phantom: true, indestructible: true } }));
  cards.set("904702", definePrinted({ code: "904702", name: "Shrine to Morgoth", type: "location", threat: 2, questPoints: 3, keywords: { uncharted: true } }));
  cards.set("142070", definePrinted({ code: "142070", name: "Uruk-hai Archer", type: "enemy", threat: 2, engagementCost: 30, attack: 3, defense: 1, health: 3 }));
  cards.set("142078", definePrinted({ code: "142078", name: "Wooded Shoreline", type: "location", threat: 1, questPoints: 2 }));
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

  it("shows Uncharted on a double-sided location only on its Lost Island side", () => {
    const table = buildTable(base, { staging: ["904702"] });
    const shrine = idsOf(table, "904702");
    expect(words(cardKeywords(table.state, table.ctx, shrine))).toEqual([]);
    expect(words(cardKeywords(updateCard(table.state, shrine, { face: "B" }), table.ctx, shrine))).toEqual(["Uncharted"]);
  });

  it("counts the archery a card gives itself as the engine does", () => {
    const table = buildTable(base, { staging: ["142070", "142078"] });
    const archer = idsOf(table, "142070");
    const shore = idsOf(table, "142078");
    // Uruk-hai Archer (142070:A:1): Archery X, X the number of players. Wooded Shoreline (142078:A:1): 2 archery while it is in the staging area.
    const state = hold(hold(table.state, archer, "archeryPlayers"), shore, "archeryBonus", 2);
    expect(words(cardKeywords(state, table.ctx, archer))).toEqual([`Archery ${table.state.seatCount}`]);
    expect(words(cardKeywords(state, table.ctx, shore))).toEqual(["Archery 2"]);
    expect(archeryTotal(state, table.ctx.cards)).toBe(table.state.seatCount + 2);
  });
});
