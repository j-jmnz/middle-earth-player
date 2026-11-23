import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Card } from "../../src/catalog/card-facts.ts";
import type { RuleEntry } from "./rules/spans.ts";
import { loadCards } from "./load-cards.ts";
import { DATA_DIR } from "./paths.ts";

// An erratum replaces its card's printed wording (docs/brief.md, Data sources); the game follows it only because the source text has it applied. The FAQ's errata section is in data/rules as one span per card
// (`faq.errata.<card code>`; the Core Set rulebook's is `faq.errata.core-rulebook-quest-phase`, which names no card). This test reads each erratum's
// "Should read" wording from the span and finds it in the card's `text` (its other side's and its shadow text too), compared with quotes, tags,
// dashes and whitespace made alike and icons as words. A difference is a finding for the user, not for this test to fix: it is listed at its
// code with its reason, none may be added, and an entry the card no longer differs on is stale and goes. An erratum with no wording to compare
// (a clarification, "Omit the parenthetical") and a card that is not in data/cards are counted, not compared.
const DIFFERENCES: Readonly<Record<string, string>> = {
  "03003": "punctuation: the card has no comma before the last icon (\"[tactics] or [spirit]\"); the erratum has one",
  "131013": "wording: the card says \"Discard Thrór's Map\", the erratum (FAQ 1.9, 2017) \"Exhaust Thrór's Map\"; the game plays the later official printing (Dwarves of Durin, later Over Hill and Under Hill), which the FAQ never recorded (docs/brief.md, Player card readings)",
  "132068": "wording: the stage's side B reads \"use that stage\", \"not other players\" and \"the staging area\"; the erratum \"using that stage\", \"no other players\" and \"its staging area\"; the scenario is not playable and the card has no ledger entry, so the erratum is not applied",
  "06117": "punctuation: the card has no comma before \"or take 1 hidden card\"; the erratum has one",
  "06157": "punctuation: the card has no comma before \"or reveals\"; the erratum has one",
  "144067": "wording: the card (the campaign card, LoS 67) reads \"change hero cards without\"; the erratum \"change hero cards he controls without\"; the ledger was read from the scan, and each player changes only their own heroes in either wording. No later printing was found online",
};

const entries = JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "entries.json"), "utf8")) as RuleEntry[];
// A publisher's own errata document is imported the same way, one span per card: `<publisher id>.errata.<card code>` (docs/brief.md, Data sources, Fan-made content).
const ERRATUM_ID = /^[a-z0-9]+\.errata\.([0-9a-z]+)$/;
const errata = entries.filter((entry) => ERRATUM_ID.test(entry.id));
const cards = new Map(loadCards().map((card) => [card.code, card]));

// The FAQ prints the sphere and icon glyphs as letters of its font (Ì Î Ï Ê); they cannot be told apart, so a quote that has one is compared with every icon left out.
const GLYPHS = /[ÌÎÏÊ]/g;

/** The words of a text with quotes, dashes, tags and whitespace made alike; `[icon]` kept as its word, or dropped when `icons` is false. */
function normalized(text: string, icons = true): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\[([^\]]+)\]/g, icons ? " $1 " : " ")
    .replace(GLYPHS, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** What an erratum span says the card should read: its quoted wording in pieces (a `...` splits it), and a title when it gives one. */
function wording(text: string): { pieces: string[]; hasGlyph: boolean; title: string | null } {
  const read = /should (?:read|have the text):\s*[“"]([\s\S]*?)[”"](?:\s|$)/i.exec(text.replace(/Title should read:[\s\S]*?\n/i, ""));
  const title = /title should read:\s*[“"]([^”"]*)[”"]/i.exec(text)?.[1] ?? null;
  const raw = read?.[1] ?? "";
  return { pieces: raw.split(/\.\.\.|…/).map((piece) => piece.trim()).filter((piece) => piece.length > 0), hasGlyph: /[ÌÎÏÊ]/.test(raw), title };
}

function printed(card: Card): string[] {
  return [card.text, card.back?.text, card.shadowText].filter((text): text is string => typeof text === "string" && text.length > 0);
}

/** The pieces of the erratum the card's printed text does not hold, in order. */
function missing(card: Card, text: string): string[] {
  const { pieces, hasGlyph, title } = wording(text);
  const out: string[] = [];
  const icons = !hasGlyph;
  const have = printed(card).map((value) => normalized(value, icons));
  for (const piece of pieces) if (!have.some((value) => value.includes(normalized(piece, icons)))) out.push(piece);
  if (title !== null && normalized(card.name) !== normalized(title)) out.push(`title ${title}`);
  return out;
}

const codeOf = (id: string): string => ERRATUM_ID.exec(id)?.[1] ?? "";

const compared = errata.flatMap((entry) => {
  const card = cards.get(codeOf(entry.id));
  const { pieces, title } = wording(entry.text);
  return card && (pieces.length > 0 || title !== null) ? [{ entry, card }] : [];
});
const found = new Map(compared.map(({ entry, card }) => [codeOf(entry.id), missing(card, entry.text)] as const).filter(([, parts]) => parts.length > 0));

describe("errata spans", () => {
  it("holds the FAQ's card errata, each span on the FAQ's errata pages", () => {
    expect(errata.length).toBeGreaterThan(40);
    for (const entry of entries.filter((item) => item.id.startsWith("faq.errata."))) expect([2, 3, 4], entry.id).toContain(entry.page);
  });

  it("reads a publisher's errata spans like the FAQ's, and not a span that names no card", () => {
    expect(codeOf("faq.errata.01012")).toBe("01012");
    expect(codeOf("alep.errata.9001")).toBe("9001");
    expect(codeOf("faq.errata.core-rulebook-quest-phase")).toBe("");
  });

  it("reads a quoted wording, a title and a clarification", () => {
    expect(wording("Beravor\nCORE 12\nShould read: “Action: Exhaust Beravor to\nchoose a player.”")).toMatchObject({ pieces: ["Action: Exhaust Beravor to\nchoose a player."], title: null });
    expect(wording("Love\nShould read: “Response: After a Song...” ").pieces).toEqual(["Response: After a Song"]);
    expect(wording('O Elbereth! D 132\nTitle should read: “A Elbereth! Gilthoniel!”\nShould read: “Response: After...”')).toMatchObject({ pieces: ["Response: After"], title: "A Elbereth! Gilthoniel!" });
    expect(wording("Thalin\nCORE 6\nWhen an enemy card is revealed, Thalin’s ability resolves first.").pieces).toEqual([]);
  });

  it("finds the erratum's wording in the card's text, the listed cards at their reason", () => {
    expect(compared.length).toBeGreaterThan(25);
    const unlisted = [...found].filter(([code]) => !(code in DIFFERENCES)).map(([code, parts]) => `${code} ${cards.get(code)?.name}: the card does not read "${parts.join('", "')}"`);
    expect(unlisted).toEqual([]);
  });

  it("lists in DIFFERENCES only cards that still differ", () => {
    expect(Object.keys(DIFFERENCES).filter((code) => !found.has(code)), "remove the entry").toEqual([]);
  });

  it("tells a card that has the wording from one that does not", () => {
    const card = { name: "Beravor", text: "<b>Action:</b> Exhaust Beravor to choose a player. That player draws 2 cards. Limit once per round.", back: null, shadowText: null } as unknown as Card;
    const should = "Should read: “Action: Exhaust Beravor to choose\na player. That player draws 2 cards. Limit once per round.”";
    expect(missing(card, should)).toEqual([]);
    expect(missing({ ...card, text: "Exhaust Beravor to choose a player. That player draws 3 cards." } as Card, should)).toHaveLength(1);
  });
});
