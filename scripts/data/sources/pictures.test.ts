import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { scenarioCards } from "../../../src/catalog/scenario-data.ts";
import { loadScenario } from "../load-scenarios.ts";
import { DATA_DIR } from "../paths.ts";
import { MEC108_CHANGED, MEC109_CHANGED, MEC112_CHANGED, MEC113_CHANGED } from "../printed/scope.ts";
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
    expect(products.get("TTwT")).toBe("MEC112");
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

  it("takes a double-sided card's back image for the card named by the slug's second title", () => {
    const rows = new Map([
      ["MEC108 158", { slug: "EncounterSideQuest-Protect_the_Innocent- Arnor_Ravaged-Intruders_in_Chetwood_Campaign", front: "158-front.jpg", back: "158-back.jpg" }],
    ]);
    const products = new Map([["AACE", "MEC108"]]);
    const printing = [{ pack: "AACE", number: 158 }];
    expect(cardgameToolsFile(rows, products, { name: "Protect the Innocent", printings: printing }, "A")).toBe("158-front.jpg");
    expect(cardgameToolsFile(rows, products, { name: "Arnor Ravaged", printings: printing }, "A")).toBe("158-back.jpg");
  });

  it("pins no picture to two cards, except the printings of one card face", () => {
    const { sources } = JSON.parse(readFileSync(path.join(DATA_DIR, "sources.json"), "utf8")) as { sources: Record<string, { files: { path: string; sha256: string }[] } | undefined> };
    const byHash = new Map<string, string[]>();
    for (const file of sources.pictures?.files ?? []) {
      const code = /^pictures\/(\w+)\.A\./.exec(file.path)?.[1];
      if (code) byHash.set(file.sha256, [...(byHash.get(file.sha256) ?? []), code]);
    }
    const names = new Map<string, string>();
    for (const file of readdirSync(path.join(DATA_DIR, "cards")).filter((name) => name.endsWith(".json"))) {
      for (const card of JSON.parse(readFileSync(path.join(DATA_DIR, "cards", file), "utf8")) as { code: string; name: string }[]) names.set(card.code, lettersOf(card.name));
    }
    // Two codes may share a picture only when they are one card's name (a reprint or a twin); another name is a side filed under the wrong card.
    const shared = [...byHash.values()].filter((codes) => new Set(codes.map((code) => names.get(code) ?? code)).size > 1);
    expect(shared).toEqual([]);
  });

  it("names one PDF page per side of the 21 campaign, boon and burden cards", () => {
    const keys = PDF_PAGES.map((entry) => `${entry.code}.${entry.side}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(PDF_PAGES.map((entry) => entry.code)).size).toBe(21);
    expect(keys.filter((key) => key.endsWith(".B")).sort()).toEqual(["01129.B", "01130.B", "01131.B", "41050.B", "41051.B"]);
  });

  // A card added to data/cards after the last `pnpm data sync pictures` has no picture pin, and the app bundles its small scan instead (the
  // Dream-chaser cards did, user report 2026-10-31). Every card a built scenario deals has a side A picture, except the cards no source pictures.
  it("pins a picture for every card a built scenario deals", () => {
    const { sources } = JSON.parse(readFileSync(path.join(DATA_DIR, "sources.json"), "utf8")) as { sources: Record<string, { files: { path: string }[] } | undefined> };
    const pinned = new Set([...(sources.pictures?.files ?? []), ...(sources.nightmare?.files ?? [])].map((file) => /^pictures\/(\w+)\.A\./.exec(file.path)?.[1]).filter((code) => code != null));
    // The MEC108, MEC109, MEC112 and MEC113 printings whose wording differs keep their scan (MEC108_CHANGED, MEC109_CHANGED, MEC112_CHANGED, MEC113_CHANGED). Navigation (11084) is a rules card of The Grey Havens that
    // neither JvZijp nor cardgame.tools carries.
    // Ered Mithrin: no picture source carries the Campaign Expansion's own cards (cardgame.tools' MEC115 stops at the encounter cards, JvZijp's Drive holds
    // none of a campaign expansion's cards): the pack bundles their scan, Hall of Beorn's digital render (about 1020 × 1451), so each must have one.
    // The Campaign Expansion's 40 cards, by code (120165 is the Journey Up the Anduin campaign card; the rest are 12166 to 12204).
    const emce = ["120165", ...Array.from({ length: 39 }, (_, at) => String(12166 + at))];
    const unpictured = new Set([...MEC108_CHANGED, ...MEC109_CHANGED, ...MEC112_CHANGED, ...MEC113_CHANGED, "11084", ...emce]);
    const missing: string[] = [];
    for (const id of readdirSync(path.join(DATA_DIR, "scenarios")).filter((file) => file.endsWith(".json")).map((file) => file.slice(0, -".json".length))) {
      const scenario = loadScenario(id);
      for (const code of new Set([...scenario.stages, ...scenarioCards(scenario).map((card) => card.code), ...(scenario.campaignCard ? [scenario.campaignCard] : []), ...scenario.campaignPlaced])) {
        if (!pinned.has(code) && !unpictured.has(code)) missing.push(`${id} ${code}`);
      }
    }
    expect(missing, "Run pnpm data sync pictures").toEqual([]);
    const scanned = new Set((sources.scans?.files ?? []).map((file) => /^scans\/(\w+)\.A\./.exec(file.path)?.[1]).filter((code) => code != null));
    expect(emce.filter((code) => !scanned.has(code)), "Run pnpm data sync scans").toEqual([]);
  });
});
