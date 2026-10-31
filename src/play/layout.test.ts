// The table's geometry at each UI scale (docs/plans/done/settings-theme-and-ui-scale.md, UI scale engine; user request, 2026-10-28): at Medium it is
// the table as it was; at Small and Large every card still fits the canvas, the hand keeps its 44 pt strip and its target, and the
// gutters and gaps are Medium's times the factor.
import { describe, expect, it } from "vitest";

import type { CardInstance } from "../rules/state.ts";

import { cardSize, handCardSize, hitBounds, MIN_TARGET, PLAY_FLOOR, slotBounds, tableLayout, type CardSlot, type LayoutViews, type PileViews, type Rect } from "./layout.ts";
import { PILES, TABLE_ZONES, type PileId, type PileView, type ZoneEntry, type ZoneId, type ZoneView } from "./selectors.ts";
import { HAND_TUCK } from "./play-area.ts";
import { ACROSS, DOWN, SLACK, shareOut, wrapRows } from "./table-spacing.ts";
import { touch, UI_SCALES } from "./ui-scale.ts";

const card = (id: string, zone: CardInstance["zone"], extra: Partial<CardInstance> = {}): CardInstance => ({
  id,
  code: `c${id}`,
  zone,
  exhausted: false,
  damage: 0,
  progress: 0,
  resources: 0,
  host: null,
  attachments: [],
  committed: false,
  shadowId: null,
  face: "up",
  controller: 0,
  enteredPlay: 0,
  ...extra,
});

const entry = (c: CardInstance, extra: Partial<ZoneEntry> = {}): ZoneEntry => ({ card: c, attached: [], paired: [], fight: null, ...extra });
const ids = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${i}`);

// A busy table: a quest stage, a location, five in staging, two enemies engaged (one with a character beside it and a shadow card under
// it), five allies and heroes in play (one exhausted), and a hand of `hand` cards.
function views(hand: number, crowd?: { engaged: number; play: number }): { views: LayoutViews; piles: PileViews } {
  const zones: Record<ZoneId, readonly ZoneEntry[]> = {
    questStage: [entry(card("q", "questStage"))],
    staging: ids("s", 5).map((id) => entry(card(id, "staging"))),
    activeLocation: [entry(card("l", "activeLocation"))],
    secondActiveLocation: [],
    engaged: [
      entry(card("e0", "engaged"), { attached: [card("sh", "shadow", { face: "down" })], paired: [card("p0", "play")], fight: "defense" }),
      ...ids("e", crowd?.engaged ?? 2).slice(1).map((id) => entry(card(id, "engaged"))),
    ],
    // One ally carries an attachment, so its row is a peek deeper.
    play: ids("p", crowd?.play ?? 5).map((id, i) => entry(card(id, "play", { exhausted: i === 1, committed: i === 2 }), i === 3 ? { attached: [card(`a${id}`, "play")] } : {})),
    hand: ids("h", hand).map((id) => entry(card(id, "hand"))),
  };
  const built = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, { zone, seat: 0, entries: zones[zone] } satisfies ZoneView])) as unknown as LayoutViews;
  const piles = Object.fromEntries(PILES.map((pile) => [pile, { pile, seat: 0, ids: ["x"], top: null } satisfies PileView])) as unknown as PileViews;
  return { views: built, piles };
}

// The canvas the table view leaves at 844x390 and 667x375 (the command column beside it, the 52 pt bar over it), and a small one.
const PHONES = [
  { width: 591, height: 338 },
  { width: 457, height: 323 },
  { width: 400, height: 300 },
];
// About what a tablet and a 12.9" tablet leave in landscape (docs/handover measurements, estimates until measured on a device).
const TABLETS = [
  { width: 760, height: 700 },
  { width: 980, height: 920 },
];
const CANVASES = [...PHONES, ...TABLETS];
const SCALES = [UI_SCALES.small, UI_SCALES.medium, UI_SCALES.large];

describe("the table's layout at a UI scale", () => {
  it("is the same table at scale 1 as with no scale", () => {
    for (const canvas of CANVASES) {
      const { views: v, piles } = views(7);
      const plain = tableLayout(canvas.width, canvas.height, v, piles, {});
      const medium = tableLayout(canvas.width, canvas.height, v, piles, { scale: 1 });
      expect(medium).toEqual(plain);
      expect(cardSize(canvas.width, canvas.height, 1)).toEqual(cardSize(canvas.width, canvas.height));
    }
  });

  it("keeps every card on the table inside the canvas at Small and Large", () => {
    for (const scale of SCALES) {
      for (const canvas of CANVASES) {
        for (const hand of [0, 1, 5, 9, 12]) {
          const { views: v, piles } = views(hand);
          const layout = tableLayout(canvas.width, canvas.height, v, piles, { scale });
          for (const slot of layout.slots) {
            const at = `${scale} ${canvas.width}x${canvas.height} hand ${hand} ${slot.zone} ${slot.id}`;
            const box = slotBounds(slot);
            expect(box.x, at).toBeGreaterThanOrEqual(0);
            expect(box.x + box.w, at).toBeLessThanOrEqual(canvas.width + 0.5);
            if (slot.zone === "hand") {
              // The hand peeks up from the bottom edge: its top is on the canvas.
              expect(slot.y, at).toBeLessThan(canvas.height);
              continue;
            }
            expect(box.y, at).toBeGreaterThanOrEqual(0);
            // Whatever is not in the hand stands above the hand's strip.
            expect(box.y + box.h, at).toBeLessThanOrEqual(canvas.height);
          }
          for (const id of ["encounterDeck", "encounterDiscard", "deck", "discard"] as const) {
            const rect = layout.piles[id];
            expect(rect.x, id).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.w, id).toBeLessThanOrEqual(canvas.width);
          }
          expect(layout.scale).toBe(scale);
        }
      }
    }
  });

  it("scales the gutter, the gap and the cap with the factor", () => {
    for (const scale of SCALES) {
      const { views: v, piles } = views(3);
      const layout = tableLayout(2000, 1200, v, piles, { scale });
      // A canvas far larger than any phone: the card is at its cap (120 at Medium), and every gap has grown to its own cap: the quest
      // card stands one gutter and a quarter card in, staging one gutter and 0.15 of a card down.
      expect(layout.card.w).toBe(Math.floor(120 * scale));
      expect(layout.zones.questStage.x).toBeCloseTo(8 * scale + ACROSS.edge.cap * layout.card.w, 9);
      expect(layout.zones.staging.y).toBeCloseTo(8 * scale + DOWN.top.cap * layout.card.h, 9);
    }
  });

  it("keeps 44 pt of each hand card to touch, and a hand strip as tall as a target, at every scale", () => {
    for (const scale of SCALES) {
      for (const canvas of CANVASES) {
        // (A hand of 12 on a canvas this narrow cannot keep 44 pt of each card at any scale: the card floor wins, as it always did.)
        for (const hand of [2, 6, 8]) {
          const { views: v, piles } = views(hand);
          const layout = tableLayout(canvas.width, canvas.height, v, piles, { scale });
          const cards = layout.slots.filter((slot) => slot.zone === "hand");
          expect(cards).toHaveLength(hand);
          for (let at = 1; at < cards.length; at += 1) {
            const step = (cards[at]?.x ?? 0) - (cards[at - 1]?.x ?? 0);
            expect(step, `${scale} ${canvas.width} hand ${hand} card ${at}`).toBeGreaterThanOrEqual(MIN_TARGET - 0.001);
          }
          // The hand's strip above the bottom edge is a target at least 44 pt tall (less the fan's drop at the ends).
          const strip = layout.zones.hand;
          expect(canvas.height - strip.y, `${scale} ${canvas.width}`).toBeGreaterThanOrEqual(MIN_TARGET);
          // Every card still shows at least a 44 pt target above the bottom edge.
          for (const slot of cards) expect(canvas.height - slot.y, `${scale} ${slot.id}`).toBeGreaterThanOrEqual(MIN_TARGET - 0.001);
        }
      }
    }
  });

  it("never narrows a hand card under the floor, and keeps the strip a target", () => {
    const base = { w: 60, h: 84 };
    for (const scale of SCALES) {
      const narrowed = handCardSize(base, 220, 5, scale);
      expect(narrowed.w).toBeGreaterThanOrEqual(Math.round(36 * scale));
      expect(handCardSize(base, 220, 1, scale)).toEqual(base);
      // The strip of each card but the last: the width less the card, over the gaps between them, is at least 44.
      expect((220 - narrowed.w) / 4).toBeGreaterThanOrEqual(MIN_TARGET - 0.001);
    }
  });

  it("grows a pile smaller than 44 pt to a 44 pt hit target at every scale", () => {
    for (const scale of SCALES) {
      const { views: v, piles } = views(3);
      const layout = tableLayout(300, 260, v, piles, { scale });
      for (const slot of layout.slots.filter((candidate) => candidate.kind === "pile")) {
        const box = hitBounds(slot);
        expect(box.w, slot.id).toBeGreaterThanOrEqual(Math.min(MIN_TARGET, slot.w));
        expect(box.h, slot.id).toBeGreaterThanOrEqual(Math.min(MIN_TARGET, slot.h));
      }
    }
  });
});

// Where each row starts at its minimum gaps: the table as it was before the spacing was shared out.
function tight(layout: ReturnType<typeof tableLayout>, scale: number): { staging: number; engaged: number; play: number; quest: number } {
  const staging = 8 * scale;
  const engaged = staging + layout.card.h + 6 * scale;
  return { staging, engaged, play: engaged + layout.zones.engaged.h + 6 * scale, quest: 8 * scale };
}

const playCards = (layout: ReturnType<typeof tableLayout>): CardSlot[] => layout.slots.filter((slot) => slot.zone === "play" && slot.kind === "card");
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
const within = (outer: Rect, inner: Rect) => inner.x >= outer.x - 1e-6 && inner.x + inner.w <= outer.x + outer.w + 1e-6 && inner.y >= outer.y - 1e-6 && inner.y + inner.h <= outer.y + outer.h + 1e-6;

describe("the table's spacing (user request, 2026-10-29)", () => {
  it("leaves a phone's table as it was: the rows at their minimum gaps, at every scale", () => {
    for (const scale of SCALES) {
      for (const canvas of PHONES) {
        const { views: v, piles } = views(8);
        const layout = tableLayout(canvas.width, canvas.height, v, piles, { scale });
        const at = tight(layout, scale);
        const where = `${scale} ${canvas.width}x${canvas.height}`;
        expect(layout.zones.staging.y, where).toBeCloseTo(at.staging, 9);
        expect(layout.zones.engaged.y, where).toBeCloseTo(at.engaged, 9);
        expect(layout.zones.play.y, where).toBeCloseTo(at.play, 9);
        expect(layout.zones.questStage.x, where).toBeCloseTo(at.quest, 9);
        expect(layout.zones.play.h, where).toBeCloseTo(layout.card.h + 20 * scale, 9);
      }
    }
  });

  it("pins the phone's table at Medium", () => {
    const { views: v, piles } = views(8);
    const layout = tableLayout(591, 338, v, piles);
    expect(layout.card).toEqual({ w: 54, h: 76 });
    expect(layout.zones).toEqual({
      questStage: { x: 8, y: 17, w: 81, h: 58 },
      staging: { x: 97, y: 8, w: 400, h: 76 },
      activeLocation: { x: 22, y: 90, w: 54, h: 76 },
      secondActiveLocation: { x: 8, y: 90, w: 0, h: 0 },
      engaged: { x: 97, y: 90, w: 486, h: 86 },
      play: { x: 97, y: 182, w: 486, h: 96 },
      hand: { x: 8, y: 286, w: 575, h: 52 },
    });
  });

  it("grows a tablet's gaps, each under its cap", () => {
    for (const scale of SCALES) {
      for (const canvas of TABLETS) {
        const { views: v, piles } = views(8);
        const layout = tableLayout(canvas.width, canvas.height, v, piles, { scale });
        const at = tight(layout, scale);
        const where = `${scale} ${canvas.width}x${canvas.height}`;
        const top = layout.zones.staging.y - at.staging;
        const stagingEngaged = layout.zones.engaged.y - layout.zones.staging.y - layout.card.h - 6 * scale;
        const engagedPlay = layout.zones.play.y - layout.zones.engaged.y - layout.zones.engaged.h - 6 * scale;
        for (const [gap, claim] of [[top, DOWN.top], [stagingEngaged, DOWN.stagingEngaged], [engagedPlay, DOWN.engagedPlay]] as const) {
          expect(gap, where).toBeGreaterThan(0);
          expect(gap, where).toBeLessThanOrEqual(claim.cap * layout.card.h + 1e-9);
        }
        // The two gaps around the play area take the larger shares.
        expect(engagedPlay, where).toBeGreaterThanOrEqual(stagingEngaged);
        // The play area still stands a gap above the hand.
        expect(layout.zones.play.y + layout.zones.play.h, where).toBeLessThanOrEqual(layout.zones.hand.y - 6 * scale + 1e-9);
      }
    }
  });

  it("raises the hand into ground no gap can take, up to its whole card, and leaves a phone's hand where it was", () => {
    const { views: v, piles } = views(8);
    const tall = tableLayout(980, 920, v, piles);
    const rest = 920 - Math.round(tall.card.h * 0.56);
    expect(tall.zones.hand.y).toBeLessThan(rest);
    expect(tall.zones.hand.y).toBeGreaterThanOrEqual(920 - tall.card.h - 1e-9);
    // The gap above the hand still reaches its cap.
    expect(tall.zones.hand.y - (tall.zones.play.y + tall.zones.play.h)).toBeGreaterThanOrEqual(DOWN.playHand.cap * tall.card.h);
    expect(tableLayout(591, 338, v, piles).zones.hand.y).toBe(286);
  });

  it("shares room by share, stops each gap at its cap and hands its overflow on", () => {
    expect(shareOut(10, [{ share: 1, cap: 100 }, { share: 3, cap: 100 }]).extra).toEqual([2.5, 7.5]);
    const capped = shareOut(100, [{ share: 1, cap: 10 }, { share: 1, cap: 100 }]);
    expect(capped.extra[0]).toBeCloseTo(10, 9);
    expect(capped.extra[1]).toBeCloseTo(90, 9);
    expect(shareOut(100, [{ share: 1, cap: 10 }, { share: 1, cap: 20 }])).toEqual({ extra: [10, 20], left: 70 });
    expect(shareOut(-5, [{ share: 1, cap: 10 }]).extra).toEqual([0]);
    // Slack under SLACK is not shared at all.
    expect(SLACK).toBeGreaterThan(0);
  });

  it("wraps items into rows that fit, one item at least", () => {
    expect(wrapRows([50, 50, 50], 110, 6)).toEqual([[0, 1], [2]]);
    expect(wrapRows([50, 50, 50], 162, 6)).toEqual([[0, 1, 2]]);
    expect(wrapRows([200, 50], 100, 6)).toEqual([[0], [1]]);
    expect(wrapRows([], 100, 6)).toEqual([]);
  });
});

describe("the play area wraps (user request, 2026-10-29)", () => {
  // A crowded table: five enemies engaged, ten (and twelve) allies in play, eight cards in hand.
  const CROWDS = [10, 12];

  it("keeps every card on a crowded table inside the canvas, the play area above the hand and inside its zone", () => {
    for (const scale of SCALES) {
      for (const canvas of CANVASES) {
        for (const play of CROWDS) {
          const { views: v, piles } = views(8, { engaged: 5, play });
          const layout = tableLayout(canvas.width, canvas.height, v, piles, { scale });
          const where = `${scale} ${canvas.width}x${canvas.height} ${play} allies`;
          const cards = layout.slots.filter((slot) => slot.zone === "play");
          expect(playCards(layout), where).toHaveLength(play);
          for (const slot of cards) {
            const box = slotBounds(slot);
            expect(box.x, `${where} ${slot.id}`).toBeGreaterThanOrEqual(0);
            expect(box.x + box.w, `${where} ${slot.id}`).toBeLessThanOrEqual(canvas.width + 0.5);
            // The play area never covers the hand's strip: two stacked rows tuck at most HAND_TUCK under its top, which the hand is
            // drawn over.
            expect(box.y + box.h, `${where} ${slot.id}`).toBeLessThanOrEqual(layout.zones.hand.y + HAND_TUCK * scale + 1e-6);
            // The drop target for playing a card covers every row (a committed card stands a half peek above it).
            expect(within({ ...layout.zones.play, y: layout.zones.play.y - 5 * scale, h: layout.zones.play.h + 5 * scale }, box), `${where} ${slot.id}`).toBe(true);
          }
        }
      }
    }
  });

  it("wraps a tablet's ten allies onto two rows of the table's card, none over another", () => {
    for (const scale of SCALES) {
      for (const canvas of TABLETS) {
        const { views: v, piles } = views(8, { engaged: 5, play: 10 });
        const layout = tableLayout(canvas.width, canvas.height, v, piles, { scale });
        const cards = playCards(layout);
        const where = `${scale} ${canvas.width}x${canvas.height}`;
        expect(new Set(cards.filter((slot) => !slot.committed).map((slot) => slot.y)).size, where).toBeGreaterThan(1);
        for (const slot of cards) expect(slot.w, where).toBe(layout.card.w);
        cards.forEach((a, i) => cards.slice(i + 1).forEach((b) => expect(overlaps(slotBounds(a), slotBounds(b)), `${where} ${a.id} ${b.id}`).toBe(false)));
        // An attachment peeks out under its host only.
        const attachment = layout.slots.find((slot) => slot.zone === "play" && slot.kind === "attachment");
        const host = cards.find((slot) => slot.id === "p3");
        expect(attachment?.x).toBe(host?.x);
      }
    }
  });

  it("shrinks the play area's cards so they fit without overlapping, down to the floor, on one row or two", () => {
    for (const [canvas, scale, play, rows] of [
      [{ width: 640, height: 400 }, 1, 9, 1],
      [{ width: 760, height: 520 }, UI_SCALES.small, 8, 1],
      [{ width: 760, height: 700 }, 1, 12, 2],
    ] as const) {
      const { views: v, piles } = views(8, { engaged: 5, play });
      const layout = tableLayout(canvas.width, canvas.height, v, piles, { scale });
      const cards = playCards(layout);
      const where = `${canvas.width}x${canvas.height} ${scale}`;
      const w = cards[0]?.w ?? 0;
      expect(w, where).toBeLessThan(layout.card.w);
      expect(w, where).toBeGreaterThanOrEqual(Math.max(Math.round(layout.card.w * PLAY_FLOOR), touch(scale, MIN_TARGET)));
      expect(new Set(cards.filter((slot) => !slot.committed).map((slot) => slot.y)).size, where).toBe(rows);
      cards.forEach((a, i) => cards.slice(i + 1).forEach((b) => expect(overlaps(slotBounds(a), slotBounds(b)), `${where} ${a.id} ${b.id}`).toBe(false)));
    }
  });

  it("on a phone, keeps the table's card for a slight squeeze, and stacks two rows that keep 44 pt targets where one would not", () => {
    // Nine overlap by under a fifth of a card: one row of the table's card.
    const nine = playCards(tableLayout(591, 338, views(8, { engaged: 5, play: 9 }).views, views(8).piles));
    expect(new Set(nine.filter((slot) => !slot.committed).map((slot) => slot.y)).size).toBe(1);
    expect(nine[0]?.w).toBe(54);
    for (const scale of [UI_SCALES.small, UI_SCALES.medium]) {
      for (const play of [10, 12]) {
        const { views: v, piles } = views(8, { engaged: 5, play });
        const layout = tableLayout(591, 338, v, piles, { scale });
        const cards = playCards(layout);
        const target = touch(scale, MIN_TARGET);
        const where = `${scale} ${play}`;
        const rows = [...new Set(cards.filter((slot) => !slot.committed).map((slot) => slot.y))].sort((a, b) => a - b);
        // One row where it squeezes no step under a target; else the back row shows a 44 pt band above the front row.
        expect(rows.length, where).toBeLessThanOrEqual(2);
        if (rows.length === 2) expect((rows[1] ?? 0) - (rows[0] ?? 0), where).toBeCloseTo(target, 9);
        if (scale === 1 && play === 12) expect(rows, where).toHaveLength(2);
        expect(cards[0]?.w ?? 0, where).toBeGreaterThanOrEqual(target);
        for (const y of rows) {
          const row = cards.filter((slot) => slot.y === y || slot.y === y - 5 * scale).sort((a, b) => a.x - b.x);
          for (let at = 1; at < row.length; at += 1) {
            const step = slotBounds(row[at] as CardSlot).x - slotBounds(row[at - 1] as CardSlot).x;
            expect(step, `${where} row ${y}`).toBeGreaterThanOrEqual(target - 1e-6);
          }
        }
        // The rest of the table has not moved.
        expect(layout.zones.engaged.y, where).toBeCloseTo(8 * scale + layout.card.h + 6 * scale, 9);
      }
    }
    // At Large a stacked card would be under its 50.6 pt target: one row, squeezed, as before.
    const large = playCards(tableLayout(591, 338, views(8, { engaged: 5, play: 12 }).views, views(8).piles, { scale: UI_SCALES.large }));
    expect(new Set(large.filter((slot) => !slot.committed).map((slot) => slot.y)).size).toBe(1);
  });

  it("keeps staging and the engagement area still when the play area wraps into the ground above the hand", () => {
    let wrapped = 0;
    for (const scale of SCALES) {
      for (const canvas of [...TABLETS, { width: 1150, height: 950 }]) {
        for (const count of [5, 6, 7, 8]) {
          const ready = views(8, { engaged: 5, play: count });
          // Three characters exhaust (they lie sideways), which can wrap the row.
          const exhausted = { ...ready.views, play: { ...ready.views.play, entries: ready.views.play.entries.map((e, i) => (i < 3 ? { ...e, card: { ...e.card, exhausted: true } } : e)) } };
          const before = tableLayout(canvas.width, canvas.height, ready.views, ready.piles, { scale });
          const after = tableLayout(canvas.width, canvas.height, exhausted, ready.piles, { scale });
          // The room under the play area down to a gap above the hand at rest (the hand rises into ground no row needs).
          const rest = canvas.height - Math.max(touch(scale, MIN_TARGET) + 8 * scale, Math.round(before.card.h * 0.56));
          const ground = rest - 6 * scale - (before.zones.play.y + before.zones.play.h) - DOWN.playHand.cap * before.card.h;
          if (after.zones.play.h === before.zones.play.h || after.zones.play.h - before.zones.play.h > ground) continue;
          wrapped += 1;
          const where = `${scale} ${canvas.width}x${canvas.height} ${count}`;
          expect(after.zones.staging.y, where).toBeCloseTo(before.zones.staging.y, 9);
          expect(after.zones.engaged.y, where).toBeCloseTo(before.zones.engaged.y, 9);
          expect(after.zones.play.y, where).toBeCloseTo(before.zones.play.y, 9);
        }
      }
    }
    expect(wrapped).toBeGreaterThan(0);
  });

  it("leaves a wide, short phone's table as it was: its card is not at its cap, so its edges do not grow", () => {
    for (const scale of SCALES) {
      const { views: v, piles } = views(8);
      const layout = tableLayout(707, 338, v, piles, { scale });
      expect(layout.card.w).toBeLessThan(Math.floor(120 * scale));
      expect(layout.zones.questStage.x).toBeCloseTo(8 * scale, 9);
      expect(layout.zones.staging.x).toBeCloseTo(8 * scale + Math.round(layout.card.w * 1.5) + 8 * scale, 9);
    }
  });
});

describe("the second pile slot, ships and staging stacks (phase 39b)", () => {
  const second = (piles: PileViews, ids: readonly PileId[]): PileViews => ({ ...piles, ...Object.fromEntries(ids.map((pile) => [pile, { pile, seat: 0, ids: ["x", "y"], top: null } satisfies PileView])) }) as unknown as PileViews;

  it("puts the second slot under the encounter pair at the right end of the engagement area, as wide as the pair, and narrows the engagement area by it and a gap", () => {
    for (const scale of SCALES) {
      for (const canvas of CANVASES) {
        const { views: v, piles } = views(5);
        const plain = tableLayout(canvas.width, canvas.height, v, piles, { scale });
        const slot = tableLayout(canvas.width, canvas.height, v, second(piles, ["corsairDeck", "corsairDiscard"]), { scale });
        const at = `${scale} ${canvas.width}`;
        const deck = slot.piles.corsairDeck as Rect;
        const discard = slot.piles.corsairDiscard as Rect;
        expect(deck.x, at).toBe(slot.piles.encounterDeck.x);
        expect(discard.x, at).toBe(slot.piles.encounterDiscard.x);
        expect(discard.x + discard.w, at).toBe(slot.piles.encounterDiscard.x + slot.piles.encounterDiscard.w);
        // Level with the engagement row, not with staging.
        expect(deck.y, at).toBeGreaterThan(slot.zones.engaged.y - 1);
        expect(deck.y + deck.h, at).toBeLessThanOrEqual(slot.zones.engaged.y + slot.zones.engaged.h + 1);
        const pair = slot.piles.encounterDiscard.x + slot.piles.encounterDiscard.w - slot.piles.encounterDeck.x;
        expect(slot.zones.engaged.w, at).toBeCloseTo(plain.zones.engaged.w - pair - 6 * scale, 5);
        // Nothing else moves: staging, play, and the left column are as they were.
        expect(slot.zones.staging).toEqual(plain.zones.staging);
        expect(slot.zones.play).toEqual(plain.zones.play);
        expect(slot.piles.deck).toEqual(plain.piles.deck);
      }
    }
  });

  it("leaves the engagement area whole while the slot is not declared, and a deck alone takes the left place", () => {
    const { views: v, piles } = views(5);
    const plain = tableLayout(591, 338, v, piles, {});
    expect(plain.piles.corsairDeck).toBeUndefined();
    expect(plain.zones.engaged.w).toBe(plain.zones.play.w);
    const alone = tableLayout(591, 338, v, second(piles, ["corsairDeck"]), {});
    expect(alone.piles.corsairDeck?.x).toBe(alone.piles.encounterDeck.x);
    expect(alone.piles.corsairDiscard).toBeUndefined();
    expect(alone.zones.engaged.w).toBeLessThan(plain.zones.engaged.w);
  });

  it("stands a seat's ships after its side quest and before its heroes, the Dream-chaser leftmost, with one more gap after them", () => {
    const { views: v, piles } = views(0);
    const ship = (id: string, rank: 0 | 1) => entry(card(id, "play"), { ship: rank });
    const play = [entry(card("q1", "play")), ship("dc", 0), ship("ds", 1), entry(card("h1", "play")), entry(card("h2", "play"))];
    const layout = tableLayout(700, 400, { ...v, play: { zone: "play", seat: 0, entries: play } }, piles, {});
    const row = layout.slots.filter((slot) => slot.zone === "play" && slot.kind === "card").sort((a, b) => a.x - b.x);
    expect(row.map((slot) => slot.id)).toEqual(["q1", "dc", "ds", "h1", "h2"]);
    expect((row[2]?.x ?? 0) - ((row[1]?.x ?? 0) + (row[1]?.w ?? 0))).toBeCloseTo(6, 5);
    expect((row[3]?.x ?? 0) - ((row[2]?.x ?? 0) + (row[2]?.w ?? 0))).toBeCloseTo(12, 5);
    expect(row[1]?.w).toBe(layout.card.w);
  });

  it("sends the ships to the front row's left end when the play area stacks", () => {
    const { views: v, piles } = views(0);
    const ids12 = ids("p", 12);
    const play = ids12.map((id, at) => entry(card(id, "play"), at === 4 || at === 6 ? { ship: at === 4 ? 0 : 1 } : {}));
    const layout = tableLayout(457, 323, { ...v, play: { zone: "play", seat: 0, entries: play } }, piles, {});
    const row = layout.slots.filter((slot) => slot.zone === "play" && slot.kind === "card");
    const frontY = Math.max(...row.map((slot) => slot.y));
    if (new Set(row.map((slot) => slot.y)).size < 2) return;
    const front = row.filter((slot) => slot.y === frontY).sort((a, b) => a.x - b.x);
    expect(front.slice(0, 2).map((slot) => slot.id)).toEqual(["p4", "p6"]);
  });

  it("shows one peek with a count under a staging card that holds more than one card, and every peek of a card with one", () => {
    const { views: v, piles } = views(0);
    const host = card("s0", "staging");
    const under = [card("u1", "staging", { host: "s0", controller: null }), card("u2", "staging", { host: "s0", controller: null }), card("u3", "staging", { host: "s0", controller: null })];
    const layout = tableLayout(591, 338, { ...v, staging: { zone: "staging", seat: 0, entries: [entry(host, { attached: under }), entry(card("s1", "staging"), { attached: [card("u4", "staging", { host: "s1" })] })] } }, piles, {});
    const stacked = layout.slots.filter((slot) => slot.kind === "attachment" && slot.zone === "staging");
    expect(stacked.filter((slot) => slot.stack != null)).toHaveLength(1);
    expect(stacked.find((slot) => slot.stack != null)?.stack).toBe(3);
    // One peek for the stack and one for the card with a single attachment.
    expect(stacked).toHaveLength(2);
    expect(stacked.find((slot) => slot.id === "u4")?.stack).toBeUndefined();
  });

  it("leaves a Fellowship and a Mirkwood table as it was: no fold stack, no second slot, the pairs where they were", () => {
    for (const canvas of CANVASES) {
      for (const scale of SCALES) {
        const { views: v, piles } = views(7);
        const layout = tableLayout(canvas.width, canvas.height, v, piles, { scale });
        expect(layout.folds).toEqual([]);
        expect(layout.piles.corsairDeck).toBeUndefined();
        expect(layout.slots.every((slot) => slot.stack == null && slot.fold == null)).toBe(true);
        expect(Object.keys(layout.piles).sort()).toEqual(["deck", "discard", "encounterDeck", "encounterDiscard"]);
      }
    }
  });
});
