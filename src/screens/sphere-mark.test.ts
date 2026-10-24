import { describe, expect, it } from "vitest";

import { markedSphere, sphereWord } from "./sphere-mark.ts";

describe("sphere marks", () => {
  it("allows the printed spheres and turns an empty name into Neutral", () => {
    expect(markedSphere("leadership")).toBe("leadership");
    expect(markedSphere("tactics")).toBe("tactics");
    expect(markedSphere("spirit")).toBe("spirit");
    expect(markedSphere("lore")).toBe("lore");
    expect(markedSphere("fellowship")).toBe("fellowship");
    expect(markedSphere("neutral")).toBe("neutral");
    // Baggins prints its own sphere icon (the RingsDB glyph), so it has a mark too.
    expect(markedSphere("baggins")).toBe("baggins");
    expect(markedSphere("unknown")).toBeNull();
    expect(markedSphere(null)).toBeNull();
    expect(sphereWord("Lore")).toBe("Lore");
    expect(sphereWord("")).toBe("Neutral");
    expect(sphereWord(null)).toBe("Neutral");
  });
});
