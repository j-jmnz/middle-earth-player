import type { Card } from "../../../src/catalog/card-facts.ts";
import type { PrintedKeywords } from "../../../src/catalog/boundary.ts";
import { PRODUCTS } from "../campaign-defs.ts";
import { isKeywordLine, parseKeywordTokens } from "./keywords.ts";
import { timingLabels } from "./timings.ts";
import type { Ledger, LedgerEntry } from "../printed/ledger.ts";
import { keyOf } from "../printed/ledger.ts";

const SHADOW = /^Shadow:/;

export function splitFront(entry: LedgerEntry): { text: string | null; shadow: string | null } {
  const body = entry.lines.filter((line) => !SHADOW.test(line));
  const shadow = entry.lines.filter((line) => SHADOW.test(line));
  return { text: body.length > 0 ? body.join("\n") : null, shadow: shadow.length > 0 ? shadow.join("\n") : null };
}

// Loose comparison: the ledger writes icons as words and RingsDB writes them as [icon] tokens and HTML.
function loose(text: string | null | undefined): string[] {
  return (text ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[(\w+)\]/g, "$1")
    .replaceAll("`", "'")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .split(/\r?\n/)
    .map((line) => line.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim())
    .filter((line) => line !== "");
}

export type Difference = { key: string; ledger: string[]; source: string[] };

// The printings (a pack code, or the product's name where the reader wrote that) of the Dream-chaser box cards. Hall of Beorn lists some of their keywords as text only (Immune to player card
// effects on the ships and the Thing in the Depths), so for these cards the keyword sentences that open a line of the scan-read ledger are
// keywords the card has, and the Sailing success symbols the ledger counts are kept with them (dcce.sailing-tests).
const LEDGER_KEYWORD_PACKS: ReadonlySet<string> = new Set(PRODUCTS.filter((product) => product.home === "dream-chaser").flatMap((product) => [product.name, ...product.packs]));

function ledgerKeywords(entry: LedgerEntry): PrintedKeywords {
  const sentences: string[] = [];
  for (const line of entry.lines) {
    for (const sentence of line.split(/(?<=\.)\s+/)) {
      const parsed = parseKeywordTokens([sentence]);
      if (parsed.unknown.length > 0 || Object.keys(parsed.keywords).length === 0) break;
      sentences.push(sentence);
    }
  }
  const keywords = parseKeywordTokens(sentences).keywords;
  return entry.sailingSuccess ? { ...keywords, sailingSuccess: entry.sailingSuccess } : keywords;
}

// Cards whose text came from Hall of Beorn take the ledger text. The core-set cards of the starter lists keep
// RingsDB's marked-up text (the card screen renders it); their ledger entries are still compared.
export function applyPrinted(cards: readonly Card[], ledger: Ledger): { cards: Card[]; differences: Difference[] } {
  const differences: Difference[] = [];
  const out = cards.map((card) => {
    const a = ledger.byKey.get(keyOf(card.code, "A"));
    const b = ledger.byKey.get(keyOf(card.code, "B"));
    if (!a && !b) return card;
    const front = a ? splitFront(a) : { text: card.text, shadow: card.shadowText };
    const sourceFront = [card.text, card.shadowText].filter((part): part is string => !!part).join("\n");
    const sourceBack = card.back?.text ?? null;
    const compare = (key: string, ledgerLines: readonly string[], source: string | null) => {
      const left = ledgerLines.flatMap((line) => loose(line));
      const right = loose(source);
      if (left.join(" ") === right.join(" ")) return;
      differences.push({ key, ledger: left.filter((line) => !right.includes(line)), source: right.filter((line) => !left.includes(line)) });
    };
    if (a) compare(keyOf(card.code, "A"), a.lines, sourceFront);
    if (b) compare(keyOf(card.code, "B"), b.lines, sourceBack);
    // A card whose text came from Hall of Beorn takes the ledger text: the box cards (the Fellowship's MEC109 printing, and
    // every campaign, quest, encounter, boon and burden card). A deck-legal player card keeps its RingsDB text.
    if (card.deckLegal && !card.printings.some((printing) => printing.pack === "TFotR")) return card;
    const backText = b ? (b.lines.length > 0 ? b.lines.join("\n") : null) : (card.back?.text ?? null);
    const back = b || card.back ? { name: card.back?.name ?? null, text: backText, questPoints: card.back?.questPoints ?? null, stage: card.back?.stage ?? null } : null;
    // A quest stage is played on its side B, so its keywords (Sailing) are read from that side too.
    const sea = a && LEDGER_KEYWORD_PACKS.has(a.printing) ? { keywords: { ...(card.keywords ?? {}), ...ledgerKeywords(a), ...(card.type === "quest" && b ? ledgerKeywords(b) : {}) } } : {};
    return {
      ...card,
      ...sea,
      text: front.text,
      shadowText: front.shadow,
      back,
      timings: [...timingLabels(front.text, isKeywordLine, card.type === "campaign"), ...timingLabels(backText, isKeywordLine, card.type === "campaign"), ...(front.shadow ? ["shadow"] : [])],
    };
  });
  return { cards: out, differences };
}
