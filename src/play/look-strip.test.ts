// Rules: dcce.sailing, dcce.sailing-tests (data/rules/entries.json). The Sailing test's look strip (docs/design-system-table.md, The Sailing test).
import { describe, expect, it } from "vitest";

import { definePrinted, type PrintedCard } from "../rules/printed.ts";
import { loadCards } from "../../scripts/data/load-cards.ts";
import { loadLedger } from "../../scripts/data/printed/ledger.ts";

import { cardSize, tableLayout } from "./layout.ts";
import { LOOK_STAGGER_MS, lookBands, lookStrip, marksOf, MEDALLION, medallionAt, naturalCapacity, squeezedCapacity, successOf, totalSuccess } from "./look-strip.ts";
import { seaFixture, seaViews } from "./sea-fixture.ts";
import { medallionCount } from "./sea-words.ts";
import { MOTION } from "./motion-tokens.ts";
import { touch, UI_SCALES } from "./ui-scale.ts";

type Screen = { width: number; height: number; inset: number; scales: readonly number[] };
const SCREENS: readonly Screen[] = [
  { width: 667, height: 375, inset: 0, scales: [UI_SCALES.small, UI_SCALES.medium, UI_SCALES.large] },
  { width: 844, height: 390, inset: 47, scales: [UI_SCALES.small, UI_SCALES.medium, UI_SCALES.large] },
  { width: 1024, height: 768, inset: 0, scales: [UI_SCALES.medium, UI_SCALES.large] },
  { width: 1366, height: 1024, inset: 0, scales: [UI_SCALES.medium, UI_SCALES.large] },
];

function canvasOf(screen: Screen, scale: number, quest: boolean) {
  const command = Math.round(Math.min(280, Math.max(210, (screen.width / scale) * 0.3)) * scale);
  const questWidth = quest ? (screen.height / scale >= 600 ? 110 : 86) * scale : 0;
  return { width: Math.floor(screen.width - 2 * screen.inset - command - questWidth), height: Math.floor(screen.height - 60 * scale) };
}

describe("the look strip's room", () => {
  it("holds as many cards a gap apart as the band's width allows, then squeezes to 44 pt steps", () => {
    expect(naturalCapacity(300, 50, 6)).toBe(5);
    expect(squeezedCapacity(300, 50, 44)).toBe(6);
    expect(naturalCapacity(10, 50, 6)).toBe(1);
  });

  it("places 1 to 12 cards at each screen, with and without the quest scale: a gap apart, then squeezed to a target, then over more bands", () => {
    for (const screen of SCREENS) {
      for (const scale of screen.scales) {
        for (const quest of [false, true]) {
          const size = canvasOf(screen, scale, quest);
          const { views, piles } = seaViews(seaFixture({ heading: "Rain", staging: 3, engaged: 2, allies: 3, ships: [{ code: "dream-chaser", seat: 0 }] }));
          const layout = tableLayout(size.width, size.height, views, piles, { scale });
          const bands = lookBands(layout);
          const target = touch(scale, 44);
          const fit = squeezedCapacity(Math.min(...bands.map((band) => band.w)), layout.card.w, target);
          for (let count = 1; count <= 12; count += 1) {
            const strip = lookStrip(count, bands, layout.card, 6 * scale, target);
            const at = `${count} cards ${screen.width}x${screen.height} at ${scale}${quest ? " quest" : ""}`;
            expect(strip.places, at).toHaveLength(count);
            expect(strip.bands, at).toBe(Math.min(3, Math.max(1, Math.ceil(count / fit))));
            // Each band's cards stay inside the band and the cards are in reading order.
            strip.places.forEach((place, index) => {
              const band = bands[strip.band[index] ?? 0];
              expect(place.x, at).toBeGreaterThanOrEqual((band?.x ?? 0) - 0.01);
              expect(place.x + place.w, at).toBeLessThanOrEqual((band?.x ?? 0) + (band?.w ?? 0) + 0.01);
              expect(place.y, at).toBe(band?.y);
              if (index > 0) expect(strip.band[index], at).toBeGreaterThanOrEqual(strip.band[index - 1] ?? 0);
            });
            // Steps are a gap apart at most and a target at least, until the three bands cannot hold the cards.
            if (!strip.crowded && strip.step !== Infinity) {
              expect(strip.step, at).toBeGreaterThanOrEqual(Math.min(target, layout.card.w + 6 * scale) - 0.01);
              expect(strip.step, at).toBeLessThanOrEqual(layout.card.w + 6 * scale + 0.01);
            }
            expect(strip.crowded, at).toBe(count > fit * 3);
          }
        }
      }
    }
  });

  it("overlaps closer than 44 pt only past three bands", () => {
    const size = canvasOf(SCREENS[0] as Screen, 1, false);
    const { views, piles } = seaViews(seaFixture({}));
    const layout = tableLayout(size.width, size.height, views, piles, {});
    const bands = lookBands(layout);
    const fit = squeezedCapacity(Math.min(...bands.map((band) => band.w)), layout.card.w, 44);
    const full = lookStrip(fit * 3, bands, layout.card, 6, 44);
    expect(full.crowded).toBe(false);
    expect(full.step).toBeGreaterThanOrEqual(44 - 0.01);
    const past = lookStrip(fit * 3 + 1, bands, layout.card, 6, 44);
    expect(past.crowded).toBe(true);
    expect(past.step).toBeLessThan(44);
  });

  it("is empty with no cards, and the cards come 90 ms apart", () => {
    expect(lookStrip(0, [{ x: 0, y: 0, w: 100 }], { w: 40, h: 56 }, 6, 44).places).toEqual([]);
    expect(LOOK_STAGGER_MS).toBe(MOTION.stagger.ms);
  });

  it("straddles the card's foot with a 22 pt medallion, and says two symbols as ×2", () => {
    const at = medallionAt({ x: 10, y: 20, w: 50, h: 70 }, 1);
    expect(at).toEqual({ cx: 35, cy: 90, r: MEDALLION / 2 });
    expect(medallionAt({ x: 0, y: 0, w: 50, h: 70 }, 1.15).r).toBeCloseTo(12.65, 5);
    expect(medallionCount(1)).toBeNull();
    expect(medallionCount(2)).toBe("×2");
  });
});

describe("the success marks come from the ledger", () => {
  const cards = new Map(loadCards().map((card) => [card.code, card]));
  const entries = loadLedger().entries.filter((entry) => cards.has(entry.code) && entry.printing !== "Nightmare");
  // The printed cards the engine would read: each Dream-chaser card with the symbols its card record holds (the build puts the ledger's count there).
  const printed = new Map<string, PrintedCard>([...cards.values()].map((card) => [card.code, definePrinted({ code: card.code, name: card.name, type: "treachery", keywords: card.keywords?.sailingSuccess ? { sailingSuccess: card.keywords.sailingSuccess } : {} })]));

  it("marks every ledger side that prints the symbol with its count, and no other card", () => {
    const marked = entries.filter((entry) => entry.side === "A" && (entry.sailingSuccess ?? 0) > 0);
    expect(marked.length).toBeGreaterThan(10);
    for (const entry of marked) expect(successOf(printed, entry.code), `${entry.code} ${cards.get(entry.code)?.name}`).toBe(entry.sailingSuccess);
    const codes = entries.filter((entry) => entry.side === "A").map((entry) => entry.code);
    const withMarks = codes.filter((code, at) => marksOf(printed, codes)[at] !== 0);
    expect(new Set(withMarks)).toEqual(new Set(marked.map((entry) => entry.code)));
    expect(totalSuccess(printed, codes)).toBe(marked.reduce((sum, entry) => sum + (entry.sailingSuccess ?? 0), 0));
  });

  it("knows a card with two symbols (11050) and a card with none", () => {
    expect(successOf(printed, "11050")).toBe(2);
    expect(successOf(printed, "11080")).toBe(0);
    expect(successOf(printed, "nothing")).toBe(0);
  });

  it("sizes the strip at the table's card", () => {
    expect(cardSize(591, 338).w).toBeGreaterThan(30);
  });
});
