import type { Ask } from "../asks.ts";

// The choice words of A Journey to Rhosgobel (shadows-of-mirkwood part 3), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario a-journey-to-rhosgobel --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=a-journey-to-rhosgobel` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {};
