// The web's "Click" for the phone's "Tap" (click-words.ts).
import { describe, expect, it } from "vitest";

import { clickChildren, clickWords } from "./click-words.ts";

describe("clickWords", () => {
  it("words the instructions of the table's tray and the spotlight for a mouse", () => {
    expect(clickWords("Tap a glowing card to play it, or drag it.")).toBe("Click or drag a glowing card to play.");
    expect(clickWords("Tap a glowing card to play it, or drag it.").length).toBeLessThanOrEqual(38);
    expect(clickWords("Tap again: planning ends")).toBe("Click again: planning ends");
    expect(clickWords("X is what you pay. Tap a hero to take one resource from its pool.")).toBe("X is what you pay. Click a hero to take one resource from its pool.");
    expect(clickWords("A replay of each attack that deals or blocks damage. Tap to skip.")).toBe("A replay of each attack that deals or blocks damage. Click to skip.");
    expect(clickWords("Setup · tap to see the card")).toBe("Setup · click to see the card");
    expect(clickWords("When tapped")).toBe("When clicked");
  });

  it("words a double tap as a click, a hold as a right click and a tap-or-swipe as a click", () => {
    expect(clickWords("Double tap to show the card")).toBe("Click to show the card");
    expect(clickWords("double tap to open")).toBe("click to open");
    expect(clickWords("Hold a card to read it.")).toBe("Right-click a card to read it.");
    expect(clickWords("When tapped keeps it until you tap or swipe it, or the next one replaces it.")).toBe("When clicked keeps it until you click it, or the next one replaces it.");
    expect(clickChildren("Hold a card to read it.")).toBe("Right-click a card to read it.");
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
