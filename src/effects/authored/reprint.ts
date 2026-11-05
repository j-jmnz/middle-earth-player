import type { Ledger } from "../../catalog/active-text.ts";
import type { Effect } from "../../catalog/boundary.ts";
import { selfNamed } from "../../catalog/self-named.ts";

// The records of a ledger line, taken again by another line with the same printed text: a card printed again in a later product (Forest Gate 01100 and 41012,
// Calphon 11028 and 110013) or a sentence a card prints twice (the two sides of a Campaign Expansion ship). A copy keeps the source record and changes its
// card code, its ledger line ids and its id, whose number is the one the line has on the target: the source's number moved by how far the target's line stands
// from the source's among the records of that timing (their order is the printed order, front, side B, then the shadow). A copy is refused, when the module loads, if
// the copy would take an id that is in use. Each copied record keeps the line pairs it was copied by (`copiedLines`) and its source (`copySource`), and
// src/effects/copies.test.ts refuses a pair whose two ledger lines differ once normalized (keywords stripped, each card's own name read as {self}), so a
// ledger edit cannot keep a stale copy, and a source record that names its own card by code in any field, or by name when the target card is named otherwise, since a copy changes only the code, the line ids and the id (a same-named reprint keeps a name that is still right). The check is a test, not
// a load-time throw, so this module does not import the ledger JSON and the Node scripts that load the effects (effects:open, card-smoke, the fixture writer) run.
export type Copy = { readonly copy: readonly (readonly [from: string, to: string])[] };

type Options = {
  // Records the sources are found in besides the list itself (another file's, when the source card is written there).
  readonly pool?: readonly Effect[];
};

/** One line's records taken by another line: `copyLine("11081:A:5", "110137:A:5")`. */
export function copyLine(from: string, to: string): Copy {
  return { copy: [[from, to]] };
}

/** The same positions of two cards: `copyLines("11027", "11030", "B:2", "B:3", "B:4")`. */
export function copyLines(fromCode: string, toCode: string, ...positions: readonly string[]): Copy {
  return { copy: positions.map((position) => [`${fromCode}:${position}`, `${toCode}:${position}`] as const) };
}

const isCopy = (item: Effect | Copy): item is Copy => "copy" in item;

const LINE = /^(.+):([AB]):(\d+)$/;
const RECORD = /^(.+):([A-Za-z]+):(\d+)$/;

function parse(id: string, pattern: RegExp): { code: string; part: string; n: number } {
  const match = pattern.exec(id);
  if (!match) throw new Error(`Not a ledger line or record id: ${id}`);
  return { code: match[1] ?? "", part: match[2] ?? "", n: Number(match[3]) };
}

// The printed place of a line: front, then side B (the shadow line is the last of side A).
const placeOf = (lineId: string): number => {
  const { part, n } = parse(lineId, LINE);
  return (part === "A" ? 0 : 10_000) + n;
};

/** A ledger line's text, or undefined when the ledger has no such line. */
export function printedLine(ledger: Ledger, lineId: string): string | undefined {
  const { code, part, n } = parse(lineId, LINE);
  return ledger.get(code)?.find((side) => side.side === part)?.lines[n - 1]?.replaceAll("`", "'").trim();
}

/** One line pair a record was copied by. */
export type CopiedLine = { readonly from: string; readonly to: string };

const COPIED = new WeakMap<Effect, readonly CopiedLine[]>();
const SOURCES = new WeakMap<Effect, Effect>();

/** The line pairs a record was made by, when `withCopies` made it. */
export function copiedLines(record: Effect): readonly CopiedLine[] | undefined {
  return COPIED.get(record);
}

/** The record a copy was made from, when `withCopies` made it. */
export function copySource(record: Effect): Effect | undefined {
  return SOURCES.get(record);
}

/** A card's printed name by its code, as the copy check reads each card's own name as {self}. */
export type NameOf = (code: string) => string | undefined;

/**
 * Why a pair may not be copied under this ledger, or null when its two lines read the same with each card's own name as {self}. A source record that
 * names its own card in any field is refused too when the target card has another name, and when it holds the source's card code in any field: a copy changes
 * only the code, the line ids and the id, so the name or code would stay the source card's. A reprint under the same name keeps a name that is still right.
 */
export function copyMismatch(ledger: Ledger, pair: CopiedLine, nameOf: NameOf, source: Effect): string | null {
  const from = printedLine(ledger, pair.from);
  const to = printedLine(ledger, pair.to);
  if (from === undefined || to === undefined) return `The printed-text ledger has no line ${from === undefined ? pair.from : pair.to}`;
  const fromName = nameOf(parse(pair.from, LINE).code);
  const toName = nameOf(parse(pair.to, LINE).code);
  if (fromName === undefined || toName === undefined) return `No card name for ${fromName === undefined ? pair.from : pair.to}`;
  if (selfNamed(fromName, from) !== selfNamed(toName, to)) return `Cannot copy ${pair.from} to ${pair.to}: "${from}" is not "${to}"`;
  const { id, cardCode, lines, ...fields } = source;
  if (fromName.toLowerCase() !== toName.toLowerCase() && JSON.stringify(fields).toLowerCase().includes(fromName.toLowerCase())) return `Cannot copy ${source.id} to ${pair.to}: the record names its own card "${fromName}"`;
  const fromCode = parse(pair.from, LINE).code;
  const toCode = parse(pair.to, LINE).code;
  if (fromCode !== toCode && JSON.stringify(fields).includes(`"${fromCode}"`)) return `Cannot copy ${source.id} to ${pair.to}: the record names its own card by code "${fromCode}"`;
  return null;
}

// The record's printed place, with its position in the list as the tiebreak, as the rank of the record among its card's records of its timing.
// A rank sees only the records of `list`: a copy's number is right only when the card's records of that timing are all in this file's list (plus
// `pool`). A card whose records of one timing live in several files must not be copied this way; the global id-uniqueness test catches a
// collision, not a wrong number.
function rankIn(record: Effect, list: readonly Effect[]): number {
  const same = list.map((other, at) => ({ other, at })).filter(({ other }) => other.cardCode === record.cardCode && other.timing === record.timing);
  const place = (entry: { other: Effect }): number => Math.min(...entry.other.lines.map(placeOf));
  same.sort((a, b) => place(a) - place(b) || a.at - b.at);
  return same.findIndex(({ other }) => other === record) + 1;
}

// `items` is a list of records with copies among them; the copies are replaced, in place, by the records they make.
export function withCopies(items: readonly (Effect | Copy)[], options: Options = {}): Effect[] {
  const own = items.filter((item): item is Effect => !isCopy(item));
  const pool = [...(options.pool ?? []), ...own];

  const made = new Map<Copy, { source: Effect; record: Effect }[]>();
  for (const item of items) {
    if (!isCopy(item)) continue;
    const map = new Map(item.copy);
    const sources = pool.filter((record) => record.lines.some((line) => map.has(line)));
    for (const [from] of item.copy) if (!sources.some((record) => record.lines.includes(from))) throw new Error(`No record to copy for ${from}`);
    made.set(
      item,
      sources.map((source) => {
        const lines = source.lines.map((line) => map.get(line) ?? "");
        if (lines.includes("")) throw new Error(`${source.id} names lines the copy does not take: ${source.lines.join(", ")}`);
        const cardCode = parse(lines[0] ?? "", LINE).code;
        if (lines.some((line) => parse(line, LINE).code !== cardCode)) throw new Error(`${source.id} would be copied to more than one card`);
        return { source, record: { ...source, cardCode, lines } };
      }),
    );
  }

  // The number each copy takes among its target's records.
  const everyone = [...own, ...[...made.values()].flatMap((list) => list.map(({ record }) => record))];
  const taken = new Set(own.map((record) => record.id));
  for (const list of made.values()) {
    for (const entry of list) {
      const { source, record } = entry;
      const from = parse(source.id, RECORD);
      const number = from.n + rankIn(record, everyone) - rankIn(source, pool);
      const id = `${record.cardCode}:${record.timing}:${number}`;
      if (number < 1 || taken.has(id)) throw new Error(`Cannot copy ${source.id} to ${record.lines.join(", ")}: the record id ${id} is not free`);
      taken.add(id);
      entry.record = { ...record, id };
      everyone[everyone.indexOf(record)] = entry.record;
    }
  }
  for (const list of made.values()) {
    for (const { source, record } of list) {
      COPIED.set(record, source.lines.map((from, at) => ({ from, to: record.lines[at] ?? "" })));
      SOURCES.set(record, source);
    }
  }
  return items.flatMap((item) => (isCopy(item) ? (made.get(item) ?? []).map(({ record }) => record) : [item]));
}

// A whole card printed again has the same lines, so the same records: those of `fromCode` with the code in the record id, the card code and the ledger line ids changed to `toCode`'s.
export function reprint(records: readonly Effect[], fromCode: string, toCode: string): Effect[] {
  const found = records.filter((record) => record.cardCode === fromCode);
  if (found.length === 0) throw new Error(`No record to reprint for ${fromCode}`);
  const lines = [...new Set(found.flatMap((record) => record.lines))];
  const swap = (line: string): string => `${toCode}${line.slice(fromCode.length)}`;
  return withCopies([{ copy: lines.map((line) => [line, swap(line)] as const) }], { pool: found });
}
