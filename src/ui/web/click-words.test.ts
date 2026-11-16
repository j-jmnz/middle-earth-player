// The web's "Click" for the phone's "Tap" (click-words.ts).
import { describe, expect, it } from "vitest";

import { clickChildren, clickWords } from "./click-words.ts";

describe("clickWords", () => {
  it("words the instructions of the table's tray and the spotlight for a mouse", () => {
    expect(clickWords("Tap a glowing card to play it, or drag it.")).toBe("Click a glowing card to play it, or drag it.");
    expect(clickWords("Tap again: planning ends")).toBe("Click again: planning ends");
    expect(clickWords("X is what you pay. Tap a hero to take one resource from its pool.")).toBe("X is what you pay. Click a hero to take one resource from its pool.");
    expect(clickWords("A replay of each attack that deals or blocks damage. Tap to skip.")).toBe("A replay of each attack that deals or blocks damage. Click to skip.");
    expect(clickWords("Setup · tap to see the card")).toBe("Setup · click to see the card");
    expect(clickWords("When tapped")).toBe("When clicked");
  });

  it("leaves other words alone", () => {
    expect(clickWords("Tapestry of the tapering Tapir")).toBe("Tapestry of the tapering Tapir");
    expect(clickWords("Exhaust a hero")).toBe("Exhaust a hero");
  });
});

describe("clickChildren", () => {
  it("words each string of a list of children and returns the same list when nothing changed", () => {
    expect(clickChildren(["Tap ", "Aragorn"])).toEqual(["Click ", "Aragorn"]);
    const same = ["Aragorn", "Gimli"];
    expect(clickChildren(same)).toBe(same);
    expect(clickChildren(null)).toBeNull();
    expect(clickChildren(3)).toBe(3);
  });
});
