import { describe, expect, it } from "vitest";

import { jvzijpFile, jvzijpPictures, namesMatch, onDriveRefusal, parseDriveFolder } from "./jvzijp.ts";

const packs = [
  { code: "Core", name: "Core Set" },
  { code: "TBR", name: "The Black Riders" },
  { code: "TWitW", name: "The Watcher in the Water" },
  { code: "THftD", name: "The Hunt for the Dreadnaught" },
];

const files = [
  { path: "01 - Core Set/Player/001 - Aragorn.jpg", id: "aragorn" },
  { path: "01 - Core Set/Player/036 - Thicket of Spears.jpg", id: "thicket" },
  { path: "01 - Core Set/Player/036 - Thicket of Spears (errata).jpg", id: "thicket-errata" },
  { path: "01 - Core Set/Quest/119 - 1A - Flies and Spiders.jpg", id: "flies-a" },
  { path: "01 - Core Set/Quest/119 - 1B - Flies and Spiders.jpg", id: "flies-b" },
  { path: "01 - Core Set/Quest/core_set_campaign_cards-23.jpg", id: "page-23" },
  { path: "01 - Core Set/Quest/sharpen-Heading.jpg", id: "working-file" },
  { path: "04 - Dwarrowdelf/03 - The Watcher in the Water/Player/053 - Aragorn.jpg", id: "aragorn-lore" },
  { path: "20 - The Lord of the Rings Saga/01 - The Black Riders/Player/017 -Mr. Underhill.jpg", id: "underhill" },
  { path: "20 - The Lord of the Rings Saga/01 - The Black Riders/Encounter/A Knife in the Dark/051 - Bill Fenry.jpg", id: "ferny" },
  { path: "23 - The Hunt for the Dreadnaught/Player/047a - A Perilous Voyage (Side A).jpg", id: "voyage-a" },
  { path: "23 - The Hunt for the Dreadnaught/Player/047b - A Perilous Voyage (Side B)_1.jpg", id: "voyage-b" },
];

const card = (name: string, printings: [string, number][], hasErrata = false) => ({ name, hasErrata, printings: printings.map(([pack, number]) => ({ pack, number })) });

describe("JvZijp's Drive", () => {
  it("reads the files and folders of Drive's embedded folder view", () => {
    const html = `<div class="flip-entry"><a href="https://drive.google.com/drive/folders/1abc" target="_blank"><div class="flip-entry-title">01 - Core Set</div></a></div>
<div class="flip-entry"><a href="https://drive.google.com/file/d/2def/view?usp=drive_web" target="_blank"><div class="flip-entry-title">036 - Gandalf&#39;s Search.jpg</div></a></div>`;
    expect(parseDriveFolder(html)).toEqual([
      { name: "01 - Core Set", kind: "folder", id: "1abc" },
      { name: "036 - Gandalf's Search.jpg", kind: "file", id: "2def" },
    ]);
  });

  it("files each picture under the pack its deepest folder names, and leaves working files out", () => {
    const pictures = jvzijpPictures(files, packs);
    expect(pictures.find((picture) => picture.id === "aragorn-lore")).toMatchObject({ kind: "card", pack: "TWitW", number: 53, side: "A" });
    expect(pictures.find((picture) => picture.id === "underhill")).toMatchObject({ pack: "TBR", number: 17, name: "Mr. Underhill" });
    expect(pictures.find((picture) => picture.id === "voyage-b")).toMatchObject({ pack: "THftD", number: 47, side: "B", name: "A Perilous Voyage" });
    expect(pictures.find((picture) => picture.id === "page-23")).toEqual({ kind: "pdfPage", page: 23, id: "page-23", path: files[5]?.path });
    expect(pictures.some((picture) => picture.id === "working-file")).toBe(false);
  });

  it("matches a side by pack and number when the title names the card, typos allowed", () => {
    const pictures = jvzijpPictures(files, packs);
    const id = (name: string, printings: [string, number][], side: "A" | "B" = "A", hasErrata = false) =>
      jvzijpFile(pictures, card(name, printings, hasErrata), side, null)?.id ?? null;
    // The Revised Core Set's Aragorn is the Core Set's file.
    expect(id("Aragorn", [["RevCore", 1]])).toBe("aragorn");
    expect(id("Aragorn", [["TWitW", 53]])).toBe("aragorn-lore");
    expect(id("Théodred", [["Core", 1]])).toBeNull();
    expect(id("Bill Ferny", [["TBR", 51]])).toBe("ferny");
    expect(id("Flies and Spiders", [["Core", 119]], "B")).toBe("flies-b");
    expect(id("A Perilous Voyage", [["THftD", 47]], "B")).toBe("voyage-b");
    // A card with errata takes its errata file, any other the printed one.
    expect(id("Thicket of Spears", [["Core", 36]], "A", true)).toBe("thicket-errata");
    expect(id("Thicket of Spears", [["Core", 36]])).toBe("thicket");
    expect(jvzijpFile(pictures, card("Appointed by Fate", [["RevCore", 134]]), "A", 23)?.id).toBe("page-23");
    expect(namesMatch("Stricken Dumb", "Sticken Dumb")).toBe(true);
    expect(namesMatch("Gandalf", "Galadriel")).toBe(false);
  });
});

describe("onDriveRefusal", () => {
  it("keeps a pinned picture, with or without its cached file, and takes no lower source", () => {
    expect(onDriveRefusal({ sha256: "aa" }, "aa")).toEqual({ action: "keep", cached: true });
    expect(onDriveRefusal({ sha256: "aa" }, "bb")).toEqual({ action: "keep", cached: false });
    expect(onDriveRefusal({ sha256: "aa" }, null)).toEqual({ action: "keep", cached: false });
  });

  it("lets a card with no pin fall back to the next source", () => {
    expect(onDriveRefusal(undefined, null)).toEqual({ action: "fallback" });
  });
});
