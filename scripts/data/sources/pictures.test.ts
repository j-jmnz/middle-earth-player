import { describe, expect, it } from "vitest";

import { cardgameToolsFile, fallbackUrls, lettersOf, PDF_PAGES, productsOfPacks } from "./pictures.ts";

describe("pictures", () => {
  it("files a printing under the cardgame.tools product of its pack", () => {
    const products = productsOfPacks(
      [
        { code: "RevCore", name: "Revised Core Set" },
        { code: "TBR", name: "The Black Riders" },
        { code: "MotKA", name: "Messenger of the King Allies" },
      ],
      [
        { code: "MEC101", name: "Revised Core Set", type: "Core" },
        { code: "MEC32", name: "The Black Riders", type: "Saga_Expansion" },
        { code: "uMEN19", name: "The Black Riders", type: "Nightmare_Expansion" },
        { code: "MEC16", name: "The Hobbit: Over Hill and Under Hill", type: "Saga_Expansion" },
      ],
    );
    expect(products.get("RevCore")).toBe("MEC101");
    expect(products.get("TBR")).toBe("MEC32");
    expect(products.get("OHaUH")).toBe("MEC16");
    expect(products.get("TFotR")).toBe("MEC109");
    expect(products.has("MotKA")).toBe(false);
  });

  it("takes a side's file from the first printing whose slug names the card, else the RingsDB picture", () => {
    const rows = new Map([
      ["MEC101 1", { slug: "Hero-Aragorn-Leadership", front: "MEC01-1-front-Hero-Aragorn-Leadership.jpg", back: null }],
      ["MEC102 51", { slug: "Campaign-The_Caves_of_Nibin-Dum", front: "front.jpg", back: "back.jpg" }],
    ]);
    const products = new Map([
      ["RevCore", "MEC101"],
      ["DoM", "MEC102"],
    ]);
    const printing = (pack: string, number: number) => ({ pack, number });
    const aragorn = { name: "Aragorn", printings: [printing("MotKA", 1), printing("RevCore", 1)] };
    expect(cardgameToolsFile(rows, products, aragorn, "A")).toBe("MEC01-1-front-Hero-Aragorn-Leadership.jpg");
    expect(cardgameToolsFile(rows, products, aragorn, "B")).toBeNull();
    expect(cardgameToolsFile(rows, products, { ...aragorn, name: "Théodred" }, "A")).toBeNull();
    expect(cardgameToolsFile(rows, products, { name: "The Caves of Nibin-Dûm", printings: [printing("DoM", 51)] }, "B")).toBe("back.jpg");
    expect(lettersOf("\u201cNo Time to Waste!\u201d")).toBe("notimetowaste");
    expect(
      fallbackUrls({
        imagesrc: "/bundles/cards/9901014.png",
        printings: [{ pack: "MotKA", number: 1, imageUrls: ["https://dragncards-lotrlcg.s3.amazonaws.com/cards/English/x.jpg", "https://s3.amazonaws.com/hallofbeorn-resources/x.jpg"] }],
      }),
    ).toEqual([
      "https://ringsdb.com/bundles/cards/9901014.png",
      "https://s3.amazonaws.com/hallofbeorn-resources/x.jpg",
      "https://dragncards-lotrlcg.s3.amazonaws.com/cards/English/x.jpg",
    ]);
  });

  it("names one PDF page per side of the 21 campaign, boon and burden cards", () => {
    const keys = PDF_PAGES.map((entry) => `${entry.code}.${entry.side}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(PDF_PAGES.map((entry) => entry.code)).size).toBe(21);
    expect(keys.filter((key) => key.endsWith(".B")).sort()).toEqual(["01129.B", "01130.B", "01131.B", "41050.B", "41051.B"]);
  });
});
