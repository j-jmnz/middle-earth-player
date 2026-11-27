// The hand-off of an Undo made on a result screen (the Resolution, a standalone game's outcome) to the table it returns to. The result
// screen's store takes the move back and holds the moment ("Taken back" and the move's words); the table is a new screen with a new
// store, so it opens on that moment: no quest screen over it, the banner up, and the table's own answers held (store.ts, `landing`).
// A landing is for one game at one length of its log and lasts a few seconds, so a table opened later is an ordinary resume.
import type { TableMoment } from "../../play/store/store";

type Undone = Extract<TableMoment, { kind: "undone" }>;

const LASTS_MS = 10_000;

let landing: { id: string; moves: number; at: number; moment: Undone } | null = null;

/** Remembers the Undo a result screen just made: `moves` is the length of the game's log after it. */
export function landOnUndo(id: string, moves: number, moment: TableMoment | null, now: number = Date.now()): void {
  landing = moment?.kind === "undone" ? { id, moves, at: now, moment } : null;
}

/** The moment the table of this game opens on, or undefined: nothing was taken back from a result screen just now. */
export function landingFor(id: string, moves: number, now: number = Date.now()): Undone | undefined {
  return landing && landing.id === id && landing.moves === moves && now - landing.at < LASTS_MS ? landing.moment : undefined;
}
