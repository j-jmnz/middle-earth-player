// Rules: rr.quest-cards-quest-deck, rr.quest-advancement, ltp.victory-display (data/rules/entries.json). The stages defeated before
// the quest stage, newest first, as the stage's preview lists them (earlier-stages.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { updateCard } from "../../rules/core/state.ts";
import { moveCard } from "../../rules/core/zones.ts";
import { buildTable, idsOf, sceneCards } from "../../../test/harness/scene.ts";
import { loadVoyageWorld, voyageTable, type VoyageWorld } from "../../../test/scenarios/voyage-across-belegaer/scene.ts";

import { earlierStages } from "./earlier-stages.ts";
import { previewCards } from "./table-preview.ts";

let base: Awaited<ReturnType<typeof sceneCards>>;
let voyage: VoyageWorld;

beforeAll(async () => {
  base = await sceneCards();
  voyage = await loadVoyageWorld();
});

describe("earlierStages", () => {
  it("lists the stages before the current one newest first, set aside as they were defeated", () => {
    const table = buildTable(base, { stage: "141024" });
    expect(earlierStages(table.state, table.ctx, table.state.questStage!)).toEqual([idsOf(table, "141023"), idsOf(table, "141022")]);
    const first = buildTable(base, { stage: "141022" });
    expect(earlierStages(first.state, first.ctx, first.state.questStage!)).toEqual([]);
  });

  it("is empty for a card that is not the quest stage", () => {
    const table = buildTable(base, { stage: "141024" });
    expect(earlierStages(table.state, table.ctx, idsOf(table, "141022"))).toEqual([]);
  });

  it("follows the stages a branching quest reached, and leaves out the one it skipped", () => {
    const table = buildTable(base, { stage: "141024" });
    const branched = { ...table.state, stagesReached: ["141024"] };
    expect(earlierStages(branched, table.ctx, table.state.questStage!)).toEqual([idsOf(table, "141022")]);
  });

  it("finds a stage in the victory display, as a game with ships puts it (11171:B:4)", () => {
    const table = buildTable(base, { stage: "141024" });
    const sea = moveCard(table.state, idsOf(table, "141022"), { zone: "victory" });
    expect(earlierStages(sea, table.ctx, table.state.questStage!)).toEqual([idsOf(table, "141023"), idsOf(table, "141022")]);
  });

  it("lists a deck-ordered quest's stages in the order they were defeated, not the order of its definition (Voyage Across Belegaer)", () => {
    const table = voyageTable(voyage, { stage: "11020" });
    const id = (code: string) => Object.values(table.state.cards).find((card) => card.code === code)!.id;
    // The stage 2 cards were played 11019, 11017, 11018 after stage 1: the order they lie in the set-aside zone.
    const played = ["11016", "11019", "11017", "11018"].map(id);
    const ordered = { ...table.state, setAside: played };
    expect(earlierStages(ordered, table.ctx, table.state.questStage!)).toEqual([...played].reverse());
    // The victory display holds them in a game with ships, in the same order.
    const sea = { ...table.state, setAside: [], victory: played };
    expect(earlierStages(sea, table.ctx, table.state.questStage!)).toEqual([...played].reverse());
  });

  it("reads the stage's own seat once stages are separate: the shared stages and its own, not another seat's", () => {
    const table = buildTable(base, { stage: "141024", seats: 2 });
    const stage = table.state.questStage!;
    let state = updateCard(table.state, stage, { controller: 0 });
    state = updateCard(state, idsOf(table, "141023"), { controller: 1 });
    const separate = { ...state, separate: true as const, questStage: null, seats: [{ ...state.seats[0], stage }, state.seats[1]] as const };
    expect(earlierStages(separate, table.ctx, stage)).toEqual([idsOf(table, "141022")]);
  });
});

describe("the quest stage's preview", () => {
  const describeCode = (code: string, picture?: string) => ({ name: `name ${code}`, source: null, picture });

  it("lists the earlier stages after the stage's own cards, each on its B side as an earlier stage", () => {
    const table = buildTable(base, { stage: "141024", staging: ["f0"] });
    const shown = previewCards(table.state, table.ctx, table.state.questStage!, describeCode, (id) => id);
    expect(shown.start).toBe(0);
    expect(shown.cards.map((card) => card.code)).toEqual(["141024", "141023", "141022"]);
    expect(shown.cards[1]).toMatchObject({ title: "Stage 2B", role: "Earlier stage" });
    expect(shown.cards[2]).toMatchObject({ title: "Stage 1B", detail: "name 141022", role: "Earlier stage", picture: "141022.B" });
  });

  it("lists them after an attachment on the stage", () => {
    const table = buildTable(base, { stage: "141024", attached: [{ code: "141017", host: "141024" }] });
    const shown = previewCards(table.state, table.ctx, table.state.questStage!, describeCode, (id) => id);
    expect(shown.cards.map((card) => card.role ?? null)).toEqual([null, "Attachment", "Earlier stage", "Earlier stage"]);
  });

  it("titles a deck-ordered quest's stage 2 cards by the stage number they hold, newest first", () => {
    const table = voyageTable(voyage, { stage: "11020" });
    const id = (code: string) => Object.values(table.state.cards).find((card) => card.code === code)!.id;
    const state = { ...table.state, setAside: ["11016", "11019", "11017", "11018"].map(id) };
    const shown = previewCards(state, table.ctx, state.questStage!, describeCode, (card) => card);
    expect(shown.cards.slice(1).map((card) => [card.code, card.title])).toEqual([["11018", "Stage 2B"], ["11017", "Stage 2B"], ["11019", "Stage 2B"], ["11016", "Stage 1B"]]);
  });

  it("adds nothing to the preview of another card", () => {
    const table = buildTable(base, { stage: "141024", staging: ["f0"] });
    const shown = previewCards(table.state, table.ctx, idsOf(table, "f0"), describeCode, (id) => id);
    expect(shown.cards.some((card) => card.role === "Earlier stage")).toBe(false);
  });
});
