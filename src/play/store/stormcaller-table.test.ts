// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages (data/rules/entries.json). The Stormcaller's area on the phone table (docs/design-system-table.md, Cards, "The Stormcaller's area"): its group heads
// staging only in its scenario, the night veil is on while the players are at another stage, the reader labels, the fold, the pop, and the geometry on every screen down to 667 x 375 at the three UI scales.
import { beforeAll, describe, expect, it } from "vitest";

import { settle } from "../../rules/engine/machine.ts";
import type { EngineStep } from "../../rules/core/intents.ts";
import { momentOf } from "./outcome.ts";
import { advanceFace, advanceWords, advancedTo, callerLastStage, questView } from "../readouts/quest-advance.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { areaOf } from "../../rules/families/stormcaller/zone.ts";
import { CODES, flightTable, loadFlightWorld, type FlightLayout, type FlightWorld } from "../../../test/scenarios/flight-of-the-stormcaller/scene.ts";

import { hitBounds, shownBounds, slotBounds, tableLayout, type CardSlot, type LayoutViews, type PileViews, type Rect, type TableLayout } from "../layout/layout.ts";
import { motionsBetween } from "../motion/motion.ts";
import { pileSpeech } from "../canvas/pile-speech.ts";
import { pictureKey } from "../canvas/picture-key.ts";
import { PILES, TABLE_ZONES, pileSelector, secondPilesOf, zoneSelector } from "./selectors.ts";
import { seaFixture, seaViews } from "../dream-chaser/sea-fixture.ts";
import { stagingRank } from "../layout/row-fold.ts";
import { stripText } from "../canvas/table-canvas-views.ts";
import { areaFacts, areaGroup, areaRoleOf, areaSpeech } from "./stormcaller-table.ts";
import { AREA_FOLD_WHERE, AREA_FOLD_WORD, memberSpeech, stageSpeech, stageTitle, stagePill, STAGE_LOSS } from "../words/stormcaller.ts";
import { UI_SCALES, touch } from "../../ui/ui-scale.ts";
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

  it("reads the stage's numbers, its name, the cards of the area and that they are out of reach", () => {
    const { state, names, callerStage } = table({ ...APART, callerProgress: 3 });
    const label = areaSpeech(state, callerStage, nameOf(names), 8);
    expect(label).toBe(`Stormcaller · stage 2 of 4 · 3/8, ${names(callerStage)}. In the area: ${world.cards.get(CODES.stormcallerOriginal)?.name}, ${world.cards.get(CODES.escort)?.name}, ${world.cards.get(CODES.coastland)?.name}. Out of reach: the players are at another stage, so its cards are immune and not in the staging area`);
  });

  it("reads that the cards are reachable at the same stage, and tells each card of the area apart", () => {
    const { state, names, callerStage, caller } = table(TOGETHER);
    expect(areaSpeech(state, callerStage, nameOf(names), 8)).toContain("Reachable: the players are at the same stage, so its cards are in the staging area");
    expect(areaSpeech(state, caller, nameOf(names), null)).toBe(memberSpeech(names(caller), "together"));
    const apart = table(APART);
    expect(areaSpeech(apart.state, apart.caller, nameOf(apart.names), null)).toBe(`${apart.names(apart.caller)}, in the Stormcaller's area, out of reach`);
    expect(areaSpeech(apart.state, "nobody", nameOf(apart.names), null)).toBeNull();
  });

  it("says what a stage with no quest points or no cards in the area reads, and that the last stage loses the game", () => {
    const last = { number: 4, last: 4, progress: 2, points: null, playersAt: 2, together: false };
    expect(stageSpeech({ ...last, name: "Cape", names: [] })).toBe(`Stormcaller · stage 4 of 4 · 2, Cape. No cards in the area. Out of reach: the players are at another stage, so its cards are immune and not in the staging area. ${STAGE_LOSS}`);
    expect(stageTitle({ ...last, number: 3, points: 18, progress: 12 })).toBe("Stormcaller · stage 3 of 4 · 12/18");
  });

  it("pills the stage with its number, and \"4/4\" in threat red at the last stage", () => {
    expect(stagePill({ number: 2, last: 4 })).toEqual({ text: "2", danger: false });
    expect(stagePill({ number: 3, last: 4 })).toEqual({ text: "3", danger: false });
    expect(stagePill({ number: 4, last: 4 })).toEqual({ text: "4/4", danger: true });
  });

  it("knows the last stage and the players' stage", () => {
    const apart = table({ ...APART, caller: 3 });
    expect(areaFacts(apart.state)).toMatchObject({ number: 3, last: 4, playersAt: 1, together: false });
  });
});

// The table view's canvas: the screen less its side insets, the command column (30% in logical points, 210 to 280) under the bar (8 pt top and 52 pt).
// 667 x 375 is a small phone; 844 x 390 has the notch and the home indicator (47 pt each side, 21 pt under).
const DEVICES = [
  { name: "667 x 375", width: 667, height: 375, side: 0, bottom: 0 },
  { name: "844 x 390 with insets", width: 844, height: 390, side: 47, bottom: 21 },
] as const;

function canvas(device: (typeof DEVICES)[number], scale: number): { width: number; height: number } {
  const command = Math.round(Math.min(280, Math.max(210, (device.width / scale) * 0.3)) * scale);
  return { width: Math.floor(device.width - 2 * device.side - command), height: Math.floor(device.height - (8 + 52) * scale) };
}

const contains = (outer: Rect, inner: Rect): boolean => inner.x >= outer.x - 0.5 && inner.y >= outer.y - 0.5 && inner.x + inner.w <= outer.x + outer.w + 0.5 && inner.y + inner.h <= outer.y + outer.h + 0.5;

// The widest stretch of `bounds` that no later slot of the table covers (cards and piles; a peek under a card is drawn before it).
function uncovered(layout: TableLayout, slot: CardSlot, bounds: Rect): number {
  const later = layout.slots.slice(layout.slots.indexOf(slot) + 1).filter((other) => (other.kind === "card" || other.kind === "pile") && other.zone !== "hand").map(slotBounds);
  const covers = later.filter((other) => other.y < bounds.y + bounds.h && other.y + other.h > bounds.y && other.x < bounds.x + bounds.w && other.x + other.w > bounds.x).sort((a, b) => a.x - b.x);
  let best = 0;
  let from = bounds.x;
  for (const cover of covers) {
    best = Math.max(best, cover.x - from);
    from = Math.max(from, cover.x + cover.w);
  }
  return Math.max(best, bounds.x + bounds.w - from);
}

const CROWD = (count: number): FlightLayout => ({ ...APART, staging: Array.from({ length: count }, (_, index) => (index % 2 === 0 ? CODES.raider : CODES.skiff)) });
const SCENES: Record<string, FlightLayout> = { plain: APART, "3 staging": CROWD(3), "5 staging": CROWD(5), "9 staging": CROWD(9) };

describe("every phone size and scale", () => {
  for (const device of DEVICES) {
    for (const [name, scale] of Object.entries(UI_SCALES)) {
      const at = `${device.name}, ${name} (${scale})`;
      const size = canvas(device, scale);
      const target = touch(scale, 44);
      const lay = (layout: FlightLayout, keep?: (made: ReturnType<typeof table>) => ReadonlySet<string>) => {
        const made = table(layout);
        return { made, layout: tableLayout(size.width, size.height, made.views, made.piles, { scale, stacks: true, bottomInset: device.bottom, ...(keep ? { keep: keep(made) } : {}) }) };
      };

      it(`shows every area card a strip of a target that no later slot covers, the stage never folded: ${at}`, () => {
        for (const [scene, layout] of Object.entries(SCENES)) {
          for (const keepCaller of [false, true]) {
            const run = lay(layout, keepCaller ? (made) => new Set([made.caller]) : undefined);
            const row: Rect = { x: run.layout.zones.staging.x, y: run.layout.zones.staging.y, w: run.layout.zones.staging.w, h: run.layout.card.h };
            const group = areaSlots(run.layout);
            const label = `${scene}${keepCaller ? " keeping the Stormcaller" : ""}`;
            // The stage always stands: it carries the Stormcaller's progress.
            const stage = group.find((slot) => slot.stormcaller === "stage");
            expect(stage, label).toBeDefined();
            expect(run.layout.folds?.some((fold) => fold.cards.includes(run.made.callerStage)), label).toBeFalsy();
            for (const slot of group) {
              expect(contains(row, slotBounds(slot)), `${label} ${slot.id} in the row`).toBe(true);
              const shown = slot.stormcaller === "stage" ? shownBounds(slot) : slotBounds(slot);
              expect(uncovered(run.layout, slot, shown), `${label} ${slot.id}`).toBeGreaterThanOrEqual(Math.min(shown.w, target) - 0.5);
              expect(hitBounds(slot).w).toBeGreaterThanOrEqual(Math.min(slotBounds(slot).w, target));
            }
            if (keepCaller) expect(group.some((slot) => slot.id === run.made.caller), label).toBe(true);
          }
        }
      });

      it(`folds only the area's cards first, as a stack that counts them and not the stage: ${at}`, () => {
        for (const [scene, layout] of Object.entries(SCENES)) {
          const { made, layout: laid } = lay(layout);
          const members = areaGroup(made.state).slice(1);
          const stack = laid.slots.find((slot) => slot.fold === "staging");
          const folded = laid.folds?.find((fold) => fold.zone === "staging");
          const standing = areaSlots(laid).filter((slot) => slot.stormcaller !== "stage").map((slot) => slot.id);
          // The area's cards stand or fold, all of them or none, and the stage stands either way.
          expect(members.filter((id) => standing.includes(id)).length === 0 || folded?.cards.every((id) => !members.includes(id)) !== false, scene).toBe(true);
          if (!folded) {
            expect(standing, scene).toHaveLength(members.length);
            continue;
          }
          expect(folded.cards, scene).not.toContain(made.callerStage);
          expect(stack?.count, scene).toBe(folded.cards.length);
          const foldedMembers = members.filter((id) => folded.cards.includes(id));
          // Other cards fold only after every card of the area has.
          if (folded.cards.some((id) => !members.includes(id))) expect(foldedMembers, scene).toHaveLength(members.length);
          else {
            expect(folded.area, scene).toBe(true);
            expect(stack?.areaFold, scene).toBe(true);
            expect(pileSpeech(stack as CardSlot).label, scene).toBe(`${folded.cards.length} more cards in ${AREA_FOLD_WHERE}`);
            expect(stack?.code, scene).toBe(made.state.cards[folded.top]?.code);
          }
          expect(hitBounds(stack as CardSlot).w, scene).toBeGreaterThanOrEqual(44);
        }
      });

      it(`keeps the cards the open moment asks about on the table: ${at}`, () => {
        const { made, layout } = lay(CROWD(9), (m) => new Set([m.caller]));
        expect(areaSlots(layout).some((slot) => slot.id === made.caller)).toBe(true);
        expect(layout.folds?.some((fold) => fold.cards.includes(made.caller))).toBeFalsy();
      });
    }
  }

  it("names the fold stack's word for the area and keeps it short enough for a pile 37 pt wide", () => {
    expect(AREA_FOLD_WORD).toBe("Area");
  });

  it("shows the Stormcaller's face on a stack of the area's cards alone, and the first other folded card's in a mixed stack", () => {
    const alone = table({ ...APART, campaignSide: true, staging: [CODES.raider, CODES.raider, CODES.raider] });
    const laidAlone = tableLayout(440, 315, alone.views, alone.piles, { stacks: true });
    const area = laidAlone.slots.find((slot) => slot.fold === "staging" && slot.areaFold) as CardSlot;
    expect(area.code).toBe(CODES.stormcaller);
    expect(area.picture).toBe(pictureKey({ code: CODES.stormcaller, face: "B" }));
    const mixed = table({ ...APART, campaignSide: true, staging: Array.from({ length: 9 }, () => CODES.raider) });
    const laidMixed = tableLayout(330, 315, mixed.views, mixed.piles, { stacks: true });
    const stack = laidMixed.slots.find((slot) => slot.fold === "staging") as CardSlot;
    expect(stack.areaFold).toBeUndefined();
    expect(stack.code).toBe(CODES.raider);
  });
});

describe("the Stormcaller's stage advance", () => {
  // The round ends with the Stormcaller's stage full: the engine advances it and says so in a step (stormcaller: true).
  function advanceFrom(layout: FlightLayout) {
    const made = flightTable(world, layout);
    const steps: EngineStep[] = [];
    const settled = settle({ ...made.state, phase: "Beginning of round", boundaryPhase: "End of round", mode: "beginRound", window: null }, made.ctx, steps);
    return { made, before: made.state, after: settled, steps };
  }
  const line = (id: string) => (id === "12017:A:1" ? "When Revealed: add a Sahír's Escort to the Stormcaller's area." : null);

  it("is a beat of the banner for stage 3, with the C side's When Revealed, and not the quest advance screen", () => {
    const run = advanceFrom({ caller: 2, callerProgress: 10, deck: ["f3"] });
    expect(run.steps.some((step) => step.kind === "advance" && step.stormcaller === true)).toBe(true);
    const names = { card: (id: string) => world.cards.get(run.after.cards[id]?.code ?? "")?.name ?? id, revealed: (id: string) => (run.after.cards[id]?.code === "12017" ? line("12017:A:1") : null) };
    const moment = momentOf(run.before, run.after, run.steps, names);
    expect(moment?.title).toBe("The Stormcaller advances");
    expect(moment?.lines.map((item) => item.text)).toEqual(expect.arrayContaining([`The Stormcaller advances to stage 3 of 4: ${world.cards.get("12017")?.name}`, "When Revealed: add a Sahír's Escort to the Stormcaller's area."]));
    const moments = { seq: 3, kind: "sent" as const, before: run.before, after: run.after, steps: run.steps };
    expect(advancedTo(moments, questView(run.after))).toBeNull();
  });

  it("opens the quest advance screen for stage 4, on the C side, saying the Stormcaller is at stage 4 of 4", () => {
    const run = advanceFrom({ caller: 3, callerProgress: 16, deck: ["f3"] });
    const stage = areaOf(run.after)?.stage ?? "";
    expect(callerLastStage(run.after)).toBe(stage);
    const reached = advancedTo({ seq: 5, kind: "sent", before: run.before, after: run.after, steps: run.steps }, questView(run.after));
    expect(reached).toEqual({ seq: 5, stageId: stage });
    expect(advanceFace(run.after, run.after.cards[stage]!)).toBe("up");
    const words = advanceWords(run.after, run.made.ctx, stage, "The Cape of Andrast", () => null);
    expect(words).toMatchObject({ eyebrow: "Stormcaller · Stage 4 of 4", title: "The Cape of Andrast", also: [] });
    expect(words.detail).toBe(`The Stormcaller is at stage 4 of 4. ${STAGE_LOSS}.`);
  });
});
