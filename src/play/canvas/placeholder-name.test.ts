import { describe, expect, it } from "vitest";

import { nameFitsOne, NAME_FLOOR, placeholderName, type NameBox } from "./placeholder-name.ts";
import { damageReach } from "./token-spots.ts";

// One unit per character, so a card 100 wide holds a line of 90 (a 5 pt margin each side).
const measure = (text: string) => text.length;
const box = (over: Partial<NameBox>): NameBox => ({ name: "Wild Mûmak", w: 100, s: 1, shown: null, lines: 3, damage: false, sideways: false, foot: null, measure, ...over });

describe("the placeholder name", () => {
  it("shrinks a one-line name to the floor before it is cut (the damage token keeps the first line clear)", () => {
    // The first line is the card less the damage token's reach: 100 - reach - 6.
    const first = 100 - damageReach(1) - 6;
    const name = "x".repeat(Math.floor(first / 0.8));
    const laid = placeholderName(box({ name, lines: 1, damage: true }));
    expect(laid.scale).toBeGreaterThanOrEqual(NAME_FLOOR);
    expect(laid.scale).toBeLessThan(1);
    expect(laid.lines).toEqual([name]);
    // Past the floor it is cut, at the floor's width.
    const long = placeholderName(box({ name: "x".repeat(Math.ceil(first / NAME_FLOOR) + 5), lines: 1, damage: true }));
    expect(long.scale).toBe(1);
    expect(long.lines[0]?.endsWith("…")).toBe(true);
  });

  it("shrinks a single word too wide for the line, on a name of several lines (Tower Dunes, Mûmak Trail)", () => {
    const word = "Dunesss".padEnd(100, "s");
    const laid = placeholderName(box({ name: `Tower ${word}`, lines: 3 }));
    expect(laid.scale).toBeLessThan(1);
    expect(laid.scale).toBeGreaterThanOrEqual(NAME_FLOOR);
    expect(laid.lines.join(" ")).toBe(`Tower ${word}`);
    // A word that does not fit even at the floor is cut, as before.
    expect(placeholderName(box({ name: `Tower ${"s".repeat(200)}`, lines: 3 })).lines.at(-1)?.endsWith("…")).toBe(true);
  });

  it("starts the first line of a card lying sideways after the damage token, which stands over its start", () => {
    const laid = placeholderName(box({ sideways: true, damage: true }));
    expect(laid.indent).toBeGreaterThan(0);
    // The token's reach and its gap, less the name's own 5 pt start.
    expect(laid.indent).toBe(damageReach(1) + 1 - 5);
    expect(placeholderName(box({ sideways: true, damage: false })).indent).toBe(0);
    expect(placeholderName(box({ sideways: false, damage: true })).indent).toBe(0);
  });

  it("stops the lines of a card lying sideways above its highest foot pill", () => {
    const name = "Willow-Wood Warden Archer of Mirkwood and the Lonely Dale";
    const wide = placeholderName(box({ name, sideways: true, foot: null }));
    const stopped = placeholderName(box({ name, sideways: true, foot: 60 }));
    // A line is 60 less the 6 pt the name starts at, at the most.
    for (const line of stopped.lines) expect(line.length * stopped.scale).toBeLessThanOrEqual(60 - 6);
    expect(Math.max(...wide.lines.map((line) => line.length))).toBeGreaterThan(Math.max(...stopped.lines.map((line) => line.length)));
  });

  it("tells whether a name fits one line at the floor, so a card with pills may take a second line", () => {
    expect(nameFitsOne(box({ name: "Uruk of Mordor", w: 100 }))).toBe(true);
    expect(nameFitsOne(box({ name: `Uruk Chieftain ${"of the Black Land ".repeat(8)}`, w: 100 }))).toBe(false);
    // A shrink that reaches the floor still fits; one past it does not.
    expect(nameFitsOne(box({ name: "x".repeat(Math.floor(90 / 0.75)) }))).toBe(true);
    expect(nameFitsOne(box({ name: "x".repeat(Math.ceil(90 / 0.65)) }))).toBe(false);
  });
});
