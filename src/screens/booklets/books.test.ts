import { describe, expect, it } from "vitest";

import { BOOKLETS, bookletName, bookletPath, isBookletId, startPage } from "./books";

describe("booklet ids", () => {
  it("names the seven books the app bundles", () => {
    expect(BOOKLETS.map((book) => book.id)).toEqual(["fellowship-of-the-ring", "learn-to-play", "rules-reference", "the-dark-of-mirkwood", "dream-chaser", "ered-mithrin", "the-two-towers"]);
    expect(isBookletId("learn-to-play")).toBe(true);
    expect(isBookletId("../etc/passwd")).toBe(false);
    expect(bookletName("learn-to-play")).toBe("Learn to Play");
    expect(bookletPath("learn-to-play")).toBe("booklets/learn-to-play.pdf");
    expect(bookletName("dream-chaser")).toBe("Dream-chaser campaign rulebook");
    expect(bookletName("ered-mithrin")).toBe("Ered Mithrin campaign rulebook");
    expect(bookletName("the-two-towers")).toBe("The Two Towers campaign rulebook");
  });
});

describe("startPage", () => {
  it("opens on the saved last page when the scenario records none", () => {
    expect(startPage(undefined, 12, 60)).toBe(12);
    expect(startPage(null, 12, 60)).toBe(12);
  });

  it("opens on the scenario's page when one is recorded", () => {
    expect(startPage(7, 12, 60)).toBe(7);
  });

  it("stays inside the book", () => {
    expect(startPage(undefined, 99, 60)).toBe(60);
    expect(startPage(undefined, 0, 60)).toBe(1);
    expect(startPage(undefined, 5, 0)).toBe(1);
  });
});
