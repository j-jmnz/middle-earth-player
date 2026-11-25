// Rules: mec108.captured-cards (data/rules/entries.json). The pill of the cards captured under a card lies clear of the foot row (the engagement cost, the combat number) and the quest strip, inside the card at every size, and says a bare count where its words do not fit.
import { describe, expect, it } from "vitest";

import { TOKEN } from "./token-spots.ts";
import { FOOT_ROW, STRIP, underMarkBox, underRect } from "./under-mark.ts";

const card = (w: number) => ({ x: 100, y: 50, w, h: w * 1.4 });
// The badge font's width: about 5.5 pt a character at Medium.
const width = (text: string, s = 1) => text.length * 5.5 * s;

// The foot row an enemy host's engagement cost (FootPill) and its combat number stand in, and the strip of a stage or an active location.
const footRow = (rect: ReturnType<typeof card>, s = 1) => ({ top: rect.y + rect.h - TOKEN * s - FOOT_ROW * s, bottom: rect.y + rect.h - FOOT_ROW * s });
const strip = (rect: ReturnType<typeof card>, s = 1) => ({ top: rect.y + rect.h - STRIP * s, bottom: rect.y + rect.h });

describe("the captured pill", () => {
  it("stands above the engagement cost's foot row on an enemy host in staging, and above the combat number, at every card width", () => {
    for (const w of [34, 44, 56, 70, 90, 120]) {
      const rect = card(w);
      const box = underMarkBox(rect, width("3 captured"), width("3"), 1, true);
      expect(box.y + box.height, `w ${w}`).toBeLessThanOrEqual(footRow(rect).top);
      // The combat number's pill is 15 pt high at 3 pt from the bottom edge.
      expect(box.y + box.height, `w ${w}`).toBeLessThanOrEqual(rect.y + rect.h - 18);
      expect(box.x, `w ${w}`).toBeGreaterThanOrEqual(rect.x);
      expect(box.x + box.width, `w ${w}`).toBeLessThanOrEqual(rect.x + rect.w);
    }
  });

  it("stands above the progress strip of a stage, Stop the Executioners, Loot or an active Prison Cell, at the UI scales", () => {
    for (const s of [0.85, 1, 1.25, 1.5]) {
      for (const w of [34, 56, 90, 120]) {
        const rect = card(w * s);
        const box = underMarkBox(rect, width("10 captured", s), width("10", s), s, true);
        expect(box.y + box.height, `w ${w} s ${s}`).toBeLessThanOrEqual(strip(rect, s).top);
        expect(box.y, `w ${w} s ${s}`).toBeGreaterThanOrEqual(rect.y);
      }
    }
  });

  it("says the words where they fit and a bare count with a glyph where they do not, even for two digits, on the smallest card", () => {
    expect(underMarkBox(card(120), width("3 captured"), width("3"), 1, true).kind).toBe("words");
    for (const w of [34, 44, 56]) {
      const box = underMarkBox(card(w), width("10 captured"), width("10"), 1, true);
      expect(box.kind, `w ${w}`).not.toBe("words");
      expect(box.width, `w ${w}`).toBeLessThanOrEqual(w - 4);
    }
    expect(underMarkBox(card(44), width("3 captured"), width("3"), 1, true).kind).toBe("count");
  });

  it("keeps the foot row for the pills that count nothing captured (Havens Burn's 2/5, a held card)", () => {
    const rect = card(70);
    const box = underMarkBox(rect, width("2/5"), 0, 1, false);
    expect(box.y).toBe(footRow(rect).top);
    expect(box.kind).toBe("words");
  });
});

describe("the pill of a poisoned character turned sideways (hob.venom-poison)", () => {
  it("stands at the right end of the card with the glyph and the count, clear of the name at its left, inside the card at every width", () => {
    for (const w of [56, 70, 90, 120]) {
      const rect = card(w);
      const middle = underMarkBox(rect, width("2 poison"), width("2"), 1, true);
      const end = underMarkBox(rect, width("2 poison"), width("2"), 1, true, true);
      expect(end.kind, `w ${w}`).not.toBe("words");
      expect(end.x + end.width, `w ${w}`).toBeLessThanOrEqual(rect.x + rect.w);
      expect(end.x, `w ${w}`).toBeGreaterThanOrEqual(rect.x + rect.w / 2 - 1);
      expect(end.y, `w ${w}`).toBe(middle.y);
    }
  });

  it("says the short word Out on a card of any width: it fits the card, which the word Unconscious does not", () => {
    for (const w of [34, 44, 56]) {
      const box = underMarkBox(card(w), width("Out"), 0, 1, false);
      expect(box.width, `w ${w}`).toBeLessThanOrEqual(w - 4);
      expect(box.width, `w ${w}`).toBeGreaterThanOrEqual(width("Out"));
    }
  });

  it("lifts a pill with no count one row when the card wears the progress strip, and no other", () => {
    const rect = card(70);
    const flat = underMarkBox(rect, width("1 held"), 0, 1, false);
    const lifted = underMarkBox(rect, width("1 held"), 0, 1, false, false, true);
    expect(flat.y).toBe(footRow(rect).top);
    expect(lifted.y).toBe(flat.y - (TOKEN + 2));
    expect(lifted.x).toBe(flat.x);
  });
});

describe("the pill of a card in the hand", () => {
  it("stands inside the strip of the card that shows above the bottom edge, at every UI scale, and leaves another zone's card whole", () => {
    for (const s of [0.85, 1, 1.25, 1.5]) {
      for (const w of [34, 56, 90, 120]) {
        const rect = card(w * s);
        const box = underMarkBox(underRect(rect, true, s), width("held", s), width("", s), s, false);
        // The strip is no more than 0.56 of the card or the 52 pt target, and the pill is clear of its lower edge.
        expect(box.y + box.height, `w ${w} s ${s}`).toBeLessThanOrEqual(rect.y + underRect(rect, true, s).h);
        expect(box.y + box.height, `w ${w} s ${s}`).toBeLessThan(rect.y + rect.h);
        expect(box.y, `w ${w} s ${s}`).toBeGreaterThanOrEqual(rect.y);
        expect(underRect(rect, false, s)).toBe(rect);
      }
    }
  });
});
