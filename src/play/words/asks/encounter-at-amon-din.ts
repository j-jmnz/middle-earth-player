import type { Ask } from "../asks.ts";

// The choice words of Encounter at Amon Dîn (against-the-shadow part 6), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario encounter-at-amon-din --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=encounter-at-amon-din` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {};
