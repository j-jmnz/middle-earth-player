// The rows of a backup file that the app reads without a parser of their own (docs/brief.md, Persistence and shipping): `runs` (History reads every row) and
// `settings` (one JSON value per key). A restore reads each one here, on the copy, and refuses the file when one does not pass; `decks` rows are read by the
// deck store's own reader (src/screens/deck/row.ts). No database here, so a test reaches it.
import { z } from "zod";

import { deckOfRow, jsonColumn } from "../../deck/row";

// A number column: a time, a count or a score, or null where a back-filled row could not know it.
const wholeOrNull = z.number().nullable();
const flag = z.union([z.literal(0), z.literal(1)]);
// A column that is null or JSON text: null stays null.
const nullOr = <T extends z.ZodType>(inner: T) => z.union([z.null(), inner]);

// The columns of `runs` as SQLite names them (src/screens/data/user-schema.ts, runs).
const runRow = z.object({
  id: z.string().min(1),
  kind: z.enum(["campaign", "standalone"]),
  ref_id: z.string(),
  campaign_id: z.string().nullable(),
  box: z.string(),
  scenario_id: z.string(),
  result: z.enum(["won", "lost"]),
  loss_cause: z.string().nullable(),
  seat_count: z.union([z.literal(1), z.literal(2)]),
  heroes: jsonColumn(z.array(z.array(z.string()))),
  rounds: wholeOrNull,
  threats: nullOr(jsonColumn(z.array(z.number()).nullable())),
  victory_points: wholeOrNull,
  score: wholeOrNull,
  reward: nullOr(jsonColumn(z.array(z.string()).nullable())),
  started_at: wholeOrNull,
  ended_at: wholeOrNull,
  active_ms: wholeOrNull,
  engine_version: wholeOrNull,
  backfilled: flag,
  rebased: flag,
});

const settingRow = z.object({ key: z.string(), value: jsonColumn(z.json()) });

/** Whether a raw `decks` row (its JSON columns still text, `updatedAt` and `position` as selected) reads as a deck. */
export function deckRowReads(raw: { position?: unknown }): boolean {
  return deckOfRow(raw) !== null && wholeOrNull.safeParse(raw.position ?? null).success;
}

/** Whether a raw `runs` row reads as a run. */
export function runRowReads(raw: unknown): boolean {
  return runRow.safeParse(raw).success;
}

/** Whether a raw `settings` row holds a key and a JSON value. */
export function settingRowReads(raw: unknown): boolean {
  return settingRow.safeParse(raw).success;
}
