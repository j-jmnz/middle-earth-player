// Rules: rr.guarded, rr.in-play-and-out-of-play, rr.attachment-cards (data/rules/entries.json); ledger lines 01123:A:1, 01123:B:1, 01131:A:3,
// 01105:A:1. What the table draws for Escape from Dol Guldur: a guard beside the objective it guards, the facedown prisoner with Mendor under it in
// its player's play area, and Iron Shackles under the deck. The engine decides all of it; nothing here changes a card.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import { reduce, startScenario, type ScenarioState } from "../rules/reduce.ts";
import { prisonerHero } from "../rules/families/prisoner.ts";
import { dolGuldurStart, dolGuldurWorld } from "../../scripts/dol-guldur-game.ts";
import { dolGuldurTable, loadDolGuldurWorld, type DolGuldurWorld } from "../../scripts/dol-guldur-scene.ts";
import { first } from "../../scripts/past-scene.ts";

import { tableLayout } from "./layout.ts";
import { PILES, TABLE_ZONES, pileSelector, zoneSelector, type PileId, type PileView, type ZoneId, type ZoneView } from "./selectors.ts";

let scene: DolGuldurWorld;

beforeAll(async () => {
  scene = await loadDolGuldurWorld();
});

const views = (state: ScenarioState, seat = 0): Record<ZoneId, ZoneView> => Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, seat)(state)])) as Record<ZoneId, ZoneView>;
const piles = (state: ScenarioState, seat = 0): Record<PileId, PileView> => Object.fromEntries(PILES.map((pile) => [pile, pileSelector(pile, seat)(state)])) as Record<PileId, PileView>;

async function started(seatCount: 1 | 2, seed: number) {
  const { ctx } = await dolGuldurWorld();
  let state = startScenario(dolGuldurStart(seatCount, seed, "Normal", { prisoner: "q1", usedOnce: [], counters: {} }), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 6 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

describe("a guarded objective in the staging area", () => {
  it("is followed by the encounter card that guards it, which is not drawn under it", () => {
    const made = dolGuldurTable(scene, { guarded: [["01108", "f3"], ["01109", ""], ["01110", "place"]] });
    const entries = zoneSelector("staging", 0)(made.state).entries;
    expect(entries.map((entry) => entry.card.code)).toEqual(["01108", "f3", "01109", "01110", "place"]);
    // The staging area also holds it as its own card: the objective draws nothing under it for its guard.
    expect(entries[0]?.attached).toEqual([]);
    const ids = entries.map((entry) => entry.card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is unchanged for a game with no guard", () => {
    const made = dolGuldurTable(scene, { staging: ["f3", "place"] });
    expect(zoneSelector("staging", 0)(made.state).entries.map((entry) => entry.card.code)).toEqual(["f3", "place"]);
  });

  it("is drawn once on the table of a game dealt through the checklist, each guard beside its objective", async () => {
    const state = await started(1, 3);
    const entries = zoneSelector("staging", 0)(state).entries.map((entry) => entry.card);
    for (const objective of entries.filter((card) => ["01108", "01109", "01110"].includes(card.code))) {
      const at = entries.indexOf(objective);
      for (const id of objective.attachments) expect(entries[at + 1 + objective.attachments.indexOf(id)]?.id, objective.code).toBe(id);
    }
  });
});

describe("the prisoner", () => {
  it("is a facedown card in its player's play area, with Mendor facedown under it, and none in another seat's", async () => {
    const state = await started(2, 3);
    const prisoner = prisonerHero(state);
    expect(prisoner).not.toBeNull();
    const owner = state.cards[prisoner ?? ""]?.owner ?? 0;
    const mine = zoneSelector("play", owner)(state).entries.find((entry) => entry.card.id === prisoner);
    expect(mine?.card.face).toBe("down");
    expect(mine?.card.prisoner).toBe(true);
    expect(mine?.attached.map((card) => card.code)).toContain("01135");
    expect(mine?.attached.find((card) => card.code === "01135")?.face).toBe("down");
    expect(zoneSelector("play", 1 - owner)(state).entries.some((entry) => entry.card.id === prisoner)).toBe(false);
    // The table draws it: a slot for the prisoner and one under it for Mendor, both facedown.
    const layout = tableLayout(800, 380, views(state, owner), piles(state, owner));
    const slots = layout.slots.filter((slot) => slot.id === prisoner || slot.id === mine?.attached.find((card) => card.code === "01135")?.id);
    expect(slots.map((slot) => slot.faceDown)).toEqual([true, true]);
  });

  it("is gone from the table once it is rescued", async () => {
    const state = await started(1, 3);
    const prisoner = prisonerHero(state) ?? "";
    const hero = state.cards[prisoner];
    const freed = { ...state, cards: { ...state.cards, [prisoner]: { ...hero!, zone: "heroes" as const, face: "up" as const, prisoner: undefined, owner: undefined, controller: 0 } }, seats: [{ ...state.seats[0], heroes: [...state.seats[0].heroes, prisoner] }, state.seats[1]] as ScenarioState["seats"] };
    const entry = zoneSelector("play", 0)(freed).entries.find((item) => item.card.id === prisoner);
    expect(entry?.card.face).toBe("up");
  });
});

describe("Iron Shackles on a deck", () => {
  it("is drawn under that player's deck", () => {
    const made = dolGuldurTable(scene, { deckOf: ["filler", "filler"], staging: ["01105"] });
    const id = first(made.state, "01105");
    const attached = { ...made.state, staging: [], cards: { ...made.state.cards, [id]: { ...made.state.cards[id]!, zone: "attached" as const } }, seats: [{ ...made.state.seats[0], deckAttached: [id] }, made.state.seats[1]] as ScenarioState["seats"] };
    const deck = pileSelector("deck", 0)(attached);
    expect(deck.attached?.map((card) => card.code)).toEqual(["01105"]);
    expect(pileSelector("deck", 1)(attached).attached).toEqual([]);
    expect(pileSelector("discard", 0)(attached).attached).toEqual([]);
    const layout = tableLayout(800, 380, views(attached), piles(attached));
    const slot = layout.slots.find((item) => item.id === id);
    const deckSlot = layout.slots.find((item) => item.id === "pile:deck");
    expect(slot?.kind).toBe("attachment");
    expect(slot && deckSlot && slot.y > deckSlot.y).toBe(true);
    // The shackles are listed before the deck, so the deck is drawn over them.
    expect(layout.slots.indexOf(slot!)).toBeLessThan(layout.slots.indexOf(deckSlot!));
  });
});
