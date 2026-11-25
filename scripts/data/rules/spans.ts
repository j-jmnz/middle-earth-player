import { z } from "zod";

import type { ExtractedDoc } from "./extract.ts";
import type { RuleEntry } from "../../../src/catalog/rule-entry.ts";

// data/rules/index.json is curated by hand: each rule id is a span of one document, bounded by two exact quotes.
// `from` opens the span and `to` closes it, both read from the extracted text of one page column. A span that runs
// on into later columns names where it ends in `through`. There is no heading heuristic: a quote that is not found
// verbatim, in order, fails the build.
export const spanSchema = z.strictObject({
  // A card erratum of the FAQ is `faq.errata.<card code or slug>`.
  id: z.string().regex(/^(?:(?:rr|ltp|mec108|mec109|mec112|mec113|tdom|dcce|emce|faq|campaign-log|easy-mode|decklist|hon|wor|trg|bts|sotm|dwd|hob|ats|rm|hrd)|faq\.errata)\.[a-z0-9][a-z0-9-]*$/),
  doc: z.string().min(1),
  page: z.number().int().positive(),
  column: z.number().int().positive(),
  from: z.string().min(1),
  to: z.string().min(1),
  through: z.strictObject({ page: z.number().int().positive(), column: z.number().int().positive() }).optional(),
  title: z.string().min(1),
  terms: z.array(z.string().min(1)).optional(),
});
export type Span = z.infer<typeof spanSchema>;
export const indexSchema = z.array(spanSchema);

// The built span's shape is the app's (src/catalog/rule-entry.ts), so the build and the phone read one type.
export type { RuleEntry };

type Hit = { start: number; end: number };

// The quote's words in order, with any whitespace (a line break included) between them.
function pattern(quote: string): RegExp {
  const words = quote.trim().split(/\s+/).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(words.join("\\s+"), "g");
}

function hits(text: string, quote: string): Hit[] {
  const out: Hit[] = [];
  for (const match of text.matchAll(pattern(quote))) out.push({ start: match.index, end: match.index + match[0].length });
  return out;
}

type Unit = { page: number; column: number; text: string };

function unitsOf(doc: ExtractedDoc): Unit[] {
  return doc.pages.flatMap((page) => page.columns.map((text, at) => ({ page: page.number, column: at + 1, text })));
}

// Returns the text of the span, or throws with the span id and the quote that was not found.
export function extractSpan(span: Span, doc: ExtractedDoc): string {
  const units = unitsOf(doc);
  const startAt = units.findIndex((unit) => unit.page === span.page && unit.column === span.column);
  const end = span.through ?? { page: span.page, column: span.column };
  const endAt = units.findIndex((unit) => unit.page === end.page && unit.column === end.column);
  const first = units[startAt];
  const last = units[endAt];
  if (!first) throw new Error(`${span.id}: ${span.doc} has no page ${span.page} column ${span.column}`);
  if (!last || endAt < startAt) throw new Error(`${span.id}: the span ends before it starts`);
  const opened = hits(first.text, span.from);
  if (opened.length !== 1) throw new Error(`${span.id}: from-quote ${JSON.stringify(span.from)} is found ${opened.length} times on ${span.doc} p${span.page} c${span.column}`);
  const open = opened[0] as Hit;
  const closes = hits(last.text, span.to).filter((hit) => (startAt === endAt ? hit.start >= open.start && hit.end >= open.end : true));
  const close = closes[0];
  if (!close) throw new Error(`${span.id}: to-quote ${JSON.stringify(span.to)} is not found after the from-quote on ${span.doc} p${end.page} c${end.column}`);
  if (startAt === endAt) return first.text.slice(open.start, close.end).trim();
  const middle = units.slice(startAt + 1, endAt).map((unit) => unit.text);
  return [first.text.slice(open.start), ...middle, last.text.slice(0, close.end)].join("\n\n").trim();
}

export function buildEntries(index: readonly Span[], docs: readonly ExtractedDoc[]): RuleEntry[] {
  const byDoc = new Map(docs.map((doc) => [doc.doc, doc]));
  const seen = new Set<string>();
  return index.map((span) => {
    if (seen.has(span.id)) throw new Error(`data/rules/index.json repeats ${span.id}`);
    seen.add(span.id);
    const doc = byDoc.get(span.doc);
    if (!doc) throw new Error(`${span.id}: no document ${span.doc}`);
    return { id: span.id, doc: span.doc, page: span.page, column: span.column, title: span.title, text: extractSpan(span, doc), terms: span.terms ?? [span.title.toLowerCase()] };
  });
}
