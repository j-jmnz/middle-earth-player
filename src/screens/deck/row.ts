// A `decks` row as it lies in user.db, read without trust: a backup file brings the rows in (src/screens/settings/web/backup-db.ts), so a column may hold text
// that is not JSON or JSON of another shape. The deck store reads every row through this, and a restore refuses a file with a row that does not pass.
import { z } from "zod";

// A value no JSON text parses to.
const NOT_JSON = Symbol("not JSON");

function parsedJson(text: unknown): unknown {
  if (typeof text !== "string") return NOT_JSON;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return NOT_JSON;
  }
}

/** A column that holds JSON text of the shape `inner`. */
export function jsonColumn<T extends z.ZodType>(inner: T) {
  return z.preprocess(parsedJson, inner);
}

// A deck holds tens of cards; the bounds only keep a crafted row from being read as a deck.
const deckCard = z.object({ code: z.string().min(1).max(32), count: z.number().int().min(0).max(999) });
const deckCards = z.array(deckCard).max(2000);

const deckRow = z.object({
  id: z.string().min(1),
  name: z.string(),
  heroes: jsonColumn(z.array(z.string().max(32)).max(100)),
  cards: jsonColumn(deckCards),
  side: jsonColumn(deckCards),
  updatedAt: z.number().nullable(),
});

export type SavedDeckRow = z.infer<typeof deckRow>;

/** The deck a raw row holds (its JSON columns still text), or null when the row does not read as a deck. */
export function deckOfRow(raw: unknown): SavedDeckRow | null {
  const read = deckRow.safeParse(raw);
  return read.success ? read.data : null;
}
