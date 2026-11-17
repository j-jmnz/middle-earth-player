import { describe, expect, it } from "vitest";

import { bookPage, glossary, glossaryEntry, paragraphs, ruleTip, scenarioRuleDoc, searchGlossary, seeAlso } from "./glossary.ts";

const GLOSSARY = glossary();

describe("GLOSSARY", () => {
  it("holds the rule books' spans and leaves out decklists, setups and stages", () => {
    const docs = new Set(GLOSSARY.map((entry) => entry.doc));
    expect([...docs].sort()).toEqual(["bts", "dcce", "easy-mode", "emce", "faq", "hoem", "jtr", "learn-to-play", "mec108", "mec109", "mec112", "mec113", "rr", "rtm", "tdm", "tdom", "trg"]);
    expect(GLOSSARY.some((entry) => /^(decklist\.|mec109\.(starter-|setup-|stage-)|dcce\.(campaign-)?setup-|emce\.setup-|mec108\.(campaign-)?setup-|mec11[23]\.setup-|sotm\.setup-)/.test(entry.id))).toBe(false);
    expect(glossaryEntry("dcce.gaining-xp")?.source).toBe("Dream-chaser campaign rulebook · page 29");
    expect(glossaryEntry("mec109.hide-tests")?.source).toBe("Fellowship of the Ring campaign book · page 4");
    expect(glossaryEntry("emce.treasure")?.source).toBe("Ered Mithrin campaign rulebook · page 3");
    expect(glossaryEntry("mec112.campaign-mode-aragorn")?.source).toBe("The Two Towers campaign rulebook · page 4");
    expect(glossaryEntry("sotm.escape-test")?.source).toBe("The Dead Marshes rules · page 1");
    expect(glossaryEntry("mec113.campaign-mode-aragorn")?.source).toMatch(/^The Return of the King campaign rulebook · page \d+$/);
  });

  it("sorts by title without entry numbers, step numbers or quote marks", () => {
    const ids = GLOSSARY.map((entry) => entry.id);
    expect(ids.indexOf("faq.limitations-on-attacks")).toBeGreaterThan(ids.indexOf("rr.action"));
    expect(ids.indexOf("faq.first-player-elimination")).toBeGreaterThan(ids.indexOf("rr.action"));
    expect(ids.indexOf("rr.step-1-2")).toBeGreaterThan(ids.indexOf("rr.action"));
    expect(GLOSSARY[0]?.title).toMatch(/^A/);
  });
});

describe("the lazy glossary", () => {
  it("is parsed once and the entries are kept", () => {
    expect(glossary()).toBe(glossary());
    expect(glossaryEntry("rr.action")).toBe(glossary().find((entry) => entry.id === "rr.action"));
    expect(glossaryEntry("no.such.rule")).toBeNull();
  });

  it("finds the same entries when the same query is asked again (the folded fields are kept)", () => {
    const first = searchGlossary(GLOSSARY, "attachment").map((entry) => entry.id);
    expect(first.length).toBeGreaterThan(1);
    expect(searchGlossary(GLOSSARY, "attachment").map((entry) => entry.id)).toEqual(first);
    // Two letters search titles and terms only; three also reach the text.
    expect(searchGlossary(GLOSSARY, "at").length).toBeLessThan(searchGlossary(GLOSSARY, "att").length + GLOSSARY.length);
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

describe("bookPage", () => {
  it("opens each bundled book (the campaign books, Learn to Play, the Rules Reference) on the rule's page, and no other book", () => {
    expect(bookPage(glossaryEntry("mec109.hide-tests")!)).toEqual({ id: "fellowship-of-the-ring", name: "Fellowship of the Ring campaign book", page: 4 });
    expect(bookPage(glossaryEntry("ltp.surge")!)).toEqual({ id: "learn-to-play", name: "Learn to Play", page: 22 });
    expect(bookPage(glossaryEntry("rr.surge")!)).toEqual({ id: "rules-reference", name: "Rules Reference", page: 17 });
    expect(bookPage(glossaryEntry("tdom.mirkwood-paths")!)).toEqual({ id: "the-dark-of-mirkwood", name: "The Dark of Mirkwood rulebook", page: 7 });
    expect(bookPage(glossaryEntry("dcce.gaining-xp")!)).toEqual({ id: "dream-chaser", name: "Dream-chaser campaign rulebook", page: 29 });
    expect(bookPage(glossaryEntry("emce.treasure")!)).toEqual({ id: "ered-mithrin", name: "Ered Mithrin campaign rulebook", page: 3 });
    expect(bookPage(glossaryEntry("mec112.aragorn")!)).toEqual({ id: "the-two-towers", name: "The Two Towers campaign rulebook", page: 3 });
    expect(bookPage(glossaryEntry("faq.limitations-on-attacks")!)).toBeNull();
  });
});

describe("scenario setup spans", () => {
  it("are read on the briefing, not looked up: the glossary leaves out mec109, ltp and tdom setup spans", () => {
    expect(GLOSSARY.filter((entry) => /^(mec109|ltp|tdom)\.setup-/.test(entry.id))).toEqual([]);
    expect(glossaryEntry("tdom.campaign-mode")).not.toBeNull();
  });
});

describe("the rules a keyword chip quotes", () => {
  it("find the book of the scenario in play: its setup span, else its campaign's book, else none", () => {
    expect(scenarioRuleDoc("the-passing-of-the-grey-company", "the-return-of-the-king")).toBe("mec113");
    expect(scenarioRuleDoc("a-journey-to-rhosgobel", undefined)).toBe("jtr");
    expect(scenarioRuleDoc("the-hunt-for-gollum", undefined)).toBeNull();
    expect(scenarioRuleDoc("no-such-scenario", "the-two-towers")).toBe("mec112");
    expect(scenarioRuleDoc("no-such-scenario", undefined)).toBeNull();
  });

  it("give a span's paragraphs without See also, its source, and whether the Rules tab opens it", () => {
    const tip = ruleTip("rr.surge");
    expect(tip?.source).toBe("Rules Reference, page 17");
    expect(tip?.openable).toBe(true);
    expect(tip?.paragraphs.length).toBeGreaterThan(0);
    expect(tip?.paragraphs.some((line) => line.startsWith("See also:"))).toBe(false);
    // Not a document the app carries as a book: named, and opened in the Rules tab all the same.
    expect(ruleTip("trg.secrecy")).toMatchObject({ source: "The Redhorn Gate rules, page 1", openable: true });
    // The Honour of the Rohirrim spans are in no glossary document.
    expect(ruleTip("hon.siege")?.openable).toBe(false);
    expect(ruleTip("no.such.rule")).toBeNull();
  });
});
