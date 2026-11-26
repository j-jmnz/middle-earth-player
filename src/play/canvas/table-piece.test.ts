// Which cards of a crowded table draw again (docs/architecture.md, Performance): a card whose props are equal is skipped by TablePiece, so the
// comparison must say "different" for exactly the cards a change touched, and "same" for the rest, though layout and `slotNumbers` make
// new objects for every card on every state.
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../rules/core/state.ts";
import type { SlotNumbers } from "../cards/card-effects.ts";
import type { Clock } from "../motion/card-motion.native.tsx";
import type { BackImages, Fonts, TokenImages } from "./pieces.native.tsx";
import { crowdedTable } from "../layout/crowded-table.ts";
import { tableLayout, type CardSlot, type LayoutViews } from "../layout/layout.ts";
import { AT_REST, type Motion } from "../motion/motion.ts";
import { NO_HIGHLIGHT } from "../store/peek.ts";
import { pieceProps, sameNumbers, samePiece, sameSlot, type PieceContext } from "./table-piece.ts";
import type { TableHighlight } from "./table-canvas-types.ts";
import { tableTokens } from "../../ui/tokens.ts";

// The shared images and fonts are native objects the comparison only ever holds by identity.
const fonts = { names: {}, numbers: {}, small: {}, badge: {} } as unknown as Fonts;
const backs: BackImages = { player: null, encounter: null };
const tokens: TokenImages = { resource: null, damage: null, progress: null, questPoints: null, engagementCost: null };
const clockOf = (at: number) => ({ progress: {}, epoch: {}, at, k: 1, span: 400 }) as unknown as Clock;
const game = {} as ScenarioState;

const numbersOf = (willpower: number | null): SlotNumbers => ({ effects: { stats: [], flags: [] }, willpower, commitStat: "willpower", questPoints: null, stageLoses: false, engagement: null, delayed: false, under: null, fire: null, loss: null, place: null, side: null, determined: null, dead: null, combat: null });

type Change = { highlight?: TableHighlight; liftedId?: string | null; motions?: ReadonlyMap<string, Motion>; clock?: Clock; willpowerOf?: (id: string) => number | null };

function contextOf(change: Change = {}): PieceContext {
  const willpowerOf = change.willpowerOf ?? (() => null);
  return {
    stageMarks: null,
    highlight: change.highlight ?? NO_HIGHLIGHT,
    targetIds: new Set(),
    looking: false,
    peeking: false,
    beating: new Set(),
    liftedId: change.liftedId ?? null,
    motions: change.motions ?? new Map(),
    clock: change.clock ?? clockOf(1),
    images: new Map(),
    game,
    seat: 0,
    owner: null,
    contrast: false,
    nameOf: (key) => key,
    sphereOf: () => null,
    inactive: () => false,
    // A new object for every call, as slotNumbers makes one for every card on every state.
    info: (_game, _seat, id) => numbersOf(willpowerOf(id)),
    fonts,
    backs,
    tokens,
    t: tableTokens,
    s: 1,
  };
}

function laidOut(views: LayoutViews, piles: ReturnType<typeof crowdedTable>["piles"], keep: ReadonlySet<string> = new Set()) {
  return tableLayout(760, 700, views, piles, { keep });
}

// The ids whose props differ between two renders of the same cards. The crowded table's paired characters share ids with cards in play, so the
// slots are paired by their place in the layout, which is the same order for the same cards.
function changed(before: readonly CardSlot[], beforeContext: PieceContext, after: readonly CardSlot[], afterContext: PieceContext): string[] {
  expect(after.map((slot) => `${slot.kind}:${slot.id}`)).toEqual(before.map((slot) => `${slot.kind}:${slot.id}`));
  return after.flatMap((slot, at) => (samePiece(pieceProps(before[at] as CardSlot, beforeContext), pieceProps(slot, afterContext)) ? [] : [slot.id]));
}

describe("samePiece on a crowded table", () => {
  const { views, piles } = crowdedTable();
  const before = laidOut(views, piles);

  it("has cards to compare: the table is crowded and a new layout makes new slot objects", () => {
    const after = laidOut(views, piles);
    expect(before.slots.length).toBeGreaterThan(30);
    expect(after.slots[0]).not.toBe(before.slots[0]);
    expect(after.slots.every((slot, at) => sameSlot(slot, before.slots[at] as CardSlot))).toBe(true);
    expect(changed(before.slots, contextOf(), after.slots, contextOf())).toEqual([]);
  });

  it("picking up one card redraws that card only", () => {
    const picked = "p4";
    const highlight: TableHighlight = { ...NO_HIGHLIGHT, picked: new Map([[picked, 1]]) };
    const after = laidOut(views, piles, new Set([picked]));
    expect(changed(before.slots, contextOf(), after.slots, contextOf({ highlight, liftedId: picked }))).toEqual([picked]);
  });

  it("a damage token on one card redraws that card only", () => {
    const hurt: LayoutViews = {
      ...views,
      play: { ...views.play, entries: views.play.entries.map((entry) => (entry.card.id === "p5" ? { ...entry, card: { ...entry.card, damage: 2 } } : entry)) },
    };
    const after = laidOut(hurt, piles);
    expect(changed(before.slots, contextOf(), after.slots, contextOf())).toEqual(["p5"]);
  });

  it("a new clock redraws the cards that move, and not the ones at rest", () => {
    const moving: Motion = { ...AT_REST, dx: 40, flip: true };
    const motions = new Map([["p6", moving]]);
    const first = clockOf(1);
    const still = changed(before.slots, contextOf({ clock: clockOf(1) }), before.slots, contextOf({ clock: clockOf(2) }));
    expect(still).toEqual([]);
    expect(changed(before.slots, contextOf({ motions, clock: clockOf(1) }), before.slots, contextOf({ motions, clock: clockOf(2) }))).toEqual(["p6"]);
    // The same clock and the same motion, in a new object: nothing to redraw.
    expect(changed(before.slots, contextOf({ motions, clock: first }), before.slots, contextOf({ motions: new Map([["p6", { ...moving }]]), clock: first }))).toEqual([]);
  });

  it("a card that starts to move, or stops, is redrawn", () => {
    const motions = new Map([["p6", { ...AT_REST, dy: -12 }]]);
    expect(changed(before.slots, contextOf(), before.slots, contextOf({ motions }))).toEqual(["p6"]);
    expect(changed(before.slots, contextOf({ motions }), before.slots, contextOf())).toEqual(["p6"]);
  });

  it("new numbers with the same contents redraw nothing, and different contents redraw their card", () => {
    const same = changed(before.slots, contextOf({ willpowerOf: () => 2 }), before.slots, contextOf({ willpowerOf: () => 2 }));
    expect(same).toEqual([]);
    const more = changed(before.slots, contextOf({ willpowerOf: () => 2 }), before.slots, contextOf({ willpowerOf: (id) => (id === "p5" ? 3 : 2) }));
    expect(more).toEqual(["p5"]);
  });
});

describe("samePiece on the Stormcaller's stage", () => {
  const { views, piles } = crowdedTable();
  const slot = { ...(laidOut(views, piles).slots[0] as CardSlot), stormcaller: "stage" as const };
  const marks = (text: string, apart: boolean) => ({ ...contextOf(), stageMarks: { pill: { text, short: text, danger: text.includes("/") }, apart } });

  it("carries its marks only on the stage, and redraws it when the number or the Apart plate changes", () => {
    expect(pieceProps({ ...slot, stormcaller: undefined }, marks("3", true)).stageMarks).toBeNull();
    expect(samePiece(pieceProps(slot, marks("3", true)), pieceProps({ ...slot }, marks("3", true)))).toBe(true);
    expect(samePiece(pieceProps(slot, marks("3", true)), pieceProps(slot, marks("4/4", true)))).toBe(false);
    expect(samePiece(pieceProps(slot, marks("3", true)), pieceProps(slot, marks("3", false)))).toBe(false);
  });

  it("veils a card of the area while the players are at another stage", () => {
    expect(pieceProps({ ...slot, stormcaller: "apart" }, contextOf()).veiledHand).toBe(true);
  });
});

describe("sameNumbers", () => {
  it("compares the contents of the effects, the engagement and the marks", () => {
    const badge = { stat: "attack" as const, icon: "attack" as const, word: "Attack", value: 3, delta: 1, lasting: false, floored: false };
    const a: SlotNumbers = { ...numbersOf(2), effects: { stats: [badge], flags: [] }, engagement: { cost: 30, engages: false }, under: { text: "2/5", loses: false, speech: "2 under, lose at 5" } };
    const b: SlotNumbers = { ...numbersOf(2), effects: { stats: [{ ...badge }], flags: [] }, engagement: { cost: 30, engages: false }, under: { text: "2/5", loses: false, speech: "2 under, lose at 5" } };
    expect(sameNumbers(a, b)).toBe(true);
    expect(sameNumbers(a, { ...b, engagement: { cost: 30, engages: true } })).toBe(false);
    expect(sameNumbers(a, { ...b, effects: { stats: [{ ...badge, value: 4 }], flags: [] } })).toBe(false);
    expect(sameNumbers(a, { ...b, delayed: true })).toBe(false);
    expect(sameNumbers(a, null)).toBe(false);
    expect(sameNumbers(null, null)).toBe(true);
  });
});
