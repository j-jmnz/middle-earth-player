import type { Ask } from "../asks.ts";

// The choice words of The Steward's Fear (against-the-shadow part 4), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-stewards-fear --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-stewards-fear` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {};
