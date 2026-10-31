// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages (data/rules/entries.json). The Stormcaller's area on the phone table (docs/design-system-table.md, Cards, "The Stormcaller's area"): its group heads
// staging only in its scenario, the night veil is on while the players are at another stage, the reader labels, the fold, the pop, and the geometry on every screen down to 667 x 375 at the three UI scales.
import { beforeAll, describe, expect, it } from "vitest";

import { settle } from "../rules/machine.ts";
import type { ScenarioState } from "../rules/state.ts";
import { CODES, flightTable, loadFlightWorld, type FlightLayout, type FlightWorld } from "../../scripts/stormcaller-scene.ts";

import { hitBounds, shownBounds, slotBounds, tableLayout, type CardSlot, type LayoutViews, type PileViews, type Rect, type TableLayout } from "./layout.ts";
import { motionsBetween } from "./motion.ts";
import { pileSpeech } from "./pile-speech.ts";
import { pictureKey } from "./picture-key.ts";
import { PILES, TABLE_ZONES, pileSelector, secondPilesOf, zoneSelector } from "./selectors.ts";
import { seaFixture, seaViews } from "./sea-fixture.ts";
import { stagingRank } from "./row-fold.ts";
import { stripText } from "./table-canvas-views.ts";
import { areaFacts, areaGroup, areaRoleOf, areaSpeech } from "./stormcaller-table.ts";
import { AREA_FOLD_WHERE, AREA_FOLD_WORD, memberSpeech, stageLabel, stageSpeech } from "./stormcaller-words.ts";
import { UI_SCALES, touch } from "./ui-scale.ts";
import { zoneFactsOf } from "./zone-facts.ts";

let world: FlightWorld;

beforeAll(async () => {
  world = await loadFlightWorld();
});

// The table of a layout, settled as the engine leaves it (the area's cards move to the staging area when the players reach the Stormcaller's stage), and its views for seat 0.
function table(layout: FlightLayout = {}): { state: ScenarioState; views: LayoutViews; piles: PileViews; names: (id: string) => string; caller: string; callerStage: string } {
  const made = flightTable(world, layout);
  const state = settle(made.state, made.ctx, []);
  const facts = zoneFactsOf(made.ctx.cards);
  const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, 0, facts)(state)])) as unknown as LayoutViews;
  const piles = Object.fromEntries([...PILES, ...secondPilesOf(state)].map((pile) => [pile, pileSelector(pile, 0)(state)])) as unknown as PileViews;
  const names = (id: string) => world.cards.get(state.cards[id]?.code ?? "")?.name ?? id;
  return { state, views, piles, names, caller: made.caller, callerStage: made.callerStage };
}

const APART: FlightLayout = { area: [CODES.escort, CODES.coastland], staging: [CODES.raider] };
const TOGETHER: FlightLayout = { ...APART, stage: "12013" };

const areaSlots = (layout: TableLayout): CardSlot[] => layout.slots.filter((slot) => slot.stormcaller != null);

describe("the area's group heads staging in its scenario only", () => {
  it("lists the Stormcaller's stage first and then the Stormcaller and its cards, before the rest of the staging area", () => {
    const { state, views, caller, callerStage } = table(APART);
    const order = views.staging.entries.map((entry) => entry.card.code);
    expect(views.staging.entries[0]?.card.id).toBe(callerStage);
    expect(views.staging.entries[1]?.card.id).toBe(caller);
    expect(order.slice(0, 4)).toEqual(["12016", CODES.stormcallerOriginal, CODES.escort, CODES.coastland]);
    expect(order.at(-1)).toBe(CODES.raider);
    expect(views.staging.entries.map((entry) => entry.area)).toEqual(["stage", "apart", "apart", "apart", undefined]);
    expect(areaGroup(state)).toHaveLength(4);
  });

  it("marks no entry and draws no area in a game with ships and no Stormcaller's area", () => {
    const fixture = seaFixture({ staging: 4, engaged: 2, heading: "Sun", ships: [{ code: "dream-chaser", seat: 0 }] });
    const { views, piles } = seaViews(fixture);
    expect(views.staging.entries.every((entry) => entry.area === undefined)).toBe(true);
    const layout = tableLayout(667, 300, views, piles, { stacks: true });
    expect(areaSlots(layout)).toEqual([]);
    expect(areaGroup(fixture.state)).toEqual([]);
    expect(areaFacts(fixture.state)).toBeNull();
  });

  it("keeps the stage's role whatever the players' stage, and a card's role follows where it stands", () => {
    const apart = table(APART);
    const together = table(TOGETHER);
    expect(areaRoleOf(apart.state, apart.callerStage)).toBe("stage");
    expect(areaRoleOf(apart.state, apart.caller)).toBe("apart");
    expect(areaRoleOf(together.state, together.callerStage)).toBe("stage");
    expect(areaRoleOf(together.state, together.caller)).toBe("together");
    expect(areaRoleOf(apart.state, "nobody")).toBeNull();
    // A card of the game outside the area has no role, in the staging area or not.
    const raider = Object.values(apart.state.cards).find((card) => card.code === CODES.raider)?.id ?? "";
    expect(areaRoleOf(apart.state, raider)).toBeNull();
  });
});

describe("the night veil and the stage's place", () => {
  const SIZE = { width: 640, height: 330 };

  it("veils the area's cards while the players are at another stage, and lifts the veil, in place, at the same stage", () => {
    const apart = table(APART);
    const together = table(TOGETHER);
    const before = tableLayout(SIZE.width, SIZE.height, apart.views, apart.piles, { stacks: true });
    const after = tableLayout(SIZE.width, SIZE.height, together.views, together.piles, { stacks: true });
    const veiled = (layout: TableLayout) => layout.slots.filter((slot) => slot.stormcaller === "apart").map((slot) => slot.id);
    expect(veiled(before)).toHaveLength(3);
    expect(veiled(after)).toEqual([]);
    expect(after.slots.filter((slot) => slot.stormcaller === "together")).toHaveLength(3);
    // Nothing jumps: the stage and each card of the area stand where they stood.
    const rect = (layout: TableLayout, code: string) => {
      const slot = layout.slots.find((candidate) => candidate.code === code && candidate.stormcaller != null);
      return slot ? { x: slot.x, y: slot.y, w: slot.w, h: slot.h } : null;
    };
    for (const code of [CODES.stormcallerOriginal, CODES.escort, CODES.coastland]) expect(rect(after, code), code).toEqual(rect(before, code));
  });

  it("draws the stage sideways at a staging card's sideways footprint, the first group of the row, with its cards stepped over its right part", () => {
    const { views, piles } = table(APART);
    const layout = tableLayout(SIZE.width, SIZE.height, views, piles, { stacks: true });
    const stage = layout.slots.find((slot) => slot.stormcaller === "stage") as CardSlot;
    const members = layout.slots.filter((slot) => slot.stormcaller === "apart").sort((a, b) => a.x - b.x);
    expect(stage.landscape).toBe(true);
    expect(stage.w).toBe(layout.card.h);
    expect(stage.h).toBe(layout.card.w);
    // The first group: it stands at the staging row's left end, level with the row.
    expect(stage.x).toBeCloseTo(layout.zones.staging.x, 5);
    expect(Math.abs(stage.y + stage.h / 2 - (layout.zones.staging.y + layout.card.h / 2))).toBeLessThanOrEqual(0.5);
    // The Stormcaller first, over the stage's right part, each next one a guarded pair's step further.
    expect(members[0]?.code).toBe(CODES.stormcallerOriginal);
    expect(members[0]?.x).toBeGreaterThan(stage.x);
    expect(members[0]?.x).toBeLessThan(stage.x + stage.w);
    expect((members[1]?.x ?? 0) - (members[0]?.x ?? 0)).toBeGreaterThanOrEqual(Math.floor(layout.card.w * 0.72));
    expect(stage.shown).toBeGreaterThanOrEqual(44);
    expect(shownBounds(stage).w).toBe(stage.shown);
    expect(shownBounds(members[0] as CardSlot)).toEqual(slotBounds(members[0] as CardSlot));
    // Slots are drawn in order: the stage under its cards.
    expect(layout.slots.indexOf(stage)).toBeLessThan(layout.slots.indexOf(members[0] as CardSlot));
  });

  it("shows the stage's picture on its D side, the Stormcaller's on its Campaign Mode only side, never a card's code alone", () => {
    const { views, piles, callerStage, caller } = table({ ...APART, campaignSide: true });
    const layout = tableLayout(SIZE.width, SIZE.height, views, piles, { stacks: true });
    expect(layout.slots.find((slot) => slot.id === callerStage)?.picture).toBe("12016.B");
    expect(layout.slots.find((slot) => slot.id === caller)?.picture).toBe(`${CODES.stormcaller}.B`);
  });

  it("ranks the group first to fold while its cards are out of the staging area, and as a guarded pair at the same stage", () => {
    const apart = table(APART);
    const together = table(TOGETHER);
    expect(stagingRank(apart.views.staging.entries.slice(0, 4))).toBe(0);
    expect(stagingRank(together.views.staging.entries.slice(0, 4))).toBe(2);
  });
});

describe("the strip and the stage advance", () => {
  it("gives the stage the quest strip's numbers: its progress against its quest points", () => {
    const made = flightTable(world, { ...APART, callerProgress: 3 });
    const state = settle(made.state, made.ctx, []);
    expect(state.cards[made.callerStage]?.progress).toBe(3);
    expect(world.cards.get("12016")?.questPoints).toBeGreaterThan(3);
  });

  it("sets the stage's strip close so it stays inside the part its cards leave, and every other strip as it was", () => {
    const stage = { progress: 12, stormcaller: "stage" } as CardSlot;
    expect(stripText(stage, 24)).toBe("12/24");
    expect(stripText({ progress: 12 } as CardSlot, 24)).toBe("12 / 24");
    expect(stripText({ progress: 2 } as CardSlot, 8, "P2")).toBe("P2 · 2 / 8");
    expect(stripText(stage, null)).toBeNull();
  });

  it("pops a new stage in where the last stood, and the last one leaves", () => {
    const first = table(APART);
    const next = table({ ...APART, caller: 3 });
    const before = tableLayout(640, 330, first.views, first.piles, { stacks: true });
    const after = tableLayout(640, 330, next.views, next.piles, { stacks: true });
    const run = motionsBetween(before, after, (id) => next.state.cards[id]?.zone ?? null);
    const stage = after.slots.find((slot) => slot.stormcaller === "stage") as CardSlot;
    expect(run.motions.get(stage.id)).toMatchObject({ land: "pop", fromOpacity: 0 });
    // The Stormcaller itself is a new card in this comparison of two tables, but a card that stands still does not pop.
    const still = motionsBetween(before, before, () => null);
    expect(still.motions.get(stage.id)?.land ?? null).toBeNull();
  });
});

describe("what a screen reader hears", () => {
  const nameOf = (names: (id: string) => string) => (card: { id: string }) => names(card.id);

  it("reads the stage's name, its number, its progress against its quest points, the cards of the area and that they are out of reach", () => {
    const { state, names, callerStage } = table({ ...APART, callerProgress: 3 });
    const label = areaSpeech(state, callerStage, nameOf(names), 8);
    expect(label).toBe(`The Stormcaller's quest stage 2, ${names(callerStage)}, progress 3 of 8. In the area: ${world.cards.get(CODES.stormcallerOriginal)?.name}, ${world.cards.get(CODES.escort)?.name}, ${world.cards.get(CODES.coastland)?.name}. Out of reach: the players are at another stage, so its cards are immune and not in the staging area`);
  });

  it("reads that the cards are reachable at the same stage, and tells each card of the area apart", () => {
    const { state, names, callerStage, caller } = table(TOGETHER);
    expect(areaSpeech(state, callerStage, nameOf(names), 8)).toContain("Reachable: the players are at the same stage, so its cards are in the staging area");
    expect(areaSpeech(state, caller, nameOf(names), null)).toBe(memberSpeech(names(caller), "together"));
    const apart = table(APART);
    expect(areaSpeech(apart.state, apart.caller, nameOf(apart.names), null)).toBe(`${apart.names(apart.caller)}, in the Stormcaller's area, out of reach`);
    expect(areaSpeech(apart.state, "nobody", nameOf(apart.names), null)).toBeNull();
  });

  it("says what a stage with no quest points or no cards in the area reads", () => {
    expect(stageSpeech({ name: "Cape", number: 4, progress: 2, points: null, together: false, names: [] })).toBe("The Stormcaller's quest stage 4, Cape, 2 progress. No cards in the area. Out of reach: the players are at another stage, so its cards are immune and not in the staging area");
  });

  it("tells the Stormcaller's stage from the players' stage that shares its name", () => {
    expect(stageLabel("Full Sail Ahead!")).toBe("The Stormcaller's stage: Full Sail Ahead!");
  });
});

// The table view's canvas: the screen less the command column (30% in logical points, 210 to 280) and, in the Quest phase, the quest scale (86 pt); under the bar (8 pt top and 52 pt).
function canvas(width: number, height: number, scale: number, quest: boolean): { width: number; height: number } {
  const command = Math.round(Math.min(280, Math.max(210, (width / scale) * 0.3)) * scale);
  return { width: Math.floor(width - command - (quest ? 86 * scale : 0)), height: Math.floor(height - (8 + 52) * scale) };
}

const contains = (outer: Rect, inner: Rect): boolean => inner.x >= outer.x - 0.5 && inner.y >= outer.y - 0.5 && inner.x + inner.w <= outer.x + outer.w + 0.5 && inner.y + inner.h <= outer.y + outer.h + 0.5;

describe("667 x 375 at the three scales", () => {
  for (const [name, scale] of Object.entries(UI_SCALES)) {
    for (const quest of [false, true]) {
      const at = `${name} (${scale})${quest ? " with the quest scale" : ""}`;
      const size = canvas(667, 375, scale, quest);

      it(`fits the group in the staging row, each card whole, with a target to touch on every card: ${at}`, () => {
        const { views, piles, state } = table(APART);
        // The moment asks about the Stormcaller (a pick), so the group stays on the table.
        const layout = tableLayout(size.width, size.height, views, piles, { scale, stacks: true, keep: new Set(areaGroup(state)) });
        const group = areaSlots(layout);
        expect(group).toHaveLength(4);
        const row: Rect = { x: layout.zones.staging.x, y: layout.zones.staging.y, w: layout.zones.staging.w, h: layout.card.h };
        for (const slot of group) expect(contains(row, slotBounds(slot)), `${slot.id} ${JSON.stringify(slotBounds(slot))} in ${JSON.stringify(row)}`).toBe(true);
        const target = touch(scale, 44);
        const sorted = [...group].sort((a, b) => a.x - b.x);
        // The stage shows at least a target before its first card, and each card at least a target before the next.
        // A row too narrow for the group steps its cards closer, to the row's edge and no further.
        const last = slotBounds(sorted.at(-1) as CardSlot);
        for (let index = 0; index + 1 < sorted.length; index += 1) {
          const visible = (sorted[index + 1]?.x ?? 0) - (sorted[index]?.x ?? 0);
          if (visible < target - 0.5) expect(last.x + last.w, `${sorted[index]?.id} steps closer only to fit`).toBeGreaterThanOrEqual(row.x + row.w - layout.card.w);
        }
        const stage = group.find((slot) => slot.stormcaller === "stage") as CardSlot;
        expect(shownBounds(stage).x + shownBounds(stage).w).toBeLessThanOrEqual((sorted[1]?.x ?? 0) + 0.5);
        // No tap target of the group is smaller than a touch.
        for (const slot of group) expect(hitBounds(slot).w).toBeGreaterThanOrEqual(Math.min(slotBounds(slot).w, target));
      });

      it(`folds the group first when staging is crowded, as one stack titled for the area: ${at}`, () => {
        const crowd: FlightLayout = { ...APART, staging: Array.from({ length: 9 }, (_, index) => (index % 2 === 0 ? CODES.raider : CODES.skiff)) };
        const { views, piles } = table(crowd);
        const layout = tableLayout(size.width, size.height, views, piles, { scale, stacks: true });
        const stack = layout.slots.find((slot) => slot.fold === "staging");
        expect(stack).toBeDefined();
        expect(layout.folds?.length).toBeGreaterThan(0);
        const folded = layout.folds?.find((fold) => fold.zone === "staging");
        const group = areaGroup(table(crowd).state);
        // The area's group is the first to go: its four cards are in the stack, and the stack says whose they are when only they are in it.
        for (const id of group) expect(folded?.cards, id).toContain(id);
        if (folded?.cards.length === group.length) {
          expect(folded.area).toBe(true);
          expect(stack?.areaFold).toBe(true);
          expect(pileSpeech(stack as CardSlot).label).toBe(`4 more cards in ${AREA_FOLD_WHERE}`);
        }
        // The shown groups keep a target between them, and no area card is drawn once folded.
        expect(areaSlots(layout).length === 0 || areaSlots(layout).length === group.length).toBe(true);
        expect(hitBounds(stack as CardSlot).w).toBeGreaterThanOrEqual(44);
      });

      it(`keeps the group on the table when the open moment asks about one of its cards: ${at}`, () => {
        const crowd: FlightLayout = { ...APART, staging: Array.from({ length: 9 }, (_, index) => (index % 2 === 0 ? CODES.raider : CODES.skiff)) };
        const { views, piles, caller } = table(crowd);
        const layout = tableLayout(size.width, size.height, views, piles, { scale, stacks: true, keep: new Set([caller]) });
        expect(areaSlots(layout)).toHaveLength(4);
        expect(layout.folds?.some((fold) => fold.cards.includes(caller))).toBe(false);
      });
    }
  }

  it("names the fold stack's word for the area and keeps it short enough for a pile 37 pt wide", () => {
    expect(AREA_FOLD_WORD).toBe("Area");
  });

  it("shows the Stormcaller's face on the stack, not its sideways stage", () => {
    const crowd: FlightLayout = { ...APART, campaignSide: true, staging: Array.from({ length: 9 }, () => CODES.raider) };
    const { views, piles } = table(crowd);
    const layout = tableLayout(444, 315, views, piles, { stacks: true });
    const stack = layout.slots.find((slot) => slot.fold === "staging") as CardSlot;
    expect(stack.code).toBe(CODES.stormcaller);
    expect(stack.picture).toBe(pictureKey({ code: CODES.stormcaller, face: "B" }));
  });
});
