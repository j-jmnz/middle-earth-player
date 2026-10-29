import { describe, expect, it } from "vitest";

import { cardgameToolsFile, lettersOf, PDF_PAGES, productOf } from "./pictures.ts";

describe("pictures", () => {
  it("files a RingsDB code under the cardgame.tools product its prefix names", () => {
    expect(productOf("01001")).toEqual({ product: "MEC101", number: "1" });
    expect(productOf("41030")).toEqual({ product: "MEC102", number: "30" });
    expect(productOf("141040")).toEqual({ product: "MEC32", number: "40" });
    expect(productOf("142089")).toEqual({ product: "MEC34", number: "89" });
    expect(productOf("19121")).toEqual({ product: "MEC70", number: "121" });
    expect(productOf("02001")).toBeNull();
  });

  it("takes a side's file only when the slug names the card", () => {
    const rows = new Map([
      ["MEC101 1", { slug: "Hero-Aragorn-Leadership", front: "MEC01-1-front-Hero-Aragorn-Leadership.jpg", back: null }],
      ["MEC102 51", { slug: "Campaign-The_Caves_of_Nibin-Dum", front: "front.jpg", back: "back.jpg" }],
    ]);
    expect(cardgameToolsFile(rows, "01001", "A", "Aragorn")).toBe("MEC01-1-front-Hero-Aragorn-Leadership.jpg");
    expect(cardgameToolsFile(rows, "01001", "B", "Aragorn")).toBeNull();
    expect(cardgameToolsFile(rows, "01001", "A", "Théodred")).toBeNull();
    expect(cardgameToolsFile(rows, "41051", "B", "The Caves of Nibin-Dûm")).toBe("back.jpg");
    expect(lettersOf("“No Time to Waste!”")).toBe("notimetowaste");
  });

  it("names one PDF page per side of the 21 campaign, boon and burden cards", () => {
    const keys = PDF_PAGES.map((entry) => `${entry.code}.${entry.side}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(PDF_PAGES.map((entry) => entry.code)).size).toBe(21);
    expect(keys.filter((key) => key.endsWith(".B")).sort()).toEqual(["01129.B", "01130.B", "01131.B", "41050.B", "41051.B"]);
  });
});
