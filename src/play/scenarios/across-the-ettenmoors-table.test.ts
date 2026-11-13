// Rules: mec108.safe, mec108.objective-locations, mec108.campaign-setup-across-the-ettenmoors, mec108.side-quests-in-play, rr.guarded, rr.first-player (data/rules/entries.json); ledger lines 10068:A:1, 10070:A:1, 10077:A:2, 10080:A:1, 10182:A:3, 10183:A:2.
// What the table says of Across the Ettenmoors' pieces: the Losing Time clock on the campaign card (resources against 3, the copies set aside and what happens at 3, said true when none remain), a safe location and what it does while it is the active location, the treachery whose When Revealed it
// ignores, a guard drawn over the objective it guards wherever it was staged, No Rest on a hero, and the owner named on each row of a pick that spans seats. The engine decided each; nothing here changes one. No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { guardWith } from "../../rules/families/objectives/guard.ts";
import { crowdedTable } from "../layout/crowded-table.ts";
import { tableLayout } from "../layout/layout.ts";
import { finish, idOf, legalIntents, resolveRecords, revealFromTop, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { angmarDetail } from "../cards/angmar-preview.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { PickSheet, SheetNames } from "../choice/sheet-types.ts";
import { ettenmoorsDials, ignoredRevealNote } from "../readouts/ettenmoors.ts";
import { scenarioDials } from "../readouts/scenario-dials.ts";

const ID = "across-the-ettenmoors";
const at = (layout: Layout = {}) => tableFromLayout(ID, { stage: "10064", phase: "Quest", ...layout });
const nameOf = (state: ScenarioState) => (id: string) => (state.cards[id]?.code ?? id).replace(/^10068$/, "Secluded Cave").replace(/^10069$/, "The Hoarwell").replace(/^10081$/, "Lie Low").replace(/^10077$/, "Troll-fells").replace(/^10079$/, "Arador's Bane").replace(/^10080$/, "No Rest");
const codeName = (code: string) => ({ "10182": "Across the Ettenmoors", "10068": "Secluded Cave" })[code] ?? code;
const losing = (state: ScenarioState) => ettenmoorsDials(state, codeName)[0];
const setResources = (state: ScenarioState, resources: number): ScenarioState => updateCard(state, idOf(state, "10182"), { resources });

describe("the Losing Time clock on the campaign card", () => {
  const FIVE = ["10183", "10183", "10183", "10183", "10183"];

  it("10182:A:3 shows the resources against 3, warms at 2 while a Losing Time is set aside and says what the quest phase does", () => {
    const t = at({ campaign: true, setAside: FIVE });
    const dial = (resources: number) => losing(setResources(t.state, resources));
    expect(dial(0)).toMatchObject({ value: 0, limit: 3, warms: true, label: "Losing Time", testID: "angmar-losing" });
    expect(dial(0)?.warn).toBeUndefined();
    expect(dial(1)?.warn).toBeUndefined();
    expect(dial(0)?.note).toBe("0 of 3 resources on the campaign card. Each quest phase adds 1. At 3, they come off and a Losing Time is revealed. 5 copies are set aside.");
    expect(dial(2)?.warn).toEqual({ level: "near", words: "The next quest phase reveals a Losing Time: each player raises their threat by 3 or exhausts a hero. 5 copies are set aside." });
    expect(scenarioDials(setResources(t.state, 2), t.ctx, codeName).some((one) => one.id === "losing")).toBe(true);
  });

  it("10182:A:3 says the right number of copies set aside, one copy in the singular", () => {
    const t = at({ campaign: true, setAside: ["10183"] });
    expect(losing(setResources(t.state, 2))?.note).toContain("1 copy is set aside.");
    expect(losing(setResources(t.state, 2))?.warn?.words).toContain("1 copy is set aside.");
  });

  it("10182:A:3 says nothing more is revealed once no Losing Time is set aside: no warning, the resources stay", () => {
    const t = at({ campaign: true, setAside: [] });
    for (const resources of [2, 3]) {
      const dial = losing(setResources(t.state, resources));
      expect(dial?.warn).toBeUndefined();
      expect(dial?.limitWords).toBe("no copy is set aside");
      expect(dial?.note).toBe(`${resources} resources on the campaign card. No Losing Time is set aside, so nothing more is revealed.`);
    }
  });

  it("10182:A:3 is drawn only in a campaign game: a standalone game has no campaign card and no clock", () => {
    expect(losing(at({ campaign: false }).state)).toBeUndefined();
  });

  it("10182:A:3 says the same clock in the campaign card's preview", () => {
    const t = at({ campaign: true, setAside: FIVE });
    expect(angmarDetail(t.state, t.ctx, idOf(t.state, "10182"), nameOf(t.state))).toBe(losing(t.state)?.note);
  });
});

describe("a safe location on the table", () => {
  it("10068:A:1 names what the active safe location does, and what travelling to a staged one does", () => {
    const active = at({ active: "10068", staging: ["10081", "10069"] });
    const detail = (state: ScenarioState, code: string) => angmarDetail(state, active.ctx, idOf(state, code), nameOf(state));
    expect(detail(active.state, "10068")).toBe("Safe. While it is the active location, enemies make no engagement checks. The When Revealed effects of treacheries are ignored. The text of encounter side quests is blank. It goes to the victory display at the end of the quest phase.");
    expect(detail(active.state, "10069")).toBe("Safe. When the players travel here, every engaged enemy returns to the staging area.");
    expect(detail(active.state, "10081")).toBe("Its text box is blank while Secluded Cave is the active location: its Forced, Response and constant effects do nothing.");
    const staged = at({ staging: ["10081", "10068"] });
    expect(angmarDetail(staged.state, staged.ctx, idOf(staged.state, "10081"), nameOf(staged.state))).toBeNull();
  });

  it("10068:A:1 announces a treachery whose When Revealed effects are ignored, and only while a safe location is active", () => {
    const quiet = at({ active: "10068", deck: ["f0"] });
    const run = revealFromTop(quiet.state, quiet.ctx, "10079", []);
    expect(ignoredRevealNote(run.state, run.id, nameOf(run.state))).toBe("Arador's Bane: its When Revealed effects are ignored while Secluded Cave is the active location.");
    const loud = at({ staging: ["10068"], deck: ["10073"] });
    const revealed = finish({ state: revealFromTop(loud.state, loud.ctx, "10079", []).state, steps: [] }, loud.ctx);
    expect(ignoredRevealNote(revealed.state, idOf(revealed.state, "10079"), nameOf(revealed.state))).toBeNull();
  });
});

describe("a guard over the objective it guards", () => {
  it("10077:A:2 says what guards a safe location and what the guard holds, in the previews of both", () => {
    const t = at({ staging: ["10068", "10077"] });
    const guarded = guardWith(t.state, idOf(t.state, "10077"), idOf(t.state, "10068"));
    const detail = (code: string) => angmarDetail(guarded, t.ctx, idOf(guarded, code), nameOf(guarded));
    expect(detail("10068")).toContain("Guarded by Troll-fells. The players cannot travel here until Troll-fells leaves play.");
    expect(detail("10077")).toBe("It guards Secluded Cave. When it leaves play, Secluded Cave returns to the staging area and the players may travel to it.");
  });

  it("10077:A:2 lays a guard over its objective in the staging row whichever was staged first (Troll-fells is staged before the location it searches for)", () => {
    const { views, piles } = crowdedTable();
    const [first, second] = views.staging.entries;
    const guard = { ...first!, card: { ...first!.card, guard: true as const, host: second!.card.id } };
    const host = { ...second!, card: { ...second!.card, guard: undefined } };
    const rest = views.staging.entries.slice(2);
    for (const order of [[guard, host, ...rest], [host, guard, ...rest]]) {
      const layout = tableLayout(591, 338, { ...views, staging: { ...views.staging, entries: order } }, piles, {});
      const over = layout.slots.find((slot) => slot.id === guard.card.id);
      const under = layout.slots.find((slot) => slot.id === host.card.id);
      expect(over?.x).toBeGreaterThan(under?.x ?? 0);
      expect(over?.x).toBeLessThan((under?.x ?? 0) + (under?.w ?? 0));
    }
  });
});

describe("No Rest on a hero", () => {
  it("10080:A:1 says what No Rest does on the hero that carries it and on the card itself", () => {
    const t = at({ phase: "Refresh" });
    const tired = updateCard(t.state, t.hero2, { exhausted: true });
    const run = resolveRecords(tired, t.ctx, "10080", "whenRevealed");
    const state = run.state;
    const rest = idOf(state, "10080");
    const detail = (id: string) => angmarDetail(state, t.ctx, id, (card) => (state.cards[card]?.code === "10080" ? "No Rest" : "Aragorn"));
    expect(state.cards[rest]?.host).toBe(t.hero2);
    expect(detail(rest)).toBe("On Aragorn: it cannot ready and collects no resources in the resource phase. It is discarded when the players travel to a safe location.");
    expect(detail(t.hero2)).toBe("No Rest: it cannot ready and collects no resources. No Rest is discarded when the players travel to a safe location.");
  });
});

describe("a pick that spans seats names the owner on each row", () => {
  it("10080:A:1 offers the first player each exhausted hero, any player's, each row naming whose it is", () => {
    const t = at({ seats: 2, phase: "Refresh", deck: ["10080"] });
    const seat1 = t.state.seats[1]?.heroes[0] ?? "";
    const tired = updateCard(updateCard(t.state, t.hero, { exhausted: true }), seat1, { exhausted: true });
    // The scenario's games hold the side quest rules (the golden's opening checks it): the rows of a pick that spans seats read as they do in the earlier Angmar scenarios.
    const run = revealFromTop({ ...tired, sideQuests: true }, t.ctx, "10080", []);
    const names: SheetNames = { card: (id) => (run.state.cards[id]?.code === "10080" ? "No Rest" : `Hero ${id}`), line: () => null };
    const sheet = sheetFor(run.state, t.ctx, legalIntents(run.state, t.ctx), names) as PickSheet | null;
    expect((sheet?.options ?? []).map((option) => option.label)).toEqual([`Hero ${t.hero} · Player 1's hero`, `Hero ${seat1} · Player 2's hero`]);
  });
});
