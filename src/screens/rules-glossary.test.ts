import { describe, expect, it } from "vitest";

import { GLOSSARY, glossaryEntry, paragraphs, searchGlossary, seeAlso } from "./rules-glossary.ts";

describe("GLOSSARY", () => {
  it("holds the rule books' spans and leaves out decklists, setups and stages", () => {
    const docs = new Set(GLOSSARY.map((entry) => entry.doc));
    expect([...docs].sort()).toEqual(["easy-mode", "faq", "learn-to-play", "mec109", "rr"]);
    expect(GLOSSARY.some((entry) => /^(decklist\.|mec109\.(starter-|setup-|stage-))/.test(entry.id))).toBe(false);
    expect(glossaryEntry("mec109.hide-tests")?.source).toBe("Fellowship of the Ring campaign book · page 4");
  });

  it("sorts by title without entry numbers, step numbers or quote marks", () => {
    const ids = GLOSSARY.map((entry) => entry.id);
    expect(ids.indexOf("faq.limitations-on-attacks")).toBeGreaterThan(ids.indexOf("rr.action"));
    expect(ids.indexOf("faq.first-player-elimination")).toBeGreaterThan(ids.indexOf("rr.action"));
    expect(ids.indexOf("rr.step-1-2")).toBeGreaterThan(ids.indexOf("rr.action"));
    expect(GLOSSARY[0]?.title).toMatch(/^A/);
  });
});

describe("searchGlossary", () => {
  it("puts a title that starts with the query first, then names, then text", () => {
    const ids = searchGlossary(GLOSSARY, "Surge").map((entry) => entry.id);
    expect(ids.slice(0, 2).sort()).toEqual(["ltp.surge", "rr.surge"]);
    expect(ids).toContain("rr.keywords");
  });

  it("folds accents and curly quotes, and returns everything for an empty query", () => {
    expect(searchGlossary(GLOSSARY, "ring-bearer's life").map((entry) => entry.id)).toContain("mec109.ringbearers-life");
    expect(searchGlossary(GLOSSARY, "  ")).toHaveLength(GLOSSARY.length);
  });
});

describe("paragraphs", () => {
  it("drops the heading, joins wrapped lines and opens a paragraph at each bullet and step", () => {
    const action = paragraphs(glossaryEntry("rr.action")!);
    expect(action[0]).toBe(
      "Some abilities are labeled by the word “Action” followed by ability text. These abilities can only be initiated by a player during an action window. For details on when action windows occur during each round, see Appendix I on page 20.",
    );
    expect(action.filter((paragraph) => paragraph.startsWith("◊"))).toHaveLength(4);
    expect(action.at(-1)).toBe("See also: Ability, Triggered Ability, Appendix I");
    expect(paragraphs(glossaryEntry("rr.setup")!).filter((paragraph) => /^\d\. /.test(paragraph))).toHaveLength(7);
  });

  it("drops a heading wrapped over two lines", () => {
    expect(paragraphs(glossaryEntry("rr.attacks-outside-the-combat-phase")!)[0]).toMatch(/^If an enemy makes an attack/);
  });
});

describe("seeAlso", () => {
  it("shows a quoted name without its quote marks and comma", () => {
    expect(seeAlso(glossaryEntry("rr.attachment-cards")!, GLOSSARY).map((link) => link.name)).toContain("Cannot have attachments");
  });

  it("links each name to an entry of the same book, and keeps a name with none", () => {
    const links = seeAlso(glossaryEntry("rr.action")!, GLOSSARY);
    expect(links.map((link) => [link.name, link.entry?.id ?? null])).toEqual([
      ["Ability", null],
      ["Triggered Ability", "rr.triggered-ability"],
      ["Appendix I", null],
    ]);
  });
});
