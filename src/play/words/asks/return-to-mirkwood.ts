import type { Ask } from "../asks.ts";

// The choice words of Return to Mirkwood (shadows-of-mirkwood part 6), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario return-to-mirkwood --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=return-to-mirkwood` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {};
