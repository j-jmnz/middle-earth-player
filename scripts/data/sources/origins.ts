import type { SourceRecord } from "./fetch.ts";

// Where a source's content comes from, and under what licence. data/sources.json is written by `pnpm data sync` (a record is
// replaced whole by its adapter), so what a person declares is kept here and sync copies it into the record. A source with no
// entry is official (docs/brief.md, Data sources, Fan-made content), and its record carries no origin field.
export const FAN_MADE_PUBLISHERS = {
  // User statement, 2026-11-23: A Long-extended Party gave written permission for this app, no commercial use. No ALeP card, scenario or picture is in
  // the repository yet; the entry exists so that later content has its licence. The Semi-official Errata & FAQ page that data/printed cites is a place
  // official rulings were read, not a content source.
  alep: {
    name: "A Long-extended Party",
    licence: "written permission from the publisher for this app, no commercial use",
    statedBy: "user statement, 2026-11-23",
  },
} as const satisfies Record<string, { name: string; licence: string; statedBy: string }>;
export type PublisherId = keyof typeof FAN_MADE_PUBLISHERS;

// A source id to the id of its fan-made publisher. Empty: every source is official.
export const SOURCE_PUBLISHERS: Readonly<Record<string, string>> = {};

/** The fields sync adds to the record of source `id`: none for an official source. */
export function declaredOrigin(id: string, publishers: Readonly<Record<string, string>> = SOURCE_PUBLISHERS): Pick<SourceRecord, "origin" | "publisher" | "licence"> {
  const publisherId = publishers[id];
  if (publisherId === undefined) return {};
  const publisher = (FAN_MADE_PUBLISHERS as Record<string, { name: string; licence: string } | undefined>)[publisherId];
  if (publisher === undefined) throw new Error(`Source ${id} names the publisher ${publisherId}, which scripts/data/sources/origins.ts does not declare`);
  return { origin: "fan-made", publisher: publisher.name, licence: publisher.licence };
}

/** What the data build refuses: an origin that is neither official nor fan-made, and a fan-made source with no publisher or no licence on record. */
export function sourceOriginProblems(sources: Readonly<Record<string, Pick<SourceRecord, "origin" | "publisher" | "licence">>>): string[] {
  const problems: string[] = [];
  for (const [id, record] of Object.entries(sources)) {
    if (record.origin === undefined || record.origin === "official") continue;
    if (record.origin !== "fan-made") problems.push(`${id}: origin ${JSON.stringify(record.origin)} is neither official nor fan-made`);
    else if ((record.publisher ?? "").trim() === "") problems.push(`${id}: a fan-made source needs its publisher's name`);
    else if ((record.licence ?? "").trim() === "") problems.push(`${id}: a fan-made source needs its licence in data/sources.json (publisher ${record.publisher})`);
  }
  return problems;
}
